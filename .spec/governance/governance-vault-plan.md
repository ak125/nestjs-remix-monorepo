# Proposition: Structure Obsidian pour Gouvernance Technique

**Contexte**: Monorepo NestJS/Remix (AutoMecanik), 40 modules, 198 routes, 4M+ produits
**Objectif**: Vault Obsidian dédié audit, incidents, ADR, règles IA
**Mode**: Lecture passive, repo Git séparé, IA non-autonome
**Date**: 2026-02-02
**Statut**: Approuvé

---

## 1. Résumé Exécutif

Votre projet dispose déjà d'une gouvernance mature (`.spec/00-canon/`, 11 règles R1-R11, ADR system, truth levels L1-L4). La lacune principale est l'**absence de traçabilité centralisée des incidents** et l'**absence d'audit trail persistant** des décisions opérationnelles.

**Proposition**: Créer un vault Obsidian séparé du monorepo qui sert de:
- **Journal immutable** des incidents (post-mortems)
- **Registre de décisions** (ADR miroir + décisions opérationnelles quotidiennes)
- **Audit trail** des déploiements et changements critiques
- **Base de règles** versionnée avec liens bidirectionnels
- **Tableau de bord** de conformité (statique, régénéré manuellement ou par script)

---

## 2. Structure Obsidian Proposée

```
governance-vault/
├── 00-index/
│   ├── MOC-Governance.md           # Master Index (Map of Content)
│   ├── MOC-Incidents.md            # Index incidents par date/sévérité
│   ├── MOC-Decisions.md            # Index ADR + décisions opérationnelles
│   ├── MOC-Rules.md                # Index règles (R1-R11, IA1-16, etc.)
│   └── MOC-Orphans.md              # Documents non liés (à traiter)
│
├── 01-incidents/
│   ├── YYYY/
│   │   ├── YYYY-MM-DD_severity_slug.md
│   │   └── ...
│   └── _templates/
│       └── incident-template.md
│
├── 02-decisions/
│   ├── adr/
│   │   ├── ADR-001_supabase-direct-sdk.md
│   │   ├── ADR-002_monorepo-structure.md
│   │   └── ...
│   ├── operational/
│   │   ├── YYYY-MM-DD_decision-slug.md
│   │   └── ...
│   └── _templates/
│       ├── adr-template.md
│       └── operational-decision-template.md
│
├── 03-rules/
│   ├── technical/
│   │   ├── R1_three-tier-architecture.md
│   │   ├── R2_supabase-direct-sdk.md
│   │   └── ... (R1-R7)
│   ├── governance/
│   │   ├── R8_canon-only-policy.md
│   │   └── ... (R8-R11)
│   ├── ai-cos/
│   │   ├── golden-rules/
│   │   │   ├── GR1_no-indicator-suppression.md
│   │   │   └── ... (GR1-GR10)
│   │   ├── ia-rules/
│   │   │   ├── IA1_anti-hallucination.md
│   │   │   └── ... (IA1-IA16)
│   │   └── agent-types.md
│   └── _templates/
│       └── rule-template.md
│
├── 04-audit-trail/
│   ├── deployments/
│   │   ├── YYYY-MM/
│   │   │   ├── YYYY-MM-DD_HHmm_deploy.md
│   │   │   └── ...
│   ├── security/
│   │   ├── access-reviews/
│   │   └── vulnerability-scans/
│   ├── performance/
│   │   ├── lighthouse-reports/
│   │   └── cwv-degradations/
│   └── _templates/
│       ├── deployment-template.md
│       └── security-review-template.md
│
├── 05-compliance/
│   ├── checklists/
│   │   ├── pre-deploy-checklist.md
│   │   ├── post-incident-checklist.md
│   │   └── quarterly-review-checklist.md
│   ├── matrices/
│   │   ├── validation-matrix.md      # Qui valide quoi (QTO, CTO, CEO)
│   │   └── escalation-matrix.md      # Chaîne d'escalade par sévérité
│   └── reports/
│       ├── YYYY-QN_compliance-report.md
│       └── ...
│
├── 06-knowledge/
│   ├── glossary.md                   # Termes techniques du domaine
│   ├── architecture-overview.md      # Miroir simplifié de repo-map.md
│   ├── module-registry.md            # 40 modules avec statut (PROD/DEV)
│   └── deprecated-ledger.md          # Documents archivés
│
├── 99-meta/
│   ├── vault-changelog.md            # Historique des changements du vault
│   ├── sync-log.md                   # Log de synchronisation avec repo
│   ├── ownership.md                  # Responsables par section
│   └── SIGNING.md                    # Politique de signature commits
│
└── _assets/
    ├── diagrams/
    └── screenshots/
```

