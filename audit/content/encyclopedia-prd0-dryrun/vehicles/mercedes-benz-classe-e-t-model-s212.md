---
category: catalog/vehicle
doc_family: catalog
domain: vehicule
source_type: vehicle
title: Fiche véhicule - MERCEDES CLASSE E Break (S212)
truth_level: L1
updated_at: '2026-06-13'
verification_status: verified
doc_id: 491bf1e1-1e96-5f49-aeea-2ff537894b78
lang: fr
make: mercedes-benz
model: classe-e-t-model-s212
generation: S212
years:
- 2009
- 2016
provenance:
  ingested_by: script:vehicle-from-db-generator@v1
  generated_at: '2026-06-13T10:47:19Z'
  source_db: supabase (SELECT only — auto_marque/auto_modele/auto_type/auto_type_motor_code)
content_hash: sha256:9a0ddc7f212a8ab8
# >>> DB-MANAGED BLOCK: db_profile — script:vehicle-from-db-generator@v1 (ne pas éditer à la main)
db_profile:
  modele_id: 108058
  marque_id: 108
  modele_alias: classe-e-t-model-s212
  modele_parent: 108050
  active_type_count: 38
  type_id_scope: legacy < 60000 (type_display='1')
  selection_rank: 5
  fuel_breakdown:
    diesel: 14
    diesel-électrique: 1
    essence: 23
  bodies:
  - Break
  last_db_sync: '2026-06-13T10:47:19Z'
  source:
    type: db
    table: auto_modele + auto_type
    confidence: high
