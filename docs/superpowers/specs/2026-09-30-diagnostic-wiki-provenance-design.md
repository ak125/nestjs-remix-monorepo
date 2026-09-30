# Provenance WIKI des relations diagnostic — chaîne WIKI → DB → moteur

**Date** : 2026-09-30
**Statut** : spec de conception (sous-projet 1 sur 3), en attente de revue owner
**Branche** : `docs/diagnostic-wiki-provenance-spec`
**Portée** : dépôts monorepo + WIKI ; décision vault (amendement) préparée hors dépôt

---

## 1. Constat

Les relations symptôme → cause qu'utilise le moteur de diagnostic (`__diag_symptom_cause_link`,
162 liens seedés par `20260308_diagnostic_engine_mvp.sql`) n'ont **aucune provenance**. La chaîne
SCRAPING → RAW → WIKI → DB est coupée à chaque maillon :

| Maillon | État vérifié (origin/main, 2026-09-30) |
|---|---|
| SCRAPING → RAW | 3 gammes capturées ; découverte réseau désactivée (ADR-096) |
| RAW → WIKI | 3 relations `diagnostic_relations` (filtre-a-air, filtre-a-carburant, filtre-d-habitacle) ; leurs 5 sources sont `to_capture` au catalogue, aucune n'est prouvée dans RAW |
| WIKI → DB | aucun producteur : rien ne lit `diagnostic_relations` pour alimenter `__diag_*` |
| DB | aucune colonne ni table de provenance sur les liens |
| Moteur | `signal_match` (0-30 points) = `relative_score` seedé, non sourcé ; l'UI affiche un score « NN/100 » et six sous-scores que INC-2026-013 qualifie de chiffres fabriqués |

Ce sous-projet construit le **lien WIKI → DB** et la **consommation par le moteur**. Deux
sous-projets suivront, chacun avec sa propre spec :

- **SP2 — couverture RAW → WIKI** : capture et activation des sources (premier élément : le
  `raw_ref` placeholder du catalogue pour filtre-a-carburant, alors que le fichier RAW existe sous un
  identifiant instable) ;
- **SP3 — règles de sécurité sourcées**.

## 2. Objectif et non-objectifs

**Objectif.** Une relation diagnostic n'entre dans la DB qu'avec une provenance WIKI vérifiable.
Le moteur expose cette provenance et ne l'invente jamais. Le mode primaire la pondère dans le
classement, mais seulement pour les relations que le canon ADR-033 autorise à influencer le moteur.

**Non-objectifs** (voir §12) : créer des symptômes, causes ou liens ; décider du statut
`diagnostic_safe` ; retirer `relative_score` ; toucher aux pages SEO diagnostic indexées.

## 3. Résultat attendu au lancement — honnête

Au premier run activé, la chaîne **projette 0 relation** et enregistre **3 conflits
`source_not_raw_proven`** : les trois relations se résolvent sans ambiguïté vers un lien existant
(§4.6), mais aucune de leurs sources n'est `active`. C'est le résultat correct : il rend mesurable
le travail du SP2 au lieu de le masquer. Le moteur affiche alors toutes ses hypothèses comme
« non encore documentées ».

## 4. Conception

### 4.1 Contrat WIKI — aucune fiche éditée

Invariant : **aucune fiche approuvée `wiki/<dossier>/*.md` n'est modifiée à la main** (seul le
promoteur écrit le canon). La conception n'exige donc aucun champ nouveau dans les fiches
existantes.

- **Éligibilité à l'export** : fiche canonique `wiki/gamme/*.md` avec `review_status: approved` et
  au moins une entrée `diagnostic_relations`. Aucun drapeau `exportable.diagnostic` n'est ajouté :
  le bloc `diagnostic_relations` d'ADR-033 **est** le contrat côté diagnostic, et l'exiger
  imposerait d'éditer les fiches.
- **`cause_slug` optionnel** dans l'item `diagnostic_relations[]`, pour les relations futures dont
  la résolution serait ambiguë. Modifié dans la SoT (`_meta/schema/frontmatter.schema.json`, items
  `additionalProperties: false`) et dans son miroir Zod
  (`backend/src/config/wiki-proposal-frontmatter.schema.ts`, `DiagnosticRelationSchema`,
  `.strict()`).