---

## 3. Rôles de Chaque Dossier

| Dossier | Rôle | Fréquence MAJ | Automatisable |
|---------|------|---------------|---------------|
| `00-index/` | Navigation centrale (MOC) | Hebdo | Oui (script liens) |
| `01-incidents/` | Traçabilité post-mortems | Ad-hoc (incident) | Partiellement (création fichier) |
| `02-decisions/` | Registre ADR + décisions opérationnelles | Mensuel/Ad-hoc | Non (humain) |
| `03-rules/` | Base de règles immuables | Trimestriel | Non (humain) |
| `04-audit-trail/` | Preuves déploiements/sécurité | Quotidien | Oui (CI/CD export) |
| `05-compliance/` | Checklists et rapports conformité | Trimestriel | Partiellement |
| `06-knowledge/` | Documentation de référence | Mensuel | Non (humain) |
| `99-meta/` | Gouvernance du vault lui-même | Ad-hoc | Non |

---

## 4. Templates Cœur (4 obligatoires)

### 4.1 Incident (Post-Mortem)

```markdown
---
id: INC-YYYY-NNN
date: YYYY-MM-DD
severity: critical|high|medium|low
status: open|investigating|resolved|closed
impact_duration: "15 minutes"
affected_systems: [backend, frontend, payments]
root_cause: ""
related_rules: [[R6_manual-validation]]
related_adr: [[ADR-001]]
owner: "@username"
---

# Incident: [Titre Court]

## Timeline
| Heure | Événement |
|-------|-----------|
| 14:32 | Détection alerte Cloudflare 521 |
| 14:35 | Investigation démarrée |
| 14:47 | Root cause identifiée |

## Impact
- Utilisateurs affectés: X
- Transactions perdues: Y
- Réputation: [description]

## Root Cause
[Description technique détaillée]

## Résolution
[Commandes exécutées, rollback, etc.]

## Lessons Learned
1. [Leçon 1]
2. [Leçon 2]

## Actions Correctives
- [ ] [[Action 1]]
- [ ] [[Action 2]]

## Preuves
- Log: `[lien vers log]`
- Commit: `[sha]`
```

### 4.2 ADR (Architecture Decision Record)

```markdown
---
id: ADR-NNN
title: ""
status: proposed|accepted|rejected|deprecated|superseded
date: YYYY-MM-DD
decision_makers: ["@cto", "@lead"]
supersedes: []
superseded_by: []
related_rules: []
related_incidents: []
---

# ADR-NNN: [Titre]

## Contexte
[Pourquoi cette décision est nécessaire]

## Décision
[Ce qui a été décidé]

## Options Considérées
1. **Option A**: [description]
   - Avantages: ...
   - Inconvénients: ...
2. **Option B**: ...

## Conséquences
### Positives
- ...

### Négatives
- ...

## Critères de Succès
- [ ] Métrique 1
- [ ] Métrique 2

## Revue Planifiée
Date: YYYY-MM-DD
```

### 4.3 Règle

```markdown
---
id: R[N]
title: ""
category: technical|governance|ai-cos
enforcement: hard_block|soft_warn
status: active|deprecated
version: 1.0.0
created: YYYY-MM-DD
updated: YYYY-MM-DD
owner: "@role"
related_adr: []
---

# R[N]: [Titre]

## Énoncé
[Formulation précise de la règle]

## Justification
[Pourquoi cette règle existe]

## Exemples
### Correct
```code
...
```

### Incorrect
```code
...
```

## Exceptions
[Cas où la règle peut être contournée, avec validation requise]

## Vérification
- Automatique: [oui/non, outil]
- Manuelle: [checklist]

## Violations Connues
- [[INC-2026-001]] - Violation R6
```

