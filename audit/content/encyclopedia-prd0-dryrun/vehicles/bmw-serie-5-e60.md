---
category: catalog/vehicle
doc_family: catalog
domain: vehicule
source_type: vehicle
title: Fiche véhicule - BMW Série 5 (E60)
truth_level: L1
updated_at: '2026-06-12'
verification_status: verified
doc_id: df4abb71-85be-5d68-8ece-42bac08bef8d
lang: fr
make: bmw
model: serie-5-e60
generation: E60
years:
- 2001
- 2010
provenance:
  ingested_by: script:vehicle-from-db-generator@v1
  generated_at: '2026-06-12T18:13:30Z'
  source_db: supabase (SELECT only — auto_marque/auto_modele/auto_type/auto_type_motor_code)
content_hash: sha256:3129159ba7fbd74e
# >>> DB-MANAGED BLOCK: db_profile — script:vehicle-from-db-generator@v1 (ne pas éditer à la main)
db_profile:
  modele_id: 33052
  marque_id: 33
  modele_alias: serie-5-e60
  modele_parent: 0
  active_type_count: 42
  type_id_scope: legacy < 60000 (type_display='1')
  selection_rank: 2
  fuel_breakdown:
    diesel: 17
    essence: 25
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
- type_id: 19955
  name: 520 d
  alias: 2-0-520-d
  engine_code: null
  fuel: diesel
  power_ps: 150
  power_kw: 110
  displacement_l: 2.0
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
- type_id: 19023
  name: 520 d
  alias: 2-0-520-d
  engine_code: null
  fuel: diesel
  power_ps: 163
  power_kw: 120
  displacement_l: 2.0
  body: A trois volumes
  period:
    from_year: 2005
    from_month: 9
    to_year: 2009
    to_month: 12
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 25489
  name: 520 d
  alias: 2-0-520-d
  engine_code: null
  fuel: diesel
  power_ps: 177
  power_kw: 130
  displacement_l: 2.0
  body: A trois volumes
  period:
    from_year: 2007
    from_month: 9
    to_year: 2009
    to_month: 12
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 19950
  name: 525 d
  alias: 2-5-525-d
  engine_code: null
  fuel: diesel
  power_ps: 163
  power_kw: 120
  displacement_l: 2.5
  body: A trois volumes
  period:
    from_year: 2004
    from_month: 12
    to_year: 2010
    to_month: 3
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 17968
  name: 525 d
  alias: 2-5-525-d
  engine_code: null
  fuel: diesel
  power_ps: 177
  power_kw: 130
  displacement_l: 2.5
  body: A trois volumes
  period:
    from_year: 2004
    from_month: 6
    to_year: 2010
    to_month: 3
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 22660
  name: 525 d
  alias: 3-0-525-d
  engine_code: null
  fuel: diesel
  power_ps: 197
  power_kw: 145
  displacement_l: 3.0
  body: A trois volumes
  period:
    from_year: 2007
    from_month: 1
    to_year: 2010
    to_month: 3
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 25446
  name: 525 xd
  alias: 3-0-525-xd
  engine_code: null
  fuel: diesel
  power_ps: 197
  power_kw: 145
  displacement_l: 3.0
  body: A trois volumes
  period:
    from_year: 2006
    from_month: 11
    to_year: 2007
    to_month: 8
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 31022
  name: 525 d xDrive
  alias: 3-0-525-d-xdrive
  engine_code: null
  fuel: diesel
  power_ps: 197
  power_kw: 145
  displacement_l: 3.0
  body: A trois volumes
  period:
    from_year: 2007
    from_month: 9
    to_year: 2009
    to_month: 12
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 54932
  name: 530 d
  alias: 3-0-530-d
  engine_code: null
  fuel: diesel
  power_ps: 211
  power_kw: 155
  displacement_l: 3.0
  body: A trois volumes
  period:
    from_year: 2002
    from_month: 9
    to_year: 2009
    to_month: 12
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 17292
  name: 530 d
  alias: 3-0-530-d
  engine_code: null
  fuel: diesel
  power_ps: 218
  power_kw: 160
  displacement_l: 3.0
  body: A trois volumes
  period:
    from_year: 2002
    from_month: 9
    to_year: 2005
    to_month: 9
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 19024
  name: 530 d
  alias: 3-0-530-d
  engine_code: null
  fuel: diesel
  power_ps: 231
  power_kw: 170
  displacement_l: 3.0
  body: A trois volumes
  period:
    from_year: 2005
    from_month: 9
    to_year: 2007
    to_month: 3
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 19097
  name: 530 xd
  alias: 3-0-530-xd
  engine_code: null
  fuel: diesel
  power_ps: 231
  power_kw: 170
  displacement_l: 3.0
  body: A trois volumes
  period:
    from_year: 2005
    from_month: 2
    to_year: 2007
    to_month: 2
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 22661
  name: 530 d
  alias: 3-0-530-d
  engine_code: null
  fuel: diesel
  power_ps: 235
  power_kw: 173
  displacement_l: 3.0
  body: A trois volumes
  period:
    from_year: 2007
    from_month: 2
    to_year: 2009
    to_month: 12
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 22662
  name: 530 xd
  alias: 3-0-530-xd
  engine_code: null
  fuel: diesel
  power_ps: 235
  power_kw: 173
  displacement_l: 3.0
  body: A trois volumes
  period:
    from_year: 2007
    from_month: 3
    to_year: 2007
    to_month: 8
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 31023
  name: 530 d xDrive
  alias: 3-0-530-d-xdrive
  engine_code: null
  fuel: diesel
  power_ps: 235
  power_kw: 173
  displacement_l: 3.0
  body: A trois volumes
  period:
    from_year: 2007
    from_month: 9
    to_year: 2009
    to_month: 12
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 18308
  name: 535 d
  alias: 3-0-535-d
  engine_code: null
  fuel: diesel
  power_ps: 272
  power_kw: 200
  displacement_l: 3.0
  body: A trois volumes
  period:
    from_year: 2004
    from_month: 9
    to_year: 2010
    to_month: 3
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 22656
  name: 535 d
  alias: 3-0-535-d
  engine_code: null
  fuel: diesel
  power_ps: 286
  power_kw: 210
  displacement_l: 3.0
  body: A trois volumes
  period:
    from_year: 2007
    from_month: 1
    to_year: 2010
    to_month: 3
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 59410
  name: 520 i
  alias: 2-0-520-i
  engine_code: null
  fuel: essence
  power_ps: 156
  power_kw: 115
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
- type_id: 26960
  name: 520 i
  alias: 2-0-520-i
  engine_code: null
  fuel: essence
  power_ps: 163
  power_kw: 120
  displacement_l: 2.0
  body: A trois volumes
  period:
    from_year: 2006
    from_month: 12
    to_year: 2010
    to_month: 3
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 25491
  name: 520 i 16V
  alias: 2-0-520-i
  engine_code: null
  fuel: essence
  power_ps: 170
  power_kw: 125
  displacement_l: 2.0
  body: A trois volumes
  period:
    from_year: 2007
    from_month: 9
    to_year: 2009
    to_month: 12
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 17290
  name: 520 i 24V
  alias: 2-2-520-i
  engine_code: null
  fuel: essence
  power_ps: 170
  power_kw: 125
  displacement_l: 2.2
  body: A trois volumes
  period:
    from_year: 2003
    from_month: 7
    to_year: 2010
    to_month: 3
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 19013
  name: 523 i
  alias: 523-i
  engine_code: null
  fuel: essence
  power_ps: 177
  power_kw: 130
  displacement_l: 2.5
  body: A trois volumes
  period:
    from_year: 2004
    from_month: 10
    to_year: 2007
    to_month: 2
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 22659
  name: 523 i
  alias: 523-i
  engine_code: null
  fuel: essence
  power_ps: 190
  power_kw: 140
  displacement_l: 2.5
  body: A trois volumes
  period:
    from_year: 2007
    from_month: 3
    to_year: 2009
    to_month: 12
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 17293
  name: 525 i
  alias: 525-i
  engine_code: null
  fuel: essence
  power_ps: 192
  power_kw: 141
  displacement_l: 2.5
  body: A trois volumes
  period:
    from_year: 2003
    from_month: 9
    to_year: 2005
    to_month: 2
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 19018
  name: 525 i
  alias: 525-i
  engine_code: null
  fuel: essence
  power_ps: 218
  power_kw: 160
  displacement_l: 2.5
  body: A trois volumes
  period:
    from_year: 2005
    from_month: 3
    to_year: 2009
    to_month: 12
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 19095
  name: 525 xi
  alias: 525-xi
  engine_code: null
  fuel: essence
  power_ps: 218
  power_kw: 160
  displacement_l: 2.5
  body: A trois volumes
  period:
    from_year: 2005
    from_month: 4
    to_year: 2007
    to_month: 2
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 22657
  name: 525 i
  alias: 525-i
  engine_code: null
  fuel: essence
  power_ps: 218
  power_kw: 160
  displacement_l: 3.0
  body: A trois volumes
  period:
    from_year: 2007
    from_month: 1
    to_year: 2010
    to_month: 3
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 22658
  name: 525 xi
  alias: 525-xi
  engine_code: null
  fuel: essence
  power_ps: 218
  power_kw: 160
  displacement_l: 3.0
  body: A trois volumes
  period:
    from_year: 2007
    from_month: 3
    to_year: 2009
    to_month: 12
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 31020
  name: 525 i xDrive
  alias: 525-i-xdrive
  engine_code: null
  fuel: essence
  power_ps: 218
  power_kw: 160
  displacement_l: 3.0
  body: A trois volumes
  period:
    from_year: 2008
    from_month: 9
    to_year: 2010
    to_month: 3
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 16023
  name: 530 i (Phase 2)
  alias: 530-i-phase-2
  engine_code: null
  fuel: essence
  power_ps: 228
  power_kw: 168
  displacement_l: 3.0
  body: A trois volumes
  period:
    from_year: 2007
    from_month: 9
    to_year: 2009
    to_month: 12
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 17291
  name: 530 i (Phase 1)
  alias: 530-i-phase-1
  engine_code: null
  fuel: essence
  power_ps: 231
  power_kw: 170
  displacement_l: 3.0
  body: A trois volumes
  period:
    from_year: 2001
    from_month: 12
    to_year: 2005
    to_month: 2
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 19007
  name: 530 i
  alias: 530-i
  engine_code: null
  fuel: essence
  power_ps: 258
  power_kw: 190
  displacement_l: 3.0
  body: A trois volumes
  period:
    from_year: 2005
    from_month: 3
    to_year: 2007
    to_month: 3
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 19096
  name: 530 xi
  alias: 530-xi
  engine_code: null
  fuel: essence
  power_ps: 258
  power_kw: 190
  displacement_l: 3.0
  body: A trois volumes
  period:
    from_year: 2004
    from_month: 9
    to_year: 2007
    to_month: 2
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 22663
  name: 530 i
  alias: 530-i
  engine_code: null
  fuel: essence
  power_ps: 272
  power_kw: 200
  displacement_l: 3.0
  body: A trois volumes
  period:
    from_year: 2007
    from_month: 3
    to_year: 2009
    to_month: 12
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 22664
  name: 530 xi
  alias: 530-xi
  engine_code: null
  fuel: essence
  power_ps: 272
  power_kw: 200
  displacement_l: 3.0
  body: A trois volumes
  period:
    from_year: 2007
    from_month: 2
    to_year: 2008
    to_month: 8
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 31021
  name: 530 i xDrive
  alias: 530-i-xdrive
  engine_code: null
  fuel: essence
  power_ps: 272
  power_kw: 200
  displacement_l: 3.0
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
- type_id: 53674
  name: 535 i xDrive
  alias: 535-i-xdrive
  engine_code: null
  fuel: essence
  power_ps: 305
  power_kw: 224
  displacement_l: 3.0
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
- type_id: 25092
  name: 535 i
  alias: 535-i
  engine_code: null
  fuel: essence
  power_ps: 306
  power_kw: 225
  displacement_l: 3.0
  body: A trois volumes
  period:
    from_year: 2006
    from_month: 4
    to_year: 2009
    to_month: 12
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 19020
  name: 540 i
  alias: 540-i
  engine_code: null
  fuel: essence
  power_ps: 306
  power_kw: 225
  displacement_l: 4.0
  body: A trois volumes
  period:
    from_year: 2007
    from_month: 3
    to_year: 2009
    to_month: 12
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 17294
  name: 545 i
  alias: 545-i
  engine_code: null
  fuel: essence
  power_ps: 333
  power_kw: 245
  displacement_l: 4.4
  body: A trois volumes
  period:
    from_year: 2003
    from_month: 9
    to_year: 2005
    to_month: 8
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 35731
  name: 550 i
  alias: 550-i
  engine_code: null
  fuel: essence
  power_ps: 355
  power_kw: 261
  displacement_l: 4.8
  body: A trois volumes
  period:
    from_year: 2005
    from_month: 9
    to_year: 2010
    to_month: 3
  source:
    type: db
    table: auto_type
    confidence: high
