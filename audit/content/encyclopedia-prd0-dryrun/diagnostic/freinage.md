---
category: freinage
doc_family: diagnostic
site_section: diagnostic
source_type: diagnostic
title: Diagnostic - Système de freinage
truth_level: L1
updated_at: '2026-06-13'
verification_status: verified
doc_id: c7907089-1ba3-51e1-96cd-5030b3496dba
lang: fr
system: freinage
severity: high
audience: client
fuel_aware: false
provenance:
  ingested_by: script:diagnostic-from-db-generator@v1
  generated_at: '2026-06-13T10:20:37Z'
  source_db: supabase (SELECT only — __diag_system/__diag_symptom/__diag_cause/__diag_maintenance_operation)
content_hash: sha256:196a6515e4b15dcf
# >>> DB-MANAGED BLOCK: db_profile — script:diagnostic-from-db-generator@v1 (ne pas éditer à la main)
db_profile:
  system_id: 1
  system_slug: freinage
  system_label: Système de freinage
  symptom_count: 5
  cause_count: 5
  maintenance_operation_count: 4
  last_db_sync: '2026-06-13T10:20:37Z'
  source:
    type: db
    table: __diag_system
    confidence: high
# <<< END DB-MANAGED BLOCK: db_profile
# >>> DB-MANAGED BLOCK: symptoms — script:diagnostic-from-db-generator@v1 (ne pas éditer à la main)
symptoms:
- slug: brake_noise_metallic
  label: Grincement aigu au freinage
  signal_mode: symptom_slugs
  urgency: haute
  source:
    type: db
    table: __diag_symptom
    confidence: high
- slug: brake_noise_grinding
  label: Bruit sourd / grondement au freinage
  signal_mode: symptom_slugs
  urgency: haute
  source:
    type: db
    table: __diag_symptom
    confidence: high
- slug: brake_vibration_pedal
  label: Vibration dans la pédale de frein
  signal_mode: symptom_slugs
  urgency: moyenne
  source:
    type: db
    table: __diag_symptom
    confidence: high
- slug: brake_soft_pedal
  label: Pédale de frein molle
  signal_mode: symptom_slugs
  urgency: haute
  source:
    type: db
    table: __diag_symptom
    confidence: high
- slug: brake_pulling_side
  label: Véhicule tire d'un côté au freinage
  signal_mode: symptom_slugs
  urgency: haute
  source:
    type: db
    table: __diag_symptom
    confidence: high
# <<< END DB-MANAGED BLOCK: symptoms
# >>> DB-MANAGED BLOCK: probable_causes — script:diagnostic-from-db-generator@v1 (ne pas éditer à la main)
probable_causes:
- cause: brake_pads_worn
  label: Plaquettes de frein usées
  cause_type: maintenance_related
  likelihood: high
  urgency: haute
  workshop_priority: diy
  related_gammes:
  - plaquette-de-frein
  source:
    type: db
    table: __diag_cause
    confidence: high
- cause: brake_disc_warped
  label: Disques de frein voilés
  cause_type: wear_related
  likelihood: medium
  urgency: moyenne
  workshop_priority: recommended
  related_gammes:
  - disque-de-frein
  source:
    type: db
    table: __diag_cause
    confidence: high
- cause: brake_caliper_seized
  label: Étrier de frein grippé
  cause_type: component_fault
  likelihood: high
  urgency: haute
  workshop_priority: required
  related_gammes:
  - etrier-de-frein
  source:
    type: db
    table: __diag_cause
    confidence: high
- cause: brake_slide_pins_dry
  label: Glissières d'étrier sèches
  cause_type: maintenance_related
  likelihood: low
  urgency: basse
  workshop_priority: diy
  related_gammes: []
  source:
    type: db
    table: __diag_cause
    confidence: high
- cause: brake_fluid_low
  label: Niveau de liquide de frein bas
  cause_type: maintenance_related
  likelihood: high
  urgency: haute
  workshop_priority: recommended
  related_gammes:
  - liquide-de-frein
  source:
    type: db
    table: __diag_cause
    confidence: high
# <<< END DB-MANAGED BLOCK: probable_causes
# >>> DB-MANAGED BLOCK: maintenance_db — script:diagnostic-from-db-generator@v1 (ne pas éditer à la main)
maintenance_db:
- slug: brake_pads_replacement
  label: Remplacement plaquettes de frein
  related_gamme_slug: plaquette-de-frein
  related_pg_id: 402
  interval_km:
  - 20000
  - 60000
  interval_months:
  - 24
  - 48
  normal_wear_km:
  - 20000
  - 80000
  severity_if_overdue: critical
  source:
    type: db
    table: __diag_maintenance_operation
    confidence: high
- slug: brake_disc_replacement
  label: Remplacement disques de frein
  related_gamme_slug: disque-de-frein
  related_pg_id: 82
  interval_km:
  - 40000
  - 80000
  interval_months:
  - 36
  - 72
  normal_wear_km:
  - 60000
  - 120000
  severity_if_overdue: high
  source:
    type: db
    table: __diag_maintenance_operation
    confidence: high