### 4.4 Deployment Log

```markdown
---
id: DEPLOY-YYYY-MM-DD-HHmm
date: YYYY-MM-DD HH:mm
environment: preprod|production
commit: sha256
image_tag: ""
deployer: "@username"
status: success|failed|rollback
pre_checks_passed: true|false
post_checks_passed: true|false
---

# Déploiement: [commit message court]

## Pre-Deploy Checklist
- [x] Import firewall passé
- [x] Core-build validé
- [x] TypeScript OK
- [ ] Tests manuels

## Changements Inclus
- feat: [description]
- fix: [description]

## Métriques Post-Deploy
| Métrique | Avant | Après | Delta |
|----------|-------|-------|-------|
| LCP | 2100ms | 2050ms | -50ms |
| Error rate | 0.01% | 0.01% | 0 |

## Incidents Liés
- Aucun
```

---

## 5. Flux: Incident → Décision → Règle

```
┌─────────────┐
│  INCIDENT   │  Detection (alertes, logs, user report)
│  détecté    │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ Post-Mortem │  Création 01-incidents/YYYY/YYYY-MM-DD_*.md
│  rédigé     │  → Lien vers règles violées
└──────┬──────┘
       │
       ▼
┌─────────────────────┐
│ Lessons Learned     │  Analyse: Règle manquante? ADR obsolète?
│ analysées           │
└──────┬──────────────┘
       │
       ├──────────────────────────────┐
       │                              │
       ▼                              ▼
┌─────────────┐               ┌─────────────┐
│ Nouvelle    │               │ Mise à jour │
│ RÈGLE       │               │ ADR existant│
│ proposée    │               │ ou nouveau  │
└──────┬──────┘               └──────┬──────┘
       │                              │
       ▼                              ▼
┌─────────────┐               ┌─────────────┐
│ Validation  │               │ Validation  │
│ CTO/CEO     │               │ équipe      │
└──────┬──────┘               └──────┬──────┘
       │                              │
       ▼                              ▼
┌─────────────┐               ┌─────────────┐
│ Règle       │               │ ADR         │
│ 03-rules/   │               │ 02-decisions│
│ activée     │               │ /adr/       │
└──────┬──────┘               └──────┬──────┘
       │                              │
       └──────────────┬───────────────┘
                      │
                      ▼
              ┌───────────────┐
              │ MOC mis à jour│
              │ Liens croisés │
              └───────────────┘
```

---

## 6. Règles Vault

### R-Vault-01: Canon Fait Foi

> **R-Vault-01**: Le canon architectural reste **exclusivement** dans le monorepo (`.spec/00-canon/`).
> Le vault Obsidian est un **miroir enrichi opérationnel**, non normatif.
> En cas de conflit, `.spec/00-canon/` fait foi.

**Implications:**
- Ne jamais modifier une règle R1-R11 dans le vault sans l'avoir d'abord modifiée dans le canon
- Le vault peut ajouter des liens, tags, commentaires, mais pas changer le fond
- Script de sync = one-way (canon → vault), jamais l'inverse

### R-Vault-02: Zéro Orphelin

> **R-Vault-02**: Aucun document ne peut être orphelin.
> Tout document doit être lié depuis **au moins 1 MOC**.

**Règle d'or:**
- Nouveau document = lien dans MOC approprié **avant** commit
- Document orphelin > 7 jours = revue obligatoire (archiver ou lier)
- `MOC-Orphans.md` = file d'attente, pas une destination finale

---

## 7. Automatisation

### 7.1 À Automatiser (Scripts CI/CD)

| Action | Déclencheur | Output | Priorité |
|--------|-------------|--------|----------|
| Export log déploiement | Post-deploy CI | `04-audit-trail/deployments/` | Haute |
| Export rapport Lighthouse | Perf-gates.yml | `04-audit-trail/performance/` | Moyenne |
| Génération MOC-Incidents | Cron hebdo | `00-index/MOC-Incidents.md` | Moyenne |
| Détection liens cassés | Cron quotidien | `99-meta/broken-links.md` | Basse |
| Détection orphelins | Cron hebdo | `00-index/MOC-Orphans.md` | Moyenne |

