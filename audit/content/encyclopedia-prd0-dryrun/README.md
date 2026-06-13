# PR-D.0 — Dry-run générateurs DB-first (validation owner) — **étalon v2**

> Plan « RAW Encyclopédie » (approuvé owner 2026-06-12) + **raffinement owner 2026-06-13
> (axe motorisation)**. Artefacts **régénérés le 2026-06-13** par
> `scripts/wiki-generators/vehicle-from-db-generator.py` et
> `scripts/wiki-generators/diagnostic-from-db-generator.py` en `--dry-run --out-dir /tmp/prd0-dryrun-v2/`,
> copiés ici tels quels pour review. **Aucune écriture dans le RAW ni en DB** (SELECT only ;
> sortie hors worktree dans `/tmp`, puis copie manuelle ici).
>
> La « fiche idéale » se juge ici, à coût 5+1, avant PR-D.1 (top 50 + 13 systèmes).

## Quoi de neuf dans l'étalon v2 (raffinement owner 2026-06-13)

La **motorisation est un axe transverse** (diesel ≠ essence ≠ électrique ≠ hybride →
pannes / symptômes / intervalles différents), pas un simple champ. Granularité
**progressive « carburant d'abord, famille-moteur ensuite »** :

**Véhicule** (`vehicle-from-db-generator.py`) :
- La liste `motorizations[]` reste **exhaustive** (chaque `auto_type` avec provenance
  champ par champ, `engine_code: null` honnête) ET le markdown reste sous-titré par
  carburant (déjà le cas).
- **Deux maps BRONZE émises** (schéma v1.1.0) : `known_issues_by_engine{}` et
  `maintenance_by_engine{}`, une entrée **par groupe carburant présent** + par couple
  **carburant × cylindrée**. Squelette BRONZE : `issues: []` / `operations: []` (rempli
  au scraping PR-C.2, jamais inventé).
- **Clés NORMALISÉES — aucune clé libre.** Trois formes seulement :
  `fuel:<carburant>` · `fuel_displacement:<carburant>:<bucket_L>` ·
  `engine_family:<code>` (réservé scraping). Chaque entrée porte **`axis_key_type`**
  (`fuel` / `fuel_displacement` / `engine_family`) — lève l'ambiguïté du nom
  `…_by_engine` quand la clé est en réalité un carburant.
- **Classe carburant canonique** (diesel/essence/electrique/hybride/gpl) : les carburants
  composites DB sont rattachés de façon déterministe et documentée (`<X>-Électrique`
  → hybride ; `Essence-Gaz GPL/GNC` → gpl ; `Essence-Éthanol` → essence). La liste
  exhaustive `motorizations[]` conserve le carburant DB verbatim + validation_note.
- **Convention provenance** des entrées éditoriales (squelette prévu pour le scraping
  PR-C.2) : `applies_to: {make, model_generation, fuel, engine_family, market}` +
  `source: {type, source_market: FR|EU|DE|UK|US|unknown, lang_original, confidence,
  evidence_id}` — un modèle a des motorisations ≠ selon le marché ; FR-only, reformulé.

