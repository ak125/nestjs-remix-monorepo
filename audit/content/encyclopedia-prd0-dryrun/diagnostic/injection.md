---
category: injection
doc_family: diagnostic
site_section: diagnostic
source_type: diagnostic
title: Diagnostic - Injection et alimentation
truth_level: L1
updated_at: '2026-06-13'
verification_status: verified
doc_id: 5c835dc7-0ef4-5aa0-9de9-7105a131c132
lang: fr
system: injection
severity: high
audience: client
fuel_aware: true
provenance:
  ingested_by: script:diagnostic-from-db-generator@v1
  generated_at: '2026-06-13T10:47:21Z'
  source_db: supabase (SELECT only — __diag_system/__diag_symptom/__diag_cause/__diag_maintenance_operation)
content_hash: sha256:eecd021c728f2e02
# >>> DB-MANAGED BLOCK: db_profile — script:diagnostic-from-db-generator@v1 (ne pas éditer à la main)
db_profile:
  system_id: 12
  system_slug: injection
  system_label: Injection et alimentation
  symptom_count: 5
  cause_count: 4
  maintenance_operation_count: 2
  last_db_sync: '2026-06-13T10:47:21Z'
  source:
    type: db
    table: __diag_system
    confidence: high
# <<< END DB-MANAGED BLOCK: db_profile
# >>> DB-MANAGED BLOCK: symptoms — script:diagnostic-from-db-generator@v1 (ne pas éditer à la main)
symptoms:
- slug: moteur_broute
  label: Moteur qui broute
  signal_mode: customer_reported
  urgency: moyenne
  source:
    type: db
    table: __diag_symptom
    confidence: high
- slug: ralenti_instable
  label: Ralenti instable
  signal_mode: customer_reported
  urgency: moyenne
  source:
    type: db
    table: __diag_symptom
    confidence: high
- slug: demarrage_difficile_injection
  label: Démarrage difficile
  signal_mode: customer_reported
  urgency: haute
  source:
    type: db
    table: __diag_symptom
    confidence: high
- slug: fumee_noire_injection
  label: Fumée noire diesel
  signal_mode: customer_reported
  urgency: moyenne
  source:
    type: db
    table: __diag_symptom
    confidence: high
- slug: perte_puissance_injection
  label: Perte de puissance brutale
  signal_mode: customer_reported
  urgency: haute
  source:
    type: db
    table: __diag_symptom
    confidence: high
# <<< END DB-MANAGED BLOCK: symptoms
# >>> DB-MANAGED BLOCK: probable_causes — script:diagnostic-from-db-generator@v1 (ne pas éditer à la main)
probable_causes:
- cause: injecteur_encrasse
  label: Injecteur encrassé/usé
  cause_type: wear
  likelihood: high
  urgency: haute
  workshop_priority: P1
  related_gammes: []
  source:
    type: db
    table: __diag_cause
    confidence: high
- cause: pompe_injection_hs
  label: Pompe HP défaillante
  cause_type: mechanical
  likelihood: high
  urgency: haute
  workshop_priority: P1
  related_gammes: []
  source:
    type: db
    table: __diag_cause
    confidence: high
- cause: bobine_allumage_hs
  label: Bobine d'allumage HS
  cause_type: electrical
  likelihood: medium
  urgency: moyenne
  workshop_priority: P2
  related_gammes: []
  source:
    type: db
    table: __diag_cause
    confidence: high
- cause: filtre_carburant_injection
  label: Filtre à carburant colmaté (injection)
  cause_type: wear
  likelihood: medium
  urgency: moyenne
  workshop_priority: P2
  related_gammes: []
  source:
    type: db
    table: __diag_cause
    confidence: high
# <<< END DB-MANAGED BLOCK: probable_causes
# >>> DB-MANAGED BLOCK: maintenance_db — script:diagnostic-from-db-generator@v1 (ne pas éditer à la main)
maintenance_db:
- slug: bougie_allumage_replacement
  label: Remplacement bougies d'allumage
  related_gamme_slug: bougie-d-allumage
  related_pg_id: 686
  interval_km:
  - 30000
  - 60000
  interval_months:
  - 36
  - 72
  normal_wear_km:
  - 30000
  - 90000
  severity_if_overdue: moderate
  source:
    type: db
    table: __diag_maintenance_operation
    confidence: high
- slug: injecteur_nettoyage
  label: Nettoyage/remplacement injecteurs
  related_gamme_slug: injecteur
  related_pg_id: 3902
  interval_km:
  - 80000
  - 200000
  interval_months:
  - 60
  - 180
  normal_wear_km:
  - 80000
  - 250000
  severity_if_overdue: high
  source:
    type: db
    table: __diag_maintenance_operation
    confidence: high
# <<< END DB-MANAGED BLOCK: maintenance_db
# >>> DB-MANAGED BLOCK: validation_notes — script:diagnostic-from-db-generator@v1 (ne pas éditer à la main)
validation_notes:
- slug système DB 'injection' absent de l'enum du schéma wiki diagnostic v1.0.0 — alignement schéma requis avant
  promotion WIKI (divergence __diag_system ↔ schéma).
- 'cause injecteur_encrasse: aucune op d''entretien matchée (préfixe 2-tokens) — related_gammes vide, renvoi gamme
  à compléter éditorialement.'
- 'cause pompe_injection_hs: aucune op d''entretien matchée (préfixe 2-tokens) — related_gammes vide, renvoi gamme
  à compléter éditorialement.'
