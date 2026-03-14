# QUALITY CONSTRAINTS

Tout contenu produit doit respecter les 5 couches de gouvernance :

## G1 — Purete de role
- Chaque surface ne porte qu'UNE promesse centrale
- Aucun melange de promesses entre roles
- Les termes interdits du role ne doivent jamais apparaitre dans la sortie

## G2 — Diversite
- Eviter repetition et clones internes entre sections
- Varier le vocabulaire et les angles
- Chaque section apporte une valeur unique

## G3 — Anti-cannibalisation
- Ne pas produire de contenu qui chevauche un autre role
- Verifier le Jaccard overlap avec les surfaces existantes (seuil max 0.12)
- Si collision detectee : signaler en warning_flags, ne pas publier

## G4 — Publication control
- HORS PERIMETRE du prompt de generation
- Le prompt ne decide JAMAIS de publier
- Seul le validator peut emettre un avis publication (REVIEW par defaut)

## G5 — Escalade
- Si ambiguite non tranchable : return status = ESCALATE
- Si signaux contradictoires entre evidence et contrat : ESCALATE
- Ne jamais trancher seul un cas limite

## Regles transversales

- Mieux vaut bloquer proprement que produire faux
- Aucune claim sans evidence source
- Aucune extrapolation non prouvee
- Aucun melange de sources contradictoires sans signalement
