---
category: catalog/vehicle
doc_family: catalog
domain: vehicule
source_type: vehicle
title: Fiche véhicule - BMW Série 3 (E90)
truth_level: L1
updated_at: '2026-06-12'
verification_status: verified
doc_id: 785cf6f8-ba80-50e0-8881-c0c3d233ac8c
lang: fr
make: bmw
model: serie-3-e90
generation: E90
years:
- 2004
- 2012
provenance:
  ingested_by: script:vehicle-from-db-generator@v1
  generated_at: '2026-06-12T18:13:30Z'
  source_db: supabase (SELECT only — auto_marque/auto_modele/auto_type/auto_type_motor_code)
content_hash: sha256:dca47c6b34582953
# >>> DB-MANAGED BLOCK: db_profile — script:vehicle-from-db-generator@v1 (ne pas éditer à la main)
db_profile:
  modele_id: 33028
  marque_id: 33
  modele_alias: serie-3-e90
  modele_parent: 0
  active_type_count: 48
  type_id_scope: legacy < 60000 (type_display='1')
  selection_rank: 1
  fuel_breakdown:
    diesel: 20
    essence: 28
  bodies:
  - A trois volumes
  last_db_sync: '2026-06-12T18:13:30Z'
  source:
    type: db
    table: auto_modele + auto_type
    confidence: high
