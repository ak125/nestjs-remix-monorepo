# Tools - Scripts OPS & Utilitaires

Ce dossier contient les scripts OPS et outils de développement.

> **ATTENTION**: Ces scripts ne doivent JAMAIS être exécutés en production sans le flag `ALLOW_PROD_MUTATION=1`.

---

## Structure

```
tools/
├── scripts/           # Scripts OPS migrés depuis backend/
│   ├── seo/          # Scripts SEO (switches, gammes, etc.)
│   ├── data/         # Import/export de données
│   ├── diagnostic/   # Scripts de diagnostic
│   └── deploy/       # Scripts de déploiement RPC
└── README.md         # Ce fichier
```

---

## Inventaire des Scripts (76 fichiers)

### Catégorie: SEO (15 scripts)

| Script | Risque | Description |
|--------|--------|-------------|
| `generate_all_seo_switches.js` | **HIGH** | Génère 30 switches par gamme (10k+ records) |
| `populate_seo_gamme_car_switch.js` | **HIGH** | Population table __seo_gamme_car_switch |
| `fix-seo-switches.js` | **HIGH** | Corrige les switches Alias 3 |
| `check_seo_switches.js` | LOW | Vérifie les switches existants |
| `check_seo_marque.js` | LOW | Vérifie les marques SEO |
| `check_noindex.js` | LOW | Vérifie les pages noindex |
| `check_noindex_gammes.js` | LOW | Vérifie les gammes noindex |
| `query-seo.js` | LOW | Requêtes SEO diagnostiques |

### Catégorie: V-Level (8 scripts)

| Script | Risque | Description |
|--------|--------|-------------|
| `recalculate-vlevel.js` | **HIGH** | Recalcule V-Level pour une gamme |
| `check-vlevel.js` | LOW | Vérifie les V-Levels |
| `assign-v4.js` | MEDIUM | Assigne V-Level v4 |
| `assign-v4-fixed.js` | MEDIUM | Version fixée |
| `check-v2-duplicates.js` | LOW | Vérifie doublons v2 |
| `check-v3-candidates.js` | LOW | Vérifie candidats v3 |
| `debug-v4.js` | LOW | Debug V-Level v4 |
| `diagnose-v2.js` | LOW | Diagnostic v2 |

### Catégorie: Data Import (10 scripts)

| Script | Risque | Description |
|--------|--------|-------------|
| `import_agent2_data.js` | **HIGH** | Import données Agent 2 SEO |
| `import-volumes.js` | MEDIUM | Import volumes recherche |
| `fetch_trends_volumes.js` | LOW | Fetch volumes Google Trends |
| `get_gammes_search_volume.js` | LOW | Get volumes par gamme |
| `get_google_ads_volumes.js` | LOW | Get volumes Google Ads |
| `sync_trends_check.js` | LOW | Sync check trends |
| `compare_agent_data.js` | LOW | Compare données agents |
| `test_agent_10.js` | LOW | Test agent 10 |

### Catégorie: Diagnostic (20+ scripts)

| Script | Risque | Description |
|--------|--------|-------------|
| `check-db-stats.js` | LOW | Stats base de données |
| `check-tables.js` | LOW | Vérifie structure tables |
| `check-tables-columns.js` | LOW | Vérifie colonnes |
| `check-type-id.js` | LOW | Vérifie type IDs |
| `check-models.js` | LOW | Vérifie modèles |
| `check-bestsellers-data.js` | LOW | Vérifie données bestsellers |
| `check-function-exists.js` | LOW | Vérifie fonctions RPC |
| `diagnose-performance.js` | LOW | Diagnostic performance |
| `analyze-options.js` | LOW | Analyse options |
| `analyze_gammes_structure.js` | LOW | Analyse structure gammes |

### Catégorie: Deploy RPC (5 scripts)

| Script | Risque | Description |
|--------|--------|-------------|
| `deploy-rpc-function.js` | MEDIUM | Deploy RPC function |
| `deploy-rpc-function-v2.js` | MEDIUM | Deploy RPC v2 |
| `deploy-rpc-v2.js` | MEDIUM | Deploy RPC v2 alt |
| `deploy-rpc-bestsellers.js` | MEDIUM | Deploy bestsellers RPC |
| `deploy-oem-refs-rpc.js` | MEDIUM | Deploy OEM refs RPC |

### Catégorie: Clio/Renault (8 scripts)

| Script | Risque | Description |
|--------|--------|-------------|
| `find_clio3.js` | LOW | Trouve Clio 3 |
| `populate_clio3_pilot.js` | MEDIUM | Populate pilot Clio 3 |
| `find-clio2-type.js` | LOW | Trouve type Clio 2 |
| `list-clio2-motors.js` | LOW | Liste moteurs Clio 2 |
| `check-clio-structure.js` | LOW | Vérifie structure Clio |
| `check-type-9040.js` | LOW | Vérifie type 9040 |
| `fix-clio2-type-id.js` | MEDIUM | Fix type ID Clio 2 |
| `fix-clio2-execute.js` | **HIGH** | Exécute fix Clio 2 |

---

## Kill-Switch Production

Tous les scripts **HIGH** risk ont un kill-switch en tête de fichier :

```javascript
// ============================================
// KILL-SWITCH PRODUCTION (P0.5 - 2026-02-02)
// ============================================
if (process.env.NODE_ENV === 'production' && process.env.ALLOW_PROD_MUTATION !== '1') {
  console.error('\n⛔ ERREUR: Ce script ne peut pas s\'exécuter en production.');
  console.error('   Pour forcer: ALLOW_PROD_MUTATION=1 node script.js');
  process.exit(1);
}
```

---

## Usage

### Exécuter un script en DEV

```bash
cd backend
node generate_all_seo_switches.js --dry-run
node generate_all_seo_switches.js --limit=5
```

### Exécuter en PROD (avec autorisation explicite)

```bash
ALLOW_PROD_MUTATION=1 NODE_ENV=production node script.js
```

---

## Migration Progressive

Les scripts restent dans `backend/` pour le moment.
Ce README documente leur existence et catégorisation.

Phase suivante : déplacer progressivement vers `tools/scripts/` avec mise à jour des chemins.

---

## Référence

- [MIGRATION_PLAN_DEV_PREPROD_PROD.md](../docs/MIGRATION_PLAN_DEV_PREPROD_PROD.md)
- [Phase P2 - Industrialiser OPS scripts](../docs/MIGRATION_PLAN_DEV_PREPROD_PROD.md#phase-p2--industrialiser-ops-scripts--data)
