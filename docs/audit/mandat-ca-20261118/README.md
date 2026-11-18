# Mandat CA — Hygiène de la base massdoc, étape 1

Départements 22 (data) et 21 (runtime). Relevé du 2026-11-18, en lecture seule.
Rien n'a été écrit en base, aucune migration n'est écrite, aucun cron n'est changé.

## La réponse en trois lignes

- La base compte **718 « tables »** dans le schéma public. **355** ne sont que des
  tranches de 17 tables partitionnées : il reste **363 vraies tables**.
- **210 sont utiles** aujourd'hui. **39 peuvent être rangées** dans `_archive`
  (38 mortes, 1 copie datée). **101 demandent une réponse** avant toute décision ;
  chacune porte sa question.
- **4 sont prévues** par une décision de Marwane (`support_tickets`, `reviews`,
  `__abandoned_cart_emails`, `___xtr_invoice`) et **1 est à retirer après
  tarissement** (`__seo_gamme_conseil`, décision 32) : aucune n'est archivée.
- Les 8 copies `pieces_media_img_*` restent en place : zone interdite.

Toutes les mesures sont **mesurées** en base ou dans le dépôt ; le classement est
**déduit** de ces mesures ; les durées sont **proposées** ; ce qui manque est dit
**non fait** (section Limites de l'inventaire).

## Les fichiers

| Fichier | Rôle |
|---|---|
| `audit/massdoc-table-inventory-2026-11-18.md` | Inventaire lisible : réponse, synthèses par classe et par département, partitions, `cf_rum`, écart avec `partition-cron-gap`, tables à trancher, une ligne par table, limites |
| `audit/massdoc-table-inventory-2026-11-18.json` | Le même inventaire pour les machines (lu par le validateur) |
| `config/db-retention/retention-rules.yaml` | Règles de conservation par famille et par table partitionnée — **toutes au statut « proposé »** |
| `config/db-retention/retention-rules.schema.json` | Schéma des règles |
| `scripts/governance/validate-db-retention.js` | Validateur (même modèle que `validate-agent-operating-map.js`) |
| `scripts/governance/__tests__/validate-db-retention.test.mjs` | 10 tests `node:test` |
| `scripts/governance/__fixtures__/db-retention*.invalid.*` | Fichiers faux que le validateur doit refuser |
| `docs/audit/mandat-ca-20261118/candidats-archivage.md` | Les 39 candidats, au format du lot D, avec leurs preuves |
| `docs/audit/mandat-ca-20261118/sql/` | Les SELECT exécutés |
| `docs/audit/mandat-ca-20261118/out/` | Leurs résultats bruts, horodatés UTC (noms, comptes, tailles), et la sortie brute des tests du validateur (`validator-tests.txt`) |
| `docs/audit/mandat-ca-20261118/scripts/` | Les scripts de croisement et de classement |
| `docs/audit/mandat-ca-20261118/ci-patch.diff` | Branchement CI proposé, **non appliqué** |

## Les six classes

| Classe | Règle (déduite des mesures) |
|---|---|
| vivante | écrite depuis le 2026-09-17, ou lue par le code de l'application, ou écrite/lue par une fonction SQL appelée, ou appelée ≥ 100 fois par le rôle de l'API |
| prévue | une décision de Marwane prévoit la table (citée par le pilotage, inventaire §7 bis), ou table créée après le 2026-09-01 et jamais écrite ; jamais archivable |
| à retirer après tarissement | plus alimentée par décision, retirée quand plus rien ne la lit ; jamais archivable tant qu'une page la lit |
| copie datée | nom daté ou de sauvegarde (`_AAAAMMJJ`, `backup`, `_old`…) |
| morte | aucun code, aucune dépendance SQL (vue, fonction, cron, clé étrangère entrante), 0 écriture, presque aucune lecture |
| à trancher | tout le reste : chaque ligne porte la question à poser |

Les décisions viennent de la feuille des décisions de Marwane, que l'agent ne
lit pas : numéro et texte sont ceux cités par le pilotage (complément CA-2). Le
constat du code est mesuré à côté ; quand le code dit autre chose (`reviews` :
les avis sont rangés aujourd'hui dans `___xtr_msg`), c'est écrit.

Une table que seul un cron d'entretien touche (rotation de partitions, RLS) et qui
est vide n'est pas comptée vivante : elle est à trancher.

## Ce que Marwane décide

1. **Les durées** de `retention-rules.yaml` (30 j, 90 j… sont des propositions).
   Une règle passe à `fixé` avec `decided_by` et `decided_on` ; le validateur
   refuse un `fixé` sans ces deux champs.
2. **Chaque lot d'archivage** (F1 : 19 tables ; F2 : 20 tables `__seo_*`, `__diag_*`,
   `kg_*` soumises à décision écrite). Migration écrite dans un mandat suivant,
   passée par « 🗄️ Apply Supabase migrations (manual) », essai à blanc d'abord.
3. **Le collecteur `cf_rum`** : l'activer, ou retirer la table de la rotation.
4. **Les 101 questions** des tables à trancher (inventaire §7).
5. **La fusion** de cette PR et le branchement CI.

## Relancer les contrôles

Comme `validate-agent-operating-map.js`, le validateur lit `js-yaml`, `ajv` et
`ajv-formats`, que la CI installe par `npm ci --ignore-scripts` avant l'étape des
contrats de département. Un worktree sans `node_modules` ne les trouve pas
(« Cannot find module 'js-yaml' », même message pour le validateur voisin). Sur le
DEV, sans rien installer dans le worktree :

```bash
export NODE_PATH=/opt/automecanik/app/node_modules  # lecture seule
node scripts/governance/validate-db-retention.js             # 0 = conforme
node scripts/governance/validate-db-retention.js --self-test # les fichiers faux sont refusés
node --test scripts/governance/__tests__/validate-db-retention.test.mjs
```

## Branchement CI (proposé, non appliqué)

`.github/workflows/` est réservé par CODEOWNERS. Le patch `ci-patch.diff` ajoute
trois lignes à l'étape existante « 🧾 Contrats de département (décision 72,
bloquant) » de `ci.yml`. Pour l'appliquer : `git apply docs/audit/mandat-ca-20261118/ci-patch.diff`.

