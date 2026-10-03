# Provenance WIKI des relations diagnostic — chaîne WIKI → DB → moteur

**Date** : 2026-09-30 (révisée le même jour lors de la planification, voir §14, et après
auto-revue, voir §15)
**Plans** : `docs/superpowers/plans/2026-09-30-diagnostic-provenance-plan-{1-wiki-export,2-db-writer,3-engine}.md`
**Statut** : spec de conception (sous-projet 1 sur 3), en attente de revue owner
**Branche** : `docs/diagnostic-wiki-provenance-spec`
**Portée** : dépôts monorepo + WIKI ; révision d'ADR vault et entrées de registre L2 préparées
hors dépôt, soumises à l'owner

---

## 1. Constat

Les relations symptôme → cause qu'utilise le moteur de diagnostic (`__diag_symptom_cause_link`)
n'ont **aucune provenance**. La base compte 162 liens actifs : 22 seedés par
`20260308_diagnostic_engine_mvp.sql` (freinage), 96 par `20260321_diagnostic_engine_10_systems.sql`
(dont la filtration), et le reste sans migration dans le dépôt. La chaîne
SCRAPING → RAW → WIKI → DB est coupée à chaque maillon :

| Maillon | État vérifié (origin/main et DB en lecture seule, 2026-09-30) |
|---|---|
| SCRAPING → RAW | 3 captures, une seule gamme (`filtre-a-huile`), aucune sur les 3 gammes du périmètre ; découverte réseau désactivée (ADR-096) |
| RAW → WIKI | 3 relations `diagnostic_relations` (filtre-a-air, filtre-a-carburant, filtre-d-habitacle) ; leurs 5 sources sont `to_capture` au catalogue (0 source `active` sur 30) |
| WIKI → DB | aucun producteur : rien ne lit `diagnostic_relations` pour alimenter `__diag_*` |
| DB | aucune colonne ni table de provenance sur les liens |
| Moteur | `signal_match` (0-30 points) = `scoreSignalMatch(relative_score)`. Les `relative_score` ne sont pas sourcés (INC-2026-013) ; ils alimentent le score affiché « NN/100 » et ses six sous-scores |

Ce sous-projet construit le **lien WIKI → DB** et la **consommation par le moteur**. Deux
sous-projets suivront, chacun avec sa propre spec :

- **SP2 — couverture RAW → WIKI** : capture des sources et outillage du flux d'activation
  gouverné, qui n'existe aujourd'hui qu'en commentaires (§4.3) ;
- **SP3 — règles de sécurité sourcées**.

## 2. Objectif et non-objectifs

**Objectif.** Une relation diagnostic n'entre dans la DB qu'avec une provenance WIKI vérifiable.
Le moteur expose cette provenance et ne l'invente jamais. Le mode primaire la pondère dans le
classement, mais seulement pour les relations que le canon ADR-033 autorise à influencer le moteur.

**Non-objectifs** (voir §12) :

- créer des symptômes, causes ou liens ;
- décider du statut `diagnostic_safe` ;
- retirer `relative_score` ;
- toucher aux pages SEO diagnostic indexées.

## 3. Résultat attendu au lancement — honnête

Au premier run activé, la chaîne **projette 0 relation** et enregistre **3 conflits
`source_not_raw_proven`** : les trois relations se résolvent sans ambiguïté vers un lien existant
(§4.5), mais aucune de leurs sources n'est `raw_proven` (prédicat G1, §4.2). C'est le résultat
correct : il rend mesurable
le travail du SP2 au lieu de le masquer. Le moteur affiche alors toutes ses hypothèses comme
« non encore documentées ».

## 4. Conception

### 4.1 Contrat WIKI — aucune fiche ni schéma de fiche modifié

- **Aucune fiche approuvée `wiki/<dossier>/*.md` n'est modifiée à la main** : seul le promoteur
  écrit le canon.
- **Aucun champ nouveau** dans le frontmatter. Le bloc `diagnostic_relations` d'ADR-033 **est** le
  contrat côté diagnostic.
  - Le schéma d'item (`_meta/schema/frontmatter.schema.json`) et son miroir Zod ne changent pas.
  - La résolution vers une cause se fait sans identifiant de cause (§4.5), ce qui suffit aux trois
    relations actuelles.
  - Un champ de désambiguïsation ne sera ajouté, par amendement d'ADR-033, que lorsqu'une relation
    réelle produira un conflit `ambiguous_cause`.
- **Éligibilité à l'export** : fiche canonique `wiki/gamme/*.md` avec `review_status: approved` et
  au moins une entrée `diagnostic_relations`. Aucun drapeau `exportable.diagnostic` n'est ajouté :
  l'exiger imposerait d'éditer les fiches.
- Le schéma n'impose pas `uniqueItems` sur `diagnostic_relations`. Les doublons sont donc traités
  par le writer (`duplicate_relation`, §4.5), sans modifier le schéma.

### 4.2 Export WIKI `exports/diagnostic/`

**Builder** : nouveau `_scripts/build_exports_diagnostic.py`, qui reprend les mécanismes de
`build_exports_seo.py` :

- `source_wiki_commit` par fiche : dernier commit touchant la fiche, jamais HEAD ;
  `source_catalog_commit` : dernier commit touchant `_meta/source-catalog.yaml` ;
