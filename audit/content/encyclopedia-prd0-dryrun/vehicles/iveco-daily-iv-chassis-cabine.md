---
category: catalog/vehicle
doc_family: catalog
domain: vehicule
source_type: vehicle
title: Fiche véhicule - IVECO DAILY IV Chassis cabine
truth_level: L1
updated_at: '2026-06-13'
verification_status: verified
doc_id: d5dc358a-c761-57cc-8586-1e954f27f79c
lang: fr
make: iveco
model: daily-iv-chassis-cabine
generation: null
years:
- 2006
- 2012
provenance:
  ingested_by: script:vehicle-from-db-generator@v1
  generated_at: '2026-06-13T10:20:35Z'
  source_db: supabase (SELECT only — auto_marque/auto_modele/auto_type/auto_type_motor_code)
content_hash: sha256:cc2f370248a3df42
# >>> DB-MANAGED BLOCK: db_profile — script:vehicle-from-db-generator@v1 (ne pas éditer à la main)
db_profile:
  modele_id: 84015
  marque_id: 84
  modele_alias: daily-iv-chassis-cabine
  modele_parent: 84009
  active_type_count: 41
  type_id_scope: legacy < 60000 (type_display='1')
  selection_rank: 4
  fuel_breakdown:
    diesel: 41
  bodies:
  - Camion plate-forme/Châssis
  last_db_sync: '2026-06-13T10:20:35Z'
  source:
    type: db
    table: auto_modele + auto_type
    confidence: high