# <<< END DB-MANAGED BLOCK: db_profile
# >>> DB-MANAGED BLOCK: motorizations — script:vehicle-from-db-generator@v1 (ne pas éditer à la main)
motorizations:
- type_id: 33386
  name: 316 d
  alias: 2-0-316-d
  engine_code: null
  fuel: diesel
  power_ps: 116
  power_kw: 85
  displacement_l: 2.0
  body: A trois volumes
  period:
    from_year: 2009
    from_month: 7
    to_year: 2011
    to_month: 12
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 18967
  name: 318 d
  alias: 2-0-318-d
  engine_code: null
  fuel: diesel
  power_ps: 122
  power_kw: 90
  displacement_l: 2.0
  body: A trois volumes
  period:
    from_year: 2005
    from_month: 3
    to_year: 2007
    to_month: 8
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 5768
  name: 318 d
  alias: 2-0-318-d
  engine_code: null
  fuel: diesel
  power_ps: 136
  power_kw: 100
  displacement_l: 2.0
  body: A trois volumes
  period:
    from_year: 2007
    from_month: 9
    to_year: 2011
    to_month: 10
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 25466
  name: 318 d
  alias: 2-0-318-d
  engine_code: null
  fuel: diesel
  power_ps: 143
  power_kw: 105
  displacement_l: 2.0
  body: A trois volumes
  period:
    from_year: 2007
    from_month: 2
    to_year: 2011
    to_month: 10
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 19953
  name: 320 d
  alias: 2-0-320-d
  engine_code: null
  fuel: diesel
  power_ps: 150
  power_kw: 110
  displacement_l: 2.0
  body: A trois volumes
  period:
    from_year: 2004
    from_month: 12
    to_year: 2007
    to_month: 9
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 59741
  name: 320 d
  alias: 2-0-320-d
  engine_code: null
  fuel: diesel
  power_ps: 156
  power_kw: 115
  displacement_l: 2.0
  body: A trois volumes
  period:
    from_year: 2004
    from_month: 12
    to_year: 2007
    to_month: 9
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 11399
  name: 320 d xDrive
  alias: 2-0-320-d-xdrive
  engine_code: null
  fuel: diesel
  power_ps: 163
  power_kw: 120
  displacement_l: 2.0
  body: A trois volumes
  period:
    from_year: 2008
    from_month: 9
    to_year: 2011
    to_month: 10
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 18452
  name: 320 d
  alias: 2-0-320-d
  engine_code: null
  fuel: diesel
  power_ps: 163
  power_kw: 120
  displacement_l: 2.0
  body: A trois volumes
  period:
    from_year: 2004
    from_month: 12
    to_year: 2011
    to_month: 10
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 25471
  name: 320 d
  alias: 2-0-320-d
  engine_code: null
  fuel: diesel
  power_ps: 177
  power_kw: 130
  displacement_l: 2.0
  body: A trois volumes
  period:
    from_year: 2007
    from_month: 9
    to_year: 2010
    to_month: 2
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 31031
  name: 320 d xDrive
  alias: 2-0-320-d-xdrive
  engine_code: null
  fuel: diesel
  power_ps: 177
  power_kw: 130
  displacement_l: 2.0
  body: A trois volumes
  period:
    from_year: 2008
    from_month: 9
    to_year: 2010
    to_month: 2
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 33387
  name: 320 d
  alias: 2-0-320-d
  engine_code: null
  fuel: diesel
  power_ps: 184
  power_kw: 135
  displacement_l: 2.0
  body: A trois volumes
  period:
    from_year: 2010
    from_month: 3
    to_year: 2011
    to_month: 10
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 33388
  name: 320 d xDrive
  alias: 2-0-320-d-xdrive
  engine_code: null
  fuel: diesel
  power_ps: 184
  power_kw: 135
  displacement_l: 2.0
  body: A trois volumes
  period:
    from_year: 2010
    from_month: 3
    to_year: 2011
    to_month: 10
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 19998
  name: 325 d
  alias: 3-0-325-d
  engine_code: null
  fuel: diesel
  power_ps: 197
  power_kw: 145
  displacement_l: 3.0
  body: A trois volumes
  period:
    from_year: 2006
    from_month: 9
    to_year: 2010
    to_month: 2
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 33396
  name: 325 d
  alias: 3-0-325-d
  engine_code: null
  fuel: diesel
  power_ps: 204
  power_kw: 150
  displacement_l: 3.0
  body: A trois volumes
  period:
    from_year: 2010
    from_month: 3
    to_year: 2011
    to_month: 10
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 18968
  name: 330 d
  alias: 3-0-330-d
  engine_code: null
  fuel: diesel
  power_ps: 231
  power_kw: 170
  displacement_l: 3.0
  body: A trois volumes
  period:
    from_year: 2005
    from_month: 9
    to_year: 2008
    to_month: 9
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 19103
  name: 330 xd
  alias: 3-0-330-xd
  engine_code: null
  fuel: diesel
  power_ps: 231
  power_kw: 170
  displacement_l: 3.0
  body: A trois volumes
  period:
    from_year: 2005
    from_month: 9
    to_year: 2008
    to_month: 8
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 30864
  name: 330 d
  alias: 3-0-330-d
  engine_code: null
  fuel: diesel
  power_ps: 245
  power_kw: 180
  displacement_l: 3.0
  body: A trois volumes
  period:
    from_year: 2008
    from_month: 9
    to_year: 2011
    to_month: 10
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 30868
  name: 330 d xDrive
  alias: 3-0-330-d-xdrive
  engine_code: null
  fuel: diesel
  power_ps: 245
  power_kw: 180
  displacement_l: 3.0
  body: A trois volumes
  period:
    from_year: 2008
    from_month: 9
    to_year: 2011
    to_month: 10
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 53532
  name: 335 d
  alias: 3-0-335-d
  engine_code: null
  fuel: diesel
  power_ps: 269
  power_kw: 198
  displacement_l: 3.0
  body: A trois volumes
  period:
    from_year: 2008
    from_month: 9
    to_year: 2011
    to_month: 12
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 19837
  name: 335 d
  alias: 3-0-335-d
  engine_code: null
  fuel: diesel
  power_ps: 286
  power_kw: 210
  displacement_l: 3.0
  body: A trois volumes
  period:
    from_year: 2006
    from_month: 9
    to_year: 2011
    to_month: 12
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 27555
  name: 316 i
  alias: 1-6-316-i
  engine_code: null
  fuel: essence
  power_ps: 115
  power_kw: 85
  displacement_l: 1.6
  body: A trois volumes
  period:
    from_year: 2005
    from_month: 9
    to_year: 2011
    to_month: 10
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 30905
  name: 316 i
  alias: 1-6-316-i
  engine_code: null
  fuel: essence
  power_ps: 122
  power_kw: 90
  displacement_l: 1.6
  body: A trois volumes
  period:
    from_year: 2007
    from_month: 9
    to_year: 2011
    to_month: 10
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 18966
  name: 318 i
  alias: 2-0-318-i
  engine_code: null
  fuel: essence
  power_ps: 129
  power_kw: 95
  displacement_l: 2.0
  body: A trois volumes
  period:
    from_year: 2005
    from_month: 9
    to_year: 2007
    to_month: 8
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 58058
  name: 318 i
  alias: 2-0-318-i
  engine_code: null
  fuel: essence
  power_ps: 136
  power_kw: 100
  displacement_l: 2.0
  body: A trois volumes
  period:
    from_year: 2007
    from_month: 9
    to_year: 2011
    to_month: 10
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 25465
  name: 318 i
  alias: 2-0-318-i
  engine_code: null
  fuel: essence
  power_ps: 143
  power_kw: 105
  displacement_l: 2.0
  body: A trois volumes
  period:
    from_year: 2007
    from_month: 9
    to_year: 2011
    to_month: 10
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 18449
  name: 320 i
  alias: 2-0-320-i
  engine_code: null
  fuel: essence
  power_ps: 150
  power_kw: 110
  displacement_l: 2.0
  body: A trois volumes
  period:
    from_year: 2004
    from_month: 12
    to_year: 2007
    to_month: 8
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 33573
  name: 320 i
  alias: 2-0-320-i
  engine_code: null
  fuel: essence
  power_ps: 156
  power_kw: 115
  displacement_l: 2.0
  body: A trois volumes
  period:
    from_year: 2007
    from_month: 2
    to_year: 2011
    to_month: 12
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 25470
  name: 320 i
  alias: 2-0-320-i
  engine_code: null
  fuel: essence
  power_ps: 170
  power_kw: 125
  displacement_l: 2.0
  body: A trois volumes
  period:
    from_year: 2007
    from_month: 9
    to_year: 2011
    to_month: 10
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 19496
  name: 320 si
  alias: 2-0-320-si
  engine_code: null
  fuel: essence
  power_ps: 173
  power_kw: 127
  displacement_l: 2.0
  body: A trois volumes
  period:
    from_year: 2005
    from_month: 9
    to_year: 2006
    to_month: 8
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 28018
  name: 323 i
  alias: 323-i
  engine_code: null
  fuel: essence
  power_ps: 177
  power_kw: 130
  displacement_l: 2.5
  body: A trois volumes
  period:
    from_year: 2005
    from_month: 9
    to_year: 2007
    to_month: 2
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 55937
  name: 323 i
  alias: 323-i
  engine_code: null
  fuel: essence
  power_ps: 190
  power_kw: 140
  displacement_l: 2.5
  body: A trois volumes
  period:
    from_year: 2007
    from_month: 3
    to_year: 2011
    to_month: 12
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 54518
  name: 325 i
  alias: 325-i
  engine_code: null
  fuel: essence
  power_ps: 211
  power_kw: 155
  displacement_l: 2.5
  body: A trois volumes
  period:
    from_year: 2006
    from_month: 1
    to_year: 2011
    to_month: 12
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 18450
  name: 325 i (Phase 1)
  alias: 325-i-phase-1
  engine_code: null
  fuel: essence
  power_ps: 218
  power_kw: 160
  displacement_l: 2.5
  body: A trois volumes
  period:
    from_year: 2004
    from_month: 12
    to_year: 2011
    to_month: 12
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 19101
  name: 325 xi
  alias: 325-xi
  engine_code: null
  fuel: essence
  power_ps: 218
  power_kw: 160
  displacement_l: 2.5
  body: A trois volumes
  period:
    from_year: 2005
    from_month: 9
    to_year: 2008
    to_month: 8
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 56495
  name: 325 i (Phase 2)
  alias: 325-i-phase-2
  engine_code: null
  fuel: essence
  power_ps: 222
  power_kw: 163
  displacement_l: 2.5
  body: A trois volumes
  period:
    from_year: 2008
    from_month: 9
    to_year: 2009
    to_month: 12
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 25468
  name: 325 i
  alias: 325-i
  engine_code: null
  fuel: essence
  power_ps: 218
  power_kw: 160
  displacement_l: 3.0
  body: A trois volumes
  period:
    from_year: 2007
    from_month: 3
    to_year: 2011
    to_month: 12
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 25469
  name: 325 xi
  alias: 325-xi
  engine_code: null
  fuel: essence
  power_ps: 218
  power_kw: 160
  displacement_l: 3.0
  body: A trois volumes
  period:
    from_year: 2007
    from_month: 9
    to_year: 2008
    to_month: 8
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 31028
  name: 325 i xDrive
  alias: 325-i-xdrive
  engine_code: null
  fuel: essence
  power_ps: 218
  power_kw: 160
  displacement_l: 3.0
  body: A trois volumes
  period:
    from_year: 2008
    from_month: 9
    to_year: 2011
    to_month: 10
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 58077
  name: 328 i
  alias: 328-i
  engine_code: null
  fuel: essence
  power_ps: 234
  power_kw: 172
  displacement_l: 3.0
  body: A trois volumes
  period:
    from_year: 2006
    from_month: 9
    to_year: 2011
    to_month: 12
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 18451
  name: 330 i
  alias: 330-i
  engine_code: null
  fuel: essence
  power_ps: 258
  power_kw: 190
  displacement_l: 3.0
  body: A trois volumes
  period:
    from_year: 2004
    from_month: 12
    to_year: 2011
    to_month: 10
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 19102
  name: 330 xi
  alias: 330-xi
  engine_code: null
  fuel: essence
  power_ps: 258
  power_kw: 190
  displacement_l: 3.0
  body: A trois volumes
  period:
    from_year: 2005
    from_month: 9
    to_year: 2007
    to_month: 8
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 25472
  name: 330 i
  alias: 330-i
  engine_code: null
  fuel: essence
  power_ps: 272
  power_kw: 200
  displacement_l: 3.0
  body: A trois volumes
  period:
    from_year: 2007
    from_month: 9
    to_year: 2011
    to_month: 10
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 25473
  name: 330 xi
  alias: 330-xi
  engine_code: null
  fuel: essence
  power_ps: 272
  power_kw: 200
  displacement_l: 3.0
  body: A trois volumes
  period:
    from_year: 2007
    from_month: 9
    to_year: 2008
    to_month: 8
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 31029
  name: 330 i xDrive
  alias: 330-i-xdrive
  engine_code: null
  fuel: essence
  power_ps: 272
  power_kw: 200
  displacement_l: 3.0
  body: A trois volumes
  period:
    from_year: 2008
    from_month: 9
    to_year: 2011
    to_month: 10
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 28396
  name: 335 i
  alias: 335-i
  engine_code: null
  fuel: essence
  power_ps: 299
  power_kw: 220
  displacement_l: 3.0
  body: A trois volumes
  period:
    from_year: 2006
    from_month: 3
    to_year: 2011
    to_month: 12
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 19833
  name: 335 i
  alias: 335-i
  engine_code: null
  fuel: essence
  power_ps: 306
  power_kw: 225
  displacement_l: 3.0
  body: A trois volumes
  period:
    from_year: 2006
    from_month: 9
    to_year: 2011
    to_month: 12
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 25467
  name: 335 xi
  alias: 335-xi
  engine_code: null
  fuel: essence
  power_ps: 306
  power_kw: 225
  displacement_l: 3.0
  body: A trois volumes
  period:
    from_year: 2007
    from_month: 3
    to_year: 2008
    to_month: 8
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 31030
  name: 335 i xDrive
  alias: 335-i-xdrive
  engine_code: null
  fuel: essence
  power_ps: 306
  power_kw: 225
  displacement_l: 3.0
  body: A trois volumes
  period:
    from_year: 2008
    from_month: 9
    to_year: 2011
    to_month: 10
  source:
    type: db
    table: auto_type
    confidence: high
