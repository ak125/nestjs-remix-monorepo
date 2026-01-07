---
title: "Knowledge Graph Governance"
status: active
version: 1.0.0
authors: [Architecture Team, Security Team]
created: 2026-01-01
updated: 2026-01-01
relates-to:
  - ./knowledge-graph-v2.8.md
  - ./ai-cos-operating-system.md
  - ../workflows/ai-cos-index.md
tags: [knowledge-graph, governance, security, versioning, audit, critical]
priority: critical
---

# Knowledge Graph Governance

## Overview

Le Knowledge Graph (KG) est le **cerveau central** de l'AI-COS. Ce document définit les règles de gouvernance pour garantir son intégrité, sa sécurité et sa traçabilité.

> **Principe fondamental** : Le KG est un actif critique. Toute modification doit être tracée, validée et réversible.

## Architecture de Gouvernance

```
┌─────────────────────────────────────────────────────────────┐
│                    KNOWLEDGE GRAPH                          │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │
│  │  Lecture    │  │  Écriture   │  │   Admin     │          │
│  │  (PUBLIC)   │  │ (PIPELINE)  │  │ (RESTREINT) │          │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘          │
│         │                │                │                  │
│         ▼                ▼                ▼                  │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              Couche d'Audit                         │    │
│  │  - Logging complet (qui/quoi/quand)                 │    │
│  │  - Versioning sémantique                            │    │
│  │  - Rollback automatisé                              │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

## Règles d'Accès

### Niveaux d'Accès

| Niveau | Rôle | Permissions | Authentification |
|--------|------|-------------|------------------|
| **PUBLIC** | Tous agents IA | Lecture seule | Token agent |
| **PIPELINE** | CI/CD validé | Écriture via PR | Token service + review |
| **ADMIN** | 2-3 personnes max | Full access | MFA + audit log |
| **EMERGENCY** | CTO/CEO uniquement | Rollback immédiat | MFA + notification Board |

### Matrice des Permissions

```yaml
Permissions:
  lecture:
    qui: [tous_agents, dashboards, api_public]
    quoi: [nodes, edges, metadata, versions]
    rate_limit: 1000 req/min

  écriture:
    qui: [pipeline_ci, agents_validés]
    quoi: [nouveaux_nodes, nouvelles_edges, metadata]
    validation: PR obligatoire + 1 reviewer

  modification:
    qui: [pipeline_ci, admin]
    quoi: [nodes_existants, edges_existantes]
    validation: PR obligatoire + 2 reviewers

  suppression:
    qui: [admin_uniquement]
    quoi: [soft_delete_uniquement]
    validation: Approbation CTO + archivage

  admin:
    qui: [cto, lead_architect, security_officer]
    quoi: [schema, permissions, rollback, purge]
    validation: MFA + audit log + notification
```

## Stratégie de Versioning

### Semantic Versioning

```
Format: MAJOR.MINOR.PATCH

MAJOR : Changement de schéma incompatible
MINOR : Ajout de fonctionnalités rétrocompatibles
PATCH : Corrections de données/bugs
```

### Exemples

| Version | Type | Description |
|---------|------|-------------|
| `2.8.0 → 3.0.0` | MAJOR | Nouvelle taxonomie symptômes |
| `2.8.0 → 2.9.0` | MINOR | Ajout 500 nouvelles pannes |
| `2.8.0 → 2.8.1` | PATCH | Correction liens incorrects |

### Branches et Environnements

```
main (production)
  └── staging (validation)
        └── develop (intégration)
              └── feature/kg-* (développement)