# <<< END DB-MANAGED BLOCK: db_profile
# >>> DB-MANAGED BLOCK: motorizations — script:vehicle-from-db-generator@v1 (ne pas éditer à la main)
motorizations:
- type_id: 34287
  name: 2.3 D 16V 29L10
  alias: 2-3-d-16v-29l10
  engine_code: null
  fuel: diesel
  fuel_class: diesel
  displacement_bucket: '2.3'
  power_ps: 95
  power_kw: 70
  displacement_l: 2.3
  body: Camion plate-forme/Châssis
  period:
    from_year: 2006
    from_month: 5
    to_year: 2011
    to_month: 8
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 34290
  name: 2.3 D 16V 35C10-35S10
  alias: 2-3-d-16v-35c10-35s10
  engine_code: null
  fuel: diesel
  fuel_class: diesel
  displacement_bucket: '2.3'
  power_ps: 95
  power_kw: 70
  displacement_l: 2.3
  body: Camion plate-forme/Châssis
  period:
    from_year: 2006
    from_month: 5
    to_year: 2011
    to_month: 8
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 34295
  name: 2.3 D 16V 40C10
  alias: 2-3-d-16v-40c10
  engine_code: null
  fuel: diesel
  fuel_class: diesel
  displacement_bucket: '2.3'
  power_ps: 95
  power_kw: 70
  displacement_l: 2.3
  body: Camion plate-forme/Châssis
  period:
    from_year: 2006
    from_month: 5
    to_year: 2011
    to_month: 8
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 34496
  name: 2.3 D 16V 40C11-40C11 D
  alias: 2-3-d-16v-40c11-40c11-d
  engine_code: null
  fuel: diesel
  fuel_class: diesel
  displacement_bucket: '2.3'
  power_ps: 106
  power_kw: 78
  displacement_l: 2.3
  body: Camion plate-forme/Châssis
  period:
    from_year: 2007
    from_month: 7
    to_year: 2011
    to_month: 8
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 34506
  name: 2.3 D 16V 35C11-35S11-35S11 D-35S11 P
  alias: 2-3-d-16v-35c11-35s11-35s11-d-35s11-p
  engine_code: null
  fuel: diesel
  fuel_class: diesel
  displacement_bucket: '2.3'
  power_ps: 106
  power_kw: 78
  displacement_l: 2.3
  body: Camion plate-forme/Châssis
  period:
    from_year: 2007
    from_month: 7
    to_year: 2011
    to_month: 8
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 34288
  name: 2.3 D 16V 29L12
  alias: 2-3-d-16v-29l12
  engine_code: null
  fuel: diesel
  fuel_class: diesel
  displacement_bucket: '2.3'
  power_ps: 116
  power_kw: 85
  displacement_l: 2.3
  body: Camion plate-forme/Châssis
  period:
    from_year: 2006
    from_month: 5
    to_year: 2011
    to_month: 8
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 34291
  name: 2.3 D 16V 35C12-35S12
  alias: 2-3-d-16v-35c12-35s12
  engine_code: null
  fuel: diesel
  fuel_class: diesel
  displacement_bucket: '2.3'
  power_ps: 116
  power_kw: 85
  displacement_l: 2.3
  body: Camion plate-forme/Châssis
  period:
    from_year: 2006
    from_month: 5
    to_year: 2011
    to_month: 8
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 34296
  name: 2.3 D 16V 40C12
  alias: 2-3-d-16v-40c12
  engine_code: null
  fuel: diesel
  fuel_class: diesel
  displacement_bucket: '2.3'
  power_ps: 116
  power_kw: 85
  displacement_l: 2.3
  body: Camion plate-forme/Châssis
  period:
    from_year: 2006
    from_month: 5
    to_year: 2011
    to_month: 8
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 34488
  name: 2.3 D 16V 35C13-35C13 P-35S13 D-35S13-35S13 P
  alias: 2-3-d-16v-35c13-35c13-p-35s13-d-35s13-35s13-p
  engine_code: null
  fuel: diesel
  fuel_class: diesel
  displacement_bucket: '2.3'
  power_ps: 126
  power_kw: 93
  displacement_l: 2.3
  body: Camion plate-forme/Châssis
  period:
    from_year: 2007
    from_month: 7
    to_year: 2011
    to_month: 8
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 34499
  name: 2.3 D 16V 40C13-40C13 P
  alias: 2-3-d-16v-40c13-40c13-p
  engine_code: null
  fuel: diesel
  fuel_class: diesel
  displacement_bucket: '2.3'
  power_ps: 126
  power_kw: 93
  displacement_l: 2.3
  body: Camion plate-forme/Châssis
  period:
    from_year: 2007
    from_month: 7
    to_year: 2011
    to_month: 8
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 34289
  name: 2.3 D 16V 29L14
  alias: 2-3-d-16v-29l14
  engine_code: null
  fuel: diesel
  fuel_class: diesel
  displacement_bucket: '2.3'
  power_ps: 136
  power_kw: 100
  displacement_l: 2.3
  body: Camion plate-forme/Châssis
  period:
    from_year: 2006
    from_month: 5
    to_year: 2011
    to_month: 8
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 34294
  name: 2.3 D 16V 35C14-35S14-35S14 P
  alias: 2-3-d-16v-35c14-35s14-35s14-p
  engine_code: null
  fuel: diesel
  fuel_class: diesel
  displacement_bucket: '2.3'
  power_ps: 136
  power_kw: 100
  displacement_l: 2.3
  body: Camion plate-forme/Châssis
  period:
    from_year: 2006
    from_month: 5
    to_year: 2011
    to_month: 8
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 34486
  name: 3.0 D 16V 70C14-70C14 P
  alias: 3-0-d-16v-70c14-70c14-p
  engine_code: null
  fuel: diesel
  fuel_class: diesel
  displacement_bucket: '3.0'
  power_ps: 140
  power_kw: 103
  displacement_l: 3.0
  body: Camion plate-forme/Châssis
  period:
    from_year: 2009
    from_month: 9
    to_year: 2011
    to_month: 8
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 34489
  name: 3.0 D 16V 35C14-35C14 P-35S14-35S14 P-35S14 D-35S14 D P
  alias: 3-0-d-16v-35c14-35c14-p-35s14-35s14-p-35s14-d-35s14-d-p
  engine_code: null
  fuel: diesel
  fuel_class: diesel
  displacement_bucket: '3.0'
  power_ps: 140
  power_kw: 103
  displacement_l: 3.0
  body: Camion plate-forme/Châssis
  period:
    from_year: 2009
    from_month: 9
    to_year: 2011
    to_month: 8
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 34494
  name: 3.0 D 16V 65C14-65C14 P
  alias: 3-0-d-16v-65c14-65c14-p
  engine_code: null
  fuel: diesel
  fuel_class: diesel
  displacement_bucket: '3.0'
  power_ps: 140
  power_kw: 103
  displacement_l: 3.0
  body: Camion plate-forme/Châssis
  period:
    from_year: 2009
    from_month: 9
    to_year: 2011
    to_month: 8
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 34497
  name: 3.0 D 16V 45C14-45C14 P
  alias: 3-0-d-16v-45c14-45c14-p
  engine_code: null
  fuel: diesel
  fuel_class: diesel
  displacement_bucket: '3.0'
  power_ps: 140
  power_kw: 103
  displacement_l: 3.0
  body: Camion plate-forme/Châssis
  period:
    from_year: 2009
    from_month: 9
    to_year: 2011
    to_month: 8
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 34503
  name: 3.0 D 16V 50C14-50C14 P
  alias: 3-0-d-16v-50c14-50c14-p
  engine_code: null
  fuel: diesel
  fuel_class: diesel
  displacement_bucket: '3.0'
  power_ps: 140
  power_kw: 103
  displacement_l: 3.0
  body: Camion plate-forme/Châssis
  period:
    from_year: 2009
    from_month: 9
    to_year: 2011
    to_month: 8
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 34504
  name: 3.0 D 16V 40C14-40C14 P
  alias: 3-0-d-16v-40c14-40c14-p
  engine_code: null
  fuel: diesel
  fuel_class: diesel
  displacement_bucket: '3.0'
  power_ps: 140
  power_kw: 103
  displacement_l: 3.0
  body: Camion plate-forme/Châssis
  period:
    from_year: 2009
    from_month: 9
    to_year: 2011
    to_month: 8
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 34508
  name: 3.0 D 16V 60C14-60C14 P
  alias: 3-0-d-16v-60c14-60c14-p
  engine_code: null
  fuel: diesel
  fuel_class: diesel
  displacement_bucket: '3.0'
  power_ps: 140
  power_kw: 103
  displacement_l: 3.0
  body: Camion plate-forme/Châssis
  period:
    from_year: 2009
    from_month: 9
    to_year: 2011
    to_month: 8
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 34283
  name: 3.0 D 16V 50C15
  alias: 3-0-d-16v-50c15
  engine_code: null
  fuel: diesel
  fuel_class: diesel
  displacement_bucket: '3.0'
  power_ps: 146
  power_kw: 107
  displacement_l: 3.0
  body: Camion plate-forme/Châssis
  period:
    from_year: 2006
    from_month: 5
    to_year: 2011
    to_month: 8
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 34292
  name: 3.0 D 16V 35C15
  alias: 3-0-d-16v-35c15
  engine_code: null
  fuel: diesel
  fuel_class: diesel
  displacement_bucket: '3.0'
  power_ps: 146
  power_kw: 107
  displacement_l: 3.0
  body: Camion plate-forme/Châssis
  period:
    from_year: 2006
    from_month: 5
    to_year: 2011
    to_month: 8
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 34297
  name: 3.0 D 16V 40C15
  alias: 3-0-d-16v-40c15
  engine_code: null
  fuel: diesel
  fuel_class: diesel
  displacement_bucket: '3.0'
  power_ps: 146
  power_kw: 107
  displacement_l: 3.0
  body: Camion plate-forme/Châssis
  period:
    from_year: 2006
    from_month: 5
    to_year: 2011
    to_month: 8
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 34299
  name: 3.0 D 16V 45C15
  alias: 3-0-d-16v-45c15
  engine_code: null
  fuel: diesel
  fuel_class: diesel
  displacement_bucket: '3.0'
  power_ps: 146
  power_kw: 107
  displacement_l: 3.0
  body: Camion plate-forme/Châssis
  period:
    from_year: 2006
    from_month: 5
    to_year: 2011
    to_month: 8
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 34301
  name: 3.0 D 16V 60C15-60C15 P-60C15 D-60C15 D P
  alias: 3-0-d-16v-60c15-60c15-p-60c15-d-60c15-d-p
  engine_code: null
  fuel: diesel
  fuel_class: diesel
  displacement_bucket: '3.0'
  power_ps: 146
  power_kw: 107
  displacement_l: 3.0
  body: Camion plate-forme/Châssis
  period:
    from_year: 2006
    from_month: 5
    to_year: 2011
    to_month: 8
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 34302
  name: 3.0 D 16V 65C15-65C15 P-65C15 D-65C15 D P
  alias: 3-0-d-16v-65c15-65c15-p-65c15-d-65c15-d-p
  engine_code: null
  fuel: diesel
  fuel_class: diesel
  displacement_bucket: '3.0'
  power_ps: 146
  power_kw: 107
  displacement_l: 3.0
  body: Camion plate-forme/Châssis
  period:
    from_year: 2006
    from_month: 5
    to_year: 2011
    to_month: 8
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 59784
  name: 3.0 D 16V 70C15
  alias: 3-0-d-16v-70c15
  engine_code: null
  fuel: diesel
  fuel_class: diesel
  displacement_bucket: '3.0'
  power_ps: 146
  power_kw: 107
  displacement_l: 3.0
  body: Camion plate-forme/Châssis
  period:
    from_year: 2008
    from_month: 7
    to_year: 2011
    to_month: 8
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 34485
  name: 3.0 D 16V 35C17-35C17 P-35S17-35S17 P-35S17 D
  alias: 3-0-d-16v-35c17-35c17-p-35s17-35s17-p-35s17-d
  engine_code: null
  fuel: diesel
  fuel_class: diesel
  displacement_bucket: '3.0'
  power_ps: 170
  power_kw: 125
  displacement_l: 3.0
  body: Camion plate-forme/Châssis
  period:
    from_year: 2007
    from_month: 7
    to_year: 2011
    to_month: 8
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 34487
  name: 3.0 D 16V 70C17-70C17 P
  alias: 3-0-d-16v-70c17-70c17-p
  engine_code: null
  fuel: diesel
  fuel_class: diesel
  displacement_bucket: '3.0'
  power_ps: 170
  power_kw: 125
  displacement_l: 3.0
  body: Camion plate-forme/Châssis
  period:
    from_year: 2007
    from_month: 7
    to_year: 2011
    to_month: 8
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 34492
  name: 3.0 D 16V 65C17-65C17 P
  alias: 3-0-d-16v-65c17-65c17-p
  engine_code: null
  fuel: diesel
  fuel_class: diesel
  displacement_bucket: '3.0'
  power_ps: 170
  power_kw: 125
  displacement_l: 3.0
  body: Camion plate-forme/Châssis
  period:
    from_year: 2007
    from_month: 7
    to_year: 2011
    to_month: 8
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 34493
  name: 3.0 D 16V 35S17 W-35S17 WD
  alias: 3-0-d-16v-35s17-w-35s17-wd
  engine_code: null
  fuel: diesel
  fuel_class: diesel
  displacement_bucket: '3.0'
  power_ps: 170
  power_kw: 125
  displacement_l: 3.0
  body: Camion plate-forme/Châssis
  period:
    from_year: 2007
    from_month: 7
    to_year: 2011
    to_month: 8
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 34495
  name: 3.0 D 16V 45C17-45C17 P
  alias: 3-0-d-16v-45c17-45c17-p
  engine_code: null
  fuel: diesel
  fuel_class: diesel
  displacement_bucket: '3.0'
  power_ps: 170
  power_kw: 125
  displacement_l: 3.0
  body: Camion plate-forme/Châssis
  period:
    from_year: 2007
    from_month: 7
    to_year: 2011
    to_month: 8
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 34498
  name: 3.0 D 16V 55S17 W-55S17 WD
  alias: 3-0-d-16v-55s17-w-55s17-wd
  engine_code: null
  fuel: diesel
  fuel_class: diesel
  displacement_bucket: '3.0'
  power_ps: 170
  power_kw: 125
  displacement_l: 3.0
  body: Camion plate-forme/Châssis
  period:
    from_year: 2007
    from_month: 7
    to_year: 2011
    to_month: 8
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 34500
  name: 3.0 D 16V 40C17-40C17 P
  alias: 3-0-d-16v-40c17-40c17-p
  engine_code: null
  fuel: diesel
  fuel_class: diesel
  displacement_bucket: '3.0'
  power_ps: 170
  power_kw: 125
  displacement_l: 3.0
  body: Camion plate-forme/Châssis
  period:
    from_year: 2007
    from_month: 7
    to_year: 2011
    to_month: 8
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 34501
  name: 3.0 D 16V 60C17-60C17 P
  alias: 3-0-d-16v-60c17-60c17-p
  engine_code: null
  fuel: diesel
  fuel_class: diesel
  displacement_bucket: '3.0'
  power_ps: 170
  power_kw: 125
  displacement_l: 3.0
  body: Camion plate-forme/Châssis
  period:
    from_year: 2007
    from_month: 7
    to_year: 2011
    to_month: 8
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 34507
  name: 3.0 D 16V 50C17-50C17 P
  alias: 3-0-d-16v-50c17-50c17-p
  engine_code: null
  fuel: diesel
  fuel_class: diesel
  displacement_bucket: '3.0'
  power_ps: 170
  power_kw: 125
  displacement_l: 3.0
  body: Camion plate-forme/Châssis
  period:
    from_year: 2007
    from_month: 7
    to_year: 2011
    to_month: 8
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 34284
  name: 3.0 D 16V 50C18
  alias: 3-0-d-16v-50c18
  engine_code: null
  fuel: diesel
  fuel_class: diesel
  displacement_bucket: '3.0'
  power_ps: 176
  power_kw: 130
  displacement_l: 3.0
  body: Camion plate-forme/Châssis
  period:
    from_year: 2006
    from_month: 5
    to_year: 2011
    to_month: 8
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 34285
  name: 3.0 D 16V 60C18
  alias: 3-0-d-16v-60c18
  engine_code: null
  fuel: diesel
  fuel_class: diesel
  displacement_bucket: '3.0'
  power_ps: 176
  power_kw: 130
  displacement_l: 3.0
  body: Camion plate-forme/Châssis
  period:
    from_year: 2006
    from_month: 5
    to_year: 2011
    to_month: 8
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 34286
  name: 3.0 D 16V 65C18
  alias: 3-0-d-16v-65c18
  engine_code: null
  fuel: diesel
  fuel_class: diesel
  displacement_bucket: '3.0'
  power_ps: 176
  power_kw: 130
  displacement_l: 3.0
  body: Camion plate-forme/Châssis
  period:
    from_year: 2006
    from_month: 5
    to_year: 2011
    to_month: 8
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 34293
  name: 3.0 D 16V 35C18-35S18
  alias: 3-0-d-16v-35c18-35s18
  engine_code: null
  fuel: diesel
  fuel_class: diesel
  displacement_bucket: '3.0'
  power_ps: 176
  power_kw: 130
  displacement_l: 3.0
  body: Camion plate-forme/Châssis
  period:
    from_year: 2006
    from_month: 5
    to_year: 2011
    to_month: 8
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 34298
  name: 3.0 D 16V 40C18
  alias: 3-0-d-16v-40c18
  engine_code: null
  fuel: diesel
  fuel_class: diesel
  displacement_bucket: '3.0'
  power_ps: 176
  power_kw: 130
  displacement_l: 3.0
  body: Camion plate-forme/Châssis
  period:
    from_year: 2006
    from_month: 5
    to_year: 2011
    to_month: 8
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 34300
  name: 3.0 D 16V 45C18-45C18 P-45C18 D-45C18 D P
  alias: 3-0-d-16v-45c18-45c18-p-45c18-d-45c18-d-p
  engine_code: null
  fuel: diesel
  fuel_class: diesel
  displacement_bucket: '3.0'
  power_ps: 176
  power_kw: 130
  displacement_l: 3.0
  body: Camion plate-forme/Châssis
  period:
    from_year: 2006
    from_month: 5
    to_year: 2011
    to_month: 8
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
      make: iveco
      model_generation: daily-iv-chassis-cabine
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
  fuel_displacement:diesel:2.3:
    axis_key_type: fuel_displacement
    applies_to:
      make: iveco
      model_generation: daily-iv-chassis-cabine
      fuel: diesel
      engine_family: null
      market: unknown
      displacement_liter: 2.3
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
      make: iveco
      model_generation: daily-iv-chassis-cabine
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
# <<< END DB-MANAGED BLOCK: known_issues_by_engine
# >>> DB-MANAGED BLOCK: maintenance_by_engine — script:vehicle-from-db-generator@v1 (ne pas éditer à la main)
maintenance_by_engine:
  fuel:diesel:
    axis_key_type: fuel
    applies_to:
      make: iveco
      model_generation: daily-iv-chassis-cabine
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
  fuel_displacement:diesel:2.3:
    axis_key_type: fuel_displacement
    applies_to:
      make: iveco
      model_generation: daily-iv-chassis-cabine
      fuel: diesel
      engine_family: null
      market: unknown
      displacement_liter: 2.3
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
      make: iveco
      model_generation: daily-iv-chassis-cabine
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
# <<< END DB-MANAGED BLOCK: maintenance_by_engine
# >>> DB-MANAGED BLOCK: validation_notes — script:vehicle-from-db-generator@v1 (ne pas éditer à la main)
validation_notes:
- 'engine_code absent pour 41/41 motorisations : auto_type_motor_code est vide pour ces type_id (constat DB 2026-06-12
  : table quasi vide, 1 ligne sentinelle). Aucun code moteur inventé — à compléter par source éditoriale vérifiée
  (PR-C.2) ou backfill DB.'