# <<< END DB-MANAGED BLOCK: db_profile
# >>> DB-MANAGED BLOCK: motorizations — script:vehicle-from-db-generator@v1 (ne pas éditer à la main)
motorizations:
- type_id: 31575
  name: 200 CDI BlueTEC
  alias: 200-cdi-bluetec
  engine_code: null
  fuel: diesel
  fuel_class: diesel
  displacement_bucket: '2.2'
  power_ps: 136
  power_kw: 100
  displacement_l: 2.2
  body: Break
  period:
    from_year: 2009
    from_month: 11
    to_year: 2016
    to_month: 12
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 53147
  name: 220 CDI
  alias: 220-cdi
  engine_code: null
  fuel: diesel
  fuel_class: diesel
  displacement_bucket: '2.2'
  power_ps: 163
  power_kw: 120
  displacement_l: 2.2
  body: Break
  period:
    from_year: 2009
    from_month: 8
    to_year: 2014
    to_month: 8
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 31576
  name: 220 CDI BlueTEC
  alias: 220-cdi-bluetec
  engine_code: null
  fuel: diesel
  fuel_class: diesel
  displacement_bucket: '2.2'
  power_ps: 170
  power_kw: 125
  displacement_l: 2.2
  body: Break
  period:
    from_year: 2009
    from_month: 11
    to_year: 2016
    to_month: 12
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 12332
  name: 250 CDI BlueTEC 4-Matic
  alias: 250-cdi-bluetec-4matic
  engine_code: null
  fuel: diesel
  fuel_class: diesel
  displacement_bucket: '2.2'
  power_ps: 204
  power_kw: 150
  displacement_l: 2.2
  body: Break
  period:
    from_year: 2010
    from_month: 7
    to_year: 2016
    to_month: 12
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 31577
  name: 250 CDI BlueTEC
  alias: 250-cdi-bluetec
  engine_code: null
  fuel: diesel
  fuel_class: diesel
  displacement_bucket: '2.2'
  power_ps: 204
  power_kw: 150
  displacement_l: 2.2
  body: Break
  period:
    from_year: 2009
    from_month: 11
    to_year: 2016
    to_month: 12
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 54915
  name: 300 CDI
  alias: 300-cdi
  engine_code: null
  fuel: diesel
  fuel_class: diesel
  displacement_bucket: '3.0'
  power_ps: 204
  power_kw: 150
  displacement_l: 3.0
  body: Break
  period:
    from_year: 2009
    from_month: 12
    to_year: 2010
    to_month: 12
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 33055
  name: 350 D BlueTEC
  alias: 350-d-bluetec
  engine_code: null
  fuel: diesel
  fuel_class: diesel
  displacement_bucket: '3.0'
  power_ps: 211
  power_kw: 155
  displacement_l: 3.0
  body: Break
  period:
    from_year: 2009
    from_month: 11
    to_year: 2013
    to_month: 12
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 31578
  name: 350 CDI
  alias: 350-cdi
  engine_code: null
  fuel: diesel
  fuel_class: diesel
  displacement_bucket: '3.0'
  power_ps: 231
  power_kw: 170
  displacement_l: 3.0
  body: Break
  period:
    from_year: 2009
    from_month: 11
    to_year: 2011
    to_month: 12
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 31579
  name: 350 CDI 4-Matic
  alias: 350-cdi-4matic
  engine_code: null
  fuel: diesel
  fuel_class: diesel
  displacement_bucket: '3.0'
  power_ps: 231
  power_kw: 170
  displacement_l: 3.0
  body: Break
  period:
    from_year: 2009
    from_month: 11
    to_year: 2011
    to_month: 12
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 56076
  name: 300 CDI BlueTEC
  alias: 300-cdi-bluetec
  engine_code: null
  fuel: diesel
  fuel_class: diesel
  displacement_bucket: '3.0'
  power_ps: 231
  power_kw: 170
  displacement_l: 3.0
  body: Break
  period:
    from_year: 2009
    from_month: 11
    to_year: 2016
    to_month: 12
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 59456
  name: 350 D BlueTEC
  alias: 350-d-bluetec
  engine_code: null
  fuel: diesel
  fuel_class: diesel
  displacement_bucket: '3.0'
  power_ps: 252
  power_kw: 185
  displacement_l: 3.0
  body: Break
  period:
    from_year: 2012
    from_month: 11
    to_year: 2016
    to_month: 12
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 59459
  name: 350 D BlueTEC 4-Matic
  alias: 350-d-bluetec-4matic
  engine_code: null
  fuel: diesel
  fuel_class: diesel
  displacement_bucket: '3.0'
  power_ps: 252
  power_kw: 185
  displacement_l: 3.0
  body: Break
  period:
    from_year: 2012
    from_month: 11
    to_year: 2016
    to_month: 12
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 11149
  name: 350 CDI
  alias: 350-cdi
  engine_code: null
  fuel: diesel
  fuel_class: diesel
  displacement_bucket: '3.0'
  power_ps: 265
  power_kw: 195
  displacement_l: 3.0
  body: Break
  period:
    from_year: 2011
    from_month: 7
    to_year: 2013
    to_month: 12
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 11150
  name: 350 CDI 4-Matic
  alias: 350-cdi-4matic
  engine_code: null
  fuel: diesel
  fuel_class: diesel
  displacement_bucket: '3.0'
  power_ps: 265
  power_kw: 195
  displacement_l: 3.0
  body: Break
  period:
    from_year: 2011
    from_month: 7
    to_year: 2013
    to_month: 12
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 58962
  name: 300 BlueTEC Hybrid
  alias: 300-bluetec-hybrid
  engine_code: null
  fuel: diesel-électrique
  fuel_class: hybride
  displacement_bucket: '2.2'
  power_ps: 204
  power_kw: 150
  displacement_l: 2.2
  body: Break
  period:
    from_year: 2011
    from_month: 12
    to_year: 2016
    to_month: 12
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 31580
  name: 200 CGI
  alias: 200-cgi
  engine_code: null
  fuel: essence
  fuel_class: essence
  displacement_bucket: '1.8'
  power_ps: 184
  power_kw: 135
  displacement_l: 1.8
  body: Break
  period:
    from_year: 2009
    from_month: 11
    to_year: 2016
    to_month: 12
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 31581
  name: 250 CGI
  alias: 250-cgi
  engine_code: null
  fuel: essence
  fuel_class: essence
  displacement_bucket: '1.8'
  power_ps: 204
  power_kw: 150
  displacement_l: 1.8
  body: Break
  period:
    from_year: 2009
    from_month: 11
    to_year: 2013
    to_month: 12
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 59461
  name: '200'
  alias: '200'
  engine_code: null
  fuel: essence
  fuel_class: essence
  displacement_bucket: '2.0'
  power_ps: 184
  power_kw: 135
  displacement_l: 2.0
  body: Break
  period:
    from_year: 2012
    from_month: 11
    to_year: 2016
    to_month: 12
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 59464
  name: '250'
  alias: '250'
  engine_code: null
  fuel: essence
  fuel_class: essence
  displacement_bucket: '2.0'
  power_ps: 211
  power_kw: 155
  displacement_l: 2.0
  body: Break
  period:
    from_year: 2012
    from_month: 11
    to_year: 2016
    to_month: 12
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 59468
  name: '300'
  alias: '300'
  engine_code: null
  fuel: essence
  fuel_class: essence
  displacement_bucket: '3.0'
  power_ps: 231
  power_kw: 170
  displacement_l: 3.0
  body: Break
  period:
    from_year: 2009
    from_month: 11
    to_year: 2011
    to_month: 12
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 59453
  name: '400'
  alias: '400'
  engine_code: null
  fuel: essence
  fuel_class: essence
  displacement_bucket: '3.0'
  power_ps: 333
  power_kw: 245
  displacement_l: 3.0
  body: Break
  period:
    from_year: 2013
    from_month: 1
    to_year: 2016
    to_month: 12
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 59454
  name: 400 4-Matic
  alias: 400-4matic
  engine_code: null
  fuel: essence
  fuel_class: essence
  displacement_bucket: '3.0'
  power_ps: 333
  power_kw: 245
  displacement_l: 3.0
  body: Break
  period:
    from_year: 2013
    from_month: 1
    to_year: 2016
    to_month: 12
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 12335
  name: 300 4-Matic
  alias: 300-4matic
  engine_code: null
  fuel: essence
  fuel_class: essence
  displacement_bucket: '3.5'
  power_ps: 252
  power_kw: 185
  displacement_l: 3.5
  body: Break
  period:
    from_year: 2011
    from_month: 7
    to_year: 2016
    to_month: 12
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 12336
  name: '300'
  alias: '300'
  engine_code: null
  fuel: essence
  fuel_class: essence
  displacement_bucket: '3.5'
  power_ps: 252
  power_kw: 185
  displacement_l: 3.5
  body: Break
  period:
    from_year: 2011
    from_month: 7
    to_year: 2016
    to_month: 12
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 10111
  name: '350'
  alias: '350'
  engine_code: null
  fuel: essence
  fuel_class: essence
  displacement_bucket: '3.5'
  power_ps: 272
  power_kw: 200
  displacement_l: 3.5
  body: Break
  period:
    from_year: 2009
    from_month: 8
    to_year: 2011
    to_month: 12
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 31582
  name: 350 4-Matic
  alias: 350-4matic
  engine_code: null
  fuel: essence
  fuel_class: essence
  displacement_bucket: '3.5'
  power_ps: 272
  power_kw: 200
  displacement_l: 3.5
  body: Break
  period:
    from_year: 2009
    from_month: 11
    to_year: 2011
    to_month: 12
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 31583
  name: 350 CGI
  alias: 350-cgi
  engine_code: null
  fuel: essence
  fuel_class: essence
  displacement_bucket: '3.5'
  power_ps: 292
  power_kw: 215
  displacement_l: 3.5
  body: Break
  period:
    from_year: 2009
    from_month: 11
    to_year: 2011
    to_month: 12
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 11384
  name: '350'
  alias: '350'
  engine_code: null
  fuel: essence
  fuel_class: essence
  displacement_bucket: '3.5'
  power_ps: 306
  power_kw: 225
  displacement_l: 3.5
  body: Break
  period:
    from_year: 2011
    from_month: 9
    to_year: 2014
    to_month: 12
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 11385
  name: 350 4-Matic
  alias: 350-4matic
  engine_code: null
  fuel: essence
  fuel_class: essence
  displacement_bucket: '3.5'
  power_ps: 306
  power_kw: 225
  displacement_l: 3.5
  body: Break
  period:
    from_year: 2011
    from_month: 9
    to_year: 2016
    to_month: 12
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 11382
  name: 500 4-Matic
  alias: 500-4matic
  engine_code: null
  fuel: essence
  fuel_class: essence
  displacement_bucket: '4.7'
  power_ps: 408
  power_kw: 300
  displacement_l: 4.7
  body: Break
  period:
    from_year: 2011
    from_month: 9
    to_year: 2016
    to_month: 12
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 11383
  name: '500'
  alias: '500'
  engine_code: null
  fuel: essence
  fuel_class: essence
  displacement_bucket: '4.7'
  power_ps: 408
  power_kw: 300
  displacement_l: 4.7
  body: Break
  period:
    from_year: 2011
    from_month: 9
    to_year: 2016
    to_month: 12
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 31584
  name: '500'
  alias: '500'
  engine_code: null
  fuel: essence
  fuel_class: essence
  displacement_bucket: '5.5'
  power_ps: 388
  power_kw: 285
  displacement_l: 5.5
  body: Break
  period:
    from_year: 2009
    from_month: 11
    to_year: 2011
    to_month: 12
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 10113
  name: 63 AMG
  alias: 63-amg
  engine_code: null
  fuel: essence
  fuel_class: essence
  displacement_bucket: '5.5'
  power_ps: 525
  power_kw: 386
  displacement_l: 5.5
  body: Break
  period:
    from_year: 2011
    from_month: 2
    to_year: 2016
    to_month: 12
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 58569
  name: 63 AMG
  alias: 63-amg
  engine_code: null
  fuel: essence
  fuel_class: essence
  displacement_bucket: '5.5'
  power_ps: 558
  power_kw: 410
  displacement_l: 5.5
  body: Break
  period:
    from_year: 2011
    from_month: 2
    to_year: 2016
    to_month: 12
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 59013
  name: 63 AMG 4-Matic
  alias: 63-amg-4matic
  engine_code: null
  fuel: essence
  fuel_class: essence
  displacement_bucket: '5.5'
  power_ps: 558
  power_kw: 410
  displacement_l: 5.5
  body: Break
  period:
    from_year: 2011
    from_month: 2
    to_year: 2016
    to_month: 12
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 58673
  name: 63 AMG 4-Matic
  alias: 63-amg-4matic
  engine_code: null
  fuel: essence
  fuel_class: essence
  displacement_bucket: '5.5'
  power_ps: 585
  power_kw: 430
  displacement_l: 5.5
  body: Break
  period:
    from_year: 2013
    from_month: 2
    to_year: 2016
    to_month: 12
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 59298
  name: 63 AMG
  alias: 63-amg
  engine_code: null
  fuel: essence
  fuel_class: essence
  displacement_bucket: '5.5'
  power_ps: 585
  power_kw: 430
  displacement_l: 5.5
  body: Break
  period:
    from_year: 2013
    from_month: 2
    to_year: 2016
    to_month: 12
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 32683
  name: 63 AMG
  alias: 63-amg
  engine_code: null
  fuel: essence
  fuel_class: essence
  displacement_bucket: '6.2'
  power_ps: 525
  power_kw: 386
  displacement_l: 6.2
  body: Break
  period:
    from_year: 2009
    from_month: 8
    to_year: 2011
    to_month: 12
  source:
    type: db
    table: auto_type
    confidence: high
