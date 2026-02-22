---
name: marketing-hub
description: "Marketing Hub: plan hebdo, copywriting multi-canal, brand gates, export manifests."
argument-hint: "[plan|copy|gate|export|digest]"
allowed-tools: Read, Grep, Glob, Bash, mcp__supabase__execute_sql
version: "1.0"
---

# Marketing Hub Skill — v1.0

Skill operationnel pour le Marketing Hub social AutoMecanik. Gere la planification hebdomadaire, la generation de copy multi-canal, les brand/compliance gates, et l'export de manifests de publication.

---

## Architecture

```
┌──────────────────────┐     generate     ┌──────────────────────────┐
│  WeeklyPlanGenerator │ ──────────────→  │  MultiChannelCopywriter  │
│  (scripts/CLI)       │                  │  (AiContentService)      │
│  - anti-duplication  │                  │  - IG / FB / YT          │
│  - priority gammes   │                  │  - composable templates  │
│  - 4 piliers/semaine │                  │  - UTM builder           │
└──────────────────────┘                  └────────────┬─────────────┘
                                                       │ evaluate
                                                       ▼
┌──────────────────────┐     approve      ┌──────────────────────────┐
│  PublishQueue        │ ←─────────────── │  BrandComplianceGate     │
│  - approve / reject  │                  │  - Gate A: Brand Voice   │
│  - export manifest   │                  │  - Gate B: Compliance    │
│  - mark published    │                  │  - PASS / WARN / FAIL    │
└──────────────────────┘                  └──────────────────────────┘
```

---

## Sous-commandes

| Commande | Description | Prerequis |
|----------|-------------|-----------|
| `plan` | Generer le plan hebdomadaire pour une semaine ISO | Aucun |
| `copy` | Generer le copy multi-canal pour les slots du plan | Plan genere pour la semaine |
| `gate` | Executer brand + compliance gates sur les posts generes | Posts en status `generated` |
| `export` | Exporter le manifest JSON par canal | Posts en status `approved` |
| `digest` | Afficher un resume des metriques de la semaine | Posts existants |

---

## Workflows

### `/marketing-hub plan`

1. Verifier la semaine ISO (format `YYYY-WNN`)
2. Lancer la requete SQL pour verifier si un plan existe deja :
   ```sql
   SELECT id, status, priority_gammes FROM __marketing_weekly_plans WHERE week_iso = '{week}';
   ```
3. Si plan existe et status != 'draft' → afficher warning
4. Si pas de plan → lancer le script :
   ```bash
   cd /opt/automecanik/app && npx ts-node scripts/marketing/generate-weekly-plan.ts --week {week}
   ```
5. Afficher les slots generes (jour, pilier, topic, canaux)

### `/marketing-hub copy`

1. Verifier qu'un plan existe pour la semaine
2. Lancer le script de generation :
   ```bash
   cd /opt/automecanik/app && npx ts-node scripts/marketing/generate-copy-batch.ts --week {week}
   ```
3. En dry-run d'abord si premiere execution :
   ```bash
   npx ts-node scripts/marketing/generate-copy-batch.ts --week {week} --dry-run
   ```
4. Afficher le resume (generated / errors / gates)

### `/marketing-hub gate`

1. Lister les posts de la semaine en status `generated` :
   ```sql
   SELECT id, slot_label, primary_channel, status
   FROM __marketing_social_posts
   WHERE week_iso = '{week}' AND status = 'generated'
   ORDER BY day_of_week;
   ```
2. Pour chaque post, afficher le resume des gates :
   ```sql
   SELECT id, gate_brand_level, gate_compliance_level, quality_score, gate_blocking_issues
   FROM __marketing_social_posts
   WHERE week_iso = '{week}' AND status IN ('gate_passed', 'gate_failed')
   ORDER BY day_of_week;
   ```
3. Mettre en evidence les posts avec `gate_failed` ou blocking issues

### `/marketing-hub export`

1. Verifier les posts approuves :
   ```sql
   SELECT id, day_of_week, primary_channel, status
   FROM __marketing_social_posts
   WHERE week_iso = '{week}' AND status = 'approved'
   ORDER BY day_of_week;
   ```
2. Lancer le script d'export :
   ```bash
   npx ts-node scripts/marketing/export-publish-queue.ts --week {week} --channel {channel}
   ```
3. Le fichier JSON sera ecrit dans le repertoire courant

### `/marketing-hub digest`

1. Afficher les metriques de la semaine :
   ```sql
   SELECT
     status,
     COUNT(*) as count,
     ROUND(AVG(quality_score), 1) as avg_score
   FROM __marketing_social_posts
   WHERE week_iso = '{week}'
   GROUP BY status
   ORDER BY status;
   ```
2. Afficher les posts avec le meilleur et le pire score qualite
3. Afficher le taux de passage des gates (gate_passed / total)

---

## Key Files

### Backend (services)
- `backend/src/modules/marketing/services/weekly-plan-generator.service.ts`
- `backend/src/modules/marketing/services/multi-channel-copywriter.service.ts`
- `backend/src/modules/marketing/services/brand-compliance-gate.service.ts`
- `backend/src/modules/marketing/services/publish-queue.service.ts`
- `backend/src/modules/marketing/services/marketing-hub-data.service.ts`
- `backend/src/modules/marketing/services/utm-builder.service.ts`
- `backend/src/modules/marketing/controllers/marketing-social-posts.controller.ts`
- `backend/src/modules/marketing/marketing.module.ts`

### Templates & Interfaces
- `backend/src/modules/marketing/interfaces/marketing-hub.interfaces.ts`
- `backend/src/modules/marketing/templates/social-post-templates.ts`
- `backend/src/modules/marketing/templates/brand-rules-seed.ts`

### Frontend
- `frontend/app/routes/admin.marketing.tsx` (layout avec onglet Social Hub)
- `frontend/app/routes/admin.marketing.social-hub.posts.tsx` (page admin)

### Scripts CLI
- `scripts/marketing/generate-weekly-plan.ts`
- `scripts/marketing/generate-copy-batch.ts`
- `scripts/marketing/export-publish-queue.ts`

### DB Tables (12)
- `__marketing_social_posts` — Posts sociaux par semaine/jour
- `__marketing_weekly_plans` — Plans hebdomadaires
- `__marketing_brand_rules` — Regles brand & compliance
- `__marketing_utm_registry` — Registre UTM
- `__marketing_analytics_digests` — Digests analytiques (V2)
- `__marketing_content_library` — Bibliotheque assets (V2)
- + 6 tables pre-existantes (`__marketing_*`)

---

## Anti-Patterns (BLOCK)

- **JAMAIS** bypass les gates : un post ne peut passer `approved` sans `gate_passed`
- **JAMAIS** publier sans gate : le status `published` requiert `approved` prealable
- **JAMAIS** modifier `__marketing_brand_rules` sans validation utilisateur
- **JAMAIS** generer du copy sans plan : le plan definit les slots et les briefs
- **JAMAIS** hardcoder des prix ou delais : source DB + timestamp < 24h obligatoire
- **JAMAIS** mentionner de concurrents dans le copy (gate bloquante)

---

## Interactions avec autres skills

| Skill | Relation | Detail |
|-------|----------|--------|
| `seo-content-architect` | Source → Hub | Le contenu SEO enrichi alimente les briefs de posts sociaux |
| `rag-ops` | Source → Hub | Le corpus RAG fournit les facts/evidence pour les posts |
| `content-audit` | Qualite | Peut auditer la qualite des posts generes |
| `backend-test` | Validation | Teste les endpoints API du controller social |