- generation non dérivable mécaniquement de modele_name (pas de suffixe entre parenthèses) — laissée à null, à confirmer
  éditorialement.
# <<< END DB-MANAGED BLOCK: validation_notes
---

# IVECO DAILY IV Chassis cabine (2006-2012)

## Identité

- **Modèle** : IVECO DAILY IV Chassis cabine
- **Génération** : non renseignée en DB
- **Production** : 2006 - 2012
- **Carrosseries** : Camion plate-forme/Châssis
- **Motorisations actives au catalogue** : 41 (41 diesel)

> Bloc FAITS générés depuis la DB interne (auto_modele / auto_type / auto_type_motor_code).
> Source de vérité structurée : frontmatter `motorizations` (provenance champ par champ).

## Motorisations (DB)

### Diesel

| Motorisation | Code moteur | Puissance | kW | Cylindrée | Période | type_id |
|--------------|-------------|-----------|----|-----------|---------|---------|
| 2.3 D 16V 29L10 | — | 95 ch | 70 | 2.3 L | 2006-2011 | 34287 |
| 2.3 D 16V 35C10-35S10 | — | 95 ch | 70 | 2.3 L | 2006-2011 | 34290 |
| 2.3 D 16V 40C10 | — | 95 ch | 70 | 2.3 L | 2006-2011 | 34295 |
| 2.3 D 16V 40C11-40C11 D | — | 106 ch | 78 | 2.3 L | 2007-2011 | 34496 |
| 2.3 D 16V 35C11-35S11-35S11 D-35S11 P | — | 106 ch | 78 | 2.3 L | 2007-2011 | 34506 |
| 2.3 D 16V 29L12 | — | 116 ch | 85 | 2.3 L | 2006-2011 | 34288 |
| 2.3 D 16V 35C12-35S12 | — | 116 ch | 85 | 2.3 L | 2006-2011 | 34291 |
| 2.3 D 16V 40C12 | — | 116 ch | 85 | 2.3 L | 2006-2011 | 34296 |
| 2.3 D 16V 35C13-35C13 P-35S13 D-35S13-35S13 P | — | 126 ch | 93 | 2.3 L | 2007-2011 | 34488 |
| 2.3 D 16V 40C13-40C13 P | — | 126 ch | 93 | 2.3 L | 2007-2011 | 34499 |
| 2.3 D 16V 29L14 | — | 136 ch | 100 | 2.3 L | 2006-2011 | 34289 |
| 2.3 D 16V 35C14-35S14-35S14 P | — | 136 ch | 100 | 2.3 L | 2006-2011 | 34294 |
| 3.0 D 16V 70C14-70C14 P | — | 140 ch | 103 | 3.0 L | 2009-2011 | 34486 |
| 3.0 D 16V 35C14-35C14 P-35S14-35S14 P-35S14 D-35S14 D P | — | 140 ch | 103 | 3.0 L | 2009-2011 | 34489 |
| 3.0 D 16V 65C14-65C14 P | — | 140 ch | 103 | 3.0 L | 2009-2011 | 34494 |
| 3.0 D 16V 45C14-45C14 P | — | 140 ch | 103 | 3.0 L | 2009-2011 | 34497 |
| 3.0 D 16V 50C14-50C14 P | — | 140 ch | 103 | 3.0 L | 2009-2011 | 34503 |
| 3.0 D 16V 40C14-40C14 P | — | 140 ch | 103 | 3.0 L | 2009-2011 | 34504 |
| 3.0 D 16V 60C14-60C14 P | — | 140 ch | 103 | 3.0 L | 2009-2011 | 34508 |
| 3.0 D 16V 50C15 | — | 146 ch | 107 | 3.0 L | 2006-2011 | 34283 |
| 3.0 D 16V 35C15 | — | 146 ch | 107 | 3.0 L | 2006-2011 | 34292 |
| 3.0 D 16V 40C15 | — | 146 ch | 107 | 3.0 L | 2006-2011 | 34297 |
| 3.0 D 16V 45C15 | — | 146 ch | 107 | 3.0 L | 2006-2011 | 34299 |
| 3.0 D 16V 60C15-60C15 P-60C15 D-60C15 D P | — | 146 ch | 107 | 3.0 L | 2006-2011 | 34301 |
| 3.0 D 16V 65C15-65C15 P-65C15 D-65C15 D P | — | 146 ch | 107 | 3.0 L | 2006-2011 | 34302 |
| 3.0 D 16V 70C15 | — | 146 ch | 107 | 3.0 L | 2008-2011 | 59784 |
| 3.0 D 16V 35C17-35C17 P-35S17-35S17 P-35S17 D | — | 170 ch | 125 | 3.0 L | 2007-2011 | 34485 |
| 3.0 D 16V 70C17-70C17 P | — | 170 ch | 125 | 3.0 L | 2007-2011 | 34487 |
| 3.0 D 16V 65C17-65C17 P | — | 170 ch | 125 | 3.0 L | 2007-2011 | 34492 |
| 3.0 D 16V 35S17 W-35S17 WD | — | 170 ch | 125 | 3.0 L | 2007-2011 | 34493 |
| 3.0 D 16V 45C17-45C17 P | — | 170 ch | 125 | 3.0 L | 2007-2011 | 34495 |
| 3.0 D 16V 55S17 W-55S17 WD | — | 170 ch | 125 | 3.0 L | 2007-2011 | 34498 |
| 3.0 D 16V 40C17-40C17 P | — | 170 ch | 125 | 3.0 L | 2007-2011 | 34500 |
| 3.0 D 16V 60C17-60C17 P | — | 170 ch | 125 | 3.0 L | 2007-2011 | 34501 |
| 3.0 D 16V 50C17-50C17 P | — | 170 ch | 125 | 3.0 L | 2007-2011 | 34507 |
| 3.0 D 16V 50C18 | — | 176 ch | 130 | 3.0 L | 2006-2011 | 34284 |
| 3.0 D 16V 60C18 | — | 176 ch | 130 | 3.0 L | 2006-2011 | 34285 |
| 3.0 D 16V 65C18 | — | 176 ch | 130 | 3.0 L | 2006-2011 | 34286 |
| 3.0 D 16V 35C18-35S18 | — | 176 ch | 130 | 3.0 L | 2006-2011 | 34293 |
| 3.0 D 16V 40C18 | — | 176 ch | 130 | 3.0 L | 2006-2011 | 34298 |
| 3.0 D 16V 45C18-45C18 P-45C18 D-45C18 D P | — | 176 ch | 130 | 3.0 L | 2006-2011 | 34300 |