# <<< END DB-MANAGED BLOCK: motorizations
# >>> DB-MANAGED BLOCK: known_issues_by_engine — script:vehicle-from-db-generator@v1 (ne pas éditer à la main)
known_issues_by_engine:
  fuel:diesel:
    axis_key_type: fuel
    applies_to:
      make: mercedes-benz
      model_generation: classe-e-t-model-s212
      fuel: diesel
      engine_family: null
      market: unknown
    source:
      type: db
      table: auto_type
      axis: type_fuel
      confidence: high
      note: axe carburant DB-fiable ; issues/operations remplis au scraping PR-C.2 (jamais inventés).
    issues: []
  fuel:essence:
    axis_key_type: fuel
    applies_to:
      make: mercedes-benz
      model_generation: classe-e-t-model-s212
      fuel: essence
      engine_family: null
      market: unknown
    source:
      type: db
      table: auto_type
      axis: type_fuel
      confidence: high
      note: axe carburant DB-fiable ; issues/operations remplis au scraping PR-C.2 (jamais inventés).
    issues: []
  fuel:hybride:
    axis_key_type: fuel
    applies_to:
      make: mercedes-benz
      model_generation: classe-e-t-model-s212
      fuel: hybride
      engine_family: null
      market: unknown
    source:
      type: db
      table: auto_type
      axis: type_fuel
      confidence: high
      note: axe carburant DB-fiable ; issues/operations remplis au scraping PR-C.2 (jamais inventés).
    issues: []