**Diagnostic** (`diagnostic-from-db-generator.py`) :
- Champ **`fuel_aware`** en frontmatter. `true` **uniquement** pour les **systèmes
  moteur** (symptômes/causes fuel-dépendants) — slugs DB `injection` (« Injection et
  alimentation », couvre l'alimentation), `distribution`, `refroidissement` — qui
  structurent leurs sections éditoriales (TODO PR-C.2) **par carburant**.
- `false` pour les systèmes **châssis/sécurité** (un frein reste un frein) : freinage,
  direction, suspension, eclairage, transmission, embrayage, echappement, filtration,
  climatisation, demarrage_charge. **Ce dry-run = freinage → `fuel_aware: false`**,
  fuel-agnostic (pas de dimension carburant).

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
- **Maps fuel-aware v2** : `known_issues_by_engine` / `maintenance_by_engine` portent 8 clés
  normalisées chacune — `fuel:diesel`, `fuel:essence` + `fuel_displacement:{diesel:2.0,
  diesel:3.0, essence:1.6, essence:2.0, essence:2.5, essence:3.0}` — cohérent avec les
  buckets cylindrée SQL (Diesel 2.0×12/3.0×8 ; Essence 1.6×2/2.0×7/2.5×6/3.0×13). Chaque
  entrée : `axis_key_type` + `applies_to` (make/model_generation/fuel/engine_family:null/
  market:unknown) + `source` DB + `issues: []`/`operations: []` (BRONZE) ✓

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
- **`fuel_aware: false`** (v2) : le freinage est un système châssis/sécurité — fuel-agnostic,
  pas de dimension carburant (un frein reste un frein). La fiche porte une note explicite
  dans le body ; le contenu éditorial (PR-C.2) restera commun à toutes les motorisations.
  Les systèmes moteur (`injection`, `distribution`, `refroidissement`) porteront au contraire
  `fuel_aware: true` + sections « Spécificités par carburant » par carburant.

## Garanties anti-écrasement (testées)

1. **Mode défaut (create-missing)** : skip si le fichier existe — jamais d'écrasement.
2. **`--merge-managed-blocks`** : réécrit UNIQUEMENT les blocs frontmatter délimités
   (`# >>> DB-MANAGED BLOCK: …` / `# <<< END DB-MANAGED BLOCK: …`) —
   vehicle : `db_profile` / `motorizations` / **`known_issues_by_engine`** /
   **`maintenance_by_engine`** / `validation_notes` (v2 : +2 maps) ;
   diagnostic : `db_profile` / `symptoms` / `probable_causes` / `maintenance_db` /
   `validation_notes`.
   Test unitaire exécuté (v2) : éditorial (body, clés frontmatter humaines)
   **byte-à-byte intouché** ; fiche legacy sans les 2 nouveaux marqueurs → insertion
   **additive** avant le `---` fermant, zéro octet existant modifié, YAML toujours parseable.
3. **`--dry-run`** exige `--out-dir` (refus d'écrire dans le RAW en dry-run) ; étalon v2
   généré hors worktree (`/tmp/prd0-dryrun-v2/`).
4. YAML frontmatter des 6 fiches : parse OK (`yaml.safe_load`).
5. **Clés motorisation 100% normalisées** (regex `^(fuel|fuel_displacement|engine_family):`)
   sur les 88 entrées des maps des 5 fiches véhicule ; chaque entrée a `axis_key_type`
   cohérent avec le préfixe de clé ; squelettes `issues`/`operations` vides (BRONZE).
6. Provenance champ par champ : `source: {type: db, table: …, confidence: high}` sur chaque
   motorisation / symptôme / cause / op / entrée de map ; `truth_level: L1`,
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
6. **Carburant composite DB** : `'Diesel-Électrique'` (type_id 58962, S212) → la liste
   exhaustive `motorizations[]` le conserve lowercase + validation_note (no silent fallback) ;
   pour les clés des maps fuel-aware, il est rattaché à la **classe canonique `hybride`**
   (thermique + électrique) de façon déterministe et documentée → clé `fuel:hybride`.
7. **`brake_slide_pins_dry`** : aucune op d'entretien matchée → `related_gammes: []` +
   validation_note (renvoi gamme à compléter éditorialement).
8. **`__diag_system` slugs réels (13, constat 2026-06-13)** : `freinage`, `demarrage_charge`,
   `refroidissement`, `distribution`, `embrayage`, `suspension`, `direction`, `echappement`,
   `filtration`, `injection` (label « Injection et alimentation »), `climatisation`,
   `transmission`, `eclairage`. **Systèmes moteur `fuel_aware: true`** = `injection`,
   `distribution`, `refroidissement` (l'« alimentation » de l'owner est fusionnée dans
   `injection`). Tous les autres = `fuel_aware: false`.

## Reproduction

```bash
python3 scripts/wiki-generators/vehicle-from-db-generator.py --top 5 --dry-run --out-dir /tmp/prd0-dryrun-v2
python3 scripts/wiki-generators/diagnostic-from-db-generator.py --system freinage --dry-run --out-dir /tmp/prd0-dryrun-v2
# (spot-check système moteur fuel-aware, non inclus dans l'étalon) :
# python3 scripts/wiki-generators/diagnostic-from-db-generator.py --system injection --dry-run --out-dir /tmp/check
```

Env : `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (chargés depuis `backend/.env` si absents,
override via `BACKEND_ENV_FILE`). Lecture seule : GET REST paginé (Range headers, cap 1000).