- **Test de parité ciblé** : mêmes clés et même liste `required` pour l'item relation entre le JSON
  Schema et le miroir Zod. Il n'en existe aucun aujourd'hui ; ce test ferme la dérive sur l'item
  touché, sans prétendre couvrir tout le schéma.

### 4.2 diag-canon : table des causes

- `scripts/wiki/export-diag-canon-slugs.py` ajoute `causes: {cause_slug: system_slug}` depuis
  `__diag_cause` (`active = true`).
- Le Zod `DiagCanon` (`backend/src/config/diag-canon.schema.ts`) gagne `causes` **optionnel** ; la
  version reste `1.0.0`, pour ne pas bloquer `wiki-canon-shape-check.yml` pendant la transition.
- Les validateurs Python (`scripts/wiki/validate-gamme-diagnostic-relations.py`) et TS
  (`checkDiagnosticRelation`) gagnent `cause_slug_unknown` et `cause_system_mismatch`, avec le
  test de parité octet-identique existant (`diag-canon.schema.test.ts`). `cause_slug` présent et
  table `causes` absente du canon ⇒ **échec fermé**.
- Aucun validateur n'écrit : pas de boucle canon ↔ fiche.

### 4.3 Export WIKI `exports/diagnostic/`

- Nouveau builder WIKI `_scripts/build_exports_diagnostic.py`, calqué sur `build_exports_seo.py` :
  `source_wiki_commit` par fiche (dernier commit touchant la fiche, jamais HEAD),
  `_assert_full_clone`, garde de chemins propre, 0 LLM, 0 DB.