- type_id: 19021
  name: 550 i
  alias: 550-i
  engine_code: null
  fuel: essence
  power_ps: 367
  power_kw: 270
  displacement_l: 4.8
  body: A trois volumes
  period:
    from_year: 2005
    from_month: 9
    to_year: 2009
    to_month: 12
  source:
    type: db
    table: auto_type
    confidence: high
# <<< END DB-MANAGED BLOCK: motorizations
# >>> DB-MANAGED BLOCK: validation_notes — script:vehicle-from-db-generator@v1 (ne pas éditer à la main)
validation_notes:
- 'engine_code absent pour 42/42 motorisations : auto_type_motor_code est vide pour ces type_id (constat DB 2026-06-12
  : table quasi vide, 1 ligne sentinelle). Aucun code moteur inventé — à compléter par source éditoriale vérifiée
  (PR-C.2) ou backfill DB.'
# <<< END DB-MANAGED BLOCK: validation_notes
---

# BMW Série 5 (E60) (2001-2010)

## Identité

- **Modèle** : BMW Série 5 (E60)
- **Génération** : E60
- **Production** : 2001 - 2010
- **Carrosseries** : A trois volumes
- **Motorisations actives au catalogue** : 42 (17 diesel, 25 essence)

> Bloc FAITS générés depuis la DB interne (auto_modele / auto_type / auto_type_motor_code).
> Source de vérité structurée : frontmatter `motorizations` (provenance champ par champ).