- slug: brake_fluid_change
  label: Purge/remplacement liquide de frein
  related_gamme_slug: liquide-de-frein
  related_pg_id: 479
  interval_km:
  - null
  - null
  interval_months:
  - 24
  - 36
  normal_wear_km:
  - null
  - null
  severity_if_overdue: high
  source:
    type: db
    table: __diag_maintenance_operation
    confidence: high
- slug: brake_caliper_overhaul
  label: Revision étrier de frein
  related_gamme_slug: etrier-de-frein
  related_pg_id: 78
  interval_km:
  - 80000
  - 150000
  interval_months:
  - 60
  - 120
  normal_wear_km:
  - 80000
  - 200000
  severity_if_overdue: moderate
  source:
    type: db
    table: __diag_maintenance_operation
    confidence: high
# <<< END DB-MANAGED BLOCK: maintenance_db
# >>> DB-MANAGED BLOCK: validation_notes — script:diagnostic-from-db-generator@v1 (ne pas éditer à la main)
validation_notes:
- 'cause brake_slide_pins_dry: aucune op d''entretien matchée (préfixe 2-tokens) — related_gammes vide, renvoi gamme
  à compléter éditorialement.'
# <<< END DB-MANAGED BLOCK: validation_notes
---

# Système de freinage — Diagnostic (maille système)

Circuit de freinage hydraulique : plaquettes, disques, étriers, flexibles, liquide

> Bloc FAITS générés depuis la DB interne (__diag_*). Source de vérité structurée :
> frontmatter `symptoms` / `probable_causes` / `maintenance_db` (provenance champ par champ).

## Symptômes

| Symptôme | Slug | Urgence |
|----------|------|---------|
| Grincement aigu au freinage | `brake_noise_metallic` | haute |
| Bruit sourd / grondement au freinage | `brake_noise_grinding` | haute |
| Vibration dans la pédale de frein | `brake_vibration_pedal` | moyenne |
| Pédale de frein molle | `brake_soft_pedal` | haute |
| Véhicule tire d'un côté au freinage | `brake_pulling_side` | haute |

## Causes possibles

### Plaquettes de frein usées

Garniture de friction usée, témoin d'usure métallique en contact avec le disque
- **Type** : maintenance_related
- **Urgence** : haute · **Priorité atelier** : diy
- **Plage plausible** : 20000–80000 km · 2–8 ans

### Disques de frein voilés

Disque déformé ou usé de façon irrégulière, provoque vibrations
- **Type** : wear_related
- **Urgence** : moyenne · **Priorité atelier** : recommended
- **Plage plausible** : 60000–150000 km · 4–12 ans

### Étrier de frein grippé

Piston d'étrier bloqué, provoque frottement permanent ou usure asymétrique
- **Type** : component_fault
- **Urgence** : haute · **Priorité atelier** : required
- **Plage plausible** : 80000–200000 km · 5–15 ans

### Glissières d'étrier sèches

Absence de graisse sur les glissières, plaquettes difficiles à bouger
- **Type** : maintenance_related
- **Urgence** : basse · **Priorité atelier** : diy
- **Plage plausible** : 30000–100000 km · 2–10 ans

### Niveau de liquide de frein bas

Niveau de liquide de frein en dessous du minimum, peut indiquer fuite ou usure plaquettes
- **Type** : maintenance_related
- **Urgence** : haute · **Priorité atelier** : recommended
- **Plage plausible** : — · 2 ans

## Vérifications

- **Plaquettes de frein usées** : Témoin usure allumé, épaisseur < 3mm
- **Disques de frein voilés** : Vibration pédale, usure inégale visible
- **Étrier de frein grippé** : Usure asymétrique des plaquettes
- **Glissières d'étrier sèches** : Plaquettes difficiles à bouger dans le support
- **Niveau de liquide de frein bas** : Vérification niveau bocal, recherche de fuite

## Renvoi vers gammes

| Opération d'entretien | Gamme | pg_id | Intervalle | Sévérité si dépassé |
|----------------------|-------|-------|------------|---------------------|
| Remplacement plaquettes de frein | `plaquette-de-frein` | 402 | 20000–60000 km / 24–48 mois | critical |
| Remplacement disques de frein | `disque-de-frein` | 82 | 40000–80000 km / 36–72 mois | high |
| Purge/remplacement liquide de frein | `liquide-de-frein` | 479 | 24–36 mois | high |
| Revision étrier de frein | `etrier-de-frein` | 78 | 80000–150000 km / 60–120 mois | moderate |

> Système châssis/sécurité (`fuel_aware: false`) : fuel-agnostique — pas de dimension
> carburant (le système Système de freinage ne dépend pas de la motorisation). Le contenu
> éditorial (PR-C.2) reste commun à toutes les motorisations.


## Conseils sécurité

<!-- TODO éditorial — safety_advisory : squelette à remplir avec validation humaine.
     Fail-closed : aucune valeur technique critique (couples de serrage, etc.) sans
     source constructeur/OEM identifiée — sinon validation_notes, jamais exportable. -->

