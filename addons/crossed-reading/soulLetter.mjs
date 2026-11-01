// A bounded writing exercise, not another astrological interpretation engine.
// The only personalised input is vocabulary returned by the canonical reading.
import { buildSymbolicReading } from './symbolicReading.mjs';

export const SOUL_LETTER_METHOD_VERSION = 'lastro-symbolic-soul-letter@1.0.0';
const SCHEMA = 'lastro.soul_letter@1.0.0';
const NOTICE = 'Cette lettre symbolique s’inspire du repère lunaire. Elle propose des pistes libres, sans établir votre personnalité ni votre histoire.';

// These are literary invitations illustrating the existing words, not new
// meanings attributed to signs, houses, nakshatras, periods or Chinese pillars.
const INVITATIONS = Object.freeze({
  Aries: Object.freeze([
    'Commencer n’oblige pas à décider de tout le parcours. Essayer un outil, prendre un autre chemin à pied, proposer un moment pour se retrouver : un geste simple donne déjà une forme à une idée.',
    'Le mouvement laisse aussi la liberté de s’arrêter, de regarder ce qui a changé et de reprendre autrement. Une initiative n’a pas besoin de devenir une course pour compter ; son rythme peut rester choisi.',
    'Quel premier pas aimeriez-vous tenter, en gardant la liberté d’en mesurer la suite ?'
  ]),
  Taurus: Object.freeze([
    'Tout ce qui dure n’a pas besoin de rester immobile. Retrouver un même lieu, entretenir un objet ou préserver un rendez-vous : la stabilité peut tenir dans des gestes ordinaires, choisis plutôt que maintenus par habitude.',
    'La fidélité peut se traduire par une attention renouvelée. Revenir vers ce qui compte, lui accorder du temps, en ajuster les formes : ces gestes laissent une place au changement sans effacer la continuité.',
    'Quel repère avez-vous envie d’entretenir, en lui laissant de la place pour évoluer ?'
  ]),
  Gemini: Object.freeze([
    'Lire quelques lignes par curiosité, demander comment fonctionne un objet, écouter quelqu’un raconter ce qu’il connaît : apprendre peut commencer tout près de soi. Une idée n’a pas besoin d’être maîtrisée pour éveiller une conversation.',
    'Dans un échange, il reste de la place pour une hésitation, une précision ou un silence. Chercher ensemble n’oblige pas à conclure ensemble ; une différence de point de vue peut rester une question ouverte.',
    'Quelle idée aimeriez-vous explorer avec quelqu’un, simplement pour le plaisir de mieux la comprendre ?'
  ]),
  Cancer: Object.freeze([
    'Une musique, une odeur ou la lumière d’un lieu peuvent retenir l’attention sans demander aussitôt une explication. Il est possible de s’attarder sur ce détail, ou de le laisser passer, sans en faire le signe de toute une histoire.',
    'L’attachement peut se manifester à petite échelle : prendre soin d’un objet, accorder du temps à une présence, garder un rendez-vous choisi. Ce qui compte n’a pas toujours besoin d’une grande déclaration pour trouver sa place.',
    'À quoi aimeriez-vous accorder une attention plus douce, sans vous obliger à tout expliquer ?'
  ]),
  Leo: Object.freeze([
    'Présenter une création encore imparfaite, exprimer un choix sans le minimiser, accepter que sa contribution soit nommée : il existe des manières simples de prendre une place visible. Elles ne demandent pas de tenir toute la scène.',
    'La fierté peut rester attachée à quelque chose de précis : un objet réparé, une étape achevée, une proposition enfin partagée. Reconnaître ce geste ne demande ni comparaison ni applaudissement ; cela peut simplement marquer qu’il a compté.',
    'Quelle contribution aimeriez-vous reconnaître comme la vôtre, sans attendre qu’elle soit parfaite ?'
  ]),
  Virgo: Object.freeze([
    'Séparer une information vérifiée d’une impression, choisir ce qui mérite une réponse, laisser un détail secondaire de côté : le discernement peut prendre une forme très concrète. Tout examiner n’oblige pas à tout conserver.',
    'La discrétion laisse aussi le choix de ce qui sera partagé. Expliquer un point utile ne demande pas d’exposer toute une situation ; une limite claire peut tenir en peu de mots, sans justification interminable.',
    'Quelle distinction vous aiderait à y voir plus clair, en respectant ce que vous préférez garder pour vous ?'
  ]),
  Libra: Object.freeze([
    'Un dialogue laisse une place à deux voix. Dire ce que l’on souhaite, puis écouter la réponse, peut en changer le rythme sans demander d’aboutir immédiatement au même avis. L’accord n’est pas la seule issue possible d’un échange.',
    'L’équilibre se cherche aussi dans des détails : répartir le temps de parole, reprendre un point resté ouvert, vérifier qu’une demande a été comprise. Ces gestes donnent une forme au dialogue sans garantir son résultat.',
    'Dans quelle conversation aimeriez-vous faire une place plus nette à chacune des voix, y compris la vôtre ?'
  ]),
  Scorpio: Object.freeze([
    'Chercher ce qui manque dans une explication n’impose pas d’y découvrir un secret. Reprendre une source, vérifier un détail, demander une précision : une recherche peut avancer sans transformer chaque silence en indice.',
    'La réserve laisse le choix du moment et de la personne avec qui partager une question. Tout dévoiler n’est pas nécessaire pour poursuivre une recherche ; il reste permis de s’arrêter sans forcer une conclusion.',
    'Quelle question aimeriez-vous approfondir, en gardant la liberté de choisir ce que vous en partagerez ?'
  ]),
  Sagittarius: Object.freeze([
    'Dire clairement une préférence, reconnaître un désaccord, préciser ce que l’on ne sait pas : la franchise peut prendre des formes simples. Elle n’oblige pas à tout dire d’un seul trait, ni à faire de chaque échange une confrontation.',
    'La rectitude peut se chercher dans l’accord entre une parole et un geste. Une promesse limitée à ce que l’on choisit réellement d’assumer laisse moins à expliquer qu’une assurance trop large ; elle garde aussi une place à la réponse.',
    'Que souhaiteriez-vous exprimer plus franchement, sans confondre clarté et dureté ?'
  ]),
  Capricorn: Object.freeze([
    'Préparer les outils avant de commencer, répartir une tâche en étapes, garder du temps pour un ajustement : l’organisation peut alléger un geste plutôt que remplir toute la journée. Un ordre choisi reste modifiable.',
    'La patience n’impose pas de poursuivre sans pause. Attendre qu’un matériau sèche, qu’une idée se précise ou qu’une réponse arrive laisse aussi du temps disponible. Tout ne gagne pas à être accéléré, même lorsqu’un calendrier existe.',
    'À quelle chose aimeriez-vous donner une étape claire et un peu plus de temps ?'
  ]),
  Aquarius: Object.freeze([
    'Revenir à une question ne signifie pas devoir répéter la même réponse. Examiner un premier essai, comparer deux solutions, laisser reposer une idée : la réflexion peut modifier le chemin sans effacer ce qui a déjà été tenté.',
    'La persévérance peut tenir dans ces retours mesurés. Reprendre un objet à réparer ou une difficulté à comprendre laisse la possibilité de changer de méthode ; continuer ne demande pas de refaire exactement le même geste.',
    'Quelle question aimeriez-vous reprendre, en laissant à la prochaine réponse la liberté d’être différente ?'
  ]),
  Pisces: Object.freeze([
    'Une impression peut attirer l’attention avant de trouver une explication. Un choix de couleur, un morceau de musique ou l’atmosphère d’un lieu offrent une matière à explorer, sans transformer ce premier ressenti en certitude.',
    'La sensibilité peut s’exercer dans l’attention aux nuances : écouter ce qui change d’un son à l’autre, observer une lumière, laisser une image résonner. Il reste possible d’accueillir cette expérience sans la traduire aussitôt en conclusion.',
    'Quelle impression aimeriez-vous explorer pour elle-même, en lui laissant la liberté de rester ouverte ?'
  ])
});

