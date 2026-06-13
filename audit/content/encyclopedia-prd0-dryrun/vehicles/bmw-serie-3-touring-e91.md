---
category: catalog/vehicle
doc_family: catalog
domain: vehicule
source_type: vehicle
title: Fiche véhicule - BMW Série 3 Touring (E91)
truth_level: L1
updated_at: '2026-06-13'
verification_status: verified
doc_id: e88a6e13-0668-59ce-8a7c-94414ab83118
lang: fr
make: bmw
model: serie-3-touring-e91
generation: E91
years:
- 2004
- 2012
provenance:
  ingested_by: script:vehicle-from-db-generator@v1
  generated_at: '2026-06-13T10:20:35Z'
  source_db: supabase (SELECT only — auto_marque/auto_modele/auto_type/auto_type_motor_code)
content_hash: sha256:5059b9a0deba6167
# >>> DB-MANAGED BLOCK: db_profile — script:vehicle-from-db-generator@v1 (ne pas éditer à la main)
db_profile:
  modele_id: 33043
  marque_id: 33
  modele_alias: serie-3-touring-e91
  modele_parent: 0
  active_type_count: 41
  type_id_scope: legacy < 60000 (type_display='1')
  selection_rank: 3
  fuel_breakdown:
    diesel: 18
    essence: 23
  bodies:
  - Break
  last_db_sync: '2026-06-13T10:20:35Z'
  source:
    type: db
    table: auto_modele + auto_type
    confidence: high
