# Matrice canonique des roles R0-R9

> Version figee : 2026-03-13

## Statut de ce document

Ce document est la norme de classification canonique. Il gouverne :
la qualification des surfaces, les frontieres metier entre pages, les contracts,
les gates de purete, la generation, la validation, le maillage,
la prevention de cannibalisation, la gouvernance QA.

Aucun prompt, agent, script, pipeline, assembler, brief ou contract
ne doit redefinir librement un role hors de cette matrice.

Cette matrice est amont de la Phase 2.

## Lois canoniques globales

### Loi 1 — Unicite de promesse centrale
Chaque role repond a une promesse centrale unique.
Si une surface repond simultanement a deux promesses centrales, elle est mal qualifiee.

### Loi 2 — Un artefact = un role principal
Tout artefact porte un seul role principal. Les autres roles ne peuvent exister que comme maillage, renvoi, CTA secondaire ou support de comprehension.

### Loi 3 — Separation surface / intention / execution
Un role est defini par 3 axes : surface (ce que l'utilisateur voit), intention dominante (besoin a satisfaire), mode d'execution (navigation, information, decision, transaction, diagnostic, gouvernance).

### Loi 4 — Purete avant richesse
Une page moins riche mais pure est meilleure qu'une page plus riche mais hybride.

### Loi 5 — Aucun role aval ne corrige un role amont
La matrice est respectee dans l'ordre : Phase 1 (securite matiere) → Phase 1.5 (identite canonique) → Phase 1.6 (admissibilite metier) → Phase 2 (generation de role).

## Table compacte

| Role | Nom | Promesse centrale | Intent | Dep. vehicule | Nature |
|------|-----|-------------------|--------|---------------|--------|
| R0 | Home | orienter globalement | orientation | faible | hub global |
| R1 | Router gamme | trouver la bonne gamme pour le bon vehicule | navigation compatibilite | forte | navigation |
| R2 | Product | acheter la bonne reference compatible | transaction | tres forte | listing commercial |
| R3 | Conseils | intervenir correctement | agir | faible/moyenne | how-to |
| R4 | Reference | comprendre ce que c'est | comprendre | faible | glossaire |
| R5 | Diagnostic | orienter un symptome | orienter | faible/moyenne | diagnostic |
| R6 | Guide d'achat | choisir sans erreur | choisir | moyenne | pre-achat |
| R7 | Brand | explorer une marque | navigation marque | moyenne | hub marque |
| R8 | Vehicle | contextualiser un vehicule | contextualiser | tres forte | fiche vehicule |
| R9 | Gouvernance | controler purete et collision | controle | variable | QA (non editorial) |

## Definitions detaillees

### R0 — HOME / HUB GLOBAL

- **Promesse** : orienter l'utilisateur vers le bon parcours
- **Question** : "Par ou commencer selon mon besoin ?"
- **Est** : porte d'entree, repartiteur de parcours, hub de decouverte
- **N'est pas** : page gamme, page produit, page symptome, guide d'achat detaille
- **Sources admissibles** : navigation globale, hubs metier, categories majeures, constructeurs
- **Sorties autorisees** : hero d'orientation, acces catalogue/marque/diagnostic/blog/recherche
- **Sorties interdites** : procedure detaillee, diagnostic detaille, transaction fine, definition technique profonde
- **Bascule** : besoin gamme → R1, besoin marque → R7, besoin vehicule → R8, besoin symptome → R5, besoin achat guide → R6

### R1 — ROUTER GAMME / NAVIGATION COMPATIBILITE

- **Promesse** : aider a trouver la bonne gamme pour le bon vehicule
- **Question** : "Ou trouver la bonne piece pour mon vehicule ?"
- **Est** : page gamme, orientation vers compatibilite, selection, anti-erreur de filtrage, transition vers R2
- **N'est pas** : page produit, page achat guide, page how-to, page definition, page diagnostic
- **Sources admissibles** : gamme canonique, criteres de compatibilite, variantes, familles, taxonomie produit
- **Sorties autorisees** : hero gamme, selector, compat reminders, variantes, FAQ selection, safe table legere, renvois R3/R4/R5/R6
- **Sorties interdites** : prix detailles, stock, panier, procedure, symptomes, glossaire profond
- **Gates de purete** : zero procedure, zero symptom-first, zero definition-first, zero conversion produit directe dominante
- **Bascule** : besoin transactionnel exact → R2, besoin definition → R4, besoin symptome → R5, besoin comment remplacer → R3, besoin comment choisir → R6

### R2 — PRODUCT / LISTING TRANSACTIONNEL

- **Promesse** : permettre de consulter et acheter les references compatibles
- **Question** : "Quelles references puis-je acheter maintenant pour ce vehicule exact ?"
- **Est** : listing compatible, comparaison produit, prix, disponibilite, conversion
- **N'est pas** : routeur, guide d'achat editorial, tutoriel, diagnostic, fiche encyclopedique
- **Sources admissibles** : catalogue, compatibilite exacte, prix, stock, shipping, OEM/OES/equivalences, scoring produit
- **Sorties autorisees** : cartes produit, prix, stock, CTA panier, micro specs, badges, FAQ achat, reassurance
- **Sorties interdites** : tutoriel complet, arbre diagnostic, definition pure, guide editorial long, navigation large gamme
- **Gates de purete** : presence transactionnelle obligatoire, pas de langage R3/R4/R5 dominant

### R3 — CONSEILS / HOW-TO / ENTRETIEN / REMPLACEMENT

- **Promesse** : aider a intervenir correctement sur une piece
- **Question** : "Comment intervenir correctement, en securite, sur cette piece ?"
- **Est** : how-to, conseil pratique, entretien, remplacement, controle simple, post-intervention
- **N'est pas** : guide d'achat, definition, diagnostic profond, page produit
- **Sources admissibles** : procedure validee, securite, outils, etapes, anti-erreurs, controles post-montage, FAQ maintenance
- **Sorties autorisees** : sections procedurales, checklists, tables de controle, FAQ maintenance, CTA soft vers R1, liens R4/R5/R6
- **Sorties interdites** : prix/stock/panier, comparatif achat dominant, symptome-first dominant, definition-first dominante
- **Gates de purete** : si besoin = "choisir quoi acheter" → sortie R3, si besoin = "comprendre ce que c'est" → sortie R3, si besoin = "identifier une panne" → sortie R3

### R4 — REFERENCE / DEFINITION / GLOSSAIRE

- **Promesse** : expliquer ce qu'est un terme ou un organe et eviter les confusions
- **Question** : "Qu'est-ce que c'est exactement ?"
- **Est** : definition, role mecanique, composition, limites, terminologie, confusions frequentes
- **N'est pas** : achat guide, how-to, diagnostic, page produit, page vehicule exacte
- **Sources admissibles** : definitions validees, composition, role, nomenclature, distinctions OEM/OES/IAM, confusions, FAQ encyclopedique
- **Sorties autorisees** : definition, composition, role, confusions, glossaire, FAQ encyclopedique, renvois R1/R3/R5/R6
- **Sorties interdites** : prix, stock, tutoriel, arbre de symptomes, checklist achat dominante
- **Gates de purete** : zero procedure dominante, zero diagnostic dominant, zero transactionnel dominant

### R5 — DIAGNOSTIC / SYMPTOMES / ORIENTATION PANNE

- **Promesse** : aider a orienter un symptome et prioriser les verifications
- **Question** : "Que peut signifier ce symptome et que verifier d'abord ?"
- **Est** : symptome-first, orientation prudente, tri d'hypotheses, quick checks, risque/securite, decision d'escalade
- **N'est pas** : tutoriel, definition, guide d'achat, page produit, diagnostic atelier individualise complet
- **Sources admissibles** : symptomes, hypotheses, quick checks, safety gates, niveaux d'urgence, causes plausibles
- **Sorties autorisees** : symptomes, hypotheses, verifications rapides, actions immediates prudentes, signaux d'arret, renvois R3/R4/R1
- **Sorties interdites** : depose/repose detaillee, glossaire dominant, choix qualite/budget, conversion transactionnelle
- **Gates de purete** : zero pas-a-pas dominant, zero definition dominante, zero guide achat dominant

### R6 — GUIDE D'ACHAT

- **Promesse** : aider a choisir la bonne piece sans erreur avant commande
- **Question** : "Comment choisir et commander la bonne piece sans me tromper ?"
- **Est** : guide d'achat, aide a la decision, compatibilite pre-achat, niveaux de qualite, pieges d'achat, criteres de comparaison, checklists avant commande
- **N'est pas** : tutoriel, diagnostic, definition, page produit listing, FAQ support generique
- **Sources admissibles** : selection.criteria, checklist achat, quality tiers, anti_mistakes, cross_gammes, budgets editoriaux, FAQ achat
- **Sorties autorisees** : decision blocks, quality tables, compatibility checklist, pitfalls, brands guide, when pro, FAQ achat, CTA vers R1
- **Sorties interdites** : pas a pas, symptomes/causes, glossaire dominant, panier/stock detaille
- **Gates de purete** : zero R3 dominant, zero R5 dominant, zero R4 dominant, zero R2 dominant

### R7 — BRAND / CONSTRUCTEUR / HUB MARQUE

- **Promesse** : aider a naviguer dans l'univers pieces d'une marque
- **Question** : "Comment explorer les pieces et vehicules lies a cette marque ?"
- **Est** : page constructeur, porte d'entree marque, hub de navigation, regroupement modeles/pieces/recherches
- **N'est pas** : fiche vehicule, page produit, how-to, guide d'achat, diagnostic
- **Sources admissibles** : marque, modeles, pieces populaires, top recherches, hubs compatibilite, blocs about brand
- **Sorties autorisees** : hero marque, top pieces, top vehicules, top recherches, raccourcis, compat guide leger, FAQ marque
- **Sorties interdites** : procedure, symptomes, listing transactionnel detaille, fiche vehicule profonde

### R8 — VEHICLE / FICHE VEHICULE

- **Promesse** : donner la fiche contexte d'un vehicule pour guider entretien, recherche et compatibilite
- **Question** : "Quelles sont les caracteristiques utiles de ce vehicule ?"
- **Est** : identite vehicule, motorisations, periodes, specificites, reperes entretien, points de vigilance, contexte de compatibilite
- **N'est pas** : produit, guide d'achat, tutoriel detaille, diagnostic complet, hub marque
- **Sources admissibles** : donnees vehicule, motorisations, periodes, known issues bornes, usure courante, reperes entretien, liaisons gammes
- **Sorties autorisees** : identite, versions, motorisations, reperes entretien, pieces courantes, liens R1/R3/R5/R6
- **Sorties interdites** : panier, prix, procedure longue, symptome-first dominant, brand hub

### R9 — GOUVERNANCE / QA / DIVERSITE / NON-CANNIBALISATION

- **Promesse** : garantir qu'un contenu est distinct, pur, tracable et publiable
- **Question** : "Ce contenu peut-il exister sans collision ni derive de role ?"
- **Nature** : surface systeme / controle — PAS un role editorial public
- **Est** : controle, review, anti-duplication, anti-cannibalisation, fingerprinting, nearest-neighbor, blocage publication, gouvernance qualite
- **N'est pas** : role editorial public, page metier principale, surface de contenu final
- **Sources admissibles** : fingerprints, versioning, neighbors, overlap scores, forbidden vocab, gates, decisions QA
- **Sorties autorisees** : PASS/REVIEW/BLOCK, score diversite, score purete, exclusions sitemap, file de review, logs QA
- **Sorties interdites** : contenu public metier principal

## Matrice de frontieres fortes

| Paire | Distinction |
|-------|------------|
| R3 vs R6 | R3 = comment intervenir / R6 = comment choisir avant achat |
| R4 vs R5 | R4 = qu'est-ce que c'est / R5 = que signifie ce symptome |
| R1 vs R2 | R1 = trouver la bonne gamme / R2 = acheter les references exactes |
| R7 vs R8 | R7 = univers marque / R8 = identite d'un vehicule precis |
| R5 vs outil | R5 = orientation generique / si vehicule+km+historique+contexte croise → hors role editorial, vers outil |

## Table de migration legacy → canonique

| Legacy / ancien nom | Canonique |
|---------------------|-----------|
| R3_guide_achat | R6 |
| R3 guide achat | R6 |
| guide achat R3 | R6 |
| purchase guide R3 | R6 |
| blog guide achat semantiquement pre-achat | R6 |
| R3_conseils | R3 |
| howto / conseil / remplacement | R3 |
| glossary / reference | R4 |
| diagnostic / observable / symptome | R5 |
| brand / constructeur | R7 |
| vehicle sheet / fiche vehicule | R8 |
| diversity / fingerprint / anti duplicate | R9 |

**Regle dure** : le systeme ne doit plus produire de nouvelle ambiguite du type R3_guide_achat, R6_support, R5_conseil.

## Correspondance code actuelle

| Canonique | RoleId enum | PageType (legacy) | Notes |
|-----------|------------|-------------------|-------|
| R0 Home | R0_HOME | — | Pas de PageType |
| R1 Router | R1_ROUTER | R1_pieces | OK |
| R2 Product | R2_PRODUCT | — | OK |
| R3 Conseils | R3_CONSEILS | R3_conseils | OK |
| R3 Guide (how-to) | R3_GUIDE | R3_guide_howto | Renomme 2026-03-13 (ex R3_guide_achat) |
| R4 Reference | R4_REFERENCE | R4_reference | OK |
| R5 Diagnostic | R5_DIAGNOSTIC | R5_diagnostic | OK |
| R6 Guide achat | R6_GUIDE_ACHAT | R6_guide_achat | OK |
| R7 Brand | R7_BRAND | — | Ajout 2026-03-11 |
| R8 Vehicle | R8_VEHICLE | — | Ajout 2026-03 |
| R9 Gouvernance | R9_GOVERNANCE | — | PAS de PageType (non editorial) |

## Lien avec les phases pipeline

Phase 1 garantit la matiere sure.
Phase 1.5 garantit l'identite canonique de la matiere.
Phase 1.6 garantit que cette matiere peut servir un role donne sans derive.
Phase 2 genere un role canonique a partir d'une matiere deja validee.

**Loi de verrouillage** : aucune phase > 1 ne peut ecrire du contenu si la provenance, l'identite canonique et l'admissibilite metier ne sont pas validees.