const paragraph = (id,text,context=null) => ({id,kind:'writing_invitation',text,
  proofRefs:context?[...context.proofRefs]:[],sourceRefs:context?[...context.sourceRefs]:[],
  ruleRefs:context?[...context.ruleRefs]:[],methodRefs:[SOUL_LETTER_METHOD_VERSION]});

export function buildSoulLetter(report) {
  // Rebuild canonically: report.symbolic, arbitrary prose, labels, source URLs
  // and an alleged prebuilt letter never enter this writing contract.
  const reading=buildSymbolicReading(report);
  const context=reading.sections.find(item=>item.id==='sidereal-moon')?.vocabulary;
  const common={schema:SCHEMA,methodVersion:SOUL_LETTER_METHOD_VERSION,
    title:'Lettre d’âme',badge:'Écriture symbolique',notice:NOTICE,
    scope:'literary_exercise_from_existing_lunar_vocabulary',frame:'jyotish-sidereal-lahiri',
    crossTraditionSynthesis:'not_licensed'};
  if(!context) return {...common,status:'unavailable',reason:'CERTAIN_SIDEREAL_MOON_REQUIRED',
    salutation:null,basis:null,paragraphs:[],proofRefs:[],sourceRefs:[],ruleRefs:[],sources:[]};
  const lines=INVITATIONS[context.signId];
  // A new lexical entry must be given an explicit writing invitation before it
  // can be presented here. No generic paragraph silently substitutes for it.
  if(!lines) throw Object.assign(new TypeError('SOUL_LETTER_VOCABULARY_UNSUPPORTED'),{code:'SOUL_LETTER_VOCABULARY_UNSUPPORTED'});
  const basis={signId:context.signId,signName:context.signName,words:context.words,
    text:`Point de départ : la Lune sidérale Lahiri en ${context.signName} ; vocabulaire traditionnel « ${context.words} ».`,
    proofRefs:[...context.proofRefs],sourceRefs:[...context.sourceRefs],ruleRefs:[...context.ruleRefs]};
  return {...common,status:'available',salutation:'À vous,',basis,
    paragraphs:lines.map((text,index)=>paragraph(['first-invitation','second-invitation','open-question'][index],text,context)),
    proofRefs:[...context.proofRefs],sourceRefs:[...context.sourceRefs],ruleRefs:[...context.ruleRefs],
    sources:reading.sources.filter(source=>context.sourceRefs.includes(source.id)).map(source=>({...source}))};
}

function escape(value) { return String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;'); }
export function renderSoulLetter(report) {
  const letter=buildSoulLetter(report);
  if(letter.status!=='available') return '';
  return `<section aria-labelledby="soul-letter-title" class="soul-letter"><span class="tag">${escape(letter.badge)}</span><h2 id="soul-letter-title">${escape(letter.title)}</h2><p class="note">${escape(letter.notice)}</p><p class="note soul-letter-basis">${escape(letter.basis.text)}</p><div class="soul-letter-body"><p class="soul-letter-salutation">${escape(letter.salutation)}</p>${letter.paragraphs.map(p=>`<p data-reading-kind="${escape(p.kind)}">${escape(p.text)}</p>`).join('')}</div><p class="note soul-letter-source">Vocabulaire : ${letter.sources.map(source=>`<a href="${escape(source.url)}" target="_blank" rel="noopener noreferrer">${escape(source.title)}</a> · ${escape(source.locator)}`).join(' ; ')}. Les propositions d’écriture ne sont pas des interprétations supplémentaires de cette source.</p></section>`;
}