# <<< END DB-MANAGED BLOCK: db_profile
# >>> DB-MANAGED BLOCK: motorizations — script:vehicle-from-db-generator@v1 (ne pas éditer à la main)
motorizations:
- type_id: 11145
  name: 316 d
  alias: 2-0-316-d
  engine_code: null
  fuel: diesel
  fuel_class: diesel
  displacement_bucket: '2.0'
  power_ps: 116
  power_kw: 85
  displacement_l: 2.0
  body: Break
  period:
    from_year: 2009
    from_month: 9
    to_year: 2012
    to_month: 6
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 19298
  name: 318 d
  alias: 2-0-318-d
  engine_code: null
  fuel: diesel
  fuel_class: diesel
  displacement_bucket: '2.0'
  power_ps: 122
  power_kw: 90
  displacement_l: 2.0
  body: Break
  period:
    from_year: 2005
    from_month: 9
    to_year: 2007
    to_month: 8
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 3980
  name: 318 d
  alias: 2-0-318-d
  engine_code: null
  fuel: diesel
  fuel_class: diesel
  displacement_bucket: '2.0'
  power_ps: 136
  power_kw: 100
  displacement_l: 2.0
  body: Break
  period:
    from_year: 2007
    from_month: 7
    to_year: 2012
    to_month: 6
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 25475
  name: 318 d
  alias: 2-0-318-d
  engine_code: null
  fuel: diesel
  fuel_class: diesel
  displacement_bucket: '2.0'
  power_ps: 143
  power_kw: 105
  displacement_l: 2.0
  body: Break
  period:
    from_year: 2007
    from_month: 9
    to_year: 2012
    to_month: 6
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 19954
  name: 320 d
  alias: 2-0-320-d
  engine_code: null
  fuel: diesel
  fuel_class: diesel
  displacement_bucket: '2.0'
  power_ps: 150
  power_kw: 110
  displacement_l: 2.0
  body: Break
  period:
    from_year: 2004
    from_month: 12
    to_year: 2007
    to_month: 8
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 18761
  name: 320 d
  alias: 2-0-320-d
  engine_code: null
  fuel: diesel
  fuel_class: diesel
  displacement_bucket: '2.0'
  power_ps: 163
  power_kw: 120
  displacement_l: 2.0
  body: Break
  period:
    from_year: 2005
    from_month: 6
    to_year: 2012
    to_month: 6
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 34946
  name: 320 d xDrive
  alias: 2-0-320-d-xdrive
  engine_code: null
  fuel: diesel
  fuel_class: diesel
  displacement_bucket: '2.0'
  power_ps: 163
  power_kw: 120
  displacement_l: 2.0
  body: Break
  period:
    from_year: 2009
    from_month: 7
    to_year: 2012
    to_month: 6
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 25482
  name: 320 d
  alias: 2-0-320-d
  engine_code: null
  fuel: diesel
  fuel_class: diesel
  displacement_bucket: '2.0'
  power_ps: 177
  power_kw: 130
  displacement_l: 2.0
  body: Break
  period:
    from_year: 2007
    from_month: 2
    to_year: 2010
    to_month: 12
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 31035
  name: 320 d xDrive
  alias: 2-0-320-d-xdrive
  engine_code: null
  fuel: diesel
  fuel_class: diesel
  displacement_bucket: '2.0'
  power_ps: 177
  power_kw: 130
  displacement_l: 2.0
  body: Break
  period:
    from_year: 2008
    from_month: 9
    to_year: 2010
    to_month: 2
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 33389
  name: 320 d
  alias: 2-0-320-d
  engine_code: null
  fuel: diesel
  fuel_class: diesel
  displacement_bucket: '2.0'
  power_ps: 184
  power_kw: 135
  displacement_l: 2.0
  body: Break
  period:
    from_year: 2010
    from_month: 3
    to_year: 2012
    to_month: 5
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 33390
  name: 320 d xDrive
  alias: 2-0-320-d-xdrive
  engine_code: null
  fuel: diesel
  fuel_class: diesel
  displacement_bucket: '2.0'
  power_ps: 184
  power_kw: 135
  displacement_l: 2.0
  body: Break
  period:
    from_year: 2010
    from_month: 3
    to_year: 2012
    to_month: 6
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 19995
  name: 325 d
  alias: 3-0-325-d
  engine_code: null
  fuel: diesel
  fuel_class: diesel
  displacement_bucket: '3.0'
  power_ps: 197
  power_kw: 145
  displacement_l: 3.0
  body: Break
  period:
    from_year: 2006
    from_month: 9
    to_year: 2012
    to_month: 6
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 34767
  name: 325 d
  alias: 3-0-325-d
  engine_code: null
  fuel: diesel
  fuel_class: diesel
  displacement_bucket: '3.0'
  power_ps: 204
  power_kw: 150
  displacement_l: 3.0
  body: Break
  period:
    from_year: 2010
    from_month: 2
    to_year: 2012
    to_month: 6
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 18969
  name: 330 d
  alias: 3-0-330-d
  engine_code: null
  fuel: diesel
  fuel_class: diesel
  displacement_bucket: '3.0'
  power_ps: 231
  power_kw: 170
  displacement_l: 3.0
  body: Break
  period:
    from_year: 2004
    from_month: 12
    to_year: 2008
    to_month: 8
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 19106
  name: 330 xd
  alias: 3-0-330-xd
  engine_code: null
  fuel: diesel
  fuel_class: diesel
  displacement_bucket: '3.0'
  power_ps: 231
  power_kw: 170
  displacement_l: 3.0
  body: Break
  period:
    from_year: 2005
    from_month: 9
    to_year: 2012
    to_month: 6
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 30865
  name: 330 d
  alias: 3-0-330-d
  engine_code: null
  fuel: diesel
  fuel_class: diesel
  displacement_bucket: '3.0'
  power_ps: 245
  power_kw: 180
  displacement_l: 3.0
  body: Break
  period:
    from_year: 2008
    from_month: 2
    to_year: 2012
    to_month: 5
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 30869
  name: 330 d xDrive
  alias: 3-0-330-d-xdrive
  engine_code: null
  fuel: diesel
  fuel_class: diesel
  displacement_bucket: '3.0'
  power_ps: 245
  power_kw: 180
  displacement_l: 3.0
  body: Break
  period:
    from_year: 2009
    from_month: 1
    to_year: 2012
    to_month: 6
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 19836
  name: 335 d
  alias: 3-0-335-d
  engine_code: null
  fuel: diesel
  fuel_class: diesel
  displacement_bucket: '3.0'
  power_ps: 286
  power_kw: 210
  displacement_l: 3.0
  body: Break
  period:
    from_year: 2006
    from_month: 9
    to_year: 2012
    to_month: 6
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 30910
  name: 316 i
  alias: 1-6-316-i
  engine_code: null
  fuel: essence
  fuel_class: essence
  displacement_bucket: '1.6'
  power_ps: 122
  power_kw: 90
  displacement_l: 1.6
  body: Break
  period:
    from_year: 2008
    from_month: 9
    to_year: 2012
    to_month: 6
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 19299
  name: 318 i
  alias: 2-0-318-i
  engine_code: null
  fuel: essence
  fuel_class: essence
  displacement_bucket: '2.0'
  power_ps: 129
  power_kw: 95
  displacement_l: 2.0
  body: Break
  period:
    from_year: 2006
    from_month: 1
    to_year: 2007
    to_month: 8
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 10780
  name: 318 i
  alias: 2-0-318-i
  engine_code: null
  fuel: essence
  fuel_class: essence
  displacement_bucket: '2.0'
  power_ps: 136
  power_kw: 100
  displacement_l: 2.0
  body: Break
  period:
    from_year: 2007
    from_month: 9
    to_year: 2012
    to_month: 3
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 25474
  name: 318 i
  alias: 2-0-318-i
  engine_code: null
  fuel: essence
  fuel_class: essence
  displacement_bucket: '2.0'
  power_ps: 143
  power_kw: 105
  displacement_l: 2.0
  body: Break
  period:
    from_year: 2007
    from_month: 5
    to_year: 2012
    to_month: 5
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 18758
  name: 320 i
  alias: 2-0-320-i
  engine_code: null
  fuel: essence
  fuel_class: essence
  displacement_bucket: '2.0'
  power_ps: 150
  power_kw: 110
  displacement_l: 2.0
  body: Break
  period:
    from_year: 2005
    from_month: 9
    to_year: 2012
    to_month: 6
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 55899
  name: 320 i
  alias: 2-0-320-i
  engine_code: null
  fuel: essence
  fuel_class: essence
  displacement_bucket: '2.0'
  power_ps: 156
  power_kw: 115
  displacement_l: 2.0
  body: Break
  period:
    from_year: 2005
    from_month: 9
    to_year: 2012
    to_month: 6
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 25476
  name: 320 i
  alias: 2-0-320-i
  engine_code: null
  fuel: essence
  fuel_class: essence
  displacement_bucket: '2.0'
  power_ps: 170
  power_kw: 125
  displacement_l: 2.0
  body: Break
  period:
    from_year: 2007
    from_month: 2
    to_year: 2012
    to_month: 12
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 28020
  name: 323 i
  alias: 323-i
  engine_code: null
  fuel: essence
  fuel_class: essence
  displacement_bucket: '2.5'
  power_ps: 177
  power_kw: 130
  displacement_l: 2.5
  body: Break
  period:
    from_year: 2006
    from_month: 4
    to_year: 2007
    to_month: 6
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 18759
  name: 325 i
  alias: 325-i
  engine_code: null
  fuel: essence
  fuel_class: essence
  displacement_bucket: '2.5'
  power_ps: 218
  power_kw: 160
  displacement_l: 2.5
  body: Break
  period:
    from_year: 2004
    from_month: 12
    to_year: 2008
    to_month: 8
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 19104
  name: 325 xi
  alias: 325-xi
  engine_code: null
  fuel: essence
  fuel_class: essence
  displacement_bucket: '2.5'
  power_ps: 218
  power_kw: 160
  displacement_l: 2.5
  body: Break
  period:
    from_year: 2005
    from_month: 8
    to_year: 2008
    to_month: 8
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 3536
  name: 325 i
  alias: 325-i
  engine_code: null
  fuel: essence
  fuel_class: essence
  displacement_bucket: '3.0'
  power_ps: 211
  power_kw: 155
  displacement_l: 3.0
  body: Break
  period:
    from_year: 2007
    from_month: 9
    to_year: 2012
    to_month: 6
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 25480
  name: 325 i
  alias: 325-i
  engine_code: null
  fuel: essence
  fuel_class: essence
  displacement_bucket: '3.0'
  power_ps: 218
  power_kw: 160
  displacement_l: 3.0
  body: Break
  period:
    from_year: 2007
    from_month: 9
    to_year: 2012
    to_month: 6
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 25481
  name: 325 xi
  alias: 325-xi
  engine_code: null
  fuel: essence
  fuel_class: essence
  displacement_bucket: '3.0'
  power_ps: 218
  power_kw: 160
  displacement_l: 3.0
  body: Break
  period:
    from_year: 2007
    from_month: 9
    to_year: 2008
    to_month: 8
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 31032
  name: 325 i xDrive
  alias: 325-i-xdrive
  engine_code: null
  fuel: essence
  fuel_class: essence
  displacement_bucket: '3.0'
  power_ps: 218
  power_kw: 160
  displacement_l: 3.0
  body: Break
  period:
    from_year: 2008
    from_month: 9
    to_year: 2012
    to_month: 6
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 58078
  name: 328 i
  alias: 328-i
  engine_code: null
  fuel: essence
  fuel_class: essence
  displacement_bucket: '3.0'
  power_ps: 234
  power_kw: 171
  displacement_l: 3.0
  body: Break
  period:
    from_year: 2007
    from_month: 3
    to_year: 2012
    to_month: 6
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 18760
  name: 330 i
  alias: 330-i
  engine_code: null
  fuel: essence
  fuel_class: essence
  displacement_bucket: '3.0'
  power_ps: 258
  power_kw: 190
  displacement_l: 3.0
  body: Break
  period:
    from_year: 2005
    from_month: 8
    to_year: 2007
    to_month: 8
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 19105
  name: 330 xi
  alias: 330-xi
  engine_code: null
  fuel: essence
  fuel_class: essence
  displacement_bucket: '3.0'
  power_ps: 258
  power_kw: 190
  displacement_l: 3.0
  body: Break
  period:
    from_year: 2005
    from_month: 9
    to_year: 2007
    to_month: 8
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 25478
  name: 330 i
  alias: 330-i
  engine_code: null
  fuel: essence
  fuel_class: essence
  displacement_bucket: '3.0'
  power_ps: 272
  power_kw: 200
  displacement_l: 3.0
  body: Break
  period:
    from_year: 2007
    from_month: 9
    to_year: 2012
    to_month: 6
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 25479
  name: 330 xi
  alias: 330-xi
  engine_code: null
  fuel: essence
  fuel_class: essence
  displacement_bucket: '3.0'
  power_ps: 272
  power_kw: 200
  displacement_l: 3.0
  body: Break
  period:
    from_year: 2007
    from_month: 9
    to_year: 2012
    to_month: 6
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 31033
  name: 330 i xDrive
  alias: 330-i-xdrive
  engine_code: null
  fuel: essence
  fuel_class: essence
  displacement_bucket: '3.0'
  power_ps: 272
  power_kw: 200
  displacement_l: 3.0
  body: Break
  period:
    from_year: 2007
    from_month: 9
    to_year: 2012
    to_month: 6
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 19834
  name: 335 i
  alias: 335-i
  engine_code: null
  fuel: essence
  fuel_class: essence
  displacement_bucket: '3.0'
  power_ps: 306
  power_kw: 225
  displacement_l: 3.0
  body: Break
  period:
    from_year: 2006
    from_month: 9
    to_year: 2012
    to_month: 6
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 25477
  name: 335 xi
  alias: 335-xi
  engine_code: null
  fuel: essence
  fuel_class: essence
  displacement_bucket: '3.0'
  power_ps: 306
  power_kw: 225
  displacement_l: 3.0
  body: Break
  period:
    from_year: 2007
    from_month: 3
    to_year: 2008
    to_month: 8
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 31034
  name: 335 i xDrive
  alias: 335-i-xdrive
  engine_code: null
  fuel: essence
  fuel_class: essence
  displacement_bucket: '3.0'
  power_ps: 306
  power_kw: 225
  displacement_l: 3.0
  body: Break
  period:
    from_year: 2008
    from_month: 9
    to_year: 2012
    to_month: 6
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
      make: bmw
      model_generation: serie-3-touring-e91
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
      make: bmw
      model_generation: serie-3-touring-e91
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
  fuel_displacement:diesel:2.0:
    axis_key_type: fuel_displacement
    applies_to:
      make: bmw
      model_generation: serie-3-touring-e91
      fuel: diesel
      engine_family: null
      market: unknown
      displacement_liter: 2.0
    source:
      type: db
      table: auto_type
      axis: type_fuel
      confidence: high
      note: axe carburant DB-fiable ; issues/operations remplis au scraping PR-C.2 (jamais inventés).
    issues: []
  fuel_displacement:diesel:3.0:
    axis_key_type: fuel_displacement
    applies_to:
      make: bmw
      model_generation: serie-3-touring-e91
      fuel: diesel
      engine_family: null
      market: unknown
      displacement_liter: 3.0
    source:
      type: db
      table: auto_type
      axis: type_fuel
      confidence: high
      note: axe carburant DB-fiable ; issues/operations remplis au scraping PR-C.2 (jamais inventés).
    issues: []
  fuel_displacement:essence:1.6:
    axis_key_type: fuel_displacement
    applies_to:
      make: bmw
      model_generation: serie-3-touring-e91
      fuel: essence
      engine_family: null
      market: unknown
      displacement_liter: 1.6
    source:
      type: db
      table: auto_type
      axis: type_fuel
      confidence: high
      note: axe carburant DB-fiable ; issues/operations remplis au scraping PR-C.2 (jamais inventés).
    issues: []
  fuel_displacement:essence:2.0:
    axis_key_type: fuel_displacement
    applies_to:
      make: bmw
      model_generation: serie-3-touring-e91
      fuel: essence
      engine_family: null
      market: unknown
      displacement_liter: 2.0
    source:
      type: db
      table: auto_type
      axis: type_fuel
      confidence: high
      note: axe carburant DB-fiable ; issues/operations remplis au scraping PR-C.2 (jamais inventés).
    issues: []
  fuel_displacement:essence:2.5:
    axis_key_type: fuel_displacement
    applies_to:
      make: bmw
      model_generation: serie-3-touring-e91
      fuel: essence
      engine_family: null
      market: unknown
      displacement_liter: 2.5
    source:
      type: db
      table: auto_type
      axis: type_fuel
      confidence: high
      note: axe carburant DB-fiable ; issues/operations remplis au scraping PR-C.2 (jamais inventés).
    issues: []
  fuel_displacement:essence:3.0:
    axis_key_type: fuel_displacement
    applies_to:
      make: bmw
      model_generation: serie-3-touring-e91
      fuel: essence
      engine_family: null
      market: unknown
      displacement_liter: 3.0
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
      make: bmw
      model_generation: serie-3-touring-e91
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
      make: bmw
      model_generation: serie-3-touring-e91
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
  fuel_displacement:diesel:2.0:
    axis_key_type: fuel_displacement
    applies_to:
      make: bmw
      model_generation: serie-3-touring-e91
      fuel: diesel
      engine_family: null
      market: unknown
      displacement_liter: 2.0
    source:
      type: db
      table: auto_type
      axis: type_fuel
      confidence: high
      note: axe carburant DB-fiable ; issues/operations remplis au scraping PR-C.2 (jamais inventés).
    operations: []
  fuel_displacement:diesel:3.0:
    axis_key_type: fuel_displacement
    applies_to:
      make: bmw
      model_generation: serie-3-touring-e91
      fuel: diesel
      engine_family: null
      market: unknown
      displacement_liter: 3.0
    source:
      type: db
      table: auto_type
      axis: type_fuel
      confidence: high
      note: axe carburant DB-fiable ; issues/operations remplis au scraping PR-C.2 (jamais inventés).
    operations: []
  fuel_displacement:essence:1.6:
    axis_key_type: fuel_displacement
    applies_to:
      make: bmw
      model_generation: serie-3-touring-e91
      fuel: essence
      engine_family: null
      market: unknown
      displacement_liter: 1.6
    source:
      type: db
      table: auto_type
      axis: type_fuel
      confidence: high
      note: axe carburant DB-fiable ; issues/operations remplis au scraping PR-C.2 (jamais inventés).
    operations: []
  fuel_displacement:essence:2.0:
    axis_key_type: fuel_displacement
    applies_to:
      make: bmw
      model_generation: serie-3-touring-e91
      fuel: essence
      engine_family: null
      market: unknown
      displacement_liter: 2.0
    source:
      type: db
      table: auto_type
      axis: type_fuel
      confidence: high
      note: axe carburant DB-fiable ; issues/operations remplis au scraping PR-C.2 (jamais inventés).
    operations: []
  fuel_displacement:essence:2.5:
    axis_key_type: fuel_displacement
    applies_to:
      make: bmw
      model_generation: serie-3-touring-e91
      fuel: essence
      engine_family: null
      market: unknown
      displacement_liter: 2.5
    source:
      type: db
      table: auto_type
      axis: type_fuel
      confidence: high
      note: axe carburant DB-fiable ; issues/operations remplis au scraping PR-C.2 (jamais inventés).
    operations: []
  fuel_displacement:essence:3.0:
    axis_key_type: fuel_displacement
    applies_to:
      make: bmw
      model_generation: serie-3-touring-e91
      fuel: essence
      engine_family: null
      market: unknown
      displacement_liter: 3.0
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
- 'engine_code absent pour 41/41 motorisations : auto_type_motor_code est vide pour ces type_id (constat DB 2026-06-12
  : table quasi vide, 1 ligne sentinelle). Aucun code moteur inventé — à compléter par source éditoriale vérifiée
  (PR-C.2) ou backfill DB.'