- `_assert_full_clone` et garde de chemins (le builder n'écrit que sous `exports/diagnostic/`) ;
- 0 LLM, 0 DB, 0 réseau.

**Formats** : empreintes `sha256:<64 hex minuscules>` ; commits en 40 hex minuscules ; JSON
sérialisé par `json.dumps(…, ensure_ascii=False, indent=2)` suivi d'un saut de ligne final.

**Catalogue strict** : chaque entrée porte un `status` explicite, chaque slug est unique, et le
`slug` du frontmatter d'une fiche est égal au nom de son fichier. Tout écart fait échouer le build.

**Sortie** : `exports/diagnostic/gamme/<slug>.json` et `exports/diagnostic/_index.json`, validés par
`_meta/schema/exports-diagnostic.schema.json` (ajv en CI WIKI, job calqué sur celui d'`exports/seo`).
Ce répertoire est distinct de `exports/seo/diagnostic/`, qui sert les entités `wiki/diagnostic/` des
pages SEO (hors périmètre).

Le schéma d'export (draft 2020-12) contraint les champs repris de la fiche et du catalogue par
`$ref` vers `frontmatter.schema.json` et `source-catalog-entry.schema.json`, sans rien recopier.

**Enveloppe d'un export par gamme** : `schema_version` (`1.0.0`), `builder_version`,
`export_kind: "diagnostic_gamme"`, `gamme_slug`, `wiki_path`, `source_wiki_commit`,
`source_catalog_commit`, `content_hash` (empreinte du JSON canonique des relations exportées) et
`relations[]`, non vide.

**Contenu de chaque relation exportée** : `relation_index`, `relation_sha256`, `symptom_slug`,
`system_slug`, `relation_to_part`, `part_role`, `evidence` (`confidence`, `source_policy`,
`reviewed`, `diagnostic_safe`), `confidence_score_computed` (au niveau de la relation, hors
d'`evidence`) et `sources[]`.

- **Sources.** Pour chaque slug de source : `slug`, `catalog_slug`, le type, le statut et le
  `raw_ref` (`repo`, `manifest_id`, `expected_sha256`) issus de `_meta/source-catalog.yaml`, plus
  `raw_proven`.
  - Le slug est d'abord normalisé par `re.sub(r"_p\d+$", "", slug)`, comme le fait
    `gate_diagnostic_relations`.
  - Un slug absent du catalogue après normalisation fait **échouer le build**. Ce cas est déjà
    bloqué en amont par le gate WIKI `source_slug_unknown` ; il ne peut donc être qu'un défaut.
  - **`raw_proven`** est le prédicat G1 existant `gen_coverage_map.is_page_proven` : `status:
    active` **et** `raw_ref.manifest_id` renseigné. Il est calculé par le builder seul ; tout
    consommateur le recopie et ne le recalcule jamais.
  - Le schéma d'export exige, pour une source `raw_proven: true`, `status: active` et un
    `raw_ref.expected_sha256` de type chaîne. C'est une contrainte de forme du contrat d'export ;
    elle ne revérifie pas RAW.
- **`relation_sha256`** : `sha256:` suivi du sha256 du JSON canonique de l'item tel qu'il figure
  dans la fiche (`json.dumps(item, sort_keys=True, separators=(",", ":"), ensure_ascii=False)`,
  encodé en UTF-8). Il est calculé en un seul endroit, le builder, et le writer se contente de le
  recopier.
- **`confidence_score_computed`** :
  - recalculé par `compute_score` de `compute-symptom-confidence.py` (l'étape CI `--check` est non
    bloquante, d'où ce recalcul) ;
  - sert à l'**affichage d'audit uniquement**, jamais au classement.

**Déterminisme et retraits** :

- Le builder réécrit les fichiers éligibles et ne touche à aucun autre répertoire d'export.
- `_index.json` porte `schema_version` (`1.0.0`), `builder_version`,
  `export_kind: "diagnostic_index"`, `source_catalog_commit` et `files[]`, trié : chaque entrée
  donne `path`, `sha256`, `source_wiki_commit` et `relation_count` (au moins 1). Il ne contient
  **ni horodatage ni commit HEAD** : un canon inchangé reproduit les mêmes octets, et le workflow
  ne committe rien.
- Un fichier d'export dont la fiche n'est plus éligible **n'est pas supprimé en silence**. Comme
  pour le builder SEO, il est signalé `UNRECONCILED`, conservé, et le build sort en erreur. Le
  retrait passe par une PR WIKI revue qui supprime le fichier (retrait gouverné).
- Un index valide à **0 entrée** reste une sortie légitime (retrait gouverné de toutes les
  fiches). Côté DB, il s'applique (§4.5).

**Transport** :

- Workflow monorepo `wiki-exports-diagnostic-generate.yml`, calqué sur
  `wiki-exports-seo-generate.yml` : runner cloud, secret `WIKI_REPO_TOKEN`, diff idempotent puis
  commit sur `main` du WIKI.
  - Il tourne chaque jour à 02:30 UTC, après `diag-canon-slugs-export` (02:00) et
    `wiki-exports-seo-generate` (02:15).
  - Le bot `automecanik-bot` est l'**unique writer** de `exports/diagnostic/`.
  - Si un autre bot a poussé entre-temps, `git push` est refusé en non fast-forward : le run est
    rouge et visible, rien n'est écrasé, aucun rebase n'est tenté, et le run suivant rattrape.
- Les exports atteignent l'image par le pin du sous-module `backend/content/automecanik-wiki` et
  une ligne `COPY` ajoutée au `Dockerfile`, qui ne copie aujourd'hui que `exports/seo`. Cette
  ligne n'est proposée **qu'après** avoir vérifié par `git ls-tree` que le pin de `main` contient
  `exports/diagnostic` : le build Docker ne tourne qu'au push sur `main`, donc une ligne posée trop
  tôt casserait `:preprod` sans qu'aucun check de PR ne l'attrape.
- Le pin avance par une PR Dependabot `gitsubmodule`, jamais fusionnée automatiquement. Sa fusion
  déclenche `ci.yml` → `build.yml` (`submodules: true`) et donc une nouvelle image `:preprod`
  (vérifié, §11).

### 4.3 Preuve RAW : consommer la garde existante, réparer ce qui la rend vacante

**Visibilité des dépôts.** Le WIKI est **public**, RAW est **privé**. La CI WIKI ne peut pas lire
RAW : le gate cross-repo `quality-gates.py --cross-repo` (`gate_source_catalog_raw_refs`) ne tourne
donc pas en CI, et aucun workflow monorepo n'accède à RAW. Les `raw_ref` sont déjà publics dans le
catalogue WIKI : les recopier dans l'export ne divulgue rien de nouveau.

**Garantie réelle aujourd'hui** (vérifiée) :

- `check-activation-guard.py --base origin/main` bloque, **sur PR**, toute activation par édition
  directe, y compris une nouvelle entrée créée `active`.
- **Sur push `main`**, la même commande compare HEAD à lui-même : elle est **vacante**.
- La branche `main` du WIKI n'est **pas protégée** et n'exige aucun check.
- Le « flux d'activation gouverné » qui exécuterait `--cross-repo` n'est **pas outillé** : il
  n'existe qu'en commentaires. 0 source sur 30 est `active`.

**Décision** :

- Une relation est **prouvée** si et seulement si **toutes** ses sources sont `raw_proven`, valeur
  recopiée de l'export (§4.2). Aucun second détecteur RAW, aucun nouveau secret : ce serait
  dupliquer le gate cross-repo et contredire la décision WIKI de ne pas créer de credential
  cross-repo.
- La garde existante est **réparée là où elle est vacante**, au lieu d'être doublée :
  - **PR WIKI** : le step reçoit `GUARD_BASE`, qui vaut `github.event.before` sur `push` et
    `origin/main` sur `pull_request`. `check-activation-guard.py` vérifie la base avec `^{commit}`
    et sort en code 2 si elle est nulle (premier push), inconnue ou n'est pas un commit : il échoue
    fermé. Sans `^{commit}`, `rev-parse --verify` accepte n'importe quel SHA complet bien formé, et
    la base vaudrait « catalogue vide ».
  - **Précondition owner** : `main` du WIKI protégée, avec `wiki-quality-gates` comme check requis.
    L'outillage associé (rulesets, jeton administrateur, checks filtrés par chemins) relève du SP2.
- Ces deux points sont des **préconditions** à l'exposition de la provenance aux utilisateurs
  (§8, étape 3). Ils ne conditionnent ni la migration ni le writer, qui ne projettent rien tant
  qu'aucune source n'est `raw_proven`.
- L'outillage du flux d'activation gouverné relève du SP2.

### 4.4 DB — migration additive

**Fichier** : `backend/supabase/migrations/20261001_diag_link_provenance.sql`. Il est accompagné
d'un `20261001_diag_link_provenance.down.sql` **destructif** : il supprime les trois tables et la
fonction, ne s'exécute que sur GO owner et seulement après avoir coupé le drapeau du writer.

**En-tête et timeouts**

- En-tête structuré comme `20260422_enable_rls_diag_tables.sql` : migration, date, sévérité,
  portée, tables, risque, impact backend.
- `SET LOCAL lock_timeout = '5s'; SET LOCAL statement_timeout = '30s';` : valeurs explicites,
  jamais héritées du rôle (60 s pour `postgres`), limitées à la transaction de la migration.
- **Aucune directive `squawk-ignore`.** Vérifié avec squawk 2.52.1, la version de la CI :
  `require-concurrent-index-creation` ne se lève pas, car les index portent sur des tables créées
  dans le même fichier ; `prefer-bigint-over-int` se levait sur `link_id`, d'où une colonne
  `bigint` (la clé étrangère `int8` → `int4` est admise, même famille d'opérateurs btree).
- Justification : la création des clés étrangères prend un verrou `SHARE ROW EXCLUSIVE` sur
  `__diag_symptom_cause_link`. Ce verrou bloque les écritures sur cette table, pas les lectures
  du moteur, et il est court puisque les tables créées sont vides.

**RLS** : patron de `20260422_enable_rls_diag_tables.sql`, soit `REVOKE ALL FROM anon,
authenticated`, RLS activée, politique `service_role` et bloc `DO` idempotent.

Les trois tables ont un identifiant `bigint GENERATED ALWAYS AS IDENTITY`.

**`__diag_projection_runs`**

- Colonnes : `id`, `triggered_by`, `runtime_env`, `index_sha256`, `builder_version`,
  `exported_count`, `projected_count`, `conflict_count`, `retired_count`, `status`, `error`,
  `started_at`, `finished_at`.
- Contraintes :
  - `triggered_by`, par `CHECK`, vaut `repeatable` ou `admin` ;
  - `status`, par `CHECK`, vaut `applied` ou `failed` ;
  - les quatre compteurs sont `≥ 0` ;
  - `CHECK (status <> 'applied' OR exported_count = projected_count + conflict_count)` ;
  - `CHECK (status <> 'failed' OR error IS NOT NULL)` : un échec porte toujours sa cause.
- `runtime_env` est renseigné par le writer depuis `getAppConfig().app.environment` (soit
  `NODE_ENV`, ou `development` s'il est absent). Il distingue un run DEV d'un run PROD sur la base
  partagée.
- La table est distincte de `__seo_projection_runs`, car `replay_projection.py` lit les runs SEO
  sans filtre de type (seulement une fenêtre `started_at`).

**`__diag_projection_conflicts`**

- Colonnes : `run_id`, `wiki_path`, `gamme_slug`, `relation_index` (`≥ 0`), `symptom_slug`,
  `system_slug`, `reason`, `detail jsonb NOT NULL DEFAULT '{}'`, `created_at`.
- `run_id` est une clé étrangère vers `__diag_projection_runs`, `ON DELETE RESTRICT`.
- `reason` est borné par un `CHECK` sur les 8 valeurs du §4.5 : `schema_invalid`,
  `not_a_cause_relation`, `unknown_symptom`, `system_mismatch`, `no_matching_link`,
  `ambiguous_cause`, `duplicate_relation`, `source_not_raw_proven`.

**`__diag_link_provenance`** : une ligne par couple (lien, fiche).

- Colonnes :
  - `link_id` : clé étrangère vers `__diag_symptom_cause_link(id)`, `ON DELETE RESTRICT` ;
  - identité de la fiche : `wiki_path`, `gamme_slug`, `wiki_commit`, `content_hash` ;
  - contenu de la relation : `relation_to_part`, `part_role`, `confidence`, `source_policy`,
    `confidence_score_computed`, `reviewed`, `diagnostic_safe`, `sources jsonb` ;
  - cycle de vie : `first_run_id`, `last_run_id`, `projected_at`, `retired_at`, `retired_run_id`.
- Contraintes : `sources` est un tableau JSON non vide ; `retired_pair` impose que `retired_at` et
  `retired_run_id` soient renseignés ensemble ou pas du tout.
- Unicité des lignes vivantes : `CREATE UNIQUE INDEX … (link_id, wiki_path) WHERE retired_at IS
  NULL`. L'upsert reprend le même prédicat (`ON CONFLICT (link_id, wiki_path) WHERE retired_at IS
  NULL`).
- **Retrait doux** : une relation qui n'est plus projetée reçoit `retired_at`. Deux cas :
  - elle a disparu de l'export ;
  - elle est désormais en conflit, par exemple parce que son lien a été désactivé
    (`no_matching_link`).

  L'historique reste conservé et observable. Si la relation revient, une nouvelle ligne vivante
  est créée.
- **Aucune colonne d'état** sur `__diag_symptom_cause_link`, qui n'est pas modifiée. L'état
  « documenté » se dérive de l'existence d'une ligne vivante.
- `wiki_commit` et `content_hash` sont des **métadonnées d'audit**, au sens d'ADR-059 (§Audit
  metadata vs replay authority). Aucune capacité de rejeu n'est revendiquée.

**RPC d'application `__diag_projection_apply(p_run jsonb) RETURNS jsonb`**

- **Une seule transaction**, dans cet ordre :
  1. verrou `pg_advisory_xact_lock(hashtext('__diag_projection_apply'))` ;
  2. insertion du run ;
  3. re-vérification que chaque `link_id` à projeter est encore `active`, sous `FOR SHARE OF l`
     (sinon exception, donc run `failed`) : une désactivation concurrente attend la fin du run ;
  4. upsert des lignes vivantes ;
  5. retrait des lignes non projetées ;
  6. insertion des conflits ;
  7. assertion de complétude.
- Un run partiel est donc impossible, ce que des appels `.from()` successifs ne garantissent pas.
- **Écrivain unique au niveau DB** : DEV:3000 et PROD partagent la base mais pas la file BullMQ. Le
  single-flight du `jobId` ne suffit donc pas ; le verrou consultatif sérialise deux runs
  concurrents.
- **`SECURITY INVOKER`** : le seul appelant est `service_role` et les tables sont en RLS
  `service_role`, donc les droits d'un propriétaire ne sont pas nécessaires.
- **`search_path = public, pg_temp`** fixé dans la définition de la fonction (advisor
  `function_search_path_mutable`).
- **Retour** : `{run_id, projected_count, conflict_count, retired_count}`, validé côté writer par
  un schéma Zod (§4.5).
- **Droits** :
  - `REVOKE EXECUTE ON FUNCTION __diag_projection_apply(jsonb) FROM PUBLIC, anon, authenticated`,
    explicite, car les privilèges par défaut Supabase accordent l'exécution à `anon` ;
  - puis `GRANT EXECUTE … TO service_role` sur la même signature.

**Autres points**

- **Run en échec** (§4.5) : enregistré par une insertion directe `service_role` avec
  `status = 'failed'`, et **aucune** mutation de provenance.
- **Contrat de types** : porté par le schéma Zod du retour RPC et par le harnais SQL (§7). Aucune
  régénération des types DB n'est prévue : `generate:types` de `@repo/database-types` n'est qu'un
  `echo`.
- **Propriété** : les deux fichiers de migration ne sont couverts par aucun glob
  d'`ownership.yaml`, et la gate `block-new` les signale `[MISSING_BOTH]`. L'entrée corrective
  est remise à l'owner, seul à committer sous `.spec/00-canon/**`.
- **Application sur la DB partagée** : **GO owner** (zone RLS).

### 4.5 Writer — `DiagnosticProjectionModule`

**Emplacement** : `backend/src/modules/diagnostic-engine/projection/`, module NestJS propre importé
par `AppModule`. Il reste dans le dossier du contexte diagnostic pour deux raisons :

- la résolution lit `CAUSE_GAMME_MAP`, déclaré « single source of truth » cause → gamme ;
- un module frère importerait ce fichier en profondeur, ce qui ajouterait une violation de la règle
  `no-deep-module-access` à l'inventaire généré `audit/module-boundaries.json` (règle en `warn`).

**Mécanique** reprise de seo-projection, sans toucher à son code :

- **Job et horaire.** Job BullMQ repeatable à `jobId` stable. Quand le drapeau est OFF, le
  scheduler retourne sans rien enregistrer et purge tout repeatable résiduel resté dans Redis.
  - Cron `DIAGNOSTIC_PROJECTION_CRON`, par défaut `'0 2 * * *'` en UTC (quotidien), comme le feed
    R1.
  - Le processor **revérifie le drapeau au moment du job** et ignore un job, même déclenché par
    l'admin, si le drapeau est OFF.
  - Un run a lieu même si les entrées n'ont pas changé : la ligne de run quotidienne prouve que la
    chaîne est vivante, pour un volume borné.
- **Racine des exports.** `DIAGNOSTIC_PROJECTION_EXPORTS_ROOT`, par défaut
  `content/automecanik-wiki/exports/diagnostic`, résolue depuis `process.cwd()` comme
  `getExportsRoot()`.
- **Drapeau.** `DIAGNOSTIC_PROJECTION_ENABLED`, défaut **OFF**, lu via `FeatureFlagsService`
  (`bool()`, `ALLOWED_KEYS`), comme les drapeaux KG du moteur.
  - C'est un écart volontaire : seo-projection lit ses drapeaux via `ConfigService`.
  - Les trois drapeaux de ce sous-projet vivent ainsi au même endroit que ceux du contexte
    diagnostic.
- **`READ_ONLY`.** `guardReadOnly` de `SupabaseBaseService` : skip journalisé **avant toute
  lecture**, du disque comme de la base (PREPROD).
- **Appel RPC.** Par `callRpc`, derrière `RpcGateService`, avec le nom littéral
  `__diag_projection_apply` déclaré dans la liste des RPC publiées du ratchet des sinks d'écriture.
  Le retour est validé par un schéma Zod (`ApplyResultSchema`) : un retour hors contrat lève une
  exception.
- **Traçabilité des échecs.** Tout échec avant ou pendant l'appel RPC est tracé par un run
  `failed`. Si cette insertion échoue à son tour, l'exception remonte au job BullMQ : un échec
  n'est jamais silencieux.
- **Déclenchement admin.** `POST api/admin/diagnostic-projection/trigger`,
  `@UseGuards(AuthenticatedGuard, IsAdminGuard)`, soumis au même drapeau.
- **Démarrage.** Aucune CI de PR ne démarre le backend : un test compile le module avec les modules
  globaux réels et refuse le boot sans `RpcGateModule`. La preuve de bout en bout se fait sur
  DEV:3000, une fois le pin du sous-module avancé (§9).
- **Hors PROD.** Le drapeau reste OFF sur les autres environnements, même après l'activation en
  PROD. Seul PROD porte le repeatable. La preuve DEV:3000 passe par une surcharge volatile du
  drapeau, retirée à la fin.

**Pré-validation du run** (échec ⇒ run `failed`, rien n'est muté ni retiré). Le chargeur lève
`DiagnosticExportsInvalidError` avec l'un de ces 9 codes :

- `exports_root_missing` : répertoire d'export absent, par exemple si le `COPY` manque ou si le
  sous-module n'est pas initialisé ;
- `index_invalid` : `_index.json` absent, JSON illisible ou hors schéma (dont une version majeure
  inconnue) ;
- `duplicate_index_path` : un chemin listé deux fois ;
- `listed_file_missing` : fichier listé absent ;
- `unlisted_file_present` : fichier présent mais non listé ;
- `non_regular_file` : entrée de `gamme/` ou index qui n'est pas un fichier ordinaire (lien
  symbolique, répertoire), ou `gamme` qui n'est pas un répertoire ;
- `sha256_mismatch` : sha256 d'un fichier différent de l'index ;
- `envelope_invalid` : enveloppe d'un export par gamme illisible ou hors schéma ;
- `envelope_mismatch` : enveloppe en désaccord avec l'index ou avec elle-même : chemin ↔
  `gamme_slug`, `wiki_path`, `source_wiki_commit`, `source_catalog_commit`, `builder_version`,
  nombre de relations.

**Lecture du référentiel** : `getProjectionReference()` de la couche données lit symptômes, causes
et liens actifs **page par page, à compte exact**. Elle lève si une page échoue, si le nombre de
lignes servies diffère du compte, en cas de doublon symptôme → cause ou de ligne inactive. Une
lecture partielle classerait à tort une relation `no_matching_link` et retirerait sa provenance.
La résolution elle-même est une **fonction pure** de l'export et du référentiel.

Un index **présent et valide à 0 entrée** n'est pas un échec : c'est une sortie délibérée du
builder (retrait gouverné). Il s'applique, toutes les lignes vivantes sont retirées, et
`retired_count` est journalisé en `warn`.

**Résolution déterministe**, par relation *r* (dans l'ordre du tableau) d'une fiche de gamme *g*.
Le premier contrôle en échec donne l'unique raison de conflit :

1. item invalide selon le schéma d'export → `schema_invalid` ;
2. `relation_to_part ≠ possible_cause` → `not_a_cause_relation` : un amplificateur ou un effet
   secondaire n'est pas un lien symptôme → cause de cette pièce ;
3. `symptom_slug` absent de `__diag_symptom` actif → `unknown_symptom` ;
4. système du symptôme ≠ `system_slug` → `system_mismatch` ;
5. **candidats** = causes actives de `__diag_cause` qui remplissent trois conditions : leur
   système vaut `system_slug`, `CAUSE_GAMME_MAP` les associe à *g*, et elles ont un lien actif avec
   le symptôme. Selon leur nombre :
   - 0 candidat → `no_matching_link` ;
   - 2 candidats ou plus → `ambiguous_cause` ;
   - 1 candidat → lien résolu ;
6. lien déjà résolu par un item antérieur de la même fiche → `duplicate_relation` (le premier item
   l'emporte) ;
7. une source au moins n'est pas `raw_proven` (valeur recopiée de l'export) →
   `source_not_raw_proven`.

Le système d'une cause est lu en DB (`__diag_cause`). Aucune table de causes n'est ajoutée au
diag-canon.

Les trois relations actuelles se résolvent chacune vers un lien unique (vérifié en DB, §11) :

| Relation | Lien résolu | id |
|---|---|---|
| filtre-a-air | `filtre_air_colmate` | 113 |
| filtre-a-carburant | `filtre_carburant_colmate` | 114 |
| filtre-d-habitacle | `filtre_habitacle_sature` | 117 |

`filtre_carburant_injection` mappe aussi filtre-a-carburant, mais elle est exclue d'abord par son
système (injection, et non filtration), et n'a de toute façon aucun lien actif avec le symptôme.

**Complétude** : `exported = projected + conflicts` pour chaque run, `exported` comptant chaque item
(doublons inclus). Elle est assertée dans la RPC et par la contrainte `CHECK`.

Le writer **ne crée jamais** de symptôme, de cause ni de lien, et **ne modifie jamais** `reviewed`
ni `diagnostic_safe`.

### 4.6 Moteur

**Fusion multi-symptômes** — `getScoredCausesForSymptoms` fusionne aujourd'hui par `cause_id` et ne
garde que le premier lien.

- La fusion conserve désormais `contributions[] = [{ link_id, symptom_slug, relative_score }]`.
- Le `relative_score` fusionné (moyenne arrondie) est inchangé.
- La provenance est lue pour **tous** les `link_id` des contributions, et plus seulement pour le
  premier.

**Pack de preuves** (champs optionnels, pour que `/sessions/:id` relise sans erreur les sessions
historiques stockées en JSONB) :

- `candidate_hypotheses[].provenance` :
  - `state` : `sourced` (toutes les contributions documentées), `partial` ou `unsourced` ;
  - `links[]` : `link_id`, `symptom_slug`, `documented` et `wiki_refs[]`. Chaque `wiki_ref`
    porte `wiki_path`, `gamme_slug`, `relation_to_part` et `diagnostic_safe`.
- `provenance_summary` :
  - `status` : `available` ou `unavailable` ;
  - comptes par état.
- Un `superRefine` du schéma refuse un pack incohérent : état sans résumé, état sous un résumé
  `unavailable`, compteurs qui ne tombent pas juste, hypothèse sans état sous un résumé
  `available`.

**Lecture** : lignes vivantes (`retired_at IS NULL`) de `__diag_link_provenance` pour les `link_id`
des contributions, par `getLiveLinkProvenance()` de la couche données, **à compte exact**. Elle lève
sur erreur, absence de tableau, compte différent des lignes servies (dont une réponse au-delà du
plafond PostgREST de 1000 lignes : un diagnostic porte sur quelques dizaines de liens), ligne
invalide, deux lignes vivantes pour un même couple lien / fiche, ou ligne d'un lien non demandé.
Le rôle `anon` du container PREPROD (table `service_role` seul) tombe dans le cas « erreur ». Si la
lecture lève :

- `provenance_summary.status = 'unavailable'`, avec un log et un compteur ;
- aucune hypothèse ne porte d'état, et le classement est celui de référence ;
- aucune hypothèse n'est déclarée `unsourced` : `unsourced` veut dire « lu, et aucune fiche ne
  documente ce lien ». Une panne n'est pas une absence de preuve.

**Drapeaux** — tous défaut **OFF**, déclarés dans `FeatureFlagsService` à côté de
`DIAGNOSTIC_KG_SHADOW_ENABLED` / `DIAGNOSTIC_KG_PRIMARY_ENABLED`, lus par `bool(…, false)` : tout ce
qui n'est pas le littéral `true` vaut `false`. Contrairement au shadow KG, qui est ON par défaut, le
défaut OFF est explicite. Ils sont surchargeables à chaud par l'admin et relus à chaque analyse.
Drapeaux OFF ⇒ aucune lecture de provenance, aucun événement, pack identique à celui d'aujourd'hui.

- **`DIAGNOSTIC_PROVENANCE_EXPOSE_ENABLED`**
  - Lit la provenance et l'expose dans le pack. C'est une information, pas une pondération : le
    classement ne change pas.
  - Calcule l'écart de rang que produirait le mode primaire, sans l'appliquer.
  - Télémétrie calquée sur le shadow KG : un événement EventEmitter2, qu'un listener du module
    `observability` convertit en compteur Prometheus. Les labels sont bornés (état, statut, écart
    de rang oui/non) et ne portent jamais de slug. Ni `OutcomeEmitterService` ni `__seo_event_log`
    ne sont utilisés, car ils servent aux issues de session. Série :
    `diagnostic_provenance_evaluated_total`, labels `mode`, `status`, `top_state`, `rank_changed` ;
    `none` pour un champ qu'une provenance `unavailable` ne porte pas, `unknown` pour toute valeur
    hors ensemble. Jamais un slug, un id de lien, de fiche ou de session.
- **`DIAGNOSTIC_PROVENANCE_PRIMARY_ENABLED`**
  - Pondération : chaque contribution vaut 100 si son lien a une ligne vivante avec
    `diagnostic_safe: true`, et 0 sinon. On en prend la moyenne existante, arrondie une seule
    fois, et le résultat passe par `scoreSignalMatch`, inchangé. Les autres sous-scores ne changent
    pas.
  - Exemple : deux symptômes dont un seul lien est `diagnostic_safe` donnent 50.
  - Pourquoi binaire : réutiliser `confidence_score_computed` transformerait une mesure de qualité
    des sources en probabilité. Une relation n'ayant qu'une source `blog_pro` tomberait alors à 0.
  - Pourquoi `diagnostic_safe` : ADR-033, qui est accepté, le définit comme « autorisée à
    influencer le moteur diagnostic LIVE ». Une relation documentée mais non `diagnostic_safe` est
    affichée comme documentée, sans jamais peser sur le rang.
  - **Provenance indisponible** alors que le mode primaire est ON : le classement se fait sur les
    `relative_score` d'avant le mode primaire, avec `status: unavailable`, un compteur et un log.
    Ce repli est gouverné par cette spec, observable et testé.
  - **Dépendance au drapeau EXPOSE** : sans exposition, le mode primaire pondérerait par une
    information invisible. Le script PROD refuse donc la combinaison PRIMARY ON / EXPOSE OFF
    (§4.8). Au runtime, le mode primaire n'est effectif que si EXPOSE est ON ; sinon, un
    avertissement est journalisé **une fois par processus** : au boot par un `onModuleInit`
    synchrone (aucune I/O distante), ou à la première analyse si une surcharge admin crée ce cas
    plus tard.
  - Aucune relation n'a `diagnostic_safe: true` aujourd'hui : le mode primaire reste OFF.
- La bascule de `diagnostic_safe` reste régie par ADR-033 (§D4 et critère 9), côté WIKI. Ni le
  writer ni le moteur ne la font, jamais.

**Ordre transitoire** : pour les liens non documentés, l'ordre existant, fondé sur `relative_score`,
est conservé à titre transitoire. Aucun nombre n'est plus affiché (§4.7). Le retrait de
`relative_score` fera l'objet d'une spec propre.

**Branchement dans l'orchestrateur** : `DiagnosticProvenanceService.rank(links, score)` relit les
drapeaux à chaque appel et rend `{hypotheses, provenance}`. L'orchestrateur le reçoit en
**8ᵉ paramètre** et lui délègue le classement : `rank(scoredLinks, (links) =>
this.scoringEngine.score(links, input.vehicle_context))`. **Tout l'aval** (catalogue, risques,
confiance, shadow KG, pack) lit les hypothèses rendues par `rank`, jamais un second classement de
référence. Le niveau de risque dépend de l'ensemble des causes, qu'aucun classement ne change : un
test vérifie qu'il est identique drapeaux ON et OFF. L'ajout d'un paramètre au constructeur casse
chaque `new DiagnosticEngineOrchestrator(` écrit à la main ; l'injection NestJS masque cette casse,
la liste des sites d'appel est donc vérifiée par grep.

### 4.7 Frontend

Fichier : `frontend/app/components/diagnostic-wizard/results/ResultHypotheses.tsx`.

**Retirer** :

- « NN/100 » ;
- la barre de progression (seuils 70/45/25) ;
- la grille des six sous-scores (INC-2026-013) ;
- le type `ScoringBreakdown` des types frontend (`diagnostic-wizard/types.ts`), qui n'a plus de
  lecteur.

**Afficher** :

- le rang ;
- un badge de provenance au libellé neutre :
  - « Relation documentée (sources techniques archivées) » ;
  - « Relation partiellement documentée » ;
  - « Relation non encore documentée — à confirmer par un contrôle ».

**Pas de badge** si `provenance_summary` est absent (drapeau OFF, session historique) ou si son
statut est `unavailable`, plutôt qu'un badge faux.

**Pas de `part_role`** : c'est une prose interne de la fiche, non destinée à l'utilisateur. Il est
**absent du pack par construction** (le `wiki_ref` ne le porte pas, §4.6) : le frontend ne peut pas
l'afficher. `DiagnosticResults.tsx` transmet `provenance_summary` aux cartes.

**Conventions** : composants `~/components/ui/`, Tailwind et lucide-react.

**SEO** :

- Le wizard est embarqué dans des routes indexées (`depannage.tsx`, `diagnostic-auto._index.tsx`,
  `index,follow`). Les résultats sont toutefois un état client, qui n'existe qu'après interaction.
  Aucune URL, meta, H1, JSON-LD ni HTML SSR n'est touché.
- Les pages SEO `diagnostic-auto.$slug.tsx` (« Fiabilité 60/85/95 % ») sont **hors périmètre** :
  SEO indexé, zone STOP.

### 4.8 Gardes, ratchets et registres touchés (déclarés, pas contournés)

- **`check-served-content-write-sinks-ratchet.ts`** : la provenance est affichée à l'utilisateur,
  c'est donc une sortie servie. `SERVED_TABLES` contient déjà `__diag_symptom`, `__diag_cause`,
  `__diag_system` et `__diag_safety_rule`.
  - La **PR de migration** ajoute `__diag_link_provenance` à `SERVED_TABLES`, et inscrit à la
    baseline le puits `sql_migration` que crée le corps de la RPC.
  - La **PR writer** ajoute `__diag_projection_apply` à `SERVED_PUBLISH_RPCS`.
  - Chaque PR rafraîchit la baseline, puisque le ratchet est symétrique.
- **`no-deep-module-access`** : aucune violation nouvelle (§4.5).
- **Plomberie PROD des drapeaux** : script frère `scripts/ci/prod-diagnostic-provenance-env.sh`,
  appelé par `deploy-prod.yml`, sur le contrat de `prod-seo-projection-env.sh`.
  - Il couvre **trois** drapeaux : `DIAGNOSTIC_PROJECTION_ENABLED` (writer, §4.5),
    `DIAGNOSTIC_PROVENANCE_EXPOSE_ENABLED` et `DIAGNOSTIC_PROVENANCE_PRIMARY_ENABLED`.
  - Il ne lit que des variables GitHub de dépôt (`vars.PROD_*`), jamais un secret.
  - Chaque variable non définie devient un `false` explicite.
  - Seuls `true` et `false` sont acceptés ; toute autre valeur donne exit 1, `.env` octet-identique.
  - PRIMARY `true` avec EXPOSE `false` donne exit 1.
  - `deploy-prod.yml` ne reçoit que des **insertions** (test parmi les vérifications qui précèdent
    toute mutation, variables du step, appel du script), relues par l'owner.
  - Seule exemption ShellCheck : `SC1090` sur la relecture du `.env` candidat (`. "$TMP"`). Verdict
    cité, règle lancée sans la directive : « ShellCheck can't follow non-constant source », sur un
    chemin `mktemp` voulu ; la directive est vivante, le script voisin de `main` porte la même.
  - Le script est testé par un `.test.mjs` frère (36 tests, dont le câblage de `deploy-prod.yml`).
- **Registre L2** (`.spec/00-canon/repository-registry/`, owner-only) : des diffs sont soumis à
  l'owner et ne sont pas appliqués par l'assistant. Ils sont validés par
  `scripts/canon/validate-cross-references.py`. Entrées :
  - `projections.registry.json` : `diagnostic_provenance_v1` ;
  - `pipelines.registry.json` : `wiki_to_exports_diagnostic` et
    `exports_diagnostic_to_db_projection` ;
  - `automation-reality.yaml` : `wiki-exports-diagnostic-generate` et
    `diagnostic-projection-nightly` ;
  - `ownership.yaml` : propriété des deux fichiers de migration (§4.4).
  - `projections.registry.json` : `diagnostic_provenance_v1`, statut `PLANNED`, avec source,
    tables, runner, RPC et ADR.
  - `pipelines.registry.json` : `wiki_to_exports_diagnostic` (`filtered_view`) et
    `exports_diagnostic_to_db_projection` (`runtime_projection`).
- **Registry L3** : `canonical.json` et `REPO_MAP.md` sont régénérés par leurs commandes, jamais
  édités à la main.
- **ast-grep `backend-no-remote-io-in-onmoduleinit`** : l'enregistrement du repeatable suit le
  patron « `onModuleInit` synchrone + `void` ».

### 4.9 Gouvernance — révision d'ADR-035

ADR-035 est au statut `proposed`. Il est **révisé** : un brouillon est rédigé dans le scratchpad et
soumis à l'owner pour **acceptation**, avec signature G3. Son acceptation rend la décision normative ;
aucun numéro nouveau n'est nécessaire. Le brouillon consigne les décisions suivantes.

- **D1** : une table de provenance remplace les colonnes `is_trusted` / `source_origin`
  initialement envisagées.
- **D2** : le writer est l'unique producteur. Il ne crée aucun symptôme, cause ni lien, et ne
  bascule aucun drapeau WIKI.
- **D3** : aucun nombre n'est affiché pour un lien, tant qu'aucune fréquence sourcée n'existe.
  L'ordre existant reste transitoire pour les liens non documentés, et le retrait de
  `relative_score` relèvera d'une spec distincte.
- **D4** : la pondération du rang est réservée aux liens `diagnostic_safe: true` (ADR-033).
  `confidence_score_computed` n'est pas une probabilité et ne pondère pas le rang.
- **D5** : activation par drapeaux, tous défaut OFF : `DIAGNOSTIC_PROJECTION_ENABLED` (run quotidien
  du writer, PROD seul porte le job planifié), `DIAGNOSTIC_PROVENANCE_EXPOSE_ENABLED` (lecture et
  exposition, rang inchangé), `DIAGNOSTIC_PROVENANCE_PRIMARY_ENABLED` (pondération D4, refusée par
  la plomberie PROD si EXPOSE est OFF).
- **D6** : critères de succès : le premier run activé donne 3 exportées, 0 projetée, 3 conflits
  `source_not_raw_proven` ; une source passée `active` par le flux gouverné produit une ligne vivante
  au run suivant, sans intervention manuelle ; une panne de lecture n'est jamais présentée comme une
  absence de preuve ; aucune fiche approuvée n'est modifiée, aucun symptôme, cause ni lien n'est
  créé.
- **D7** : interdictions : écrire `__diag_link_provenance` hors de `__diag_projection_apply` ;
  projeter une relation dont une source n'est pas `raw_proven` ; afficher un nombre par lien ;
  pondérer le rang par un lien non `diagnostic_safe` ; alimenter la provenance depuis RAG ou depuis
  RAW directement.
- `related_adr` : ADR-032 et ADR-033.

Le brouillon ne comporte **pas** d'`amends: ADR-033`, puisque le contrat `diagnostic_relations`
n'est pas modifié.

**Séquencement** :

- Les PR à drapeaux OFF avancent sans attendre, selon le principe « le vault ne bloque jamais le
  runtime ».
- Attendent l'acceptation de l'ADR : toute **activation** (drapeau ON en PROD) et la PR frontend,
  qui est visible sans drapeau.

## 5. Flux de données

```text
wiki/gamme/<slug>.md (approved, diagnostic_relations)   _meta/source-catalog.yaml
            │                                                   │ (statut, raw_ref, _pNN normalisé)
            └────────── build_exports_diagnostic.py ◄───────────┘
                                  │  (CI WIKI : ajv + gates same-repo + activation-guard PR/push)
                                  ▼
          exports/diagnostic/{gamme/*.json, _index.json}  ── pin sous-module + COPY Dockerfile
                                  │
                                  ▼
DiagnosticProjection (BullMQ quotidien, drapeau OFF par défaut) ── pré-validation ── résolution §4.5
                                  │
                                  ▼  __diag_projection_apply (1 transaction, verrou, service_role)
        __diag_link_provenance · __diag_projection_runs · __diag_projection_conflicts
                                  │
                                  ▼  lecture des lignes vivantes pour tous les link_id des contributions
   Moteur : provenance exposée (EXPOSE) → pondération diagnostic_safe par contribution (PRIMARY)
                                  │
                                  ▼
                 ResultHypotheses : rang + badge de provenance
```

## 6. Matrice d'erreurs

| Situation | Comportement | Observabilité |
|---|---|---|
| Fiche devenue inéligible, export conservé | build WIKI en erreur `UNRECONCILED`, aucun export publié | CI WIKI |
| Export absent, index invalide, hash divergent, fichier non listé (9 codes, §4.5) | run `failed`, 0 mutation | ligne `__diag_projection_runs` (`error` = code) + log |
| Référentiel lu partiellement (page en échec, compte différent, doublon, ligne inactive) | run `failed`, 0 mutation | ligne run + log |
| Trace du run `failed` elle-même en échec | l'exception remonte au job BullMQ | job BullMQ en échec + log |
| Index valide à 0 entrée | run `applied`, toutes les lignes vivantes retirées | `retired_count` + log `warn` |
| Relation non résoluble ou dupliquée | conflit typé, relation non projetée, ligne vivante éventuelle retirée | `__diag_projection_conflicts` |
| Lien désactivé entre lecture et application | exception dans la RPC, rollback, run `failed` | ligne run + log |
| Erreur dans la RPC | rollback complet, run `failed` | ligne run + log |
| `READ_ONLY` (container PREPROD) | aucune écriture | log `[READ_ONLY]` |
| Drapeau writer OFF | repeatable désenregistré | log au boot |
| Lecture provenance échouée (moteur) | `status: unavailable`, aucune hypothèse `unsourced` | log + compteur + `provenance_summary` |
| Idem avec PRIMARY ON | classement sur `relative_score` d'avant le mode primaire | log + compteur |
| PRIMARY ON sans EXPOSE | refusé par le script PROD ; au runtime, PRIMARY inactif | exit 1 au déploiement ; `warn` une fois par processus |
| Variable PROD mal orthographiée (`True`, `yes`, `1`) | refusée par le script PROD, `.env` octet-identique | exit 1 au déploiement |
| Backend en `anon` (container PREPROD) | lecture refusée ⇒ `unavailable` | constaté, pas contourné |
| Session historique sans provenance | parse OK (champs optionnels), aucun badge | — |

## 7. Tests

- **WIKI** — `test_build_exports_diagnostic.py` :
  - éligibilité ;
  - déterminisme : deux runs donnent les mêmes octets, sans horodatage ni commit HEAD ;
  - `UNRECONCILED` sur une fiche devenue inéligible ;
  - index valide à 0 entrée ;
  - normalisation `_pNN` ;
  - recopie du statut et du `raw_ref` ;
  - `relation_sha256` stable ;
  - validation ajv, y compris le refus d'une source `active` sans `expected_sha256`.
- **WIKI, garde d'activation** : le cas `push` avec `github.event.before` détecte une activation par
  édition directe ; le premier push échoue fermé.
- **Writer** :
  - chaque raison de conflit, et l'ordre des contrôles ;
  - `duplicate_relation`, où le premier item l'emporte ;
  - les trois relations réelles, en fixture, donnent 3 conflits `source_not_raw_proven` ;
  - complétude, doublons inclus ;
  - pré-validations ;
  - index à 0 entrée qui retire tout ;
  - lien désactivé : conflit `no_matching_link` et retrait de la ligne vivante ;
  - retrait doux puis ré-apparition ;
  - `READ_ONLY` et drapeau OFF ;
  - portée du rôle, calqué sur `seo-projection-writer-role-scope.test.ts`.
- **Migration** :
  - squawk ;
  - test SQL de la RPC : atomicité, `CHECK` de complétude, verrou, re-vérification `active`,
    refus `anon`, prédicat de l'index partiel.
- **Moteur** :
  - EXPOSE sans effet sur le rang ;
  - fusion à deux symptômes dont un seul lien est `diagnostic_safe` : état `partial` et score
    primaire 50 ;
  - primaire restreint à `diagnostic_safe` ;
  - `unavailable` sur erreur de lecture, avec et sans PRIMARY ;
  - PRIMARY sans EXPOSE inactif ;
  - parse d'une session historique ;
  - listener et compteur.
- **Script PROD** — `prod-diagnostic-provenance-env.test.mjs` : défauts `false`, valeurs invalides,
  combinaison PRIMARY sans EXPOSE.
- **Frontend** :
  - absence de « /100 » et des sous-scores ;
  - libellés des trois badges ;
  - aucun badge si le résumé est absent ou `unavailable` ;
  - aucun `part_role` affiché.
- **E2E** : le container PREPROD tourne en `anon` et ne lit donc jamais la provenance. Les E2E ne
  couvrent que l'état « aucun badge ». La preuve de lecture est faite sur DEV:3000 (§8).

**Volumes fixés par les plans**, chaque garde ayant un mutant qui la tue :

| Plan | Tests | Mutants |
|---|---|---|
| 1 — export WIKI | builder et schéma : 42 ; garde d'activation : 4 ; simulation du transport : 5 scénarios | M1-M4 du builder ; `--force` du push |
| 2 — tables, RPC, writer | harnais PostgreSQL 17 jetable : 69 assertions ; TS : 59 tests (7 suites) ; ratchet des sinks : 19 | 5 (migration, rollback) ; 13 (TS) |
| 3 — moteur, script, frontend | script PROD : 36 ; backend : 46 (5 suites) ; frontend : 5 | 3 ; 11 ; 2 |

## 8. Rollout, observabilité, rollback

1. **Migration** appliquée sur la DB partagée (GO owner), tables vides. Pas de régénération des
   types : le contrat est porté par les schémas Zod et le harnais SQL (§4.4).
2. **Writer** déployé drapeau OFF.
   - **Preuve runtime sur DEV:3000** : le drapeau passe à ON le temps d'un run, puis revient à
     OFF. Run attendu : 3 conflits, 0 projection, `runtime_env` DEV.
   - **PROD** : le drapeau passe à ON par la variable GitHub `PROD_DIAGNOSTIC_PROJECTION_ENABLED`
     puis un tag `v*`, après l'acceptation de l'ADR, sur GO owner. PROD porte seul le repeatable,
     et le drapeau reste OFF ailleurs.
3. **EXPOSE ON en PROD** (variable `PROD_DIAGNOSTIC_PROVENANCE_EXPOSE_ENABLED` puis tag `v*`), sur
   GO owner, avec trois préconditions :
   - ADR-035 accepté ;
   - garde d'activation réparée sur push (PR WIKI) ;
   - `main` du WIKI protégée (action owner).

   La couverture est ensuite mesurée par le compteur.
4. **Frontend** : badges, et retrait des scores fabriqués, dans un tag `v*` sur GO owner.
5. **PRIMARY** : reste OFF tant que le compteur ne montre aucun lien `diagnostic_safe: true`.

Chaque étape PROD (2 à 5) est un GO owner nominatif distinct ; aucune n'en autorise une autre.

**Rollback** :

- chaque étape se coupe par son drapeau ;
- la migration est additive : aucune table existante n'est modifiée, et le `.down.sql` documente
  le retrait ;
- le frontend revient par revert de PR.

## 9. Ordre des PR et empilement

1. **Vault** : révision d'ADR-035, préparée hors dépôt, soumise à l'owner (G3).
2. **Registre L2** : diff soumis à l'owner (owner-only).
3. **WIKI** :
   - correctif de la garde d'activation sur push ;
   - builder + schéma d'export ;
   - job CI d'export.
4. **monorepo** :
   - workflow `wiki-exports-diagnostic-generate.yml` ;
   - ligne `COPY` du `Dockerfile`.
5. **monorepo** : migration, `.down.sql`, `SERVED_TABLES` et baseline (GO owner pour l'application).
6. **monorepo** : writer, `SERVED_PUBLISH_RPCS` et drapeau `DIAGNOSTIC_PROJECTION_ENABLED`.
7. **monorepo** :
   - script PROD `prod-diagnostic-provenance-env.sh` (trois drapeaux, PR-C du Plan 3),
     indépendant, présent dans un tag `v*` avant toute activation ;
   - moteur (fusion, provenance, EXPOSE, PRIMARY, listener ; PR-D).
   - Empilé après #1607, #1624, #1608, #1626 (couches de score et de sécurité) et #1618
     (`CAUSE_GAMME_MAP`).
   - #1618 ne touche pas les entrées filtration (diff vérifié), mais la résolution lit ce fichier.
8. **monorepo** : frontend, empilé après #1592 (`ResultHypotheses`) et après l'acceptation de
   l'ADR.

## 10. Critères de succès

- Le premier run activé donne `exported = 3`, `projected = 0`, `conflicts = 3`
  (`source_not_raw_proven`), et respecte le `CHECK` de complétude.
- Une source passée `active` par le flux gouverné (SP2) produit une ligne vivante au run suivant,
  sans intervention manuelle.
- Aucune hypothèse n'est déclarée `unsourced` quand la lecture de provenance échoue.
- Avec plusieurs symptômes, la provenance de chaque lien contributeur est visible.
- L'UI n'affiche plus de score sur 100 ni de sous-score.
- Aucune fiche WIKI approuvée n'est modifiée, et aucun symptôme, cause ou lien n'est créé.
- Ratchets verts, avec les baselines déclarées dans la même PR.

## 11. Vérifications faites avant le plan

| Point | Résultat | Méthode |
|---|---|---|
| Unicité des trois résolutions | liens 113, 114, 117 uniques | DB en lecture seule |
| `filtre_carburant_injection` | système injection (12) ; aucun lien actif avec `perte_puissance_filtration` | DB en lecture seule |
| `gate_safety_unsourced` sur filtre-d-habitacle | ne s'applique pas : la filtration n'est dans aucune des 6 familles de `safety_families.py` | code WIKI |
| Transport du pin | PR Dependabot `gitsubmodule` quotidienne, fusion humaine ⇒ `ci.yml` → `build.yml` (`submodules: true`) | `.github/dependabot.yml`, workflows |
| Visibilité des dépôts | WIKI public, RAW privé | `gh repo view` |
| Garde d'activation | bloquante sur PR ; vacante sur push ; `main` non protégée | workflow WIKI, API branches |
| Méthode de retrait du builder SEO | `UNRECONCILED`, conservation, exit ≠ 0 | `build_exports_seo.py` |
| Verdict squawk de la migration | aucune exemption nécessaire ; `prefer-bigint-over-int` corrigé (`bigint`) | squawk 2.52.1, version de `ci.yml` |
| Régénération des types DB | sans objet : `generate:types` de `@repo/database-types` n'est qu'un `echo` | `packages/database-types/package.json` |
| Réponse de l'API admin des drapeaux | enveloppe `{success, data: {key, value, volatile}, meta}` | `AdminResponseInterceptor` sur `admin-feature-flags.controller.ts` |
| Exemption ShellCheck du script PROD | `SC1090` seule, vivante, même directive que le script voisin de `main` | ShellCheck 0.11 avec et sans la directive |

## 12. Hors périmètre

- S2_DIAG, et les exports `exports/seo/diagnostic/`.
- Couverture RAW → WIKI et outillage du flux d'activation gouverné (SP2).
- Règles de sécurité sourcées (SP3).
- Retrait de `relative_score` et des liens non sourcés : convergence progressive, spec propre.
- Règle mécanique de bascule `diagnostic_safe` : spec propre, jamais une décision owner.
- Champ de désambiguïsation de cause dans `diagnostic_relations`, tant qu'aucun
  `ambiguous_cause` réel n'existe.
- Pages SEO diagnostic indexées.
- **Signalé seulement** :
  - le libellé « deux dépôts privés », désormais faux, dans les commentaires WIKI de
    `wiki-quality-gates.yml` et `check-activation-guard.py`. Il est corrigé seulement dans les
    lignes que touche la PR de garde ;
  - la dérive de schéma :
    - les colonnes `plausible_km_*`, `plausible_age_*` et `workshop_priority` de `__diag_cause` ;
    - les tables `__diag_maintenance_operation`, `__diag_context_questions`,
      `__diag_safe_phrases`, `__diag_related_parts`, `__diag_symptom_family` et
      `__diag_symptoms`.

    Aucune n'a de migration `CREATE` dans le dépôt, et environ 44 liens n'ont pas de migration.

## 13. Couverture de cette spec

| Élément | Statut |
|---|---|
| État des 3 relations WIKI, catalogue, schéma d'item (origin/main) | Vérifié |
| Nombre et origine des liens, unicité des trois résolutions | Vérifié (DB en lecture seule + migrations) |
| Tables `__diag_*`, patron RLS, forme de `__diag_symptom_cause_link` | Vérifié (migrations) |
| Mécanique seo-projection, drapeaux KG, listener KG shadow, workflows d'export, `COPY` Dockerfile | Vérifié (code) |
| Garde d'activation (PR/push), protection de `main` du WIKI, visibilité des dépôts | Vérifié (workflow, `gh api`, `gh repo view`) |
| Ratchet des sorties servies, règle `no-deep-module-access`, registres L2 | Vérifié (script, config, schémas) |
| Topologie Redis séparée DEV/PROD, privilèges par défaut Supabase | Non vérifiable depuis le dépôt (hypothèse prudente, couverte par le verrou et le `REVOKE`) |
| Codes du chargeur, lecture à compte exact, script PROD, branchement de l'orchestrateur | Vérifié (code des plans exécuté sur des worktrees jetables : tests et mutants) |
| Comportement runtime du writer et du moteur sur DEV:3000 et en PROD | Non vérifiable avant implémentation (preuves DEV et PROD prévues, GO owner) |

## 14. Révisions lors de la planification (2026-09-30)

Écarts entre la première version de la spec et le code réel, relevés en écrivant les trois plans ;
la spec est alignée sur le code.

- **§4.2 Export** : enveloppe et contenu de relation explicités (`schema_version`,
  `builder_version`, `export_kind`, `source_catalog_commit`, `relation_index`,
  `relation_sha256` préfixé `sha256:` sur du JSON canonique UTF-8, `confidence_score_computed` hors
  d'`evidence`) ; `raw_proven` calculé par le builder seul (prédicat G1) et recopié partout ;
  `_index.json` à entrées `{path, sha256, source_wiki_commit, relation_count ≥ 1}` ; transport à
  02:30 UTC, writer unique, push non fast-forward ⇒ run rouge sans rebase ni écrasement.
- **§4.3 Garde** : base `github.event.before` / `origin/main` vérifiée `^{commit}`, code 2 sinon ;
  précondition owner `main` du WIKI protégée.
- **§4.4 DB** : timeouts locaux, identifiants `bigint` (verdict squawk), contraintes de runs, 8
  raisons de conflit, retour de RPC validé par Zod ; plus de régénération de types (`echo`) ;
  propriété des migrations remise à l'owner (`[MISSING_BOTH]`).
- **§4.5 Writer** : purge du repeatable résiduel, drapeau revérifié au job, skip `READ_ONLY` avant
  toute lecture, appel par `callRpc` / `RpcGateService`, trace des échecs, endpoint admin, test DI de
  démarrage, preuve DEV par surcharge volatile, 9 codes du chargeur, référentiel à compte exact.
- **§4.6 Moteur** : lecture à compte exact et cas `unavailable` (dont `anon`), drapeaux `bool(…,
  false)` relus à chaque analyse, série et labels Prometheus, avertissement une fois par processus,
  `superRefine` de cohérence du pack, branchement en 8ᵉ paramètre avec un seul classement en aval.
- **§4.7 Frontend** : retrait de `ScoringBreakdown` ; `part_role` absent du pack par construction.
- **§4.8 Gardes** : script PROD étendu à trois drapeaux, `vars.*` seules, insertions seules dans
  `deploy-prod.yml`, verdict SC1090 ; entrées L2 nommées.
- **§4.9 ADR** : décisions D5 (drapeaux), D6 (critères de succès), D7 (interdictions).
- **§6 à §9** : erreurs du chargeur et du référentiel, volumes de tests et mutants, activation PROD
  par variables GitHub et tags `v*` avec un GO owner par étape, script PROD déplacé à l'étape 7.

## 15. Révisions après auto-revue (2026-09-30)

- **Retirés** :
  - `cause_slug` et la table `causes` du diag-canon : aucune relation réelle n'en a besoin
    (rule-of-three) ;
  - l'`amends: ADR-033` ;
  - la télémétrie via `__seo_event_log` ;
  - l'affichage de `part_role` ;
  - l'affirmation de « re-dérivation » de l'entrée.
- **Corrigés** :
  - contradiction sur l'export vide ;
  - perte de provenance en multi-symptômes ;
  - visibilité des dépôts ;
  - comptage et origine des 162 liens ;
  - périmètre des captures RAW ;
  - portée d'INC-2026-013 ;
  - garantie réelle de la garde d'activation ;
  - méthode de retrait du builder ;
  - nature de la règle `no-deep-module-access` ;
  - source des drapeaux seo-projection ;
  - raison d'exclusion de `filtre_carburant_injection`.
- **Ajoutés** :
  - `duplicate_relation` ;
  - repli PRIMARY gouverné ;
  - drapeau `…_EXPOSE_ENABLED` et défauts OFF explicites ;
  - script PROD des drapeaux ;
  - précisions DB : FK `RESTRICT`, index partiel, clé du verrou, re-vérification `active`,
    `search_path`, `runtime_env`, `.down.sql` ;
  - entrées de registre L2 ;
  - normalisation `_pNN` ;
  - réparation de la garde d'activation sur push.
