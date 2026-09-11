// Limitation de débit en mémoire du processus.
//
// Pourquoi un module commun : quatre points d'entrée non authentifiés déclenchent
// une action sortante ou coûteuse — inscrire (envoi d'un code), se connecter,
// redemander un lien de lecture (envoi d'un e-mail), chercher un lieu (appel à un
// service externe). Chacun avait sa règle ou aucune ; quatre compteurs recopiés
// finissent toujours par diverger, et c'est celui qu'on a oublié de recopier qui
// reste ouvert.
//
// Ce que ça borne : un client qui insiste. Ce que ça ne borne pas : quelqu'un qui
// change d'adresse source ou d'adresse visée à chaque essai. La limitation vit en
// mémoire du processus : un redémarrage la remet à zéro, et deux instances ne la
// partagent pas. C'est suffisant pour empêcher un abus massif depuis un seul
// client, pas pour fonder une facturation — même compromis assumé que la
// limitation de renvoi de code (voir `src/auth/verification.mjs`).

export function createRateLimiter({ windowMs, max, maxKeys = 2000, now = Date.now } = {}) {
  if (!Number.isFinite(windowMs) || windowMs <= 0) {
    throw new TypeError("createRateLimiter : windowMs doit être une durée positive.");
  }
  if (!Number.isFinite(max) || max <= 0) {
    throw new TypeError("createRateLimiter : max doit être un entier positif.");
  }

  // clé -> instants des coups enregistrés, du plus ancien au plus récent.
  const coups = new Map();

  function purge(instant) {
    for (const [cle, instants] of coups) {
      const recents = instants.filter((moment) => instant - moment < windowMs);
      if (recents.length === 0) {
        coups.delete(cle);
      } else if (recents.length !== instants.length) {
        coups.set(cle, recents);
      }
    }
    // Garde-fou mémoire : un attaquant qui invente une clé par requête ferait
    // grossir la table sans fin. Au-delà du plafond, on oublie les clés les plus
    // anciennes — les plus récentes sont celles qui protègent encore.
    while (coups.size > maxKeys) {
      const plusAncienne = coups.keys().next().value;
      coups.delete(plusAncienne);
    }
  }

  return {
    // Consulte sans enregistrer : l'appelant décide quand un essai compte. Un
    // essai refusé par la limitation ne doit pas prolonger la limitation.
    check(cle) {
      const instant = now();
      purge(instant);
      const instants = coups.get(String(cle)) ?? [];
      if (instants.length < max) {
        return { limited: false, retryAfterMs: 0 };
      }
      return {
        limited: true,
        retryAfterMs: Math.max(0, windowMs - (instant - instants[0]))
      };
    },
    hit(cle) {
      const instant = now();
      purge(instant);
      const nom = String(cle);
      const instants = coups.get(nom) ?? [];
      // Supprimer avant de réinsérer place la clé en fin de table : la purge par
      // plafond oublie ainsi la moins récemment utilisée, pas la première arrivée.
      coups.delete(nom);
      coups.set(nom, [...instants, instant]);
    },
    // Utilisée pour effacer une clé après un succès (une connexion réussie ne
    // doit pas laisser un compteur d'échecs derrière elle) et par les tests.
    reset(cle) {
      if (cle === undefined) {
        coups.clear();
        return;
      }
      coups.delete(String(cle));
    }
  };
}

// En-tête normalisé pour une réponse 429 : le client sait quand réessayer.
export function retryAfterSeconds(retryAfterMs) {
  return String(Math.max(1, Math.ceil(retryAfterMs / 1000)));
}

// Adresse du client derrière le proxy de la plateforme.
//
// On prend la DERNIÈRE entrée de `X-Forwarded-For` : c'est celle ajoutée par le
// proxy, donc celle qu'un client ne peut pas fabriquer en envoyant son propre
// en-tête. Prendre la première laisserait n'importe qui choisir sa clé de
// limitation (et donc contourner la limite en la changeant à chaque requête).
export function clientAddress(req) {
  const transmis = String(req?.headers?.["x-forwarded-for"] ?? "");
  const entrees = transmis
    .split(",")
    .map((entree) => entree.trim())
    .filter(Boolean);
  if (entrees.length) {
    return entrees[entrees.length - 1];
  }
  return req?.socket?.remoteAddress ?? "inconnu";
}

// Adresse réduite à son préfixe réseau (/24 en IPv4, /48 en IPv6), pour le
// journal.
//
// Pourquoi masquer : une lecture offerte doit être visible dans les journaux
// (c'est ainsi qu'on repère une exploitation), mais un journal n'a pas à
// conserver l'adresse complète d'un client — c'est une donnée personnelle, et le
// préfixe suffit à distinguer « un seul poste insiste » de « des postes
// différents ». Trois octets et non deux : un /16 confondrait deux attaquants
// distincts du même opérateur.
export function maskClientAddress(adresse) {
  const valeur = String(adresse ?? "").trim();
  // Une adresse IPv4 présentée en IPv6 (« ::ffff:1.2.3.4 ») reste une IPv4.
  const mappee = valeur.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  const brut = mappee ? mappee[1] : valeur;
  const octets = brut.split(".");
  if (octets.length === 4 && octets.every((octet) => /^\d+$/.test(octet))) {
    return `${octets[0]}.${octets[1]}.${octets[2]}.x`;
  }
  if (brut.includes(":")) {
    const groupes = brut.split(":").filter(Boolean);
    return groupes.length >= 3 ? `${groupes.slice(0, 3).join(":")}::` : "adresse locale";
  }
  return "adresse inconnue";
}

// Vrai pour la machine elle-même : sert à n'accorder le mode gratuit sans
// paiement configuré qu'à un appel local (voir la route des lectures).
export function isLoopbackAddress(adresse) {
  const brut = String(adresse ?? "").trim().replace(/^::ffff:/i, "");
  return brut === "::1" || brut === "localhost" || brut.startsWith("127.");
}