# <<< END DB-MANAGED BLOCK: motorizations
# >>> DB-MANAGED BLOCK: validation_notes — script:vehicle-from-db-generator@v1 (ne pas éditer à la main)
validation_notes:
- 'engine_code absent pour 48/48 motorisations : auto_type_motor_code est vide pour ces type_id (constat DB 2026-06-12
  : table quasi vide, 1 ligne sentinelle). Aucun code moteur inventé — à compléter par source éditoriale vérifiée
  (PR-C.2) ou backfill DB.'
# <<< END DB-MANAGED BLOCK: validation_notes
---

# BMW Série 3 (E90) (2004-2012)

## Identité

- **Modèle** : BMW Série 3 (E90)
- **Génération** : E90
- **Production** : 2004 - 2012
- **Carrosseries** : A trois volumes
- **Motorisations actives au catalogue** : 48 (20 diesel, 28 essence)

> Bloc FAITS générés depuis la DB interne (auto_modele / auto_type / auto_type_motor_code).
> Source de vérité structurée : frontmatter `motorizations` (provenance champ par champ).

## Motorisations (DB)

### Diesel

| Motorisation | Code moteur | Puissance | kW | Cylindrée | Période | type_id |
|--------------|-------------|-----------|----|-----------|---------|---------|
| 316 d | — | 116 ch | 85 | 2.0 L | 2009-2011 | 33386 |
| 318 d | — | 122 ch | 90 | 2.0 L | 2005-2007 | 18967 |
| 318 d | — | 136 ch | 100 | 2.0 L | 2007-2011 | 5768 |
| 318 d | — | 143 ch | 105 | 2.0 L | 2007-2011 | 25466 |
| 320 d | — | 150 ch | 110 | 2.0 L | 2004-2007 | 19953 |
| 320 d | — | 156 ch | 115 | 2.0 L | 2004-2007 | 59741 |
| 320 d xDrive | — | 163 ch | 120 | 2.0 L | 2008-2011 | 11399 |
| 320 d | — | 163 ch | 120 | 2.0 L | 2004-2011 | 18452 |
| 320 d | — | 177 ch | 130 | 2.0 L | 2007-2010 | 25471 |
| 320 d xDrive | — | 177 ch | 130 | 2.0 L | 2008-2010 | 31031 |
| 320 d | — | 184 ch | 135 | 2.0 L | 2010-2011 | 33387 |
| 320 d xDrive | — | 184 ch | 135 | 2.0 L | 2010-2011 | 33388 |
| 325 d | — | 197 ch | 145 | 3.0 L | 2006-2010 | 19998 |
| 325 d | — | 204 ch | 150 | 3.0 L | 2010-2011 | 33396 |
| 330 d | — | 231 ch | 170 | 3.0 L | 2005-2008 | 18968 |
| 330 xd | — | 231 ch | 170 | 3.0 L | 2005-2008 | 19103 |
| 330 d | — | 245 ch | 180 | 3.0 L | 2008-2011 | 30864 |
| 330 d xDrive | — | 245 ch | 180 | 3.0 L | 2008-2011 | 30868 |
| 335 d | — | 269 ch | 198 | 3.0 L | 2008-2011 | 53532 |
| 335 d | — | 286 ch | 210 | 3.0 L | 2006-2011 | 19837 |