# <<< END DB-MANAGED BLOCK: validation_notes
---

# BMW Série 3 Touring (E91) (2004-2012)

## Identité

- **Modèle** : BMW Série 3 Touring (E91)
- **Génération** : E91
- **Production** : 2004 - 2012
- **Carrosseries** : Break
- **Motorisations actives au catalogue** : 41 (18 diesel, 23 essence)

> Bloc FAITS générés depuis la DB interne (auto_modele / auto_type / auto_type_motor_code).
> Source de vérité structurée : frontmatter `motorizations` (provenance champ par champ).

## Motorisations (DB)

### Diesel

| Motorisation | Code moteur | Puissance | kW | Cylindrée | Période | type_id |
|--------------|-------------|-----------|----|-----------|---------|---------|
| 316 d | — | 116 ch | 85 | 2.0 L | 2009-2012 | 11145 |
| 318 d | — | 122 ch | 90 | 2.0 L | 2005-2007 | 19298 |
| 318 d | — | 136 ch | 100 | 2.0 L | 2007-2012 | 3980 |
| 318 d | — | 143 ch | 105 | 2.0 L | 2007-2012 | 25475 |
| 320 d | — | 150 ch | 110 | 2.0 L | 2004-2007 | 19954 |
| 320 d | — | 163 ch | 120 | 2.0 L | 2005-2012 | 18761 |
| 320 d xDrive | — | 163 ch | 120 | 2.0 L | 2009-2012 | 34946 |
| 320 d | — | 177 ch | 130 | 2.0 L | 2007-2010 | 25482 |
| 320 d xDrive | — | 177 ch | 130 | 2.0 L | 2008-2010 | 31035 |
| 320 d | — | 184 ch | 135 | 2.0 L | 2010-2012 | 33389 |
| 320 d xDrive | — | 184 ch | 135 | 2.0 L | 2010-2012 | 33390 |
| 325 d | — | 197 ch | 145 | 3.0 L | 2006-2012 | 19995 |
| 325 d | — | 204 ch | 150 | 3.0 L | 2010-2012 | 34767 |
| 330 d | — | 231 ch | 170 | 3.0 L | 2004-2008 | 18969 |
| 330 xd | — | 231 ch | 170 | 3.0 L | 2005-2012 | 19106 |
| 330 d | — | 245 ch | 180 | 3.0 L | 2008-2012 | 30865 |
| 330 d xDrive | — | 245 ch | 180 | 3.0 L | 2009-2012 | 30869 |
| 335 d | — | 286 ch | 210 | 3.0 L | 2006-2012 | 19836 |