# <<< END DB-MANAGED BLOCK: known_issues_by_engine
# >>> DB-MANAGED BLOCK: maintenance_by_engine — script:vehicle-from-db-generator@v1 (ne pas éditer à la main)
maintenance_by_engine:
  fuel:diesel:
    axis_key_type: fuel
    applies_to:
      make: mercedes-benz
      model_generation: classe-e-t-model-s212
      fuel: diesel
      engine_family: null
      market: unknown
    source:
      type: db
      table: auto_type
      axis: type_fuel
      confidence: high
      note: axe carburant DB-fiable ; issues/operations remplis au scraping PR-C.2 (jamais inventés).
    operations: []
  fuel:essence:
    axis_key_type: fuel
    applies_to:
      make: mercedes-benz
      model_generation: classe-e-t-model-s212
      fuel: essence
      engine_family: null
      market: unknown
    source:
      type: db
      table: auto_type
      axis: type_fuel
      confidence: high
      note: axe carburant DB-fiable ; issues/operations remplis au scraping PR-C.2 (jamais inventés).
    operations: []
  fuel:hybride:
    axis_key_type: fuel
    applies_to:
      make: mercedes-benz
      model_generation: classe-e-t-model-s212
      fuel: hybride
      engine_family: null
      market: unknown
    source:
      type: db
      table: auto_type
      axis: type_fuel
      confidence: high
      note: axe carburant DB-fiable ; issues/operations remplis au scraping PR-C.2 (jamais inventés).
    operations: []