### Essence

| Motorisation | Code moteur | Puissance | kW | Cylindrée | Période | type_id |
|--------------|-------------|-----------|----|-----------|---------|---------|
| 316 i | — | 115 ch | 85 | 1.6 L | 2005-2011 | 27555 |
| 316 i | — | 122 ch | 90 | 1.6 L | 2007-2011 | 30905 |
| 318 i | — | 129 ch | 95 | 2.0 L | 2005-2007 | 18966 |
| 318 i | — | 136 ch | 100 | 2.0 L | 2007-2011 | 58058 |
| 318 i | — | 143 ch | 105 | 2.0 L | 2007-2011 | 25465 |
| 320 i | — | 150 ch | 110 | 2.0 L | 2004-2007 | 18449 |
| 320 i | — | 156 ch | 115 | 2.0 L | 2007-2011 | 33573 |
| 320 i | — | 170 ch | 125 | 2.0 L | 2007-2011 | 25470 |
| 320 si | — | 173 ch | 127 | 2.0 L | 2005-2006 | 19496 |
| 323 i | — | 177 ch | 130 | 2.5 L | 2005-2007 | 28018 |
| 323 i | — | 190 ch | 140 | 2.5 L | 2007-2011 | 55937 |
| 325 i | — | 211 ch | 155 | 2.5 L | 2006-2011 | 54518 |
| 325 i (Phase 1) | — | 218 ch | 160 | 2.5 L | 2004-2011 | 18450 |
| 325 xi | — | 218 ch | 160 | 2.5 L | 2005-2008 | 19101 |
| 325 i (Phase 2) | — | 222 ch | 163 | 2.5 L | 2008-2009 | 56495 |
| 325 i | — | 218 ch | 160 | 3.0 L | 2007-2011 | 25468 |
| 325 xi | — | 218 ch | 160 | 3.0 L | 2007-2008 | 25469 |
| 325 i xDrive | — | 218 ch | 160 | 3.0 L | 2008-2011 | 31028 |
| 328 i | — | 234 ch | 172 | 3.0 L | 2006-2011 | 58077 |
| 330 i | — | 258 ch | 190 | 3.0 L | 2004-2011 | 18451 |
| 330 xi | — | 258 ch | 190 | 3.0 L | 2005-2007 | 19102 |
| 330 i | — | 272 ch | 200 | 3.0 L | 2007-2011 | 25472 |
| 330 xi | — | 272 ch | 200 | 3.0 L | 2007-2008 | 25473 |
| 330 i xDrive | — | 272 ch | 200 | 3.0 L | 2008-2011 | 31029 |
| 335 i | — | 299 ch | 220 | 3.0 L | 2006-2011 | 28396 |
| 335 i | — | 306 ch | 225 | 3.0 L | 2006-2011 | 19833 |
| 335 xi | — | 306 ch | 225 | 3.0 L | 2007-2008 | 25467 |
| 335 i xDrive | — | 306 ch | 225 | 3.0 L | 2008-2011 | 31030 |

## Spécificités & problèmes connus

<!-- TODO éditorial — couche web sourcée (PR-C.2) : pannes connues PAR motorisation
     (known_issues_by_engine), rappels officiels (Rappel Conso), entretien par moteur.
     Aucune donnée scrapée ne remplace un fait DB ; divergence → validation_notes. -->

## Pièces fréquentes

<!-- TODO éditorial — croisement gammes ↔ véhicule (compatible_part_families),
     maillé par les clés DB (PR-D.1+). -->

## FAQ

<!-- TODO éditorial — questions propriétaire sourcées (PR-C.2). -->

