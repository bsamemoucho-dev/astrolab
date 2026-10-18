# Ticket 2 — Clarifier PERSONAL_TRANSIT.natalHouse

Statut : suivi local, aucune correction de cette ambiguïté dans cette expérience.

Le champ natalHouse décrit la maison du point natal contacté ; il ne prouve pas la maison natale de la planète transitante. Le writer peut recevoir un numéro sans disposer d'une preuve NATAL_BODY_HOUSE autorisée concernant le point auquel il se rapporte. Il ne faut ni autoriser n'importe quel corps dans cette maison, ni transformer le rejet en avertissement.

Proposition distincte : documenter/typer explicitement le rôle `natalPointHouse` ; référencer la preuve atomique du point natal correspondant lorsqu'elle existe et qu'elle est fiable ; séparer toute éventuelle maison natale du corps transitant. Pour les angles ou points non planétaires, définir le type de preuve approprié plutôt que réutiliser un type planète/maison par commodité. En absence de preuve, conserver une interprétation dépourvue de placement de maison non justifié.

Critères d'acceptation : point natal correct et mauvais corps ; deux points partageant une maison ; ascendant/MC ; heure inconnue ou approximative ; scope du packet et de la section ; absence de preuve ; aucune modification du calcul ou des permissions pour contourner un rejet. Tester migration et compatibilité avant déploiement.
