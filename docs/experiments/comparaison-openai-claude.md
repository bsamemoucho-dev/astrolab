# Comparaison gpt-4o-mini / claude-sonnet-5-5 — trois chapitres d'aspects

Même thème fictif, mêmes prompts, même découpage, mêmes garde-fous.
Deux runs : `docs/experiments/2026-10-18-chapitres-aspects/` (OpenAI) et
`docs/experiments/2026-10-19-chapitres-aspects-claude/` (Anthropic).

## Conditions

| | gpt-4o-mini | claude-sonnet-5-5 |
|---|---|---|
| Fournisseur / endpoint | `api.openai.com/v1` | `api.anthropic.com/v1` (couche de compatibilité OpenAI) |
| Invites (système + utilisateur) | identiques | identiques |
| Découpage | 1 + 1 + 2 = 4 appels | identique |
| Plafond de tokens par bloc | 1 692 / 1 400 / 1 988 / 2 000 | identiques |
| Température | 0,35 (reprise 0,2) | **non applicable** — paramètre déprécié pour ce modèle, omis |
| `response_format` | `json_object` | **omis** — refusé par la couche de compatibilité (HTTP 400) |
| Corrections | 0 | 0 |
| Troncatures | 0 | 0 |

Les deux différences techniques (température, `response_format`) sont imposées
par l'API Anthropic, pas par une décision de ma part. Les prompts sont, eux,
strictement identiques : la comparaison porte sur le modèle, pas sur la consigne.

## Résultats mesurés

| | gpt-4o-mini | claude-sonnet-5-5 |
|---|---|---|
| Mots produits (hors phrases factuelles du serveur) | 503 (115 + 129 + 259) | **664** (192 + 157 + 315) |
| Thèmes repris avec ≥ 4 mots identiques | 15 / 18 | **12 / 18** |
| Plus longue suite copiée mot pour mot | **15 mots** | **9 mots** |
| Occurrences de « vous » (adresse au lecteur) | 0 | **22** |
| Validation factuelle | 0 anomalie | 0 anomalie |
| Coût des 4 appels | 0,0013 USD | **0,0360 USD** (≈ ×28) |

## Ce que change le modèle, concrètement

**Ce qui s'améliore chez Claude**

- **Il s'adresse au lecteur.** « Une première dynamique touche *votre* rapport à
  l'action » au lieu de « La dynamique entre Mars et Saturne indique… ». C'est la
  différence la plus visible : 22 « vous » contre zéro.
- **Il explique les fonctions symboliques** sans qu'on le lui demande : « Mars
  représente votre élan, votre façon de vous engager ; Saturne apporte la mesure,
  l'exigence et le sens de la limite ». gpt-4o-mini nommait les planètes sans les
  situer.
- **Il ajoute une lecture, pas seulement une paraphrase** : « le prendre comme
  une ressource, et non comme une garantie, vous permet de mieux en profiter ».
- **Il organise `aspects majeurs` par familles** (« effort et ses limites »,
  « confiance et ouverture », « parole et lien ») là où gpt-4o-mini enchaînait
  les aspects un par un.

**Ce qui ne change pas**

- **La recopie des thèmes demeure** : 12 des 18 thèmes transmis reviennent avec
  au moins quatre mots identiques, jusqu'à neuf mots d'affilée. Le modèle
  reformule mieux, il ne s'affranchit pas du matériau fourni.
- **`aspects majeurs` reste une redite** des deux autres chapitres, avec les
  mêmes thèmes et presque les mêmes phrases. Sans mémoire inter-chapitres, le
  problème est structurel, pas lié au modèle.
- **Le coût ×28** ne se justifie que si le gain éditorial est jugé réel par un
  lecteur — et non par une mesure.

## Conclusion

Le modèle n'est pas le levier principal, mais il n'est pas neutre : à matériau
identique, Claude produit **32 % de texte en plus**, **s'adresse au lecteur** et
**recopie moins**. Le plafond de qualité reste fixé par ce que la couche
interprétative transmet : tant que les thèmes sont des phrases entières, le
rédacteur les reformule.

Deux chantiers restent donc devant, dans cet ordre :

1. **Changer la nature des thèmes** (angles courts plutôt que phrases) et
   interdire la reprise littérale de plus de cinq mots.
2. **Mémoire inter-chapitres**, ou fusion de `aspects majeurs` avec les deux
   chapitres de catégorie.
