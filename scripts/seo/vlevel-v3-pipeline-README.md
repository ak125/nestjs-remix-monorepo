# V-Level — CLI de préparation des packs

[`vlevel-v3-pipeline.ts`](vlevel-v3-pipeline.ts) prépare des propositions V-Level et des fichiers
locaux. Il **ne modifie pas la base et n'exécute pas le SQL produit**. L'ordre des opérations,
les invariants métier et les conditions d'une exécution séparée sont dans le
[runbook par gamme](../../.claude/knowledge/ops/vlevel-v3-gamme-procedure.md).

## Commandes et fichiers

Exécuter depuis la racine du dépôt, uniquement contre une base dont la lecture est autorisée.
Les scripts npm disponibles sont définis dans [`package.json`](../../package.json) ; les modes
pris en charge sont dans le dispatch final du CLI. Les exemples ci-dessous ne lancent aucun apply DB.

Les modes de préparation chargent `SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY` depuis
l'environnement, sinon `backend/.env`, et utilisent des lectures `.select()` via le SDK Supabase.
Vérifier la cible avant de les lancer : le nom « dry-run » n'isole pas l'environnement.
Le [seed de preuves web](vlevel-v3-web-evidence.json) est alimenté manuellement.

**Préserver les sorties existantes.** Le CLI utilise `PACK_DATE`, avec un défaut fixe `2026-06-06`.
Fournir une date explicite et vérifier les chemins de sortie avant chaque génération : relancer
le même mode sur le même lot avec la même date peut écraser les fichiers. La date seule n'assure
pas l'unicité. `apply-pack` écrit à côté du CSV et remplace son suffixe `.csv` par `.apply-dryrun.sql` ;
utiliser un fichier portant bien l'extension `.csv` et préserver l'éventuelle sortie précédente.

```bash
# Exemple Bash : choisir un lot autorisé et vérifier les sorties avant exécution.
PACK_DATE="$(date +%F)" npm run vlevel:v3:decision-pack -- --pg-id 82
# Remplacer le chemin ci-dessous par le CSV du lot effectivement relu par l'owner.
npm run vlevel:v3:validate-pack -- --file audit/lot-relu.csv
PACK_DATE="$(date +%F)" npm run vlevel:v3:apply-pack -- --file audit/lot-relu.csv --dry-run
```

## Sorties et portée

| Mode | Sorties locales | Limite |
|---|---|---|
| `decision-pack` | `audit/`, Markdown + CSV + JSON | propositions à faire trancher par l'owner |
| `generics-pack` | `audit/`, CSV + JSON | génériques V2/V3/V4 ; pas de SQL produit par ce mode |
| `decontaminate-pack`, `reelection-pack` | `audit/`, Markdown + CSV + JSON + SQL | SQL spécialisé avec gardes, à relire pour le lot courant |
| `auto-plan` | `audit/`, CSV + JSON + SQL | SQL des seuls changements `AUTO_APPLY_SAFE` ; ce label n'autorise aucune exécution |
| `blocked-plan` | `audit/`, CSV + JSON + Markdown | diagnostic et candidats, pas d'apply |
| `blocked-apply-pack` | `scripts/seo/`, SQL | proposition gardée pour les cas clairs retenus |
| `validate-pack` | console | contrôles locaux du CSV, sans lecture DB |
| `apply-pack --dry-run` | console + fichier `.apply-dryrun.sql` | proposition SQL non exécutée, sans les gardes des packs spécialisés |

## Revue et limites de validation

`decision-pack` propose notamment `APPROVE_CANDIDATE`, `APPROVE_DISTINCT_CANDIDATE`,
`REVIEW_OWNER`, `DEFER_REMAP` ou `DEFER_CATALOG_GAP`. Les critères sont définis dans
`decisionPack` ; ils ne sont pas interchangeables avec ceux de `autoPlan`.
L'owner tranche dans `owner_decision` : `APPROVE`, `APPROVE_DISTINCT`, `REVIEW`, `DEFER` ou `REJECT`.
Seules les deux premières valeurs sont retenues par `validate-pack` et `apply-pack`.

`validate-pack` vérifie un type cible renseigné, la forme de l'URL `/pieces/...html` et la
cohérence du `pg_id` dans l'URL lorsque les colonnes nécessaires sont présentes. Il signale
les propositions non tranchées, sans les rendre bloquantes. Il ne vérifie ni l'état courant
DB, ni la disponibilité réelle de la page, ni l'authenticité du GO owner. Un résultat vert
peut donc porter sur **zéro ligne approuvée**.

`apply-pack --dry-run` lit le CSV sans appeler `validate-pack` : lancer et examiner la validation
séparément. Le SQL proposé contient des `UPDATE` et des commentaires de retour arrière ;
il n'embarque ni transaction, ni contrôle `ROW_COUNT`, ni garde sur l'ancien `type_id`.
Il ne constitue donc pas le package d'exécution gardé exigé par le runbook. Le relire et préparer
les gardes, le snapshot et le rollback avant toute exécution distinctement autorisée.

`apply-pack --apply --owner-approved` est **refusé** avec le code de sortie 2, avant lecture
du CSV. Ce refus ne dépend pas d'une approbation : l'apply réel n'est pas implémenté dans ce CLI.
