# Captures — page d'accueil publique (19 octobre 2026)

Captures de contrôle de l'intégration du nouveau texte d'accueil (hero + section
pédagogique). Elles servent de preuve visuelle pour la revue avant mise en ligne :
aucune de ces images n'est générée par un service externe, elles viennent du
serveur local (`node src/server.mjs`) rendu par Chrome 155 en mode headless, avec
des viewports réels imposés par CDP (`Emulation.setDeviceMetricsOverride`).

Langue forcée à `fr` via `localStorage.lastro_lang` (le navigateur de la machine
de capture est en anglais), sauf pour la capture `anglais`.

## Fichiers

| Fichier | Viewport | Échelle | Contenu |
|---|---|---|---|
| `accueil-1440-ecran.png` | 1440 × 1000 | 1 | Premier écran ordinateur : hero, bouton, début de la section pédagogique |
| `accueil-1440-page.png` | 1440 × 1000 | 1 | Page entière ordinateur (2057 px de haut) |
| `accueil-390-ecran.png` | 390 × 844 | 2 | Premier écran iPhone 12/13/14 |
| `accueil-390-page.png` | 390 × 844 | 1 | Page entière à 390 px |
| `accueil-375-ecran.png` | 375 × 812 | 2 | Premier écran iPhone SE 2/3 / 8 |
| `accueil-375-page.png` | 375 × 812 | 1 | Page entière à 375 px |
| `accueil-320-ecran.png` | 320 × 720 | 2 | Premier écran très étroit (iPhone SE 1re génération) |
| `accueil-320-page.png` | 320 × 720 | 1 | Page entière à 320 px |
| `accueil-1440-anglais.png` | 1440 × 1000 | 1 | Même page en anglais : la section pédagogique et le bouton français sont absents |

Les captures `-page` sont en échelle 1 pour rester légères ; les captures `-ecran`
sont en échelle 2 pour juger la typographie.

## Ce que ces captures permettent de vérifier

- Le titre est un H1 unique par page affichée, sur deux lignes, et le segment doré
  « le début de l'histoire » n'est jamais coupé en fin de ligne.
- L'ordre réel est : hero → bouton → section pédagogique → formulaire.
- Aucun débordement horizontal à 1440, 390, 375 ni 320 px
  (`documentElement.scrollWidth == innerWidth`, mesuré à chaque capture).
- Les cinq astres passent en deux colonnes au-dessus de 720 px, en une seule
  colonne en dessous.
- La phrase « Vous n'avez donc pas un seul signe : vous avez tout un thème à
  explorer. » est mise en avant, et la phrase de clôture est isolée en signature,
  sans encadré.
- En anglais, le contenu français n'apparaît pas ; le hero garde ses libellés
  anglais d'origine.

## Limites

- Ces captures ne testent pas le paiement, la génération de lecture, ni les
  autres langues que le français et l'anglais.
- Le rendu dépend des polices installées sur la machine de capture (Georgia pour
  le titrage) : les métriques exactes peuvent varier de quelques pixels ailleurs,
  sans changer les points ci-dessus.