- 'cause bobine_allumage_hs: aucune op d''entretien matchée (préfixe 2-tokens) — related_gammes vide, renvoi gamme
  à compléter éditorialement.'
- 'cause filtre_carburant_injection: aucune op d''entretien matchée (préfixe 2-tokens) — related_gammes vide, renvoi
  gamme à compléter éditorialement.'
# <<< END DB-MANAGED BLOCK: validation_notes
---

# Injection et alimentation — Diagnostic (maille système)

Injecteurs, pompe HP, rampe commune, régulateur pression

> Bloc FAITS générés depuis la DB interne (__diag_*). Source de vérité structurée :
> frontmatter `symptoms` / `probable_causes` / `maintenance_db` (provenance champ par champ).

## Symptômes

| Symptôme | Slug | Urgence |
|----------|------|---------|
| Moteur qui broute | `moteur_broute` | moyenne |
| Ralenti instable | `ralenti_instable` | moyenne |
| Démarrage difficile | `demarrage_difficile_injection` | haute |
| Fumée noire diesel | `fumee_noire_injection` | moyenne |
| Perte de puissance brutale | `perte_puissance_injection` | haute |

## Causes possibles

### Injecteur encrassé/usé

Pulvérisation dégradée, fuite possible
- **Type** : wear
- **Urgence** : haute · **Priorité atelier** : P1
- **Plage plausible** : 80000–250000 km · 5–15 ans

### Pompe HP défaillante

Pression rampe commune insuffisante
- **Type** : mechanical
- **Urgence** : haute · **Priorité atelier** : P1
- **Plage plausible** : 120000–300000 km · 6–15 ans

### Bobine d'allumage HS

Raté allumage sur un cylindre
- **Type** : electrical
- **Urgence** : moyenne · **Priorité atelier** : P2
- **Plage plausible** : 60000–150000 km · 4–12 ans

### Filtre à carburant colmaté (injection)

Débit insuffisant, eau dans filtre diesel
- **Type** : wear
- **Urgence** : moyenne · **Priorité atelier** : P2
- **Plage plausible** : 30000–60000 km · 24–48 ans

## Vérifications

- **Injecteur encrassé/usé** : Lecture codes défaut, test débit/retour injecteurs
- **Pompe HP défaillante** : Mesure pression rampe vs spécification
- **Bobine d'allumage HS** : Code défaut P030x, test résistance bobine
- **Filtre à carburant colmaté (injection)** : Contrôle historique, test débit

## Renvoi vers gammes

| Opération d'entretien | Gamme | pg_id | Intervalle | Sévérité si dépassé |
|----------------------|-------|-------|------------|---------------------|
| Remplacement bougies d'allumage | `bougie-d-allumage` | 686 | 30000–60000 km / 36–72 mois | moderate |
| Nettoyage/remplacement injecteurs | `injecteur` | 3902 | 80000–200000 km / 60–180 mois | high |

## Spécificités par carburant

> Système MOTEUR (`fuel_aware: true`) : symptômes et causes du système Injection et alimentation
> sont fuel-dépendants → sections éditoriales structurées PAR CARBURANT. Squelette
> BRONZE rempli au scraping PR-C.2 (jamais inventé) ; provenance par entrée :
> applies_to.{make,model_generation,fuel,engine_family,market} + source.{source_market,
> lang_original,confidence,evidence_id} ; clé moteur normalisée `engine_family:<code>`.

### Diesel

<!-- TODO éditorial PR-C.2 — pannes/causes spécifiques diesel du système injection (clé `fuel:diesel`) : symptômes propres au carburant, causes fuel-dépendantes, vérifications. FR-only, reformulé non-verbatim ; valeurs prescriptives (couples…) = fail-closed sans source constructeur/OEM. -->

### Essence

<!-- TODO éditorial PR-C.2 — pannes/causes spécifiques essence du système injection (clé `fuel:essence`) : symptômes propres au carburant, causes fuel-dépendantes, vérifications. FR-only, reformulé non-verbatim ; valeurs prescriptives (couples…) = fail-closed sans source constructeur/OEM. -->

### Électrique

<!-- TODO éditorial PR-C.2 — pannes/causes spécifiques electrique du système injection (clé `fuel:electrique`) : symptômes propres au carburant, causes fuel-dépendantes, vérifications. FR-only, reformulé non-verbatim ; valeurs prescriptives (couples…) = fail-closed sans source constructeur/OEM. -->

### Hybride

<!-- TODO éditorial PR-C.2 — pannes/causes spécifiques hybride du système injection (clé `fuel:hybride`) : symptômes propres au carburant, causes fuel-dépendantes, vérifications. FR-only, reformulé non-verbatim ; valeurs prescriptives (couples…) = fail-closed sans source constructeur/OEM. -->

### GPL / Gaz

<!-- TODO éditorial PR-C.2 — pannes/causes spécifiques gpl du système injection (clé `fuel:gpl`) : symptômes propres au carburant, causes fuel-dépendantes, vérifications. FR-only, reformulé non-verbatim ; valeurs prescriptives (couples…) = fail-closed sans source constructeur/OEM. -->


## Conseils sécurité

<!-- TODO éditorial — safety_advisory : squelette à remplir avec validation humaine.
     Fail-closed : aucune valeur technique critique (couples de serrage, etc.) sans
     source constructeur/OEM identifiée — sinon validation_notes, jamais exportable. -->

