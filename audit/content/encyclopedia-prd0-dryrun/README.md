# PR-D.0 — Dry-run générateurs DB-first (validation owner)

> Plan « RAW Encyclopédie » (approuvé owner 2026-06-12). Artefacts générés le 2026-06-12
> par `scripts/wiki-generators/vehicle-from-db-generator.py` et
> `scripts/wiki-generators/diagnostic-from-db-generator.py` en `--dry-run --out-dir /tmp/prd0-dryrun/`,
> copiés ici tels quels pour review. **Aucune écriture dans le RAW ni en DB** (SELECT only,
> `git status` du repo RAW vérifié inchangé avant/après).
>
> La « fiche idéale » se juge ici, à coût 5+1, avant PR-D.1 (top 50 + 13 systèmes).

## Contenu

| Fichier | Type | Source DB |
|---------|------|-----------|
| `vehicles/*.md` (5) | Fiche véhicule maille modèle-génération | `auto_marque` / `auto_modele` / `auto_type` / `auto_type_motor_code` |
| `diagnostic/freinage.md` | Fiche diagnostic maille SYSTÈME (ADR-033 : jamais 1 fichier/symptôme) | `__diag_system` / `__diag_symptom` / `__diag_cause` / `__diag_maintenance_operation` |

## Sélection top 5 (sans V-Level)

Classement par **nb de type_id actifs legacy** (`type_id::int < 60000`, `type_display='1'`)
× **récence** (`modele_year_to IS NULL OR >= 2010`). Tie-break déterministe : count DESC,
`modele_id` ASC. Équivalent SQL :

```sql
SELECT t.type_modele_id, COUNT(*) AS active_types
FROM auto_type t
WHERE t.type_id::int < 60000 AND t.type_display = '1'
GROUP BY t.type_modele_id
-- joint auto_modele ; filtre modele_year_to IS NULL OR modele_year_to::int >= 2010 ;
-- tri active_types DESC, modele_id ASC
```

Univers : **11 660 types actifs legacy**, 1 371 modèles distincts.

| Rang | Slug fiche | modele_id | Types actifs | Carburants | Années |
|------|-----------|-----------|--------------|------------|--------|
| 1 | `bmw-serie-3-e90` | 33028 | **48** | 28 essence / 20 diesel | 2004-2012 |
| 2 | `bmw-serie-5-e60` | 33052 | **42** | 25 essence / 17 diesel | 2001-2010 |
| 3 | `bmw-serie-3-touring-e91` | 33043 | **41** | 23 essence / 18 diesel | 2004-2012 |
| 4 | `iveco-daily-iv-chassis-cabine` | 84015 | **41** | 41 diesel | 2006-2012 |
| 5 | `mercedes-benz-classe-e-t-model-s212` | 108058 | **38** | 23 essence / 14 diesel / 1 diesel-électrique | 2009-2016 |

(Exclu du top 5 par le filtre récence : MERCEDES CLASSE E (W211), 39 types, 2002-2009.)

## Cross-check véhicule témoin (BMW Série 3 E90, modele_id 33028)

Vérifié par requête SQL directe (SELECT, MCP Supabase) vs frontmatter généré :

- **Comptage** : SQL `48 types actifs (20 diesel / 28 essence)` = fiche
  `active_type_count: 48`, `fuel_breakdown: {diesel: 20, essence: 28}` ✓
- **3 échantillons** (type_id 33386 « 316 d » 116 ch/85 kW/2.0 L 2009-2011 ;
  18450 « 325 i (Phase 1) » 218 ch/160 kW/2.5 L ; 11399 « 320 d xDrive » 163 ch/120 kW/2.0 L
  2008-2011) : identiques aux entrées `motorizations[]` ✓
- **motor_code_rows = 0** pour les 3 en SQL → cohérent avec `engine_code: null` + validation_note ✓

## Fiche freinage (maille système)

- **5 symptômes** (`brake_noise_metallic`, `brake_noise_grinding`, `brake_vibration_pedal`,
  `brake_soft_pedal`, `brake_pulling_side`) — slug/label/signal_mode/urgency + source db
- **5 causes** (`brake_pads_worn`, `brake_disc_warped`, `brake_caliper_seized`,
  `brake_slide_pins_dry`, `brake_fluid_low`) — likelihood = projection déterministe de
  `urgency` (haute→high, moyenne→medium, basse→low), `workshop_priority` conservé,
  `related_gammes[]` par match préfixe 2-tokens cause↔op (ex. `brake_pads_worn` ↔
  `brake_pads_replacement` → `plaquette-de-frein`)