## Motorisations (DB)

### Diesel

| Motorisation | Code moteur | Puissance | kW | Cylindrée | Période | type_id |
|--------------|-------------|-----------|----|-----------|---------|---------|
| 520 d | — | 150 ch | 110 | 2.0 L | 2005-2007 | 19955 |
| 520 d | — | 163 ch | 120 | 2.0 L | 2005-2009 | 19023 |
| 520 d | — | 177 ch | 130 | 2.0 L | 2007-2009 | 25489 |
| 525 d | — | 163 ch | 120 | 2.5 L | 2004-2010 | 19950 |
| 525 d | — | 177 ch | 130 | 2.5 L | 2004-2010 | 17968 |
| 525 d | — | 197 ch | 145 | 3.0 L | 2007-2010 | 22660 |
| 525 xd | — | 197 ch | 145 | 3.0 L | 2006-2007 | 25446 |
| 525 d xDrive | — | 197 ch | 145 | 3.0 L | 2007-2009 | 31022 |
| 530 d | — | 211 ch | 155 | 3.0 L | 2002-2009 | 54932 |
| 530 d | — | 218 ch | 160 | 3.0 L | 2002-2005 | 17292 |
| 530 d | — | 231 ch | 170 | 3.0 L | 2005-2007 | 19024 |
| 530 xd | — | 231 ch | 170 | 3.0 L | 2005-2007 | 19097 |
| 530 d | — | 235 ch | 173 | 3.0 L | 2007-2009 | 22661 |
| 530 xd | — | 235 ch | 173 | 3.0 L | 2007-2007 | 22662 |
| 530 d xDrive | — | 235 ch | 173 | 3.0 L | 2007-2009 | 31023 |
| 535 d | — | 272 ch | 200 | 3.0 L | 2004-2010 | 18308 |
| 535 d | — | 286 ch | 210 | 3.0 L | 2007-2010 | 22656 |