# <<< END DB-MANAGED BLOCK: maintenance_by_engine
# >>> DB-MANAGED BLOCK: validation_notes — script:vehicle-from-db-generator@v1 (ne pas éditer à la main)
validation_notes:
- 'type_id 58962: carburant DB non normalisé (''Diesel-Électrique'') — conservé tel quel (lowercase).'
- 'engine_code absent pour 38/38 motorisations : auto_type_motor_code est vide pour ces type_id (constat DB 2026-06-12
  : table quasi vide, 1 ligne sentinelle). Aucun code moteur inventé — à compléter par source éditoriale vérifiée
  (PR-C.2) ou backfill DB.'
# <<< END DB-MANAGED BLOCK: validation_notes
---

# MERCEDES CLASSE E Break (S212) (2009-2016)

## Identité

- **Modèle** : MERCEDES CLASSE E Break (S212)
- **Génération** : S212
- **Production** : 2009 - 2016
- **Carrosseries** : Break
- **Motorisations actives au catalogue** : 38 (14 diesel, 1 diesel-électrique, 23 essence)

> Bloc FAITS générés depuis la DB interne (auto_modele / auto_type / auto_type_motor_code).
> Source de vérité structurée : frontmatter `motorizations` (provenance champ par champ).

## Motorisations (DB)