### 7.2 À NE PAS Automatiser (Humain Obligatoire)

| Action | Raison |
|--------|--------|
| Rédaction post-mortem | Analyse causale nécessite jugement |
| Validation ADR | Décision architecturale = responsabilité humaine |
| Création/modification règle | Impact sur tout le système |
| Revue trimestrielle compliance | Audit = signature humaine |
| Dépréciation de document | Risque de perte de contexte |

### 7.3 Script de Synchronisation Canon → Vault

```yaml
# sync-config.yaml
conflict_policy: "manual"  # DÉFAUT: intervention humaine requise

policies:
  default: "manual"           # Crée .conflict + alerte
  rules:
    pattern: "03-rules/**"
    policy: "canon_wins"      # Règles = canon fait foi (R-Vault-01)
  decisions:
    pattern: "02-decisions/**"
    policy: "manual"          # ADR = toujours vérifier
  knowledge:
    pattern: "06-knowledge/**"
    policy: "canon_wins"      # Architecture = canon fait foi

# INTERDIT: Suppression silencieuse
# Toujours: log + marquage deprecated au lieu de suppression
```

---

## 8. Sécurité: Signature des Commits

Pour transformer le vault en **ledger quasi-légal**:

```bash
# Configuration Git signing (SSH recommandé)
git config --local commit.gpgsign true
git config --local gpg.format ssh
git config --local user.signingkey ~/.ssh/id_ed25519.pub
```

Tous les commits du vault doivent être signés. Tout commit non signé est considéré suspect.

---

## 9. Décisions Confirmées

| Question | Choix |
|----------|-------|
| Localisation vault | **Repo Git séparé** (isolation complète) |
| Granularité incidents | **Un fichier par incident** (traçabilité maximale) |
| Synchronisation canon | **Script automatique** (détection changements) |
| Langue | **Français** (cohérent avec équipe) |
| Format dates | ISO `YYYY-MM-DD` (tri alphabétique = tri chronologique) |

---

## 10. Prochaines Étapes

### Phase 1: Setup Initial (Jour 1-2)
1. [ ] Créer repo Git `governance-vault` (GitHub/GitLab privé)
2. [ ] Activer commit signing
3. [ ] Créer structure dossiers vide
4. [ ] Importer les 4 templates cœur
5. [ ] Créer MOC initiaux

### Phase 2: Migration Pilote (Jour 3-5)
6. [ ] Documenter incident 2026-01-11 (référence)
7. [ ] Migrer R5, R6, R7 (règles critiques)
8. [ ] Migrer ADR-001 à ADR-003
9. [ ] Créer `module-registry.md`

### Phase 3: Automatisation (Jour 6-10)
10. [ ] Écrire `sync-canon.sh`
11. [ ] Écrire `check-orphans.sh`
12. [ ] Configurer cron quotidien
13. [ ] Écrire script export déploiement CI

### Phase 4: Validation (Jour 11-14)
14. [ ] Simuler workflow: incident → post-mortem → règle
15. [ ] Revue avec équipe
16. [ ] Documenter ownership

### Phase 5: Production (Jour 15+)
17. [ ] Activer sync en production
18. [ ] Premier rapport compliance
19. [ ] Planifier revue trimestrielle

---

## 11. Checklist de Validation Humaine

### Par Incident
- [ ] Post-mortem rédigé dans les 48h
- [ ] Root cause identifiée (pas de "cause inconnue")
- [ ] Liens vers règles violées ajoutés
- [ ] Actions correctives avec owners et deadlines
- [ ] MOC-Incidents mis à jour

### Par ADR
- [ ] Contexte clair et factuel
- [ ] Options alternatives documentées
- [ ] Décision justifiée
- [ ] Conséquences positives ET négatives listées
- [ ] Date de revue planifiée

### Trimestrielle (Compliance)
- [ ] Tous les incidents des 90 jours revus
- [ ] Actions correctives vérifiées (clôturées?)
- [ ] Règles toujours pertinentes?
- [ ] ADR à revoir identifiés
- [ ] Rapport compliance généré et signé