### Essence

| Motorisation | Code moteur | Puissance | kW | Cylindrée | Période | type_id |
|--------------|-------------|-----------|----|-----------|---------|---------|
| 520 i | — | 156 ch | 115 | 2.0 L | 2007-2010 | 59410 |
| 520 i | — | 163 ch | 120 | 2.0 L | 2006-2010 | 26960 |
| 520 i 16V | — | 170 ch | 125 | 2.0 L | 2007-2009 | 25491 |
| 520 i 24V | — | 170 ch | 125 | 2.2 L | 2003-2010 | 17290 |
| 523 i | — | 177 ch | 130 | 2.5 L | 2004-2007 | 19013 |
| 523 i | — | 190 ch | 140 | 2.5 L | 2007-2009 | 22659 |
| 525 i | — | 192 ch | 141 | 2.5 L | 2003-2005 | 17293 |
| 525 i | — | 218 ch | 160 | 2.5 L | 2005-2009 | 19018 |
| 525 xi | — | 218 ch | 160 | 2.5 L | 2005-2007 | 19095 |
| 525 i | — | 218 ch | 160 | 3.0 L | 2007-2010 | 22657 |
| 525 xi | — | 218 ch | 160 | 3.0 L | 2007-2009 | 22658 |
| 525 i xDrive | — | 218 ch | 160 | 3.0 L | 2008-2010 | 31020 |
| 530 i (Phase 2) | — | 228 ch | 168 | 3.0 L | 2007-2009 | 16023 |
| 530 i (Phase 1) | — | 231 ch | 170 | 3.0 L | 2001-2005 | 17291 |
| 530 i | — | 258 ch | 190 | 3.0 L | 2005-2007 | 19007 |
| 530 xi | — | 258 ch | 190 | 3.0 L | 2004-2007 | 19096 |
| 530 i | — | 272 ch | 200 | 3.0 L | 2007-2009 | 22663 |
| 530 xi | — | 272 ch | 200 | 3.0 L | 2007-2008 | 22664 |
| 530 i xDrive | — | 272 ch | 200 | 3.0 L | 2008-2009 | 31021 |
| 535 i xDrive | — | 305 ch | 224 | 3.0 L | 2008-2009 | 53674 |
| 535 i | — | 306 ch | 225 | 3.0 L | 2006-2009 | 25092 |
| 540 i | — | 306 ch | 225 | 4.0 L | 2007-2009 | 19020 |
| 545 i | — | 333 ch | 245 | 4.4 L | 2003-2005 | 17294 |
| 550 i | — | 355 ch | 261 | 4.8 L | 2005-2010 | 35731 |
| 550 i | — | 367 ch | 270 | 4.8 L | 2005-2009 | 19021 |

## Spécificités & problèmes connus

<!-- TODO éditorial — couche web sourcée (PR-C.2) : pannes connues PAR motorisation
     (known_issues_by_engine), rappels officiels (Rappel Conso), entretien par moteur.
     Aucune donnée scrapée ne remplace un fait DB ; divergence → validation_notes. -->

## Pièces fréquentes

<!-- TODO éditorial — croisement gammes ↔ véhicule (compatible_part_families),
     maillé par les clés DB (PR-D.1+). -->

## FAQ

<!-- TODO éditorial — questions propriétaire sourcées (PR-C.2). -->