```

| Branche | Environnement | Validation |
|---------|---------------|------------|
| `main` | Production | 2 reviewers + tests E2E |
| `staging` | Staging | 1 reviewer + tests intégration |
| `develop` | Dev | CI automatique |
| `feature/*` | Local | Lint + tests unitaires |

## Procédures de Rollback

### Rollback Automatique

```yaml
Triggers:
  - Erreur taux > 5% sur 5 minutes
  - Latence p95 > 500ms
  - Validation métier échouée

Actions:
  1. Alerte immédiate (Slack, PagerDuty)
  2. Rollback automatique vers version N-1
  3. Notification équipe
  4. Post-mortem obligatoire
```

### Rollback Manuel

```bash
# Lister les versions disponibles
kg version list --last 30

# Rollback vers version spécifique
kg rollback --version 2.8.5 --reason "Bug critique X"

# Vérification post-rollback
kg health check --verbose
```

### Rétention des Versions

| Type | Rétention | Stockage |
|------|-----------|----------|
| Production | 30 dernières versions | Hot storage |
| Staging | 10 dernières versions | Warm storage |
| Archive | 1 an | Cold storage (S3 Glacier) |

## Audit et Traçabilité

### Données Auditées

```yaml
Chaque opération enregistre:
  - timestamp: ISO 8601
  - actor: ID utilisateur/agent/pipeline
  - action: CREATE | UPDATE | DELETE | READ
  - target: Node/Edge ID
  - before_state: Snapshot avant modification
  - after_state: Snapshot après modification
  - source: Origine de la donnée
  - validation: Reviewers + approval status
  - correlation_id: Pour traçabilité cross-service
```

### Table d'Audit (Supabase)

```sql
CREATE TABLE kg_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Actor
  actor_type TEXT NOT NULL, -- 'user' | 'agent' | 'pipeline' | 'system'
  actor_id TEXT NOT NULL,
  actor_ip TEXT,

  -- Action
  action TEXT NOT NULL, -- 'CREATE' | 'UPDATE' | 'DELETE' | 'READ' | 'ROLLBACK'
  target_type TEXT NOT NULL, -- 'node' | 'edge' | 'schema' | 'permission'
  target_id TEXT NOT NULL,

  -- State
  before_state JSONB,
  after_state JSONB,

  -- Metadata
  source TEXT, -- 'manual' | 'ci_pipeline' | 'agent_sync' | 'import'
  correlation_id UUID,
  validation_status TEXT, -- 'pending' | 'approved' | 'rejected'
  reviewers TEXT[],

  -- Indexes
  CONSTRAINT valid_action CHECK (action IN ('CREATE', 'UPDATE', 'DELETE', 'READ', 'ROLLBACK'))
);

-- Indexes pour requêtes fréquentes
CREATE INDEX idx_kg_audit_actor ON kg_audit_log(actor_id, created_at DESC);
CREATE INDEX idx_kg_audit_target ON kg_audit_log(target_id, created_at DESC);
CREATE INDEX idx_kg_audit_action ON kg_audit_log(action, created_at DESC);

-- Rétention automatique (90 jours online, puis archive)
-- Voir politique de rétention
```

### Traçabilité des Sources

```yaml
Sources_autorisées:
  - type: manual
    validation: Obligatoire par expert métier
    confiance: 95%

  - type: import_constructeur
    validation: Automatique + spot check 5%
    confiance: 90%

  - type: agent_enrichissement
    validation: Review si confiance < 80%
    confiance: Variable (score agent)

  - type: feedback_utilisateur
    validation: Obligatoire
    confiance: 70% (à confirmer)

Chaque_node_doit_avoir:
  - source_type: Origine de la donnée
  - source_id: Référence spécifique
  - confidence_score: 0-100
  - last_validated_at: Date dernière validation
  - validated_by: Qui a validé
```

## Sécurité

### Chiffrement

| Donnée | Au repos | En transit |
|--------|----------|------------|
| Nodes/Edges | AES-256 | TLS 1.3 |
| Audit logs | AES-256 | TLS 1.3 |
| Backups | AES-256 + envelope encryption | TLS 1.3 |
| PII | **INTERDIT dans KG** | N/A |

### Gestion des PII

```yaml
Règle_absolue: JAMAIS de PII dans le Knowledge Graph

Données_interdites:
  - Noms clients
  - Emails
  - Téléphones
  - Adresses
  - Données bancaires
  - Plaques d'immatriculation

Solution:
  - Stocker uniquement des UUID références
  - Lier via FK vers tables sécurisées
  - Accès PII via service dédié avec audit
```

### Backup et Disaster Recovery

```yaml
Backup:
  fréquence: Quotidien à 3h00 UTC
  type: Incrémental + Full hebdomadaire
  rétention: 90 jours online, 1 an archive
  stockage: S3 multi-région (eu-west-1 + eu-central-1)
  chiffrement: AES-256 avec rotation clés mensuelle

Recovery:
  RTO: < 1 heure (Recovery Time Objective)
  RPO: < 15 minutes (Recovery Point Objective)
  test: Trimestriel avec rapport

Procédure_DR:
  1. Détection incident (monitoring)
  2. Évaluation impact (CTO)
  3. Décision recovery (CEO si > 30min)
  4. Exécution restore
  5. Validation intégrité
  6. Post-mortem
```

## Intégration CI/CD Gates

### Gates Bloquantes

| Gate | Trigger | Action si échec |
|------|---------|-----------------|
| Schema Validation | Tout PR | PR bloquée |
| Integrity Check | Avant merge | Merge bloqué |
| Source Validation | Nouvelles données | Commit bloqué |
| PII Scan | Tout commit | Commit bloqué + alerte CISO |
| Rollback Test | Release | Deploy bloqué |

### Pipeline de Validation

```yaml
# .github/workflows/kg-validation.yml

name: Knowledge Graph Validation
on:
  pull_request:
    paths:
      - 'data/knowledge-graph/**'
      - 'backend/src/modules/knowledge-graph/**'

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - name: Schema Validation
        run: npm run kg:validate:schema

      - name: Integrity Check
        run: npm run kg:validate:integrity

      - name: Source Validation
        run: npm run kg:validate:sources

      - name: PII Scan
        run: npm run kg:scan:pii

      - name: Rollback Test
        run: npm run kg:test:rollback

      - name: Generate Diff Report
        run: npm run kg:diff:report

      - name: Post PR Comment
        uses: actions/github-script@v6
        with:
          script: |
            // Post validation report as PR comment
```

## KPIs de Gouvernance

| KPI | Cible | Alerte | Critique |
|-----|-------|--------|----------|
| `kg-integrity-score` | 100% | < 99.5% | < 99% |
| `kg-source-coverage` | 100% | < 95% | < 90% |
| `kg-rollback-success-rate` | 100% | < 99% | < 95% |
| `kg-audit-coverage` | 100% | < 100% | N/A |
| `kg-pii-incidents` | 0 | > 0 | > 0 |
| `kg-recovery-time` | < 1h | > 1h | > 4h |
| `kg-version-drift` | 0 | > 1 version | > 3 versions |

## Rôles et Responsabilités

| Rôle | Responsabilités | Escalation |
|------|-----------------|------------|
| **KG Owner** (Lead Architect) | Schéma, évolutions majeures, arbitrages | CTO |
| **KG Maintainers** (2-3 devs) | Reviews PR, validations, incidents N1 | KG Owner |
| **Security Officer** | Audit, PII, compliance | CISO |
| **Data Stewards** (métier) | Qualité données, validation sources | KG Owner |

## Procédures d'Urgence

### Incident Niveau 1 (Mineur)

```
Symptôme: Données incorrectes isolées
Impact: < 100 nodes affectés
Action: Fix via PR standard
SLA: 24h
```

### Incident Niveau 2 (Majeur)

```
Symptôme: Corruption partielle, latence dégradée
Impact: 100-1000 nodes ou latence > 500ms
Action: Rollback partiel + investigation
SLA: 4h
Notification: KG Owner + CTO
```

### Incident Niveau 3 (Critique)

```
Symptôme: KG indisponible, corruption massive
Impact: > 1000 nodes ou downtime
Action: Rollback complet + DR si nécessaire
SLA: 1h
Notification: CTO + CEO + CISO
Post-mortem: Obligatoire sous 48h
```

## Changelog

- **2026-01-01 v1.0.0** : Version initiale - Règles de gouvernance complètes

## Related Documents

- [Knowledge Graph v2.8](./knowledge-graph-v2.8.md) - Spécification technique
- [AI-COS Operating System](./ai-cos-operating-system.md) - Système global
- [AI-COS Index](../workflows/ai-cos-index.md) - Navigation
