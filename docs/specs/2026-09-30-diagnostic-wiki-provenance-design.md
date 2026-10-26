# Provenance WIKI des relations diagnostic — chaîne WIKI → DB → moteur

**Date** : 2026-09-30 (auto-revue le même jour) ; révisée à la planification (2026-09-30 et
2026-10-01) ; mise à jour le 2026-10-14 (état livré, §0)
**Plans** : les trois plans de #1658, non repris ; la livraison a suivi d'autres PR (§9)
**Statut** : document de référence, non normatif. Spec d'implémentation de la phase 1
« Provenance » d'ADR-112 (D13). Les décisions vivent dans ADR-035, amendé par ADR-112 et ADR-115 :
en cas de divergence, l'ADR et le dépôt priment. Writer, migrations, export et régénération WIKI
fusionnés (PR du §9), drapeaux OFF ; moteur, exposition et frontend restants (§0) ; aucun run du
writer.
**Branche** : `docs/diagnostic-provenance-spec-delivered` (remplace #1658)
**Portée** : dépôts monorepo + WIKI

---

## 0. État au 2026-10-14

**Livré** (fusionné ; drapeaux OFF pour la chaîne de provenance) :

- export WIKI `exports/diagnostic/` : builder, schéma et job CI (WIKI #112) ;
- régénération quotidienne de `exports/diagnostic/` dans le WIKI, poussée sur son `main` (#1770),
  déclarée `SCRIPT_ONLY` au registre (#1776) ;
- ligne `COPY` du `Dockerfile` et drapeau du writer dans le script PROD existant (#1762) ;
- migrations 20261010 (tables et RPC, #1751) et 20261012 (conflit `not_reviewed` et contrainte
  `reviewed`, #1767), plus 20261011 hors provenance (#1755) ; appliquées sur la DB partagée
  (registre `infra.schema_migrations`, du 2026-10-10 au 2026-10-12) ;
- writer `DiagnosticProjectionModule` (#1758), qui a posé le pin `88017732`.

Cités pour la chronologie, sans drapeau et relevant de la phase 0 d'ADR-112 (D13) :

- #1730 retire tout nombre par lien de l'assistant ; tag
  `v2026.10.05-departements-commandes-f9c825c` ;
- #1749 retire les fiabilités fixes des pages `/diagnostic-auto`, par une PR distincte de contenu
  indexé (zone STOP) ; tags `v2026.10.10-pieces-marque-410-e285eb7` et
  `v2026.10.11-maintenance-9384ef9a`.

**Pas encore exécuté** :

- aucun run du writer : 0 run, 0 conflit, 0 ligne de provenance en DB ;
- la variable `PROD_DIAGNOSTIC_PROJECTION_ENABLED` n'est pas posée ;
- aucun tag `v*` ne contient #1767. Le dernier tag, `v2026.10.11-maintenance-9384ef9a`, contient
  le writer mais pas le conflit `not_reviewed` (§8).

**Restant** :

- activation du writer en PROD : poser la variable `PROD_DIAGNOSTIC_PROJECTION_ENABLED`, puis un
  tag `v*` contenant #1767, chacun sur GO owner (§8) ;
- moteur : plomberie EXPOSE / PRIMARY du script PROD (PR-C), lecture et exposition de la
  provenance (PR-D) ;
- frontend : badges de provenance et retrait du type `ScoringBreakdown` (PR-E) ;
- garde d'activation du WIKI sur push (WIKI #101, ouverte) ;
- entrées du registre L2 encore absentes, soumises à l'owner (§4.8).

## 1. Constat

Les relations symptôme → cause du moteur (`__diag_symptom_cause_link`) n'ont **aucune provenance
vivante** en base. La base compte 162 liens actifs (ids 1 à 163, sans 149) :

- 17 liens freinage (ids 1-13 et 48-51), tous présents dans `20260308_diagnostic_engine_mvp.sql` :
  les ids 1-13 en viennent (2026-03-08) ; les ids 48-51 ont été créés le 2026-03-09 hors du
  fichier, avec 52-55, puis ajoutés au fichier le 2026-03-10 (`ON CONFLICT DO NOTHING`) ;
- 93 par `20260321_diagnostic_engine_10_systems.sql` (ids 56-148, dont la filtration, 112-117) ;
- 52 sans migration dans le dépôt : démarrage et charge (21 ; ids 14-30 et 52-55),
  refroidissement (17 ; ids 31-47) et 14 liens d'ids 150-163, dont 152
  (`perte_puissance_filtration` → `filtre_huile_colmate`) et 153 (→ `filtre_habitacle_sature`).

Les comptes « 22 » et « 96 » de la version du 2026-09-30 étaient faux dès l'origine.

| Maillon | État au 2026-10-14 (origin/main, WIKI main et DB en lecture seule) |
|---|---|
| SCRAPING → RAW | 15 captures, `discovery.mode: provided` : RAW #60 (3, filtre-a-huile) et RAW #69 (12 : 6 plaquette-de-frein, 2 disque-de-frein, 1 filtre-a-air sur Wikipédia, 1 filtre-d-habitacle capturée le 2026-10-10 mais non activée, 2 divers). Découverte réseau en `REPORT_ONLY` depuis RAW #61 |
| Catalogue WIKI | 32 sources : 11 `active`, 21 `to_capture` (3 `active` au pin `88017732`). 8 activations du 2026-10-13 (`6bc00e7e`) sont arrivées par un commit direct sur `main`, sans PR |
| RAW → WIKI | 5 relations `diagnostic_relations` dans 4 fiches, toutes `reviewed: false` et `diagnostic_safe: false`. Les 5 sources des 3 relations d'origine restent `to_capture` |
| WIKI → exports | builder livré ; 4 fichiers, 5 relations |
| exports → image | `COPY` livré ; le pin `88017732` porte des exports valides |
| DB | 3 tables et 2 RPC appliquées, vides ; la table des liens n'a pas de colonne de provenance, et c'est voulu (ADR-035 D1) |
| Moteur | `signal_match` (0-30 points) = `scoreSignalMatch(relative_score)` = `Math.round((rs / 100) * 30)`, ordre par score (INC-2026-013, ouvert). Le pack renvoie encore `relative_score` (= `total_score`) et `scoring_breakdown` (6 sous-scores) ; l'assistant ne les affiche plus (#1730) |

- La capture Wikipédia est cataloguée `wikipedia_fr_filtre_a_air`, en `to_capture` : la carte de
  couverture la cite pour la définition ; elle n'est ni activée ni citée par la relation
  diagnostic.
- Les sources des 3 relations d'origine, toutes `to_capture` : `oem_filter_maintenance_general`,
  `bosch_fad_2020`, `web_vroomly_filtre_gasoil_20260612`, `web_idgarages_filtre_gasoil_20260612`,
  `web_carglass_filtre_habitacle_20260612`.

Le découpage « SP2 couverture RAW → WIKI / SP3 règles de sécurité » de la version d'origine est
remplacé par les phases 2 à 5 d'ADR-112 (D13) et par sa couche sécurité (D5).

## 2. Objectif et non-objectifs

**Objectif** : mettre en œuvre le principe directeur d'ADR-115 (lié, non recopié). Objectif propre
à cette spec : le moteur expose la provenance projetée et ne l'invente jamais.

**Non-objectifs** (décidés ailleurs, liés et non recopiés) :

- créer des symptômes, causes ou liens, ou décider de `reviewed` / `diagnostic_safe` : ADR-035 D2,
  ADR-033 D4 ;
- retirer `relative_score` : ADR-035 D3, spec distincte ;
- toucher aux pages SEO diagnostic indexées : le contenu indexé passe par une PR distincte, en zone
  STOP (ADR-112 D13) ;
- les phases 2 à 5 d'ADR-112.

## 3. Résultat attendu au premier run — honnête

La règle est ADR-035 D6.1, amendé par ADR-115 D2 (non recopié). Seul le calcul est donné ici.

**Attendu, calculé hors ligne** (aucun run n'a eu lieu) sur les exports du pin `88017732` :
`exported = 5`, `projected = 0`, `conflicts = 5`. C'est un constat daté, pas une cible.

| Fiche | Lien résolu | Conflit |
|---|---|---|
| filtre-a-air | 113 (`filtre_air_colmate`) | `source_not_raw_proven` |
| filtre-a-carburant | 114 (`filtre_carburant_colmate`) | `source_not_raw_proven` |
| filtre-d-habitacle | 117 (`filtre_habitacle_sature`) ; le lien 153 porte un autre symptôme | `source_not_raw_proven` |
| filtre-a-huile (`voyant_huile`) | 112 | `not_reviewed` |
| filtre-a-huile (`perte_puissance_filtration`) | 152 | `not_reviewed` |

- Les statuts sont les mêmes sur `main` du WIKI au 2026-10-14 (`917cc501`).
- Exclusions vérifiées : la cause 53 (`filtre_carburant_injection`, système 12, liens 124 et 126,
  aucun vers `perte_puissance_filtration`) et la cause 64 (climatisation).
- Une fois PR-D et PR-E livrées, le moteur présentera toutes ses hypothèses comme « non encore
  documentées ». Le premier run seul ne change aucun affichage.

## 4. Conception — livré, écarts, restant

### 4.1 Contrat WIKI

**Livré** : WIKI #112 respecte « aucune fiche ni schéma de fiche modifié ». Ses 9 fichiers ne
touchent ni `wiki/**` ni `_meta/schema/frontmatter.schema.json`. Le bloc `diagnostic_relations`
d'ADR-033 est le contrat ; l'éligibilité reste une fiche `wiki/gamme/*.md` `review_status:
approved` portant au moins une relation.

**Écarts** :

- WIKI #103, d'un autre chantier (ADR-112 et ADR-113), a ajouté au schéma d'item `cause_slug`,
  `vehicle_scope`, `citations` et `evidence.strength`. Au frontmatter, il a ajouté
  `diagnostic_not_applicable` (fiche gamme, exclusif des relations), `diagnostic.quick_checks[]`
  et `safety_rules[]`.
- Le « champ de désambiguïsation » prévu est donc sans objet. Pour le writer, `cause_slug` n'est
  qu'un contrôle : conflit `cause_slug_mismatch`, évalué après `ambiguous_cause`.
- Toute `vehicle_scope` donne `vehicle_scope_unsupported` (la table des liens n'a pas de colonne de
  portée), évalué avant la résolution du symptôme.
- Le miroir Zod `backend/src/config/wiki-proposal-frontmatter.schema.ts` (`.strict()`) n'a pas
  suivi ces champs : dérive signalée, hors périmètre.

### 4.2 Export WIKI `exports/diagnostic/` et régénération

**Builder livré** : `_scripts/build_exports_diagnostic.py`, version 2.0.0.

- `--check` signale `STALE`, `MISSING` et `UNRECONCILED` ; `--require-commits-on <ref>` exige que
  chaque commit épinglé soit un ancêtre de `<ref>`.
- Codes de sortie : 0 conforme ; 1 écart, ou erreur de build ou d'environnement (dépôt sans git,
  clone superficiel (shallow), slug inconnu) ; 2 schéma d'export absent ou option invalide.
- `UNRECONCILED` : fichier conservé et build en erreur, sur le patron de `build_exports_seo.py`.
  Un index à 0 entrée est une sortie légitime.
- Slugs de source normalisés par `_pNN`, comme `gate_diagnostic_relations`. Un slug inconnu est
  bloqué en amont par ce gate (`source_slug_unknown`, lancé en `--all-local`, sans
  `continue-on-error`).
- `raw_proven` reste le prédicat G1 (`status: active` et `raw_ref.manifest_id`), calculé par le
  builder seul et recopié par les consommateurs.
- Le schéma d'export (ajv) exige `raw_ref` sur chaque source (`null` permis). Quand
  `raw_proven: true`, il exige aussi `status: active` et un `raw_ref.expected_sha256` en chaîne :
  il est plus strict que G1, et une source `active` dont `expected_sha256` est `null` fait échouer
  l'export. Une source `active` sans `raw_ref` le passe, avec `raw_proven: false`.
- Enveloppe par gamme et index en `schema_version` 2.0.0. Index : `builder_version`,
  `export_kind: "diagnostic_index"`, `source_catalog_commit`, et `files[]` trié de
  `{path, sha256, source_wiki_commit, relation_count}`, sans horodatage ni commit HEAD.

**Écarts** avec la version d'origine :

- `relation_sha256` est exporté, mais le writer ne le lit ni ne le stocke.
- `confidence_score_computed` est recalculé par le builder. Le blocage sur écart et la tolérance
  d'absence sont ceux de `compute-symptom-confidence.py --check --all` (CI WIKI) ; le `--check` du
  builder compare les octets d'export.
- Côté monorepo, le resolver recopie `confidence_score_computed` dans
  `__diag_link_provenance.confidence_score_computed` ; aucun code de classement ne le lit.
- `exports/seo/diagnostic/` n'a jamais existé : la distinction annoncée était sans objet.
- Le job `validate-exports-diagnostic` n'est pas exigé par le ruleset de `main` du WIKI.

**Régénération livrée** : workflow monorepo `wiki-exports-diagnostic-generate.yml` (#1770).

- Cron à 03:30 UTC (et non 02:30), `workflow_dispatch`, concurrence sérialisée sans annulation.
- Commit sur `main` du WIKI seulement si les exports changent, par le contournement prévu du
  ruleset. Un push refusé en non fast-forward fait échouer le run, sans rebase ni écrasement.
- Runs observés : `38321704586` (dispatch, 2026-10-12, → `21b5abc5`), `38343778326` (cron,
  2026-10-13, aucun commit), `38507684550` (cron, 2026-10-14, → `917cc501`).

**Pin et image** :

- Les exports atteignent l'image par le pin du sous-module `backend/content/automecanik-wiki` et la
  ligne `COPY` (#1762). Un pin sans `exports/diagnostic` fait échouer le build.
- Le pin `88017732` a été posé par #1758 ; #1652 avait déjà changé le pin. Le dernier bump
  Dependabot `gitsubmodule` (#1745, `042e566` → `8cd7f4c`) a été fermé sans fusion le
  2026-10-11, juste après la fusion de #1758.
- La chaîne fusion → `ci.yml` → build a tourné sur #1758 (gitlink `042e5660` → `88017732`, run
  `ci.yml` 38143144794, build vert), avant la ligne `COPY` de #1762. Elle n'a jamais été observée
  sur un bump postérieur à #1762, ni sur un bump Dependabot.
- Entre `88017732` et `917cc501`, les exports ne diffèrent que par `source_catalog_commit`
  (`817be22f` → `6bc00e7e`) et par les sha256 de l'index ; les `content_hash` sont identiques.
- Le loader contrôle l'égalité de `source_catalog_commit` entre l'index et chaque fichier : le pin
  actuel est cohérent. Avancer le pin aligne le catalogue de référence sans changer l'attendu du
  §3. Ce n'est pas requis pour le run ; c'est requis pour passer l'entrée du registre en `ACTIVE`
  (§8).

### 4.3 Preuve RAW et garde d'activation

**Inchangé** : le WIKI est public, RAW est privé ; la CI WIKI ne lit pas RAW. Une relation est
prouvée si et seulement si toutes ses sources sont `raw_proven`, valeur recopiée de l'export.
Aucun second détecteur RAW, aucun secret nouveau.

**État** :

- `check-activation-guard.py` bloque sur PR ; il est **vacant sur push** (il compare HEAD à
  lui-même). Les 8 activations du 2026-10-13, poussées directement sur `main`, ont traversé la
  garde, qui a rendu un PASS à vide (run `38363488107` : `base=origin/main`, qui vaut HEAD sur
  push).
- `main` du WIKI est protégée depuis le 2026-10-09 par deux rulesets : « contrôles requis »
  (7 checks, contournement administrateur) et « intégrité ».
- Le flux d'activation gouverné a été exécuté à la main trois fois, sur deux jours : deux fois le
  2026-09-30 (`bd296756`, puis `817be22f`), une fois le 2026-10-13 (`6bc00e7e`). Il n'est pas
  outillé (§12).

**Restant : WIKI #101** (ouverte, en retard de 12 commits sur `main`).

- Ses 6 checks verts datent du 2026-10-01 ; le 7e check requis n'a pas tourné. Une mise à jour de
  sa branche est obligatoire (ruleset strict).
- Le step reçoit `GUARD_BASE` : `github.event.before` sur push, `origin/main` sinon.
- La base est vérifiée par `rev-parse --verify --quiet <base>^{commit}` ; deux tests couvrent un
  SHA nul et un SHA inconnu (code 2).
- Sans `^{commit}`, git accepte un SHA de 40 hex inexistant. La garde lirait alors un catalogue
  vide et compterait chaque entrée `active` comme une activation : faux positif bloquant, au lieu
  d'une sortie en code 2.
- Elle corrige le libellé « 2 repos privés » à ses deux seuls emplacements sur `main`
  (`wiki-quality-gates.yml` l.49, `check-activation-guard.py` l.8).

### 4.4 DB

**Livré** :

- `20261010_diag_link_provenance.sql` (#1751) et `20261012_diag_projection_requires_review.sql`
  (#1767), chacune avec son `.down.sql`.
- `20261011_diag_capture_maintenance_schema.sql` (#1755) est hors provenance : elle capture le
  schéma d'entretien et porte deux `squawk-ignore-file` justifiés.
- Appliquées par l'owner le 2026-10-10 (run `38062554261`), le 2026-10-11 (run `38120007004`) et
  le 2026-10-12 (run `38259243776`), selon le registre `infra.schema_migrations`.

**Objets** : `__diag_projection_runs`, `__diag_projection_conflicts`, `__diag_link_provenance`, et
deux RPC, `__diag_projection_apply(p_run jsonb)` et `__diag_projection_record_failure(p_run jsonb)`.

**Droits** :

- RPC en `SECURITY DEFINER`, `search_path = pg_catalog, pg_temp` ;
- tables : `REVOKE ALL` à `anon`, `authenticated` et `service_role`, puis `GRANT SELECT` au seul
  `service_role` ; séquences révoquées ; RLS activée, avec une politique `SELECT` pour
  `service_role` ;
- `dev_readonly` garde le `SELECT` de ses privilèges par défaut (non révoqué, signalé) ;
- `EXECUTE` des deux RPC accordé au seul `service_role`. Pour les rôles API, ce sont les seules
  voies d'écriture ; `postgres`, propriétaire, garde ses droits.

**Contraintes** :

- identifiants `bigint`, et `link_id` aussi (verdict squawk `prefer-bigint-over-int`) ;
  `run_key uuid UNIQUE` ;
- sur les runs : `complete`, `applied_identified`, `error_iff_failed`, `failed_wrote_nothing` ;
  `exported_count` est nullable ;
- sur la provenance : `sources_raw_proven`, `retired_pair` et l'index partiel `live_uniq` des
  lignes vivantes ;
- `reviewed` (ADR-115 D3) ;
- raison de conflit bornée à 11 valeurs : 10 en 20261010, plus `not_reviewed` en 20261012.

La base porte le refus, pas la preuve : elle refuse une source dont `raw_proven` n'est pas `true`
et une relation dont `reviewed` est faux, valeurs recopiées du builder.

`reviewed` et le `CHECK` des 11 raisons sont posés `NOT VALID` par 20261012 : ils contrôlent
`INSERT` et `UPDATE`. Les lignes existantes (aucune le 2026-10-12) ont été contrôlées par la garde
`$postcheck$` de la migration (l.85-135), au lieu d'un `VALIDATE`.

**Mécanique** :

- verrou consultatif et re-vérification `active` des liens sous `FOR SHARE`, dans `apply`
  seulement ; `record_failure` n'a volontairement aucun verrou ;
- `SET LOCAL lock_timeout = '5s'` et `statement_timeout = '30s'` dans les migrations. Sans eux,
  `postgres` hériterait d'un `statement_timeout` de 60 s et d'aucun `lock_timeout` ;
- aucune exemption squawk dans 20261010 et 20261012 (squawk 2.52.1, version de la CI).

**Écarts** avec la version d'origine :

- `SECURITY DEFINER` au lieu d'`INVOKER`, et `public` exclu du `search_path` ;
- `service_role` en lecture seule sur les tables (politique RLS `SELECT`) : il n'écrit que par les
  RPC ;
- `run_key`, contraintes `applied_identified`, `error_iff_failed`, `failed_wrote_nothing`, et
  `exported_count` nullable ;
- fichiers datés 20261010, et non 20261001 ; le `.down` retire aussi les 2 fonctions ;
- un run en échec est tracé par la RPC `__diag_projection_record_failure`, avec la même `run_key`,
  et non par une insertion directe ;
- 11 raisons au lieu de 8 : `vehicle_scope_unsupported`, `cause_slug_mismatch`, `not_reviewed` ;
- le refus d'une source non prouvée et d'une relation non relue est aussi porté par la base, pas
  par le seul writer.

**Autres points** :

- Harnais `scripts/db/test-diag-link-provenance.sh` et sa fixture, hors CI : 143 succès et 0 échec
  (#1751), puis 169 succès et 2 mutants tués (#1767).
- `generate:types` reste un `echo`. Les types DB sont régénérés par des PR dédiées `chore(types)`
  (#1401, #1497, #1581) ; les 3 tables de projection en sont absentes, faute de resync. Le contrat
  passe par les schémas Zod et le harnais.
- Propriété des migrations : globs du domaine D4 (`@ak125/vehicle-team`), posés par des commits
  de l'owner.
- Aucune purge : les clés étrangères sont en `RESTRICT`, les runs et conflits s'accumulent
  (signalé).
- `runtime_env` vaut `getAppConfig().app.environment`. Le container PREPROD tourne en
  `NODE_ENV=production`, mais il est en `READ_ONLY` : le writer y saute le run.

### 4.5 Writer — `DiagnosticProjectionModule`

**Livré** (#1758, puis #1767) : 16 fichiers sous `backend/src/modules/diagnostic-engine/projection/`
(8 sources, chacune avec son test).

**Job et horaire** :

- Bull v4 : file `diagnostic-projection-queue`, job `diagnostic-projection-run`. Le `jobId` stable
  `diagnostic-projection-nightly` ne porte que sur le repeatable ; le déclenchement admin reçoit un
  id généré par Bull.
- Cron `'0 2 * * *'` UTC, surchargeable par `DIAGNOSTIC_PROJECTION_CRON`. Une valeur vide ou
  blanche journalise une erreur sans bloquer le démarrage : le repeatable résiduel est retiré,
  aucun n'est enregistré, et il n'y a plus de run nocturne (signalé).
- Repeatable : 2 tentatives, backoff exponentiel de 60 s. Déclenchement admin : 1 tentative.

**Drapeau** :

- `DIAGNOSTIC_PROJECTION_ENABLED`, `bool(…, false)` dans `FeatureFlagsService`.
- Absent d'`ALLOWED_KEYS`, ce qu'un test impose : pas de surcharge admin à chaud.
- Lu au boot par `onModuleInit` (synchrone, travail en `void`) : OFF désenregistre tout repeatable
  résiduel, de façon journalisée. Le processor revérifie le drapeau à chaque job.
- Le scheduler ne teste pas l'environnement : drapeau ON ⇒ repeatable enregistré, y compris sur
  DEV ou dans le container PREPROD, où le writer saute ensuite chaque job (signalé).

**Garde et déclenchement** :

- `guardReadOnly` passe en premier, avant toute lecture.
- `POST api/admin/diagnostic-projection/trigger`, `@UseGuards(AuthenticatedGuard, IsAdminGuard)`,
  répond 409 avec la raison `FLAG_OFF` ou `READ_ONLY`.

**Pré-validation** : le loader lève l'un de 9 codes (`exports_root_missing`, `index_invalid`,
`duplicate_index_path`, `listed_file_missing`, `unlisted_file_present`, `non_regular_file`,
`sha256_mismatch`, `envelope_invalid`, `envelope_mismatch`). `envelope_mismatch` contrôle aussi
`schema_version`. Une erreur d'E/S autre qu'`ENOENT` (`EACCES`, `ENOTDIR`, `EIO`) remonte sans
code ; le writer la trace aussi en run `failed`.

**Référentiel** : `getProjectionReference()` lit `__diag_system`, `__diag_symptom`, `__diag_cause`
et `__diag_symptom_cause_link` (lignes actives) à compte exact. Le système d'une cause est lu en
DB ; le diag-canon 1.1.0 porte désormais des `causes` (#1733, #1741), que le writer ne lit pas.

**Résolution** : fonction pure de l'export, du référentiel et de la constante `CAUSE_GAMME_MAP`
(`constants/gamme-map.constants.ts`). Le premier contrôle en échec donne l'unique raison, dans cet
ordre :

1. `schema_invalid` ;
2. `not_a_cause_relation` ;
3. `vehicle_scope_unsupported` ;
4. `unknown_symptom` ;
5. `system_mismatch` ;
6. `no_matching_link`, avec un `leg` (`no_gamme_mapping` ou `no_active_link`) ;
7. `ambiguous_cause` ;
8. `cause_slug_mismatch` ;
9. `duplicate_relation` : dans une même fiche, le premier item réserve le lien avant les contrôles
   de preuve et de relecture ; s'il échoue ensuite, le doublon reste en conflit ;
10. `source_not_raw_proven` ;
11. `not_reviewed`, évalué en dernier (ADR-115 D1).

**Échecs** :

- Tout échec avant ou pendant l'appel d'application est tracé par `__diag_projection_record_failure`
  avec la `run_key` de la tentative. Si cette trace échoue, l'exception remonte au job.
- Chaque tentative tire une nouvelle `run_key`. Un run nocturne en échec laisse donc 2 lignes
  `failed`, un déclenchement admin en échec 1 ligne.
- Si la base répond que la `run_key` est déjà appliquée, le résultat est `applied_unconfirmed` :
  l'application a réussi, seule sa réponse s'était perdue.
- `DiagnosticProjectionContractError` est levée dans trois cas : réponse d'`apply` illisible,
  comptes différents du payload, réponse de `record_failure` illisible. Le processor écarte alors
  le job (`discard`), sans nouvelle tentative.

**Métriques** : `diagnostic_projection.applied`, `.failed` et `.applied_unconfirmed` (writer),
`.skipped` (processor), `.repeatable_cleanup_failed` (scheduler).

**Tests** : 123 tests en 8 suites (resolver 45, loader 31, writer 17, scheduler 12, processor 10,
contrôleur 3, types 3, module 2 : composition DI), plus 6 tests du drapeau dans
`feature-flags.service.test.ts` et 9 du référentiel dans `diagnostic-projection-reference.test.ts` :
138 en tout, exécutés le 2026-10-14.

- Le resolver est testé sur les 3 relations d'origine (liens 113, 114, 117) ; aucun test ne rejoue
  l'export réel (4 fichiers, 5 relations).
- Pas de test dédié à la portée du rôle.

**Ratchet des sinks d'écriture** (`check-served-content-write-sinks-ratchet.ts`) — écart :

- `SERVED_TABLES` ne contient pas les tables de provenance ; `SERVED_PUBLISH_RPCS` ne contient que
  `__seo_r8_publish_snapshot`. Le writer appelle les deux RPC par `callRpc`, derrière
  `RpcGateService`, avec un nom en littéral.
- Le détecteur `sql_migration` ignore les noms préfixés par `public.` (signalé).
- La baseline n'a été rafraîchie par aucune PR de la chaîne ; elle le sera par PR-D (§4.6), quand
  la provenance devient une sortie servie.

### 4.6 Moteur

**Rien n'est livré pour la provenance.** État actuel de `getScoredCausesForSymptoms` :

- fusion par `cause_id` sur les slugs dédupliqués et triés : le lien du premier slug alphabétique
  est gardé, l'évidence fusionnée, `requires_verification` combiné par OU ; `relative_score` =
  `Math.round(somme / nombre de slugs uniques)` ; tri par score décroissant, puis `cause_id` ;
- une couverture incomplète lève « Diagnostic cause coverage incomplete » : l'analyse est refusée
  (`success: false`, « Analyse indisponible ») ;
- le texte de `buildSafetyAlert`, `diagnostic_confidence` et `system_suspects` dépendent de
  `hypotheses[0]` ou de `total_score` ;
- le constructeur de l'orchestrateur a 7 paramètres, et 3 `new` écrits à la main existent dans les
  tests ;
- les sessions sont relues par `SavedDiagnosticSessionSchema` : tout champ ajouté au pack doit être
  optionnel.

**Restant — conception retenue, à construire** (reprise de #1658, alignée sur le code livré).

**PR-C** — plomberie PROD des drapeaux EXPOSE et PRIMARY, dans le script existant
`prod-seo-projection-env.sh`, comme le drapeau du writer (#1762) :

- deux entrées `*_OVERRIDE` ; une entrée non définie devient un `false` explicite ;
- `check_bool` : seuls `true`, `false` ou une valeur vide (non définie, écrite `false`) sont
  acceptés ; toute autre valeur donne exit 1 ;
- PRIMARY `true` avec EXPOSE ≠ `true` donne exit 1 ;
- en cas de refus, `.env` reste octet-identique ;
- `deploy-prod.yml` reçoit deux lignes d'environnement, depuis
  `vars.PROD_DIAGNOSTIC_PROVENANCE_EXPOSE_ENABLED` et
  `vars.PROD_DIAGNOSTIC_PROVENANCE_PRIMARY_ENABLED` : insertions seules, relues par l'owner ;
- les tests du script couvrent les deux entrées et la combinaison refusée.

**PR-D** — lecture et exposition :

- **Fusion** : elle conserve `contributions[] = [{link_id, symptom_slug, relative_score}]` ; le
  `relative_score` fusionné est inchangé ; la provenance est lue pour tous les `link_id` des
  contributions, et plus seulement pour le premier.
- **Pack** (champs optionnels, pour relire sans erreur les sessions historiques) :
  - `candidate_hypotheses[].provenance` : `state` (`sourced`, `partial` ou `unsourced`) et
    `links[]` de `{link_id, symptom_slug, documented, wiki_refs[]}` ; chaque `wiki_ref` porte
    `wiki_path`, `gamme_slug`, `relation_to_part` et `diagnostic_safe` ;
  - `provenance_summary` : `status` (`available` ou `unavailable`) et comptes par état ;
  - un `superRefine` refuse 4 incohérences : état sans résumé, état sous un résumé `unavailable`,
    comptes qui ne tombent pas juste, hypothèse sans état sous un résumé `available`.
- **Lecture** : `getLiveLinkProvenance()`, dans la couche données, lit les lignes vivantes
  (`retired_at IS NULL`) à compte exact. Elle lève sur erreur, absence de tableau, compte différent
  des lignes servies (dont le plafond PostgREST de 1000 lignes), ligne invalide, doublon vivant
  lien × fiche, ou ligne d'un lien non demandé. Le rôle `anon` du container PREPROD tombe dans le
  cas « erreur ».
- **Lecture en échec** : `provenance_summary.status = unavailable`, aucune hypothèse ne porte
  d'état, classement de référence, log et compteur. Une panne n'est jamais une absence de preuve
  (ADR-035 D6.3) : `unsourced` veut dire « lu, et aucune fiche ne documente ce lien ». La lecture
  est placée hors du `try` de couverture, pour qu'une panne de lecture ne refuse pas l'analyse.
- **Drapeaux** : `DIAGNOSTIC_PROVENANCE_EXPOSE_ENABLED` et `DIAGNOSTIC_PROVENANCE_PRIMARY_ENABLED`,
  `bool(…, false)`, ajoutés à `ALLOWED_KEYS` (surcharge admin), relus à chaque analyse. Tous OFF ⇒
  aucune lecture, aucun événement, pack identique à celui d'aujourd'hui (testé).
- **EXPOSE** expose la provenance sans changer le classement, et calcule `rank_changed` sans
  l'appliquer.
- **PRIMARY** n'est effectif que si EXPOSE est ON, quelle que soit la source (variable ou
  surcharge admin). Sinon, un avertissement est journalisé une fois par processus : au boot par un
  `onModuleInit` synchrone, sans I/O distante, ou à la première analyse si une surcharge crée ce cas
  plus tard.
- **Repli gouverné** : sous PRIMARY, une provenance `unavailable` fait classer sur les
  `relative_score` d'avant PRIMARY, avec `status: unavailable`, un log et un compteur ; testé.
- **Télémétrie** : un événement EventEmitter2, qu'un listener du module `observability` convertit
  en compteur Prometheus `diagnostic_provenance_evaluated_total`.
  - Labels : `mode`, `status`, `top_state`, `rank_changed` ; `none` pour un champ qu'une provenance
    `unavailable` ne porte pas, `unknown` pour toute valeur hors ensemble.
  - Jamais un slug, ni un id de lien, de fiche ou de session.
  - Ni `OutcomeEmitterService` ni `__seo_event_log`, qui servent aux issues de session.
- **Branchement** : `DiagnosticProvenanceService.rank(links, score)` rend `{hypotheses,
  provenance}` ; il est passé en 8ᵉ paramètre de l'orchestrateur, qui lui délègue le classement.
  Tout l'aval (catalogue, risques, confiance, shadow KG, pack) lit les hypothèses rendues par
  `rank`, jamais un second classement. Les `new DiagnosticEngineOrchestrator(` écrits à la main sont
  listés par grep, l'injection NestJS masquant leur casse.
- **Test d'invariance** : `risk_level`, règles et `blocks_catalog` identiques drapeaux ON et OFF.
- **Ratchet** : PR-D ajoute les tables de provenance au ratchet des sinks et rafraîchit sa baseline
  dans la même PR (§4.5).

**Pondération PRIMARY** :

- Elle reste celle d'ADR-035 D4 jusqu'à la phase 4 d'ADR-112, qui la remplace ; ADR-115 ne la
  modifie pas.
- Calcul : 100 par contribution dont le lien a une ligne vivante `diagnostic_safe: true`, 0 sinon ;
  moyenne existante, arrondie une seule fois ; `scoreSignalMatch` inchangé. Deux symptômes dont un
  seul lien est `diagnostic_safe` donnent 50.
- PRIMARY doit rester OFF tant qu'aucune relation n'est `diagnostic_safe: true`. Activé, il
  mettrait toutes les contributions à 0, et changerait le rang, `diagnostic_confidence`,
  `system_suspects` et le texte de l'alerte de sécurité.
- Le texte de `buildSafetyAlert` cite `hypotheses[0]` (« Hypothèse principale », branche sans
  urgence `critique`) : il dépend donc du rang, ce qu'ADR-112 D5 exclut (signalé). Le
  déclenchement de l'alerte et `risk_level` n'en dépendent pas.
- Pour les liens non documentés, l'ordre fondé sur `relative_score` est conservé à titre
  transitoire ; son retrait relève d'une spec propre (§2).

### 4.7 Frontend

**Livré** :

- #1730 retire de `ResultHypotheses.tsx` le « NN/100 », la barre et la grille des sous-scores ;
  tag `v2026.10.05-departements-commandes-f9c825c`.
- #1749 retire les pourcentages de fiabilité des pages `/diagnostic-auto` ; il est contenu dans les
  tags `v2026.10.10-pieces-marque-410-e285eb7` et `v2026.10.11-maintenance-9384ef9a`.

**Restant (PR-E)** :

- trois badges au libellé neutre : « Relation documentée (relue, sources archivées) », « Relation
  partiellement documentée », « Relation non encore documentée — à confirmer par un contrôle » ;
- le rang affiché ; `DiagnosticResults.tsx` transmet `provenance_summary` aux cartes ;
- aucun badge si le résumé est absent (drapeau OFF, session historique) ou `unavailable`, plutôt
  qu'un badge faux ;
- retrait du type `ScoringBreakdown` (`diagnostic-wizard/types.ts`, l.53-60), du champ
  `scoring_breakdown` (l.73) et de la fixture de `diagnostic-hypothesis-rank.test.tsx` (l.40) ;
  `relative_score` (l.66) reste ;
- `part_role` reste absent du pack par construction : le `wiki_ref` ne le porte pas ;
- tests : les 3 libellés ; aucun badge si le résumé est absent ou `unavailable` ; aucun
  `part_role` ;
- conventions : composants `~/components/ui/`, Tailwind et lucide-react.

**SEO** : le wizard est embarqué dans des routes indexées (`depannage.tsx`,
`diagnostic-auto._index.tsx`) ; ses résultats sont un état client. Aucune URL, meta, H1 ni HTML SSR
n'est touché.

### 4.8 Gardes, ratchets et registres

**Livré** :

- Script PROD : un seul drapeau, ajouté au script existant `prod-seo-projection-env.sh` (#1762) au
  lieu d'un script frère. `check_bool`, variables `vars.PROD_*` seules, `.env` octet-identique en
  cas de refus.
- `deploy-prod.yml` : une ligne d'environnement et des commentaires. Le step de test (l.53) et
  l'appel du script (l.333) existants sont réutilisés.
- Exemption `SC1090` du script (l.207-208), présente depuis #1569 (2026-09-24) et conservée par
  #1762 : ShellCheck a tourné en CI sur #1762 avec la directive (`audit.yml`, bloquant au niveau
  `warning`). Sa nécessité (relance sans la directive) n'a pas été
  testée (signalé).
- `onModuleInit` du scheduler est synchrone (travail en `void`) : conforme à l'intention de la
  règle ast-grep `backend-no-remote-io-in-onmoduleinit`. Sa regex exige un nom finissant par
  `Queue` précédé d'au moins un caractère : elle ne reconnaît pas le champ `this.queue`, et son
  verdict ne couvre donc pas ce fichier (signalé).
- `no-deep-module-access` : 90 violations au total, aucune sous `projection/`.
- Registre L2 : `automation-reality` déclare `wiki-exports-diagnostic-generate` en `SCRIPT_ONLY`
  (#1776) ; `canonical.json` et `REPO_MAP.md` sont régénérés par leurs commandes.
- Registre L1 : `db.json` et `rpc.json` listent les 3 tables et les 2 RPC en `domain: UNKNOWN`,
  `owner: __unassigned__`, `usedBy: []`. Aucune surcouche L2 ne leur donne domaine ni
  propriétaire ; seule `delete-policy.yaml` couvre les 3 tables (`__diag_*` → `ADR_REQUIRED`). Il
  en va de même pour toutes les tables (316) et RPC (257) du registre : le builder n'attribue de
  domaine à aucun objet DB (signalé).

**Restant** (diffs soumis à l'owner, owner-only) :

- `projections` : `diagnostic_provenance_v1` (`fed_by_pipeline`, `projection_contract_version`) ;
- `pipelines` : `wiki_to_exports_diagnostic` et `exports_diagnostic_to_db_projection` ;
- `automation-reality` : `diagnostic-projection-nightly` (executor `bullmq`).

Le ratchet des sinks d'écriture n'est pas owner-only : PR-D le met à jour (§4.6).

### 4.9 Gouvernance

- ADR-035 est accepté depuis le 2026-10-04 (vault #373). Il est amendé par ADR-112, dans la même
  PR, et par ADR-115 (2026-10-11). Ses décisions ne sont pas recopiées ici.
- Séquencement (ADR-035 D5) : l'ADR a été accepté le 2026-10-04 à 19:43 UTC, avant la première PR
  du tableau « Livrées » (#1730, ouverte à 20:51, fusionnée à 21:58 UTC). Les PR du 2026-10-01 et
  WIKI #100 l'ont précédé, mais ne portent pas de drapeau de provenance.
- ADR-112 D13 nomme pour la phase 1 les PR #1658, #1659, #1661, #1663, #1669 et WIKI #102 (§9) :
  - #1659, #1663 et WIKI #102 sont remplacées et fermées ;
  - #1661 et #1669 sont remplacées, mais encore ouvertes ;
  - #1658 est remplacée par ce document et reste ouverte jusqu'à la fusion de sa PR.

## 5. Flux de données

```text
wiki/gamme/<slug>.md (approved, diagnostic_relations)     _meta/source-catalog.yaml
            │                                                     │ (statut, raw_ref, _pNN)
            └──────────── build_exports_diagnostic.py ◄───────────┘
                                   │  (CI WIKI : ajv, gates, garde d'activation sur PR)
                                   ▼
        exports/diagnostic/{gamme/*.json, _index.json} ── régénération 03:30 UTC (commit si changé)
                                   │
                                   ▼  pin du sous-module (PR, fusion humaine) + COPY Dockerfile
                    image, puis tag v* (PROD) sur GO owner
                                   │
                                   ▼
 DiagnosticProjection (Bull, 02:00 UTC, drapeau OFF par défaut) ── loader (9 codes, E/S) ── resolver (11)
                                   │
                                   ▼  __diag_projection_apply (1 transaction, verrou, service_role)
        __diag_link_provenance · __diag_projection_runs · __diag_projection_conflicts
                                   │
                                   ▼  [à construire] lecture des lignes vivantes (PR-D)
   Moteur : provenance exposée (EXPOSE) → pondération diagnostic_safe (PRIMARY)
                                   │
                                   ▼  [à construire] (PR-E)
                 ResultHypotheses : rang + badge de provenance
```

Le writer lit les exports du pin du commit tagué, embarqués à la construction de l'image (fusion
sur `main`) ; sur DEV, ceux du sous-module local. Les horaires de 02:00 et de 03:30 ne dépendent
donc pas l'un de l'autre.

## 6. Matrice d'erreurs

| Situation | Comportement | Observabilité |
|---|---|---|
| Fiche devenue inéligible, export conservé | régénération en erreur `UNRECONCILED`, rien de poussé | workflow monorepo de 03:30 (exit 1) |
| Push refusé en non fast-forward | run rouge, rien d'écrasé, run suivant | Actions |
| Pin sans `exports/diagnostic` | build de l'image en échec (`COPY`) | CI |
| Export absent ou invalide (9 codes), ou erreur d'E/S sans code | run `failed`, 0 mutation | ligne de run (`error`) + log |
| Référentiel lu partiellement | run `failed`, 0 mutation | ligne de run + log |
| Lien désactivé entre lecture et application | exception dans la RPC, rollback, run `failed` | ligne de run + log |
| Relation non relue dans une image sans #1767 | la contrainte `reviewed` refuse l'insertion ; deux tentatives, 2 runs `failed` par nuit, rien d'écrit | lignes de run + log |
| Trace de l'échec elle-même en échec | l'exception remonte au job | job en échec + log |
| Réponse perdue d'une application validée | `applied_unconfirmed`, rien de réécrit | log `warn` + ligne de run |
| Réponse hors contrat après commit | job écarté, sans nouvelle tentative | job en échec + log |
| Index valide à 0 entrée | run `applied`, lignes vivantes retirées | `retired_count` |
| Relation non résoluble, dupliquée ou non prouvée | conflit typé, ligne vivante éventuelle retirée | `__diag_projection_conflicts` |
| `READ_ONLY` (container PREPROD), drapeau OFF | comme « Drapeau OFF » ; admin : 409 `FLAG_OFF` | log au boot |
| `READ_ONLY` (container PREPROD), drapeau ON | repeatable enregistré ; chaque job sauté par le writer, sans ligne de run ; admin : 409 `READ_ONLY` | log `warn` `readonly.skipped` |
| Drapeau OFF | repeatable désenregistré au boot ; admin : 409 `FLAG_OFF` | log au boot |
| `DIAGNOSTIC_PROJECTION_CRON` vide ou blanc, drapeau ON | démarrage poursuivi ; repeatable résiduel retiré, aucun enregistré : plus de run nocturne | log `error` |
| Variable PROD invalide (`True`, `yes`, `1`) | refusée, `.env` octet-identique | exit 1 au déploiement |
| *À construire* : lecture de provenance en échec | `status: unavailable`, aucune hypothèse ne porte d'état, classement de référence ; sous PRIMARY, repli gouverné (§4.6) | log + compteur `status=unavailable` |
| *À construire* : PRIMARY sans EXPOSE | refusé par le script PROD (PR-C) ; par surcharge admin, PRIMARY ineffectif au runtime | exit 1 au déploiement ; log `warn` une fois par processus |
| *À construire* : session historique | parse OK (champs optionnels), aucun badge | — |

## 7. Tests

| Surface | Tests au 2026-10-14 | Manques |
|---|---|---|
| Builder et schéma WIKI | 47 fonctions de test, 77 cas pytest (statique, 12 parametrize) | — |
| Garde d'activation WIKI | 8, aucun sur push | 4 tests dans WIKI #101 |
| Harnais SQL (hors CI) | 169 succès, 2 mutants tués | pas en CI |
| Writer | 123 (8 suites), plus 6 du drapeau et 9 du référentiel : 138 | rejeu de l'export réel (4 fichiers, 5 relations) ; portée du rôle |
| Script PROD | 54 (4 suites) | entrées EXPOSE / PRIMARY et PRIMARY sans EXPOSE (PR-C) |
| Moteur | — | PR-D : pack identique drapeaux OFF ; 4 refus du `superRefine` ; cas de levée de `getLiveLinkProvenance` ; `unavailable` sans état ; repli PRIMARY ; PRIMARY sans EXPOSE ; invariance de `risk_level`, des règles et de `blocks_catalog` ; labels sans slug |
| Frontend | — | PR-E : 3 libellés ; aucun badge si absent ou `unavailable` ; aucun `part_role` ; absence de `ScoringBreakdown` |

Le container PREPROD tourne en `anon` (`READ_ONLY`) et ne lira jamais la provenance : les E2E ne
couvriront que l'état « aucun badge ». La preuve de lecture se fait sur DEV (§8, étape 3).

## 8. Rollout, observabilité, rollback

1. **Migrations** : appliquées (§4.4), tables vides.
2. **Writer**, fusionné drapeau OFF :
   - **préalable** : #1767 dans le code qui tourne — un tag `v*` pour PROD, et le code DEV
     redémarré à jour pour la preuve DEV. Sans lui, le resolver ignore `not_reviewed`, et la
     contrainte `reviewed` fait échouer chaque run (§6) ;
   - **preuve DEV** :
     - relever d'abord le `NODE_ENV` du DEV, qui donne `runtime_env` : « production » ne
       distinguerait pas DEV de PROD ;
     - variable d'environnement à `true`, puis redémarrage. Le repeatable est alors enregistré sur
       DEV aussi, le scheduler ne testant pas l'environnement ;
     - déclencher par `POST api/admin/diagnostic-projection/trigger` ; attendu : le §3 ;
     - repasser à OFF et redémarrer ;
   - hors de cette fenêtre, seul PROD porte le drapeau ON (ADR-035 D5) : par configuration, non
     vérifié par le code ;
   - **PROD** : variable `PROD_DIAGNOSTIC_PROJECTION_ENABLED` d'abord, puis tag `v*` contenant
     #1767, chacun sur GO owner : `deploy-prod.yml` ne lit la variable qu'à son exécution (tag
     `v*`, ou lancement manuel en break-glass) ;
   - avancer le pin avant le tag n'est pas requis pour le run. Le registre l'exige pour passer
     `wiki-exports-diagnostic-generate` en `ACTIVE` : son `owner_action` demande un run `applied`
     du repeatable, sous un tag PROD, portant l'`index_sha256` d'un `_index.json` poussé par la
     régénération (§4.2).
3. **EXPOSE** (PR-C, PR-D) :
   - preuve DEV après PR-D : EXPOSE par surcharge admin, une analyse,
     `provenance_summary.status = available`, puis retour à OFF ;
   - PROD : variable puis tag, sur GO owner. Préconditions : WIKI #101 fusionnée ; `main` du WIKI
     protégée (fait le 2026-10-09).
4. **Frontend** (PR-E), dans un tag `v*` sur GO owner.
5. **PRIMARY** reste OFF tant qu'aucune relation n'est `diagnostic_safe: true` (§4.6).

Chaque étape PROD est un GO owner nominatif distinct ; aucune n'en autorise une autre.

**Rollback** :

- writer : couper d'abord le drapeau, sur GO owner (variable à `false` et nouveau tag ; sur DEV,
  variable et redémarrage) ;
- tables, ensuite seulement, sur GO owner :
  - `20261012.down.sql` d'abord : il retire la contrainte `CHECK (reviewed)` (la colonne reste)
    et rend au `CHECK` des raisons son ensemble sans `not_reviewed` ; il échoue tant qu'une ligne
    `not_reviewed` existe, exige le code d'avant ADR-115, et porte sa propre transaction ;
  - puis `20261010.down.sql`, qui fait un `DROP` des fonctions et des tables (destructif) ;
- EXPOSE et PRIMARY : surcharge admin à `false`, puis variable à `false` et nouveau tag ;
- frontend : revert de PR.

## 9. PR

**Livrées** :

| PR | Commit | Contenu | Remplace |
|---|---|---|---|
| #1730 | `f9c825c78` | retrait du NN/100, de la barre et des sous-scores | — |
| #1749 | `1b6ae4679` | retrait des pourcentages de fiabilité | — |
| #1751 | `2769de87e` | migration 20261010 + `.down` | #1659 (fermée) |
| #1755 | `671ece0ef` | schéma d'entretien 20261011 | #1663 (fermée) |
| WIKI #112 | `88017732` | builder et schéma d'export | WIKI #102 (fermée) |
| #1758 | `6a09be88e` | writer et pin `88017732` | #1669 (ouverte) |
| #1762 | `9384ef9a7` | `COPY` du `Dockerfile`, drapeau du script PROD | #1661 (ouverte) |
| #1767 | `ad2b8f632` | `not_reviewed`, migration 20261012 | — |
| #1770 | `2215ea8ee` | workflow de régénération | — |
| #1776 | `5b137d134` | `SCRIPT_ONLY` au registre | — |

Autres PR de la chaîne, fusionnées le 2026-10-01 : #1607, #1624 et #1626 (couches de sécurité et
de score), #1618 (`CAUSE_GAMME_MAP`) et #1608 (retrait de `forbidden_claims_runtime`). WIKI #103
(`938026e5d9`) a ajouté les champs d'ADR-112 et ADR-113 ; WIKI #100 a promu `filtre-a-huile` le
2026-09-30.

**Restantes** : WIKI #101 (garde sur push), PR-C, PR-D, PR-E, diffs L2 (owner).

## 10. Critères de succès

Les critères sont ceux d'ADR-035 D6, amendé par ADR-115 D2. État :

| Critère | État au 2026-10-14 |
|---|---|
| D6.1 — premier run honnête, `exported = projected + conflicts` | non observé (aucun run) ; attendu au §3 |
| D6.2 — ligne vivante au run suivant, sans intervention en base | non observé |
| D6.3 — une panne de lecture n'est jamais une absence de preuve | à construire (PR-D) |
| D6.4 — aucune fiche approuvée modifiée, rien de créé | respecté par les PR livrées |
| Aucun nombre par lien affiché (ADR-035 D3) | atteint par #1730 ; #1749 retire en plus les fiabilités fixes des pages `/diagnostic-auto` (ADR-112 D13) |
| Ratchets verts, baselines déclarées | verts ; baseline du ratchet des sinks à rafraîchir par PR-D |

## 11. Vérifications faites avant le plan (2026-09-30)

Tableau d'origine abrégé : colonne « Méthode » et ligne de l'API admin des drapeaux retirées, la
surcharge à chaud du drapeau du writer ayant été abandonnée. Une note datée signale chaque état
changé.

| Point | Résultat (2026-09-30) | Note au 2026-10-14 |
|---|---|---|
| Unicité des trois résolutions | liens 113, 114, 117 uniques | inchangé ; 112 et 152 pour filtre-a-huile |
| `filtre_carburant_injection` | système injection (12), aucun lien actif avec `perte_puissance_filtration` | inchangé |
| `gate_safety_unsourced` sur filtre-d-habitacle | ne s'applique pas (filtration hors des 6 familles) | — |
| Transport du pin | PR Dependabot `gitsubmodule`, fusion humaine | pin posé par #1758 ; chaîne observée sur #1758, jamais sur un bump Dependabot (§4.2) |
| Visibilité des dépôts | WIKI public, RAW privé | inchangé |
| Garde d'activation | bloquante sur PR, vacante sur push, `main` non protégée | `main` protégée le 2026-10-09 ; push : WIKI #101 |
| Retrait du builder SEO | `UNRECONCILED`, conservation, exit ≠ 0 | repris par le builder diagnostic |
| Verdict squawk | aucune exemption nécessaire | confirmé (20261010, 20261012) |
| Régénération des types DB | sans objet (`echo`) | `echo` inchangé ; types régénérés par des PR `chore(types)`, sans les 3 tables (§4.4) |
| Exemption ShellCheck | `SC1090` seule | script frère non créé ; directive en place, CI verte sur #1762 ; nécessité non retestée (§4.8) |

## 12. Hors périmètre

- Les phases 2 à 5 d'ADR-112 : capture des sources, mode « créer ou remplacer », moteur à niveaux
  de preuve, entretien.
- Outillage du flux d'activation des sources (SP2 de la version d'origine), exécuté trois fois à la
  main (§4.3) : sous-projet distinct.
- Retrait de `relative_score` et des liens non sourcés : spec propre.
- Pages SEO diagnostic indexées.
- **Signalé seulement** :
  - dérive du miroir Zod (§4.1) ;
  - `validate-exports-diagnostic` non requis (§4.2) ;
  - ratchet des sinks : tables et RPC absentes, détecteur aveugle à `public.` (§4.5) ;
  - aucune purge des runs et des conflits (§4.4) ;
  - `dev_readonly` garde le `SELECT` sur les 3 tables (§4.4) ;
  - types DB sans les 3 tables de projection (§4.4) ;
  - registre : aucun objet DB n'a de domaine ni de propriétaire, dont les 3 tables et les 2 RPC
    (§4.8) ;
  - scheduler sans test d'environnement, et `DIAGNOSTIC_PROJECTION_CRON` vide qui supprime le run
    nocturne avec un simple log (§4.5) ;
  - des commentaires du module nomment `BullMQ`, alors que le code est en Bull v4 ;
  - le texte de `buildSafetyAlert` dépend du rang (§4.6, ADR-112 D5) ;
  - la règle ast-grep `backend-no-remote-io-in-onmoduleinit` ne voit pas le champ `this.queue`
    (§4.8) ;
  - nécessité de `SC1090` non retestée sous ShellCheck (§4.8) ;
  - dérive de schéma : `__diag_maintenance_operation` est désormais capturée (#1755), mais
    `__diag_context_questions`, `__diag_safe_phrases`, `__diag_related_parts`,
    `__diag_symptom_family` et `__diag_symptoms` n'ont toujours aucune migration `CREATE`.

## 13. Couverture de cette spec (2026-10-14)

| Élément | Statut |
|---|---|
| PR livrées, commits, tags (§0, §9) | Vérifié (`gh`, `git` sur origin/main, `git tag --contains`) |
| Relations WIKI, catalogue, exports au pin et sur `main` du WIKI (§1, §3, §4.2) | Vérifié (WIKI en lecture seule) |
| Attendu du premier run (§3) | Partiellement vérifié : calcul hors ligne, aucun run |
| Liens et dates de création, tables, droits, contraintes `NOT VALID`, comptes à 0 (§1, §4.4) | Vérifié (DB en lecture seule) |
| Migrations, writer, régénération, script PROD (§4.4 à §4.8) | Vérifié (code de `main` ; 138 tests du writer, du drapeau et du référentiel, 54 du script PROD, relancés le 2026-10-14) |
| Garde d'activation, rulesets du WIKI et WIKI #101 (§4.3) | Vérifié (`gh api`) |
| Moteur et frontend restants (§4.6, §4.7) | Vérifié pour l'état actuel ; conception non implémentée |
| Nécessité de l'exemption `SC1090` | Non vérifié : ShellCheck absent de l'environnement de travail |
| Comportement runtime du writer sur DEV et en PROD | Non vérifiable avant activation (GO owner) |

## 14. Révisions lors de la planification (2026-09-30 et 2026-10-01)

La version complète de cette section, et des plans, reste lisible dans #1658. Les points
d'implémentation qu'elle fixait sont repris aux §4.2 à §4.8, alignés sur le code livré : enveloppe
et index d'export, régénération, garde, timeouts, identifiants et `link_id` en `bigint`,
contraintes de runs, retour de RPC validé par Zod, appel des deux RPC par `callRpc` derrière
`RpcGateService` (nom en littéral pour le ratchet des sinks, §4.5), test de composition DI du
module (2 tests, #1758), skip `READ_ONLY`, endpoint admin, codes du chargeur, référentiel à compte
exact, plomberie PROD, entrées L2 (chacune citée une seule fois au §4.8). La conception du
moteur et du frontend est reprise aux §4.6 et §4.7.

Non repris ou abandonnés :

- surcharge volatile du drapeau du writer : remplacée par la variable d'environnement et un
  redémarrage ;
- propriété des migrations `[MISSING_BOTH]` : devenue sans objet (globs D4 posés par l'owner,
  §4.4).

## 15. Révisions après auto-revue (2026-09-30)

Également lisibles dans #1658. Encore pertinents :

- **retirés** : télémétrie via `__seo_event_log`, affichage de `part_role` ;
- **devenus sans objet** : retrait de `cause_slug` et de l'`amends: ADR-033`, puisque WIKI #103 et
  ADR-112 ont depuis ajouté ces champs et cet amendement ;
- **corrigés dans la mise à jour du 2026-10-14** : comptage et origine des 162 liens (§1), mode de
  régénération et horaire (§4.2), mode de sécurité des RPC (§4.4).
