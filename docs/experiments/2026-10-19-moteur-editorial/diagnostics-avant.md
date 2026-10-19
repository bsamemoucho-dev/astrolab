# Diagnostics des textes déjà générés (aucune réécriture, aucun appel)

Mesures sur les deux dossiers existants. Elles servent de référence AVANT :
longueur, dépendance aux formulations sources, nouveauté, répétitions entre chapitres.

Sources comparées : 20 formulations transmises par les règles.

## gpt-4o-mini

| Chapitre | Mots | Recopie max (mots) | Nouveauté |
|---|---:|---:|---:|
| `internal_tensions` | 115 | 12 | 1 |
| `supporting_resources` | 129 | 8 | 1 |
| `major_aspects` | 259 | 15 | 1 |

- `internal_tensions` × `major_aspects` : n-grammes 0.11, recouvrement lexical **0.37**
- `supporting_resources` × `major_aspects` : n-grammes 0.09, recouvrement lexical **0.32**

## claude-sonnet-5-5

| Chapitre | Mots | Recopie max (mots) | Nouveauté |
|---|---:|---:|---:|
| `internal_tensions` | 192 | 9 | 1 |
| `supporting_resources` | 157 | 8 | 1 |
| `major_aspects` | 315 | 8 | 1 |

- `supporting_resources` × `major_aspects` : n-grammes 0, recouvrement lexical **0.28**
- `internal_tensions` × `major_aspects` : n-grammes 0, recouvrement lexical **0.24**