- Sortie : `exports/diagnostic/gamme/<slug>.json` et `exports/diagnostic/_index.json`, validés par
  `_meta/schema/exports-diagnostic.schema.json` (ajv en CI WIKI, job calqué sur celui d'`exports/seo`).
- Chaque relation exportée porte, pour chacune de ses sources (slugs), le type, le statut et le
  `raw_ref` issus de `_meta/source-catalog.yaml`. Un slug absent du catalogue fait **échouer le
  build** : ce cas est déjà bloqué en amont par le gate WIKI `source_slug_unknown`, et ne peut donc
  être qu'un défaut. La relation porte aussi `confidence_score_computed`, recalculé par
  `compute_score` de `compute-symptom-confidence.py` (étape CI `--check` non bloquante : le builder
  recalcule lui-même). Ce score sert à l'**affichage d'audit uniquement**, jamais au classement.
- **Déterminisme** : le builder régénère intégralement son seul répertoire (les fichiers non
  régénérés sont supprimés) et ne touche à aucun autre répertoire d'export. `_index.json` liste
  chaque fichier avec son sha256, son `source_wiki_commit` et son nombre de relations, plus
  `builder_version`. Il ne contient **ni horodatage ni commit HEAD** : un canon inchangé reproduit
  les mêmes octets et le workflow ne committe rien.
- Workflow monorepo `wiki-exports-diagnostic-generate.yml`, calqué sur
  `wiki-exports-seo-generate.yml` : runner cloud, secret `WIKI_REPO_TOKEN`, diff idempotent puis
  commit sur `main` du WIKI. Les exports atteignent l'image par le pin du sous-module et une ligne
  `COPY` ajoutée au `Dockerfile` (qui ne copie aujourd'hui que `exports/seo`).

### 4.4 Preuve RAW : consommer la garde existante, ne pas en créer une seconde

Le gate cross-repo `quality-gates.py --cross-repo` (`gate_source_catalog_raw_refs`) ne tourne pas
en CI WIKI : aucun credential cross-repo n'existe entre les deux dépôts privés, et aucun workflow
monorepo n'accède à RAW. La garantie existante est la suivante : `check-activation-guard.py`
(bloquant en CI WIKI) interdit toute activation par édition directe, y compris une nouvelle entrée
créée `active`. Seul le flux d'activation gouverné, qui exécute `--cross-repo` avec les deux dépôts
frais, peut rendre une source `active`.

Décision :

- une relation est **prouvée** si et seulement si **toutes** ses sources sont `status: active` au
  catalogue ;
- le builder recopie le `raw_ref` (`repo`, `manifest_id`, `expected_sha256`) de chaque source dans
  l'export, pour ré-vérification d'audit ;
- aucun second détecteur RAW n'est ajouté, et aucun nouveau secret : ce serait dupliquer la
  responsabilité du gate cross-repo, et contredire la décision WIKI de ne pas créer de credential
  cross-repo.

### 4.5 DB — migration additive

Migration `backend/supabase/migrations/<date-de-la-PR>_diag_link_provenance.sql`. En-tête
`SET lock_timeout = '5s'; SET statement_timeout = '30s';` : des valeurs explicites, jamais héritées
du rôle, suffisantes pour créer des tables vides. Le patron RLS suit
`20260422_enable_rls_diag_tables.sql` : `REVOKE ALL FROM anon, authenticated`, RLS activée,
politique `service_role`, bloc `DO` idempotent.

- **`__diag_projection_runs`**
  - Colonnes : `id`, `triggered_by`, `index_sha256`, `builder_version`, `exported_count`,
    `projected_count`, `conflict_count`, `retired_count`, `status` (`applied` | `failed`), `error`,
    `started_at`, `finished_at`.
  - Contrainte : `CHECK (status <> 'applied' OR exported_count = projected_count + conflict_count)`.
  - Table distincte de `__seo_projection_runs`, car `replay_projection.py` lit toutes les lignes de
    runs SEO sans filtre.
- **`__diag_projection_conflicts`**
  - Colonnes : `run_id` (FK), `wiki_path`, `gamme_slug`, `relation_index`, `symptom_slug`,
    `system_slug`, `cause_slug`, `reason`, `detail jsonb`, `created_at`.
  - `reason` est borné par un `CHECK` sur les valeurs du §4.6.
- **`__diag_link_provenance`** : une ligne par couple (lien, fiche).
  - Colonnes : `link_id` (FK `__diag_symptom_cause_link(id)`), `wiki_path`, `gamme_slug`,
    `wiki_commit`, `content_hash`, `relation_to_part`, `part_role`, `confidence`, `source_policy`,
    `confidence_score_computed`, `reviewed`, `diagnostic_safe`, `sources jsonb`, `first_run_id`,
    `last_run_id`, `projected_at`, `retired_at`, `retired_run_id`.
  - Unicité des lignes vivantes : `UNIQUE (link_id, wiki_path) WHERE retired_at IS NULL`.
  - Retrait **doux** : une relation disparue de l'export reçoit `retired_at`. L'historique reste
    conservé et observable ; si la relation revient, une nouvelle ligne vivante est créée.
  - L'état « documenté » **se dérive** de l'existence d'une ligne vivante ; aucune colonne d'état
    n'est ajoutée sur `__diag_symptom_cause_link`, qui n'est pas modifiée.
- **RPC d'application** `__diag_projection_apply(p_run jsonb) RETURNS jsonb`
  - Une seule transaction : insertion du run, upsert des lignes vivantes, retrait des lignes
    absentes, insertion des conflits, assertion de complétude. Un run partiel est donc impossible,
    ce que des appels `.from()` successifs ne garantissent pas.
  - **Écrivain unique au niveau DB** : `pg_advisory_xact_lock` sur une clé fixe en tête de
    transaction. DEV:3000 et PROD partagent la même base mais pas la même file BullMQ ; le
    single-flight du `jobId` ne suffit donc pas, et deux runs concurrents sont sérialisés.
  - `SECURITY INVOKER`. Le seul appelant est `service_role` et les tables sont RLS
    `service_role` : les droits d'un propriétaire ne sont pas nécessaires.
  - `REVOKE EXECUTE ON FUNCTION __diag_projection_apply(jsonb) FROM PUBLIC, anon, authenticated` explicite (les privilèges par défaut Supabase
    accordent l'exécution à `anon`), puis `GRANT EXECUTE … TO service_role` sur la même signature.
- Un run en échec (§4.6) est enregistré par une insertion directe `service_role` avec
  `status = 'failed'` et **aucune** mutation de provenance.
- Application sur la DB partagée : **GO owner** (zone RLS).

### 4.6 Writer — `DiagnosticProjectionModule`

**Emplacement** : `backend/src/modules/diagnostic-engine/projection/`, module NestJS propre importé
par `AppModule`. Deux raisons de rester dans le dossier du contexte diagnostic :

- la résolution lit `CAUSE_GAMME_MAP`, déclaré « single source of truth » cause → gamme ;
- un module frère importerait ce fichier en profondeur, ce qui ajouterait une violation
  `no-deep-module-access` au ratchet `audit/module-boundaries.json`.

**Mécanique** reprise de seo-projection, sans toucher à son code :

- job BullMQ repeatable à `jobId` stable, désenregistré quand le drapeau est OFF ;
- drapeau `DIAGNOSTIC_PROJECTION_ENABLED` (défaut OFF) via `FeatureFlagsService`
  (`bool()`, `ALLOWED_KEYS`) ;
- skip `READ_ONLY` journalisé (`getAppConfig().supabase.readOnly`) ;
- déclenchement admin `@UseGuards(AuthenticatedGuard, IsAdminGuard)` ;
- plomberie PROD du drapeau calquée sur `deploy-prod.yml` et
  `scripts/ci/prod-seo-projection-env.sh`.

Aucun snapshot : le commit WIKI et le hash stockés par ligne suffisent à re-dériver l'entrée.

**Pré-validation du run** (échec ⇒ run `failed`, rien n'est muté, rien n'est retiré) :

- `_index.json` absent ou invalide ;
- sha256 d'un fichier différent de l'index ;
- fichier listé absent ou fichier non listé présent ;
- répertoire d'export absent (`COPY` manquant, sous-module non initialisé) : il se distingue d'un
  index **présent et valide à 0 entrée**. Ce dernier est une sortie délibérée du builder : il
  s'applique, et ses retraits sont comptés dans `retired_count` et journalisés en `warn`.

**Résolution déterministe**, par relation *r* d'une fiche de gamme *g*. Le premier contrôle en
échec donne l'unique raison de conflit :

1. item invalide selon le schéma d'export → `schema_invalid` ;
2. `relation_to_part ≠ possible_cause` → `not_a_cause_relation` (un amplificateur ou un effet
   secondaire n'est pas un lien symptôme → cause de cette pièce) ;
3. `symptom_slug` absent de `__diag_symptom` actif → `unknown_symptom` ;
4. système du symptôme ≠ `system_slug` → `system_mismatch` ;
5. si `cause_slug` est présent :
   - cause absente → `unknown_cause` ;
   - système de la cause ≠ `system_slug` → `system_mismatch` ;
   - *g* ∉ `CAUSE_GAMME_MAP[cause]` → `cause_gamme_mismatch` ;
   - pas de lien actif (symptôme, cause) → `no_matching_link` ;
6. sinon, les candidats sont les causes actives dont le système vaut `system_slug`, dont
   `CAUSE_GAMME_MAP` contient *g* et qui ont un lien actif avec le symptôme :
   - 0 candidat → `no_matching_link` ;
   - 2 candidats ou plus → `ambiguous_cause` ;
   - 1 candidat → lien résolu ;
7. une source au moins n'est pas `active` → `source_not_raw_proven`.

Les trois relations actuelles se résolvent chacune vers un lien unique : `filtre_air_colmate`,
`filtre_carburant_colmate`, `filtre_habitacle_sature`. Pour filtre-a-carburant,
`filtre_carburant_injection` mappe la même gamme, mais n'a pas de lien actif avec
`perte_puissance_filtration`. Le plan re-vérifie ce point sur la DB avant tout code (§11).

**Complétude** : `exported = projected + conflicts` pour chaque run, assertée dans la RPC et par la
contrainte `CHECK`. Le writer **ne crée jamais** de symptôme, de cause ni de lien, et **ne modifie
jamais** `reviewed` ni `diagnostic_safe`.

### 4.7 Moteur

**Pack de preuves** (champs optionnels, pour que `/sessions/:id` relise sans erreur les sessions
historiques stockées en JSONB) :

- `candidate_hypotheses[].provenance` :
  - `state` : `sourced` | `unsourced` ;
  - `wiki_refs[]` : `wiki_path`, `gamme_slug`, `part_role`, `relation_to_part`, `diagnostic_safe`.
- `provenance_summary` :
  - `status` : `available` | `unavailable` ;
  - comptes par état.

**Lecture** : lignes vivantes (`retired_at IS NULL`) de `__diag_link_provenance` pour les `id` de
liens déjà chargés par `getScoredCausesForSymptoms`. Si la lecture échoue :

- `provenance_summary.status = 'unavailable'`, avec un log ;
- aucune hypothèse n'est déclarée `unsourced` : une panne n'est pas une absence de preuve.

**Drapeaux**, calqués sur la paire existante `DIAGNOSTIC_KG_SHADOW_ENABLED` /
`DIAGNOSTIC_KG_PRIMARY_ENABLED` :

- **`DIAGNOSTIC_PROVENANCE_SHADOW_ENABLED`** : calcule la provenance et journalise dans
  `__seo_event_log`, via l'`OutcomeEmitterService` existant, la couverture par état et l'écart de
  rang que produirait le mode primaire. Le classement n'est pas modifié. Le champ `provenance` est
  exposé dans le pack dès que ce drapeau est ON : c'est une information, pas une pondération.
- **`DIAGNOSTIC_PROVENANCE_PRIMARY_ENABLED`** : `signal_match` devient **binaire**.
  - 30 si le lien a une ligne vivante **avec `diagnostic_safe: true`**, 0 sinon ; agrégation par
    moyenne inchangée.
  - Pourquoi binaire : réutiliser `30 × confidence_score_computed` détournerait une mesure de
    qualité des sources en probabilité, et donnerait 0,0 à une relation n'ayant qu'une source
    `blog_pro`.
  - Pourquoi `diagnostic_safe` : le canon ADR-033 (accepté) définit ce champ comme « autorisée à
    influencer le moteur diagnostic LIVE ». Une relation documentée mais non `diagnostic_safe` est
    affichée comme documentée, sans jamais peser sur le rang.
  - Aucune relation n'a `diagnostic_safe: true` aujourd'hui : le mode primaire reste OFF. Il ne
    s'active que lorsque le shadow montre des liens éligibles.
- La bascule de `diagnostic_safe` reste régie par ADR-033 §D4 et critère 9, côté WIKI. Ni le
  writer ni le moteur ne la font, jamais.

### 4.8 Frontend

`frontend/app/components/diagnostic-wizard/results/ResultHypotheses.tsx` :

- **Retirer** « NN/100 », la barre de progression (seuils 70/45/25) et la grille des six
  sous-scores (INC-2026-013).
- **Afficher** :
  - le rang ;
  - un badge de provenance au libellé neutre : « Relation documentée (sources techniques
    archivées) », ou « Relation non encore documentée — à confirmer par un contrôle » ;
  - le `part_role` pour les liens documentés.
- `provenance_summary.status = 'unavailable'` ⇒ **aucun badge**, plutôt qu'un badge faux.
- Composants `~/components/ui/` + Tailwind + lucide-react. Aucune URL, meta, H1 ni JSON-LD n'est
  touché.
- Les pages SEO `diagnostic-auto.$slug.tsx` (« Fiabilité 60/85/95 % ») sont **hors périmètre** :
  SEO indexé, zone STOP.

### 4.9 Gardes et ratchets touchés (déclarés, pas contournés)

- **`check-served-content-write-sinks-ratchet.ts`** : la provenance est affichée à l'utilisateur,
  c'est donc une sortie servie. La PR writer ajoute `__diag_link_provenance` à `SERVED_TABLES` et
  `__diag_projection_apply` à `SERVED_PUBLISH_RPCS`, et rafraîchit la baseline dans la même PR
  (ratchet symétrique). Propriétaire d'enforcement : le writer.
- **`no-deep-module-access`** : aucune violation nouvelle (§4.6).
- **Registry** : `canonical.json` et `REPO_MAP.md` sont régénérés par leurs commandes, jamais édités
  à la main.
- **ast-grep `backend-no-remote-io-in-onmoduleinit`** : l'enregistrement du repeatable suit le
  patron « `onModuleInit` synchrone + `void` ».

### 4.10 Gouvernance — amendement vault

Amendement d'ADR-035 (`proposed`), rédigé dans le scratchpad et signé G3 par l'owner. Aucun numéro
nouveau n'est nécessaire. Contenu :

- **D1** : une table de provenance remplace les colonnes `is_trusted` / `source_origin`
  initialement envisagées.
- **D2** : le writer est l'unique producteur. Il ne crée aucun symptôme, cause ni lien, et ne
  bascule aucun drapeau WIKI.
- **D3** : aucune probabilité numérique affichée pour un lien tant qu'aucune fréquence sourcée
  n'existe.
- **D4** : la pondération du rang est réservée aux liens `diagnostic_safe: true` (ADR-033).
- `amends: ADR-033` : `cause_slug` optionnel, export `exports/diagnostic/`, consommation moteur.

Les PR WIKI (schéma, builder) fusionnent après la signature. Les PR monorepo à drapeaux OFF avancent
en parallèle (« le vault ne bloque jamais le runtime »).

## 5. Flux de données

```text
wiki/gamme/<slug>.md (approved, diagnostic_relations)   _meta/source-catalog.yaml
            │                                                   │ (statut, raw_ref)
            └────────── build_exports_diagnostic.py ◄───────────┘
                                  │  (CI WIKI : ajv + gates same-repo + activation-guard)
                                  ▼
          exports/diagnostic/{gamme/*.json, _index.json}  ── pin sous-module + COPY Dockerfile
                                  │
                                  ▼
DiagnosticProjection (BullMQ, flag OFF par défaut) ── pré-validation ── résolution §4.6
                                  │
                                  ▼  __diag_projection_apply (1 transaction, service_role)
        __diag_link_provenance · __diag_projection_runs · __diag_projection_conflicts
                                  │
                                  ▼  lecture des lignes vivantes par link_id
   Moteur : pack.provenance (shadow) → signal_match binaire, diagnostic_safe seul (primaire)
                                  │
                                  ▼
                 ResultHypotheses : rang + badge + part_role
```

## 6. Matrice d'erreurs

| Situation | Comportement | Observabilité |
|---|---|---|
| Export absent, index invalide, hash divergent | run `failed`, 0 mutation | ligne `__diag_projection_runs` + log |
| Export vide après un run appliqué non vide | run `failed`, 0 retrait | idem |
| Relation non résoluble | conflit typé, relation non projetée | `__diag_projection_conflicts` |
| Erreur dans la RPC | rollback complet, run `failed` | ligne run + log |
| `READ_ONLY` (container PREPROD) | aucune écriture | log `[READ_ONLY]` |
| Drapeau writer OFF | repeatable désenregistré | log au boot |
| Lecture provenance échouée (moteur) | `status: unavailable`, aucune hypothèse `unsourced` | log + `provenance_summary` |
| Backend en `anon` (container PREPROD) | lecture refusée ⇒ `unavailable` | constaté, pas contourné |
| Session historique sans provenance | parse OK (champs optionnels) | — |

## 7. Tests

- **WIKI** : `test_build_exports_diagnostic.py` couvre :
  - l'éligibilité ;
  - le déterminisme (deux runs donnent les mêmes octets) ;
  - la suppression des fichiers orphelins ;
  - l'absence d'horodatage et de commit HEAD ;
  - la recopie du statut et du `raw_ref` ;
  - la validation ajv.
- **Parité** :
  - item relation, JSON Schema ↔ Zod (nouveau) ;
  - validateurs Python ↔ TS (existant, étendu à `cause_slug_unknown` / `cause_system_mismatch`).
- **Writer** :
  - chaque raison de conflit ;
  - l'ordre des contrôles ;
  - les trois relations réelles, en fixture, donnent 3 conflits `source_not_raw_proven` ;
  - complétude ;
  - pré-validations ;
  - retrait doux puis ré-apparition ;
  - `READ_ONLY` ;
  - drapeau OFF.
  - Plus un test de portée du rôle, calqué sur `seo-projection-writer-role-scope.test.ts`.
- **Migration** : squawk ; test SQL de la RPC (atomicité, `CHECK` de complétude, refus `anon`).
- **Moteur** :
  - shadow sans effet sur le rang ;
  - primaire binaire restreint à `diagnostic_safe` ;
  - `unavailable` sur erreur de lecture ;
  - parse d'une session historique.
- **Frontend** :
  - absence de « /100 » et des sous-scores ;
  - libellés des badges ;
  - aucun badge si `unavailable`.

## 8. Rollout, observabilité, rollback

1. Migration appliquée sur la DB partagée (GO owner), tables vides.
2. Writer déployé drapeau OFF.
   - **Preuve runtime sur DEV:3000** : le drapeau est mis à ON le temps d'un run, puis remis à
     OFF. Run attendu : 3 conflits, 0 projection.
   - **PROD** : le drapeau passe à ON après un tag `v*`, sur GO owner. PROD porte seul le
     repeatable. Le verrou consultatif de la RPC protège contre un chevauchement accidentel.
3. Moteur `SHADOW` ON : provenance exposée, couverture mesurée dans `__seo_event_log`.
4. Frontend : badges, et retrait des scores fabriqués.
5. `PRIMARY` : reste OFF tant que le shadow ne montre aucun lien `diagnostic_safe: true`.

**Rollback** :

- chaque étape se coupe par son drapeau ;
- la migration est additive : aucune table existante n'est modifiée ;
- le frontend revient par revert de PR.

## 9. Ordre des PR et empilement

1. **Vault** : amendement ADR-035, préparé hors dépôt, signé par l'owner.
2. **monorepo** :
   - `causes` dans diag-canon (export, Zod optionnel) ;
   - validateurs Python/TS ;
   - parité.
3. **WIKI**, après l'amendement :
   - `cause_slug` au schéma ;
   - builder + schéma d'export ;
   - job CI d'export.
4. **monorepo** :
   - miroir Zod `cause_slug` + test de parité ;
   - workflow `wiki-exports-diagnostic-generate.yml` ;
   - ligne `COPY`.
5. **monorepo** : migration (GO owner pour l'application).
6. **monorepo** : writer + ratchet des sorties servies.
7. **monorepo** : moteur.
   - Empilé après #1607, #1624, #1608, #1626 (couches de score et de sécurité) et #1618
     (`CAUSE_GAMME_MAP`).
   - #1618 ne touche pas les entrées filtration (diff vérifié), mais la résolution lit ce fichier.
8. **monorepo** : frontend, empilé après #1592 (`ResultHypotheses`).

## 10. Critères de succès

- Le premier run activé donne `exported = 3`, `projected = 0`, `conflicts = 3`
  (`source_not_raw_proven`), et `CHECK` de complétude respecté.
- Une source passée `active` par le flux gouverné (SP2) produit une ligne vivante au run suivant,
  sans intervention manuelle.
- Aucune hypothèse n'est déclarée `unsourced` quand la lecture de provenance échoue.
- L'UI n'affiche plus de score sur 100 ni de sous-score.
- Aucune fiche WIKI approuvée n'est modifiée, et aucun symptôme, cause ou lien n'est créé.
- Ratchets verts, avec les baselines déclarées dans la même PR.

## 11. Vérifications à faire au plan (avant tout code)

- **Unicité des trois résolutions.** Re-vérifier sur la DB, en lecture seule, que les trois
  relations se résolvent vers un lien unique, et que `filtre_carburant_injection` n'a pas de lien
  actif avec `perte_puissance_filtration`.
- **`gate_safety_unsourced`.** Établir pourquoi filtre-d-habitacle (`manual_review`,
  `reviewed: false`) passe ce gate.
- **Transport des exports.** Confirmer le chemin par lequel le pin du sous-module WIKI avance dans
  le monorepo. Une fusion Dependabot ne déclenche pas `ci.yml` sur `main` : l'image `:preprod`
  peut rester périmée.

## 12. Hors périmètre

- S2_DIAG.
- Couverture RAW → WIKI (SP2).
- Règles de sécurité sourcées (SP3).
- Retrait de `relative_score` et des liens non sourcés : convergence progressive, spec propre.
- Règle mécanique de bascule `diagnostic_safe` : spec propre, jamais une décision owner.
- Pages SEO diagnostic indexées.
- **Dérive de schéma, signalée seulement** : les colonnes de `__diag_cause` `plausible_km_*`,
  `plausible_age_*` et `workshop_priority`, et les tables `__diag_maintenance_operation`,
  `__diag_context_questions`, `__diag_safe_phrases`, `__diag_related_parts`,
  `__diag_symptom_family` et `__diag_symptoms` n'ont pas de migration `CREATE` dans le dépôt.

## 13. Couverture de cette spec

| Élément | Statut |
|---|---|
| État des 3 relations WIKI, catalogue, schéma d'item (origin/main) | Vérifié |
| Tables `__diag_*`, patron RLS, forme de `__diag_symptom_cause_link` | Vérifié (migrations) |
| Mécanique seo-projection, drapeaux KG, workflows d'export, `COPY` Dockerfile | Vérifié (code) |
| Gate cross-repo hors CI, activation-guard bloquant | Vérifié (workflow + scripts WIKI) |
| Règle `no-deep-module-access`, ratchet des sorties servies | Vérifié (config + script) |
| Unicité des trois résolutions sur la DB vivante | Partiellement vérifié (analyse antérieure ; re-vérification §11) |
| Comportement runtime du writer et du moteur | Non vérifiable avant implémentation |
