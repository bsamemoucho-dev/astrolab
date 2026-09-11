// Lecture d'un PDF produit par le navigateur, page par page.
//
// Pourquoi : le document livré est un PDF, et je n'ai aucun moteur de rendu dans
// mon environnement (Chrome sans interface y est bloqué). Sans cet outil, je ne
// peux vérifier que des tests sur la CSS, jamais le fichier que le client reçoit
// réellement — ni la présence de l'annexe, ni la mise en page.
//
// Ce n'est pas un extracteur parfait : il décompresse les flux de contenu et
// applique les tables ToUnicode des polices pour reconstituer le texte, avec des
// retours à la ligne approximatifs. C'est suffisant pour vérifier un document.
//
//   node tools/inspect-pdf.mjs fichier.pdf
//   node tools/inspect-pdf.mjs fichier.pdf --page 9        # une seule page
//   node tools/inspect-pdf.mjs fichier.pdf --grep annexe   # cherche un motif
//   node tools/inspect-pdf.mjs fichier.pdf --apercu 200    # 200 caracteres par page

import { readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";

function parseObjects(buffer) {
  const texte = buffer.toString("latin1");
  const objets = new Map();
  const motif = /(\d+)\s+0\s+obj\b/g;
  let m;
  while ((m = motif.exec(texte)) !== null) {
    const numero = Number(m[1]);
    const fin = texte.indexOf("endobj", m.index);
    objets.set(numero, texte.slice(m.index + m[0].length, fin === -1 ? texte.length : fin));
  }
  return objets;
}

// Extraction binaire : on travaille sur le buffer pour ne pas abîmer les octets.
function extraireFlux(buffer) {
  const flux = [];
  let position = 0;
  while (true) {
    const debut = buffer.indexOf("stream", position);
    if (debut === -1) {
      break;
    }
    let contenu = debut + "stream".length;
    if (buffer[contenu] === 0x0d) contenu += 1;
    if (buffer[contenu] === 0x0a) contenu += 1;
    const fin = buffer.indexOf("endstream", contenu);
    if (fin === -1) {
      break;
    }
    let donnees = buffer.subarray(contenu, fin);
    // Un saut de ligne avant « endstream » fait partie du délimiteur.
    if (donnees[donnees.length - 1] === 0x0a) donnees = donnees.subarray(0, -1);
    if (donnees[donnees.length - 1] === 0x0d) donnees = donnees.subarray(0, -1);
    let clair = null;
    try {
      clair = inflateSync(donnees).toString("latin1");
    } catch {
      clair = null;
    }
    flux.push({ debut, clair, brut: donnees.toString("latin1") });
    // « endstream » contient « stream » : avancer d'un seul octet ferait
    // reconnaître le mot dans « endstream », sauterait le flux suivant et
    // tenterait de décompresser n'importe quoi (un flux sur 37 passait).
    position = fin + "endstream".length;
  }
  return flux;
}

function decouperEnObjets(buffer) {
  const objets = [];
  const motif = /(\d+)\s+0\s+obj/g;
  let m;
  while ((m = motif.exec(buffer.toString("latin1"))) !== null) {
    objets.push({ numero: Number(m[1]), debut: m.index });
  }
  const flux = extraireFlux(buffer);
  for (let i = 0; i < objets.length; i += 1) {
    const fin = i + 1 < objets.length ? objets[i + 1].debut : buffer.length;
    objets[i].corps = buffer.subarray(objets[i].debut, fin).toString("latin1");
    objets[i].flux = flux.filter((f) => f.debut > objets[i].debut && f.debut < fin);
  }
  return objets;
}

function analyserCMap(cmap) {
  const table = new Map();
  const lireHex = (hex) => {
    const propre = hex.replace(/[^0-9a-fA-F]/g, "");
    let sortie = "";
    for (let i = 0; i + 3 < propre.length + 1; i += 4) {
      sortie += String.fromCharCode(parseInt(propre.slice(i, i + 4), 16));
    }
    return sortie;
  };
  for (const bloc of cmap.match(/beginbfchar([\s\S]*?)endbfchar/g) ?? []) {
    for (const paire of bloc.matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>/g)) {
      table.set(parseInt(paire[1], 16), lireHex(paire[2]));
    }
  }
  for (const bloc of cmap.match(/beginbfrange([\s\S]*?)endbfrange/g) ?? []) {
    for (const ligne of bloc.split("\n")) {
      const simple = ligne.match(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>/);
      if (simple) {
        const debut = parseInt(simple[1], 16);
        const fin = parseInt(simple[2], 16);
        const base = parseInt(simple[3], 16);
        for (let code = debut; code <= fin && code - debut < 512; code += 1) {
          table.set(code, String.fromCharCode(base + (code - debut)));
        }
        continue;
      }
      const liste = ligne.match(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*\[([^\]]+)\]/);
      if (liste) {
        const debut = parseInt(liste[1], 16);
        const cibles = [...liste[3].matchAll(/<([0-9a-fA-F]+)>/g)].map((c) => lireHex(c[1]));
        cibles.forEach((cible, index) => table.set(debut + index, cible));
      }
    }
  }
  return table;
}