- **4 ops d'entretien** → renvoi gammes : `plaquette-de-frein` (pg 402), `disque-de-frein`
  (pg 82), `liquide-de-frein` (pg 479), `etrier-de-frein` (pg 78), avec intervalles km/mois
- `severity: high` (≥1 symptôme urgency `haute`), `audience: client`

## Garanties anti-écrasement (testées)

1. **Mode défaut (create-missing)** : skip si le fichier existe — jamais d'écrasement.
2. **`--merge-managed-blocks`** : réécrit UNIQUEMENT les blocs frontmatter délimités
   (`# >>> DB-MANAGED BLOCK: …` / `# <<< END DB-MANAGED BLOCK: …`) —
   vehicle : `db_profile` / `motorizations` / `validation_notes` ;
   diagnostic : + `symptoms` / `probable_causes` / `maintenance_db`.
   Test unitaire exécuté : éditorial (body, clés frontmatter humaines) **byte-à-byte intouché** ;
   fiche legacy sans marqueurs → insertion additive avant le `---` fermant, zéro octet existant
   modifié, YAML toujours parseable.
3. **`--dry-run`** exige `--out-dir` (refus d'écrire dans le RAW en dry-run).
4. YAML frontmatter des 6 fiches : parse OK (`yaml.safe_load`).
5. Provenance champ par champ : `source: {type: db, table: …, confidence: high}` sur chaque
   motorisation / symptôme / cause / op ; `truth_level: L1`,
   `provenance.ingested_by: script:…@v1`.

## Anomalies DB rencontrées (constat 2026-06-12 — aucune correction DB dans cette PR)

1. **`auto_type_motor_code` quasi vide** : 1 seule ligne sentinelle (`tmc_type_id='0'`,
   `tmc_code=''`). Le join spécifié est implémenté mais ne produit aucun code moteur →
   `engine_code: null` partout + validation_note par fiche (aucun code inventé).
   `kg_engine_families` (10 lignes, Renault-centric) n'est pas une alternative par-type.
   → candidat backfill DB ou complément éditorial sourcé (PR-C.2).
2. **Divergence `__diag_system` ↔ enum schéma wiki diagnostic v1.0.0** : 5 slugs DB sur 13
   hors enum (`demarrage_charge`, `distribution`, `embrayage`, `filtration`, `injection`) ;
   l'enum contient des valeurs absentes de la DB (`alimentation`, `moteur`, `electricite`,
   `carrosserie`, `habitacle`). `freinage` est aligné (ce dry-run). Le générateur trace la
   divergence en validation_notes — alignement schéma à arbitrer avant PR-D.1 (13 fiches).
3. **Colonnes `auto_*` en TEXT** (type_id, années, puissances) — coercition défensive
   `to_int()` systématique (anti-pattern DB connu, skill vehicle-ops).
4. **`modele_year_to` NULL sur des modèles anciens** (ex. NISSAN NAVARA II 1997-, FIAT
   PALIO I 1996-) : traités « encore en production » par le filtre récence. N'affecte pas
   ce top 5 ; à surveiller pour le top 50 (validation_note émise sur les fiches concernées).
5. **`type_liter` en centièmes de litre** (`'200'` → 2.0 L) — convention vérifiée sur
   échantillons (320d/2.0L, 325i/2.5L), projetée en `displacement_l`.
6. **Carburant non normalisé** : `'Diesel-Électrique'` (type_id 58962, S212) hors mapping →
   conservé lowercase + validation_note (no silent fallback).
7. **`brake_slide_pins_dry`** : aucune op d'entretien matchée → `related_gammes: []` +
   validation_note (renvoi gamme à compléter éditorialement).

## Reproduction

```bash
python3 scripts/wiki-generators/vehicle-from-db-generator.py --top 5 --dry-run --out-dir /tmp/prd0-dryrun
python3 scripts/wiki-generators/diagnostic-from-db-generator.py --system freinage --dry-run --out-dir /tmp/prd0-dryrun
```

Env : `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (chargés depuis `backend/.env` si absents,
override via `BACKEND_ENV_FILE`). Lecture seule : GET REST paginé (Range headers, cap 1000).
