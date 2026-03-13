# Cadre canonique des phases — Pipeline RAG v2

> Version figee : 2026-03-13 v2

## Principe directeur

Le pipeline ne confond jamais : faire entrer / stabiliser / autoriser / produire.

Les phases ciblent des roles R* (metier/surface). Les controles G* (gouvernance transverse) peuvent intervenir a chaque phase mais ne remplacent jamais la fonction de la phase.

## Matrice des phases

| Phase | Nom canonique | Finalite | Nature | Peut ecrire ? | Peut muter la ressource canonique ? | Ecritures autorisees | Interdit principal | Bloque l'aval ? |
|-------|--------------|----------|--------|---------------|-------------------------------------|----------------------|-------------------|-----------------|
| 1 | Ingestion securisee | Faire entrer sans corruption | technique | oui | oui, dans le perimetre d'entree | stockage, sync, provenance, logs | toute ecriture metier | oui |
| 1.5 | Normalisation canonique | Stabiliser l'identite | structurelle | oui | oui, sur identite et mapping | identite canonique, alias, mapping, anti-collision | toute generation metier | oui |
| 1.6 | Admissibilite metier | Decider l'usage aval | decisionnelle | oui | non sur le fond, oui sur les verdicts | verdicts, scores, limitations, policies | toute generation / publication | oui |
| 2 | Exploitation metier controlee | Produire les artefacts metier | metier | oui | non sur la source brute, oui sur les derives | drafts, sections, contracts, assemblage metier | contourner 1 / 1.5 / 1.6 | oui |

## Loi de pipeline

**Loi absolue** : aucune phase superieure ne peut ecrire sur le plan metier si la phase precedente n'a pas valide son propre contrat.

**Formulation durcie** : aucune phase n'a le droit de compenser une phase amont non validee par une logique locale.

Consequences :
- Aucune phase > 1 sans provenance validee et securite d'ecriture validee
- Aucune phase > 1.5 sans identite canonique stabilisee
- Aucune phase > 1.6 sans admissibilite metier explicite
- Aucune phase 2 sans bornes de role et bornes de preuve

## Invariants de gouvernance

### A — Non-destruction
Aucune phase avant la phase 2 ne doit produire d'ecriture metier destructrice.

### B — Provenance d'abord
Toute ressource utilisee par l'aval doit avoir une provenance lisible et verifiable.

### C — Identite avant usage
Une ressource non canonisee ne peut jamais etre utilisee comme source metier.

### D — Admissibilite avant production
Une ressource non admise ne peut jamais alimenter un role R0-R8.

### E — Separation des responsabilites
- Phase 1 ne decide pas du role
- Phase 1.5 ne redige pas
- Phase 1.6 ne publie pas
- Phase 2 ne revalide pas la securite d'entree a la place de la phase 1

### F — Pas de correction silencieuse
Toute ambiguite, collision, insuffisance ou contradiction doit produire soit une resolution explicite, soit un blocage explicite, soit une escalade explicite. Jamais une absorption silencieuse.

### G — Decision tracable
Toute decision bloquante ou autorisante prise en phase 1.5, 1.6 ou 2 doit etre :
- attribuable
- justifiable
- horodatee
- rejouable au minimum en audit

## Contrats de passage entre phases

### 1 -> 1.5
La phase 1.5 ne demarre que si :
- la ressource est ingeree
- la provenance minimale existe
- la ressource n'est pas quarantined/rejected
- la securite d'ecriture est validee

### 1.5 -> 1.6
La phase 1.6 ne demarre que si :
- la ressource a une identite canonique
- les alias sont stabilises
- les collisions sont resolues ou explicitement escaladees
- le mapping technique minimal est coherent

### 1.6 -> 2
La phase 2 ne demarre que si :
- les roles autorises sont definis
- les limites d'usage sont definies
- les blocs interdits sont connus
- le statut final n'est pas BLOCKED
- `phase2Eligible = true`

## Statuts canoniques par phase

| Phase | Statuts |
|-------|---------|
| 1 | `passed`, `failed`, `quarantined` |
| 1.5 | `normalized`, `normalized_with_warnings`, `blocked`, `quarantined`, `review_required` |
| 1.6 | `admissible`, `admissible_with_limits`, `enrichment_required`, `blocked` |
| 2 | `draft_generated`, `partial`, `qa_required`, `ready_for_publish`, `blocked` |

## Formulation canonique

Phase 1 protege l'entree.
Phase 1.5 protege l'identite.
Phase 1.6 protege l'usage.
Phase 2 borne la production et transforme seulement ce qui a ete admis.