## Problèmes connus

> Organisé PAR CARBURANT (axe motorisation — owner 2026-06-13). Squelette BRONZE :
> les clés `fuel:<carburant>` / `fuel_displacement:<carburant>:<L>` du frontmatter
> `known_issues_by_engine` sont DB-fiables ; le contenu est rempli au scraping PR-C.2
> (pannes PAR motorisation, rappels Rappel Conso) — jamais inventé, divergence DB →
> validation_notes. Le raffinement famille-moteur (`engine_family:<code>`) viendra avec
> le code moteur (absent en DB aujourd'hui → engine_code: null honnête).

### Diesel

<!-- TODO éditorial PR-C.2 — pannes connues du bloc diesel (clé `fuel:diesel`). applies_to.{make,model_generation,fuel,engine_family,market} + source.{type,source_market,lang_original,confidence,evidence_id} ; FR-only, reformulé non-verbatim. -->

## Entretien

> Organisé PAR CARBURANT (intervalles fuel-dépendants : filtre gasoil 20-30k vs filtre
> essence 60k…). Clés normalisées du frontmatter `maintenance_by_engine`. Squelette
> BRONZE rempli au scraping PR-C.2 (data réparation constructeur) — jamais inventé.

### Diesel

<!-- TODO éditorial PR-C.2 — entretien du bloc diesel (clé `fuel:diesel`) : intervalles par moteur, opérations spécifiques. Valeurs prescriptives (couples…) = fail-closed sans source constructeur/OEM. -->

## Pièces fréquentes

<!-- TODO éditorial — croisement gammes ↔ véhicule (compatible_part_families),
     fuel-aware (un FAP ne concerne que les diesels, une bougie d'allumage que
     l'essence), maillé par les clés DB (PR-D.1+). -->

## FAQ

<!-- TODO éditorial — questions propriétaire sourcées (PR-C.2). -->