### Essence

| Motorisation | Code moteur | Puissance | kW | Cylindrée | Période | type_id |
|--------------|-------------|-----------|----|-----------|---------|---------|
| 316 i | — | 122 ch | 90 | 1.6 L | 2008-2012 | 30910 |
| 318 i | — | 129 ch | 95 | 2.0 L | 2006-2007 | 19299 |
| 318 i | — | 136 ch | 100 | 2.0 L | 2007-2012 | 10780 |
| 318 i | — | 143 ch | 105 | 2.0 L | 2007-2012 | 25474 |
| 320 i | — | 150 ch | 110 | 2.0 L | 2005-2012 | 18758 |
| 320 i | — | 156 ch | 115 | 2.0 L | 2005-2012 | 55899 |
| 320 i | — | 170 ch | 125 | 2.0 L | 2007-2012 | 25476 |
| 323 i | — | 177 ch | 130 | 2.5 L | 2006-2007 | 28020 |
| 325 i | — | 218 ch | 160 | 2.5 L | 2004-2008 | 18759 |
| 325 xi | — | 218 ch | 160 | 2.5 L | 2005-2008 | 19104 |
| 325 i | — | 211 ch | 155 | 3.0 L | 2007-2012 | 3536 |
| 325 i | — | 218 ch | 160 | 3.0 L | 2007-2012 | 25480 |
| 325 xi | — | 218 ch | 160 | 3.0 L | 2007-2008 | 25481 |
| 325 i xDrive | — | 218 ch | 160 | 3.0 L | 2008-2012 | 31032 |
| 328 i | — | 234 ch | 171 | 3.0 L | 2007-2012 | 58078 |
| 330 i | — | 258 ch | 190 | 3.0 L | 2005-2007 | 18760 |
| 330 xi | — | 258 ch | 190 | 3.0 L | 2005-2007 | 19105 |
| 330 i | — | 272 ch | 200 | 3.0 L | 2007-2012 | 25478 |
| 330 xi | — | 272 ch | 200 | 3.0 L | 2007-2012 | 25479 |
| 330 i xDrive | — | 272 ch | 200 | 3.0 L | 2007-2012 | 31033 |
| 335 i | — | 306 ch | 225 | 3.0 L | 2006-2012 | 19834 |
| 335 xi | — | 306 ch | 225 | 3.0 L | 2007-2008 | 25477 |
| 335 i xDrive | — | 306 ch | 225 | 3.0 L | 2008-2012 | 31034 |

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

## Entretien

> Organisé PAR CARBURANT (intervalles fuel-dépendants : filtre gasoil 20-30k vs filtre
> essence 60k…). Clés normalisées du frontmatter `maintenance_by_engine`. Squelette
> BRONZE rempli au scraping PR-C.2 (data réparation constructeur) — jamais inventé.

### Diesel

<!-- TODO éditorial PR-C.2 — entretien du bloc diesel (clé `fuel:diesel`) : intervalles par moteur, opérations spécifiques. Valeurs prescriptives (couples…) = fail-closed sans source constructeur/OEM. -->

### Essence

<!-- TODO éditorial PR-C.2 — entretien du bloc essence (clé `fuel:essence`) : intervalles par moteur, opérations spécifiques. Valeurs prescriptives (couples…) = fail-closed sans source constructeur/OEM. -->

## Pièces fréquentes

<!-- TODO éditorial — croisement gammes ↔ véhicule (compatible_part_families),
     fuel-aware (un FAP ne concerne que les diesels, une bougie d'allumage que
     l'essence), maillé par les clés DB (PR-D.1+). -->

## FAQ

<!-- TODO éditorial — questions propriétaire sourcées (PR-C.2). -->