## Gouvernance G* par phase

| Phase | G1 Purete | G2 Diversite | G3 Anti-cannib | G4 Publication | G5 Review |
|-------|-----------|-------------|----------------|----------------|-----------|
| 1 | purete technique provenance | — | — | droit d'entrer dans le systeme | provenance douteuse / collision |
| 1.5 | normalisation ne change pas la nature metier | — | collisions familles / destinations | — | normalisation impossible / ambigue |
| 1.6 | alignement role unique | quasi-duplicate detection | frontieres inter-roles | — | conflit / doute → arbitrage humain |
| 2 | toutes gates actives | toutes gates actives | toutes gates actives | decide PASS/REVIEW/BLOCK | toutes gates actives |

## Matrice courte canonique

| Phase | Fonction | Peut ecrire contenu final ? | Cible un role R* ? | Soumise a G* ? |
|-------|----------|----------------------------|--------------------|-|
| 1 | ingestion securisee | non | non | oui |
| 1.5 | normalisation canonique | non | non | oui |
| 1.6 | admissibilite metier | non | oui (qualification) | oui |
| 2 | generation metier ciblee | oui | oui | oui |

## Regles de dependance canoniques

1. Phase 1 est le verrou de provenance et d'ecriture.
2. Phase 1.5 est le verrou de structure canonique.
3. Phase 1.6 est le verrou d'admissibilite metier.
4. Phase 2 n'existe que pour une matiere deja admissible vers un role R*.
5. Aucune couche G* n'est une destination editoriale.
6. Aucune phase ne doit creer un faux role pour resoudre un probleme de gouvernance.

## Raffinements canoniques R1-R4

### R1 — Distinction ecriture / mutation canonique

Avoir le droit d'ecrire ne signifie pas avoir le droit de muter la ressource canonique.
Les phases 1, 1.5, 1.6 et 2 peuvent toutes produire des ecritures, mais seules certaines peuvent modifier directement l'etat canonique de reference, et uniquement dans leur perimetre autorise.

| Phase | Peut ecrire | Peut muter la ressource canonique |
|-------|-------------|-----------------------------------|
| 1 | oui | oui, dans le perimetre d'entree |
| 1.5 | oui | oui, sur identite et mapping |
| 1.6 | oui | non sur le fond, oui sur les verdicts |
| 2 | oui | non sur la source brute, oui sur les derives |

### R2 — Distinction statut / passage

Le statut d'une phase decrit le verdict de cette phase sur son propre contrat.
L'autorisation de passage decrit les actions reellement autorisees pour la phase suivante.
Aucun aval ne doit inferer ses droits uniquement a partir du statut.

Implementation : `phase2Eligible`, `publicationEligible`, `allowedNextPhaseActions[]`

### R3 — Primary generation eligibility (5 niveaux)

Une ressource admissible pour un role n'est pas automatiquement eligible comme base primaire de generation.

| Niveau | Signification |
|--------|--------------|
| `primary_publication_candidate` | source principale + publication directe |
| `primary_generation_allowed` | source principale de generation |
| `primary_generation_limited` | source principale avec limites |
| `support_only` | support/enrichissement uniquement |
| `blocked` | interdit |

Implementation : `primaryGenerationLevel` dans `RoleSufficiencySchema`

### R4 — Decision tracable (Invariant G)

Toute decision structurante prise a partir de la phase 1.5 doit etre attribuable, justifiable, horodatee, persistee et rejouable en audit.

Implementation : `DecisionTrace` (decisionId, decidedBy, decidedAt, pipelineVersion, rulesetVersion) dans `ReadinessRecord`

## Implementation

| Phase | State machine | Types | Service | Migration |
|-------|--------------|-------|---------|-----------|
| 1 | `rag-state.types.ts` (PHASE1_*) | `rag-contracts.types.ts` | `rag-foundation-gate.service.ts` | `20260314_foundation_gate.sql` |
| 1.5 | `rag-state.types.ts` (PHASE15_*) | `rag-contracts.types.ts` | `rag-normalization.service.ts` | `20260315_phase15_normalization.sql` |
| 1.6 | `rag-state.types.ts` (PHASE16_*) | `rag-readiness.types.ts` | `rag-admissibility-gate.service.ts` | `20260316_phase16_admissibility_gate.sql` |
| 2 | `rag-state.types.ts` (PHASE2_*) | `rag-exploitation.types.ts` | (a venir) | `20260317_phase2_exploitation.sql` |
