# Cadre canonique des phases — Pipeline RAG v2

> Version figee : 2026-03-14 v4

## Principe directeur

Le pipeline ne confond jamais : faire entrer / stabiliser / autoriser / produire.

Les phases ciblent des roles R* (metier/surface). Les controles G* (gouvernance transverse) peuvent intervenir a chaque phase mais ne remplacent jamais la fonction de la phase.

## Matrice des phases

| Phase | Nom canonique | Finalite | Nature | Peut ecrire ? | Peut muter la ressource canonique ? | Ecritures autorisees | Interdit principal | Bloque l'aval ? |
|-------|--------------|----------|--------|---------------|-------------------------------------|----------------------|-------------------|-----------------|
| 1 | Ingestion securisee | Faire entrer sans corruption | technique | oui | oui, dans le perimetre d'entree | stockage, sync, provenance, logs | toute ecriture metier | oui |
| 1.5 | Normalisation canonique | Stabiliser l'identite canonique sans muter le sens metier | structurelle | oui | oui, sur identite et mapping | identite canonique, alias, mapping, anti-collision | toute generation metier, mutation du sens metier | oui |
| 1.6 | Admissibilite metier | Qualifier les roles R* candidats et borner l'usage aval | decisionnelle | oui | non sur le fond, oui sur les verdicts | verdicts, scores, limitations, policies | toute generation / publication | oui |
| 2 | Exploitation metier controlee | Produire les artefacts metier | metier | oui | non sur la source brute, oui sur les derives | drafts, sections, contracts, assemblage metier | contourner 1 / 1.5 / 1.6 | oui |

## Tableau canonique — entrees / sorties / blocages / garde-fous

| Phase | Fonction canonique | Entrees autorisees | Sorties autorisees | Blocages natifs | Garde-fous G1 a G5 |
|-------|-------------------|-------------------|-------------------|-----------------|---------------------|
| 1 | Ingestion securisee | sources brutes (PDF, URL, markdown, CSV, JSON, exports DB, medias, documents techniques, corpus SEO, fichiers RAG) | fichier stocke, enregistrement DB sync, metadonnees minimales, provenance tracable, log d'ingestion | provenance absente, collision destructive, ecriture sauvage, sync incomplete, source illisible/corrompue | G1 purete provenance. G3 collision destination potentielle. G4 interdit ecriture aval si provenance KO. G5 escalation si doute source |
| 1.5 | Normalisation canonique | sorties validees de phase 1 uniquement | matiere canonisee, mapping de champs, typologie source stabilisee, conventions de nommage unifiees, structure exploitable par les phases aval | structure non reconciliable, mapping ambigu, champs critiques manquants, collision de schema, perte de tracabilite, fusion destructive | G1 empeche changement de nature metier. G2 repere doublons structurels. G3 repere collisions inter-surfaces. G4 interdit passage aval si structure canonique non stabilisee. G5 review si arbitrage necessaire |
| 1.6 | Admissibilite metier | matiere canonisee issue de phase 1.5 | verdict d'admissibilite (ADMISSIBLE, ADMISSIBLE_AVEC_LIMITES, INCOMPLETE, AMBIGU, BLOCKED, REVIEW_REQUIRED), role cible R* pressenti, limites d'usage, besoins d'enrichissement | role non determinable, matiere insuffisante, conflit inter-roles, dependance vehicule/contexte non resolue, risque de cannibalisation fort, manque de preuve matiere | G1 verifie purete de role. G2 verifie risque de quasi-duplicate. G3 verifie frontieres R/R. G4 interdit phase 2 sans admissibilite explicite. G5 escalation si ambiguite metier |
| 2 | Generation metier ciblee | uniquement matiere declaree admissible par phase 1.6 + contraintes de role + contrats de sections + eventuels briefs | artefact ciblant un role R* : page, brief, contrat rempli, draft structure, blocs de sections, liens internes, metadonnees du role | tentative de generation sans admissibilite, violation de role, contrat incomplet, matiere insuffisante, contenu hors frontiere, score/qualite insuffisants | G1 purete de role. G2 diversite. G3 anti-cannibalisation. G4 publication control (PASS/REVIEW/BLOCK). G5 review ou escalation humaine |

## Lecture canonique par phase

### Phase 1

Entree : source brute.
Sortie : source securisee et tracable.
Question : "Peut-on faire entrer cette matiere dans le systeme sans l'abimer ni corrompre l'existant ?"

### Phase 1.5

Entree : source securisee.
Sortie : matiere canonique.
Question : "Peut-on rendre cette matiere stable, comparable et exploitable sans lui faire dire autre chose ?"

### Phase 1.6

Entree : matiere canonique.
Sortie : admissibilite metier.
Question : "Cette matiere a-t-elle le droit d'alimenter une surface R*, et laquelle ?"

### Phase 2

Entree : matiere admissible pour un role R*.
Sortie : artefact metier.
Question : "Peut-on produire un contenu metier propre, pur et publiable pour ce role ?"

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

## Garde-fous G1 a G5 figes

| Garde-fou | Nom canonique | Fonction transverse | Peut bloquer ? | Peut publier ? |
|-----------|--------------|---------------------|----------------|----------------|
| G1 | Purete | garantit qu'un contenu reste dans son role cible et n'empiete pas sur un autre | oui | non |
| G2 | Diversite | evite repetition, duplication, similarite excessive, footprints | oui | non |
| G3 | Anti-cannibalisation | empeche collisions entre surfaces, intentions et clusters | oui | non |
| G4 | Publication Control | decide publish / hold / block / noindex / review gate | oui | oui |
| G5 | Review / Escalation | sort les cas ambigus ou a risque vers arbitrage humain ou workflow de review | oui | non |

## Regles de dependance figees

1. Aucune phase > 1 ne peut ecrire du contenu si la phase 1 n'a pas valide la provenance et la securite d'ecriture.
2. Aucune phase > 1.5 ne peut travailler sur une matiere dont la structure canonique n'est pas stabilisee.
3. Aucune phase 2 ne peut demarrer sans verdict explicite de phase 1.6.
4. Aucune couche G* ne constitue un role metier ni une destination editoriale.
5. Tout contenu genere cible un role R*, jamais une couche G*.
6. Toute decision publish / hold / block releve de G4, pas de la phase elle-meme.

## Version courte ultra-canonique

| Phase | Verbe canonique | Objet | Resultat |
|-------|----------------|-------|----------|
| 1 | securiser | la source | matiere ingeree sans corruption |
| 1.5 | normaliser | la matiere | matiere canonique |
| 1.6 | admettre | la matiere vers un role R* | verdict metier |
| 2 | generer | la surface R* | artefact metier |

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
