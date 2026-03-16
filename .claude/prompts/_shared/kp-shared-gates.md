# QUALITY GATES — Keyword Planner (bloc partagé)

Gates communes à tous les keyword planners R1-R8 :

| Gate | Vérification | Seuil | Bloquant |
|------|-------------|-------|----------|
| RG1 | Toutes sections obligatoires ont des termes | 100% | OUI |
| RG2 | Aucun terme interdit cross-rôle | 0 violations | OUI |
| RG3 | Anti-cannibalisation Jaccard vs rôles voisins | < 0.12 | NON (warning) |
| RG4 | Min 2 termes primaires par section | ≥ 2 | NON |
| RG5 | Evidence suffisante pour sections conditionnelles | explicit_only | OUI |
| RG6 | Heading H2 unique par section | 100% | NON |
| RG7 | Score global minimum | ≥ 65 | NON |

Gates spécifiques par rôle (à ajouter dans l'agent) :
- R5 : SG1 safety gate (pièces critiques = caution HIGH minimum)
- R2 : fingerprint uniqueness gate
- R8 : vehicle identity delta gate