### Diesel

| Motorisation | Code moteur | Puissance | kW | Cylindrée | Période | type_id |
|--------------|-------------|-----------|----|-----------|---------|---------|
| 200 CDI BlueTEC | — | 136 ch | 100 | 2.2 L | 2009-2016 | 31575 |
| 220 CDI | — | 163 ch | 120 | 2.2 L | 2009-2014 | 53147 |
| 220 CDI BlueTEC | — | 170 ch | 125 | 2.2 L | 2009-2016 | 31576 |
| 250 CDI BlueTEC 4-Matic | — | 204 ch | 150 | 2.2 L | 2010-2016 | 12332 |
| 250 CDI BlueTEC | — | 204 ch | 150 | 2.2 L | 2009-2016 | 31577 |
| 300 CDI | — | 204 ch | 150 | 3.0 L | 2009-2010 | 54915 |
| 350 D BlueTEC | — | 211 ch | 155 | 3.0 L | 2009-2013 | 33055 |
| 350 CDI | — | 231 ch | 170 | 3.0 L | 2009-2011 | 31578 |
| 350 CDI 4-Matic | — | 231 ch | 170 | 3.0 L | 2009-2011 | 31579 |
| 300 CDI BlueTEC | — | 231 ch | 170 | 3.0 L | 2009-2016 | 56076 |
| 350 D BlueTEC | — | 252 ch | 185 | 3.0 L | 2012-2016 | 59456 |
| 350 D BlueTEC 4-Matic | — | 252 ch | 185 | 3.0 L | 2012-2016 | 59459 |
| 350 CDI | — | 265 ch | 195 | 3.0 L | 2011-2013 | 11149 |
| 350 CDI 4-Matic | — | 265 ch | 195 | 3.0 L | 2011-2013 | 11150 |

### Diesel-électrique

| Motorisation | Code moteur | Puissance | kW | Cylindrée | Période | type_id |
|--------------|-------------|-----------|----|-----------|---------|---------|
| 300 BlueTEC Hybrid | — | 204 ch | 150 | 2.2 L | 2011-2016 | 58962 |

### Essence

| Motorisation | Code moteur | Puissance | kW | Cylindrée | Période | type_id |
|--------------|-------------|-----------|----|-----------|---------|---------|
| 200 CGI | — | 184 ch | 135 | 1.8 L | 2009-2016 | 31580 |
| 250 CGI | — | 204 ch | 150 | 1.8 L | 2009-2013 | 31581 |
| 200 | — | 184 ch | 135 | 2.0 L | 2012-2016 | 59461 |
| 250 | — | 211 ch | 155 | 2.0 L | 2012-2016 | 59464 |
| 300 | — | 231 ch | 170 | 3.0 L | 2009-2011 | 59468 |
| 400 | — | 333 ch | 245 | 3.0 L | 2013-2016 | 59453 |
| 400 4-Matic | — | 333 ch | 245 | 3.0 L | 2013-2016 | 59454 |
| 300 4-Matic | — | 252 ch | 185 | 3.5 L | 2011-2016 | 12335 |
| 300 | — | 252 ch | 185 | 3.5 L | 2011-2016 | 12336 |
| 350 | — | 272 ch | 200 | 3.5 L | 2009-2011 | 10111 |
| 350 4-Matic | — | 272 ch | 200 | 3.5 L | 2009-2011 | 31582 |
| 350 CGI | — | 292 ch | 215 | 3.5 L | 2009-2011 | 31583 |
| 350 | — | 306 ch | 225 | 3.5 L | 2011-2014 | 11384 |
| 350 4-Matic | — | 306 ch | 225 | 3.5 L | 2011-2016 | 11385 |
| 500 4-Matic | — | 408 ch | 300 | 4.7 L | 2011-2016 | 11382 |
| 500 | — | 408 ch | 300 | 4.7 L | 2011-2016 | 11383 |
| 500 | — | 388 ch | 285 | 5.5 L | 2009-2011 | 31584 |
| 63 AMG | — | 525 ch | 386 | 5.5 L | 2011-2016 | 10113 |
| 63 AMG | — | 558 ch | 410 | 5.5 L | 2011-2016 | 58569 |
| 63 AMG 4-Matic | — | 558 ch | 410 | 5.5 L | 2011-2016 | 59013 |
| 63 AMG 4-Matic | — | 585 ch | 430 | 5.5 L | 2013-2016 | 58673 |
| 63 AMG | — | 585 ch | 430 | 5.5 L | 2013-2016 | 59298 |
| 63 AMG | — | 525 ch | 386 | 6.2 L | 2009-2011 | 32683 |