## Refaire le relevé

1. Exécuter `sql/q*.sql` par l'accès en lecture déjà configuré sur le DEV
   (une transaction en lecture seule, sortie `--csv`), résultats dans `out/`.
2. Depuis le dossier qui contient `out/` :
   `python3 scripts/xref.py <dépôt>`, puis `classify.py <dépôt>`, `finalize.py <dépôt>`,
   `build_deliverables.py <dépôt> <commit>`.

Résultats non versionnés car trop lourds et sans valeur de preuve propre :
`q9_funcs.csv` (sources des fonctions, 0,7 Mo), `q10_ledger.csv` (texte des
migrations appliquées, 1,5 Mo, déjà dans le dépôt), et les fichiers intermédiaires
`xref.json`, `classified.json`, `final.json` (repris dans l'inventaire JSON).

## Hors périmètre, signalé sans correction

- 8 tables partitionnées reçoivent des tranches sans jamais en supprimer
  (`__seo_gsc_daily_*` ×4, `__seo_quality_history`, `pieces_price_history`,
  `pricing_decision_snapshot`, `supplier_offer_snapshot`).
- `__seo_snapshot_cf_rum` : 105 tranches vides, collecteur jamais activé ici.
- Le contrôle `partition-cron-gap` ne voit ni la rétention absente, ni les tables
  tournées mais vides, ni les partitions par liste (`rm_listing_products`).
- Le registre `supabase_migrations.schema_migrations` s'arrête au 2026-10-04 alors
  que les lots B et D sont appliqués en base.
- `__cnit_raw` est lue (≈ 8 400 parcours d'index) sans lecteur dans le dépôt.
- `___xtr_invoice` : 19 appels du rôle de l'API, aucun code dans le dépôt.