// « 002F0054 » → deux caractères dont les codes sont 0x00 0x2F ... : le
// décodeur attend une chaîne d'octets, pas la représentation hexadécimale.
function hexVersOctets(hex) {
  const propre = String(hex).replace(/[^0-9a-fA-F]/g, "");
  let sortie = "";
  for (let i = 0; i + 1 < propre.length; i += 2) {
    sortie += String.fromCharCode(parseInt(propre.slice(i, i + 2), 16));
  }
  return sortie;
}

function decoderChaine(octets, cmap) {
  if (!cmap || cmap.size === 0) {
    return octets;
  }
  let sortie = "";
  for (let i = 0; i + 1 < octets.length; i += 2) {
    const code = (octets.charCodeAt(i) << 8) | octets.charCodeAt(i + 1);
    sortie += cmap.get(code) ?? "";
  }
  return sortie;
}

function echapper(texte) {
  return texte
    .replace(/\\([nrtbf()\\])/g, (_, c) => ({ n: "\n", r: "\n", t: "\t", b: "", f: "" }[c] ?? c))
    .replace(/\\([0-7]{1,3})/g, (_, octal) => String.fromCharCode(parseInt(octal, 8)));
}

function texteDuFlux(contenu, polices) {
  const morceaux = [];
  let cmapCourant = null;
  let ligneCourante = null;

  // Un retour à la ligne n'est émis que si l'ORDONNÉE change : Chrome positionne
  // parfois chaque glyphe, et compter chaque positionnement produisait un
  // caractère par ligne.
  const gererOrdonnee = (y) => {
    if (!Number.isFinite(y)) {
      return;
    }
    if (ligneCourante === null || Math.abs(y - ligneCourante) > 1.5) {
      morceaux.push("\n");
      ligneCourante = y;
    }
  };

  const motif =
    /\/([A-Za-z0-9]+)\s+[\d.]+\s+Tf|\[((?:[^\][]|\\.)*)\]\s*TJ|(\((?:\\.|[^\\()])*\)|<[0-9a-fA-F\s]+>)\s*Tj|(-?[\d.]+)\s+(-?[\d.]+)\s+(?:Td|TD)|(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+Tm|(T\*)/g;

  let m;
  while ((m = motif.exec(contenu)) !== null) {
    if (m[1] !== undefined) {
      cmapCourant = polices.get(m[1]) ?? null;
      continue;
    }
    if (m[2] !== undefined) {
      for (const element of m[2].matchAll(/\((?:\.|[^\\()])*\)|<[0-9a-fA-F\s]+>|-?\d+(?:\.\d+)?/g)) {
        const valeur = element[0];
        if (valeur.startsWith("(")) {
          morceaux.push(decoderChaine(echapper(valeur.slice(1, -1)), cmapCourant));
        } else if (valeur.startsWith("<")) {
          morceaux.push(decoderChaine(hexVersOctets(valeur.slice(1, -1)), cmapCourant));
        } else if (Number(valeur) < -80) {
          morceaux.push(" ");
        }
      }
      continue;
    }
    if (m[3] !== undefined) {
      const jeton = m[3];
      morceaux.push(
        jeton.startsWith("<")
          ? decoderChaine(hexVersOctets(jeton.slice(1, -1)), cmapCourant)
          : decoderChaine(echapper(jeton.slice(1, -1)), cmapCourant)
      );
      continue;
    }
    if (m[4] !== undefined) {
      gererOrdonnee(Number(m[5]));
      continue;
    }
    if (m[6] !== undefined) {
      gererOrdonnee(Number(m[11]));
      continue;
    }
    if (m[12] !== undefined) {
      ligneCourante = null;
      morceaux.push("\n");
    }
  }

  return morceaux
    .join("")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{2,}/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

const args = process.argv.slice(2);
const chemin = args.find((a) => !a.startsWith("--"));
if (!chemin) {
  console.error("Usage : node tools/inspect-pdf.mjs fichier.pdf [--page N] [--grep motif] [--apercu N]");
  process.exit(2);
}
const pageDemandee = args.includes("--page") ? Number(args[args.indexOf("--page") + 1]) : null;
const motifCherche = args.includes("--grep") ? String(args[args.indexOf("--grep") + 1]).toLowerCase() : null;
const apercu = args.includes("--apercu") ? Number(args[args.indexOf("--apercu") + 1]) : 300;

const buffer = readFileSync(chemin);
const objets = decouperEnObjets(buffer);
const parNumero = new Map(objets.map((o) => [o.numero, o]));
const pages = objets.filter((o) => /\/Type\s*\/Page[^s]/.test(o.corps));

console.log(`${chemin}`);
console.log(`${pages.length} page(s)\n`);

const resultats = [];
for (const [index, page] of pages.entries()) {
  const references = [...page.corps.matchAll(/(\d+)\s+0\s+R/g)].map((r) => Number(r[1]));
  // Polices de la page : objet du dictionnaire /Font, puis objets police.
  const polices = new Map();
  const refPolice = page.corps.match(/\/Font\s*<<([^>]*)>>/);
  if (refPolice) {
    for (const police of refPolice[1].matchAll(/\/([A-Za-z0-9]+)\s+(\d+)\s+0\s+R/g)) {
      const objetPolice = parNumero.get(Number(police[2]));
      const refToUnicode = objetPolice?.corps.match(/\/ToUnicode\s+(\d+)\s+0\s+R/);
      const objetToUnicode = refToUnicode ? parNumero.get(Number(refToUnicode[1])) : null;
      const cmap = objetToUnicode?.flux?.[0]?.clair ? analyserCMap(objetToUnicode.flux[0].clair) : null;
      polices.set(police[1], cmap);
      if (args.includes("--polices")) {
        console.log(
          `  [police] /${police[1]} → objet ${police[2]} · ToUnicode ${refToUnicode ? refToUnicode[1] : "absent"}` +
            ` · flux ${objetToUnicode?.flux?.length ?? 0}` +
            ` · clair ${objetToUnicode?.flux?.[0]?.clair ? "oui" : "non"}` +
            ` · entrées ${cmap ? cmap.size : 0}`
        );
      }
    }
  }
  const contenus = [];
  const refContenu = page.corps.match(/\/Contents\s*(\[[^\]]*\]|\d+\s+0\s+R)/);
  if (refContenu) {
    for (const r of refContenu[1].matchAll(/(\d+)\s+0\s+R/g)) {
      const objetContenu = parNumero.get(Number(r[1]));
      for (const flux of objetContenu?.flux ?? []) {
        if (flux.clair) {
          contenus.push(flux.clair);
        }
      }
    }
  }
  const texte = contenus.map((contenu) => texteDuFlux(contenu, polices)).join("\n").trim();
  resultats.push({ page: index + 1, texte });
}

for (const { page, texte } of resultats) {
  if (pageDemandee && page !== pageDemandee) {
    continue;
  }
  const lignes = texte.split("\n").filter(Boolean);
  console.log(`=== page ${page} — ${texte.length} caractères, ${lignes.length} lignes ===`);
  if (motifCherche) {
    for (const ligne of lignes) {
      if (ligne.toLowerCase().includes(motifCherche)) {
        console.log(`  > ${ligne.slice(0, 160)}`);
      }
    }
  } else {
    console.log(lignes.join("\n").slice(0, apercu));
  }
  console.log("");
}