## Problèmes connus

> Organisé PAR CARBURANT (axe motorisation — owner 2026-06-13). Squelette BRONZE :
> les clés `fuel:<carburant>` / `fuel_displacement:<carburant>:<L>` du frontmatter
> `known_issues_by_engine` sont DB-fiables ; le contenu est rempli au scraping PR-C.2
> (pannes PAR motorisation, rappels Rappel Conso) — jamais inventé, divergence DB →
> validation_notes. Le raffinement famille-moteur (`engine_family:<code>`) viendra avec
> le code moteur (absent en DB aujourd'hui → engine_code: null honnête).

### Diesel

<!-- TODO éditorial PR-C.2 — pannes connues du bloc diesel (clé `fuel:diesel`). applies_to.{make,model_generation,fuel,engine_family,market} + source.{type,source_market,lang_original,confidence,evidence_id} ; FR-only, reformulé non-verbatim. -->

### Essence

<!-- TODO éditorial PR-C.2 — pannes connues du bloc essence (clé `fuel:essence`). applies_to.{make,model_generation,fuel,engine_family,market} + source.{type,source_market,lang_original,confidence,evidence_id} ; FR-only, reformulé non-verbatim. -->

### Hybride

<!-- TODO éditorial PR-C.2 — pannes connues du bloc hybride (clé `fuel:hybride`). applies_to.{make,model_generation,fuel,engine_family,market} + source.{type,source_market,lang_original,confidence,evidence_id} ; FR-only, reformulé non-verbatim. -->

## Entretien

> Organisé PAR CARBURANT (intervalles fuel-dépendants : filtre gasoil 20-30k vs filtre
> essence 60k…). Clés normalisées du frontmatter `maintenance_by_engine`. Squelette
> BRONZE rempli au scraping PR-C.2 (data réparation constructeur) — jamais inventé.

### Diesel

<!-- TODO éditorial PR-C.2 — entretien du bloc diesel (clé `fuel:diesel`) : intervalles par moteur, opérations spécifiques. Valeurs prescriptives (couples…) = fail-closed sans source constructeur/OEM. -->

### Essence

<!-- TODO éditorial PR-C.2 — entretien du bloc essence (clé `fuel:essence`) : intervalles par moteur, opérations spécifiques. Valeurs prescriptives (couples…) = fail-closed sans source constructeur/OEM. -->

### Hybride

<!-- TODO éditorial PR-C.2 — entretien du bloc hybride (clé `fuel:hybride`) : intervalles par moteur, opérations spécifiques. Valeurs prescriptives (couples…) = fail-closed sans source constructeur/OEM. -->

## Pièces fréquentes

<!-- TODO éditorial — croisement gammes ↔ véhicule (compatible_part_families),
     fuel-aware (un FAP ne concerne que les diesels, une bougie d'allumage que
     l'essence), maillé par les clés DB (PR-D.1+). -->

## FAQ

<!-- TODO éditorial — questions propriétaire sourcées (PR-C.2). -->

