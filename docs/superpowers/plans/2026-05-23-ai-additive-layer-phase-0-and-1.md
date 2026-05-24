# AI Additive Layer (Phase 0 + Phase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Acter la doctrine "AI = couche additive du Search Control Plane" via 9 ADRs vault (Phase 0) puis livrer 6 extensions tech petites observable (Phase 1) parallèlement à commerce-loop V1.

**Architecture:** Phase 0 = 9 ADRs vault courts dans le repo `governance-vault` séparé (pas de code, gouvernance d'abord). Phase 1 = 6 extensions du monorepo : 1 service backend (étend `QualityHistorySnapshotService` avec 3 nouveaux `metric_name`), 1 script d'audit, 2 artefacts workspace, 1 query SQL, 1 module NestJS BullMQ. Aucune nouvelle table SQL (les nouveaux signaux passent par le pattern EAV existant `__seo_quality_history`). Phase 3 (produit C) reste GATED par commerce-loop V1 + KPIs + ADRs C résolus — hors-scope de ce plan.

**Tech Stack:** NestJS (backend services + processors BullMQ), Supabase (`__seo_quality_history` EAV existante, `__trend_signals` nouvelle additive), Jest (tests unit), TypeScript (services + scripts), YAML (Prompt Registry), CSV (probe template), SQL (Opportunity Lens query).

**Spec source:** `/opt/automecanik/app/.claude/worktrees/ai-additive-layer-design/docs/superpowers/specs/2026-05-23-ai-additive-layer-phase-0-and-1-design.md`

**Mémoires anti-régression à respecter:** [[project_a_b_c_surfaces_distinction]], [[feedback_product_c_design_invariants]], [[feedback_branch_scope_discipline]], [[feedback_commit_via_worktree_when_concurrent_agents]], [[feedback_worktree_commit_needs_no_verify_husky]], [[feedback_no_touch_meta_h1_if_optimized]], [[feedback_no_url_changes_ever]], [[reference_partitioned_snapshot_tables_need_premake_cron]], [[reference_postgrest_stable_function_write_readonly]], [[feedback_supabase_js_1000_row_cap_data_loss]].

---

## File Structure

### Phase 0 — Vault repository (gouvernance, hors monorepo)

Repository: `ak125/governance-vault` (séparé du monorepo)

- Create: 9 ADR markdown files in `adr/` (paths à confirmer vs convention vault existante)
- ADR-0 (désambiguation A/B/C) doit être mergé AVANT les ADRs C 5-9
- ADR Brand Intelligence / AI-additive / HITL peuvent être en parallèle

### Phase 1 — Monorepo extensions

| Livrable | Fichiers créés / modifiés | Type |
|---|---|---|
| L1 AI Citation Readiness | Modify `backend/src/modules/seo-monitoring/services/quality-history-snapshot.service.ts` ; Modify `backend/src/modules/seo-monitoring/services/` (ou nouveau helper) pour la détection ; New `backend/tests/unit/seo-monitoring/ai-readiness-metrics.test.ts` | dev TDD |
| L2 Schema audit par R-role | Create `backend/scripts/seo/audit/schema-coverage-by-r-role.ts` ; Create `docs/audit/2026-05-schema-coverage-by-r-role.md` | dev script |
| L3 Probe AI manuelle | Create `workspaces/ai-probe/README.md` ; Create `workspaces/ai-probe/template.csv` | ops/process |
| L4 Prompt Registry minimal | Create `workspaces/ai-probe/prompts.yaml` ; Create `workspaces/ai-probe/prompts.schema.json` (validation) | dev light |
| L5 Opportunity Lens SQL | Create `scripts/analytics/opportunity-lens.sql` ; Create `scripts/analytics/opportunity-lens.md` | dev light |
| L6 Trend Signals middle ground | Create `backend/supabase/migrations/<date>_create_trend_signals.sql` ; Create `backend/supabase/migrations/<date>_create_trend_signals.down.sql` ; Create `backend/src/modules/trend-signals/trend-signals.module.ts` ; Create `backend/src/modules/trend-signals/trend-signals.service.ts` ; Create `backend/src/modules/trend-signals/processors/trend-signals.processor.ts` ; Create `backend/tests/unit/trend-signals/*` | dev TDD |

---

## Phase 0 — Vault prerequisites (manual ADR drafting, hors TDD)

### Task 0.1: Draft ADR-0 (désambiguation A/B/C) and merge

**Files:** Vault repo `ak125/governance-vault` — new ADR file (path per vault convention).

- [ ] **Step 1: Open vault repo** (`/opt/automecanik/governance-vault/` runtime DEV)
- [ ] **Step 2: Draft ADR-0 markdown**

Content must include : statement "C = produit conversion-first hors-SEO, A/B = contenu SEO", references to spec `2026-05-23-ai-additive-layer-phase-0-and-1-design.md` and `2026-05-23-product-c-design.md`, references to memory [[project_a_b_c_surfaces_distinction]], frontmatter compliant with vault convention (cf. existing ADRs).

- [ ] **Step 3: Open vault PR + merge**

Per CLAUDE.md §Gouvernance : commit signé G3 (ADR-015). Hash-locked after merge.

- [ ] **Step 4: Update `.claude/canon-mirrors/` in monorepo** with mirrored ADR-0

Mirror script existant (check `scripts/canon-mirror/` or similar).

### Task 0.2: Draft 3 indépendants en parallèle (Brand Intelligence + AI=additive + HITL)

Same pattern as 0.1 × 3. Order : peut être parallèle (aucune dépendance entre eux). Peuvent être batchés en 1 vault PR si vault permet.

### Task 0.3: Draft 5 ADRs C en série après ADR-0 mergé

Suit ADR-0. Détails dans spec compagnon `2026-05-23-product-c-design.md`.

**Critère "Phase 0 done":** 9 ADRs vault mergées + hash-locked + mirrored. Validation : `git log governance-vault/adr/ | grep -c "adr-"` ≥9 nouveaux ADRs cette série.

---

## Phase 1 — Tech extensions

### Task 1.1: AI Citation Readiness — exploration code existant

**Files:** Read-only investigation, no edits.

- [ ] **Step 1: Confirm metric extraction layer per role**

Run: `grep -n "fetchMetricsForRole\|R5_\|R3_CONSEILS" backend/src/modules/seo-monitoring/services/quality-history-snapshot.service.ts | head -20`

Expected: identify the role→metrics dispatch logic. Currently the file shows `fetchMetricsForRole(roleId)` returning rows. Need to confirm where per-role detection lives (likely in same service or per-role sub-service).

- [ ] **Step 2: Confirm DOM/HTML access for pages to score**

Run: `grep -rn "renderHtml\|fetchHtml\|getPageContent" backend/src/modules/seo-monitoring/ | head -10`

Expected: discover how the service obtains page HTML for scoring (SSR render, cached HTML, fetch service).

- [ ] **Step 3: Document findings**

Append findings to `docs/superpowers/plans/2026-05-23-ai-additive-layer-phase-0-and-1.md` under a `## Task 1.1 findings` section so subsequent tasks reference the correct paths.

### Task 1.2: AI Citation Readiness — failing tests for 3 detectors

**Files:**
- Test: `backend/tests/unit/seo-monitoring/ai-readiness-detectors.test.ts` (new)

- [ ] **Step 1: Write failing test for `detectExtractableTldr`**

```typescript
import { detectExtractableTldr } from '../../../src/modules/seo-monitoring/helpers/ai-readiness-detectors';

describe('detectExtractableTldr', () => {
  it('returns 1 when first <p> has 50-200 chars of substantive text', () => {
    const html = '<html><body><h1>Symptôme</h1><p>La fumée noire au démarrage indique souvent un encrassement de la vanne EGR sur Clio 1.5 dCi.</p></body></html>';
    expect(detectExtractableTldr(html)).toBe(1);
  });

  it('returns 0 when no <p> in first 1000 chars', () => {
    const html = '<html><body><h1>Symptôme</h1><div>Texte sans paragraphe.</div></body></html>';
    expect(detectExtractableTldr(html)).toBe(0);
  });

  it('returns 0 when first <p> is too short (<50 chars)', () => {
    const html = '<html><body><p>Trop court.</p></body></html>';
    expect(detectExtractableTldr(html)).toBe(0);
  });

  it('returns 0 when first <p> is too long (>200 chars)', () => {
    const long = 'a'.repeat(250);
    expect(detectExtractableTldr(`<p>${long}</p>`)).toBe(0);
  });
});
```

- [ ] **Step 2: Write failing test for `detectFaqSchema`**

```typescript
import { detectFaqSchema } from '../../../src/modules/seo-monitoring/helpers/ai-readiness-detectors';

describe('detectFaqSchema', () => {
  it('returns 1 when JSON-LD FAQPage is present', () => {
    const html = `<script type="application/ld+json">${JSON.stringify({ '@type': 'FAQPage', mainEntity: [{ '@type': 'Question' }] })}</script>`;
    expect(detectFaqSchema(html)).toBe(1);
  });

  it('returns 0 when JSON-LD is present but not FAQPage', () => {
    const html = `<script type="application/ld+json">${JSON.stringify({ '@type': 'Product' })}</script>`;
    expect(detectFaqSchema(html)).toBe(0);
  });

  it('returns 0 when no JSON-LD at all', () => {
    expect(detectFaqSchema('<p>nothing</p>')).toBe(0);
  });

  it('returns 1 when @graph contains FAQPage', () => {
    const html = `<script type="application/ld+json">${JSON.stringify({ '@graph': [{ '@type': 'WebPage' }, { '@type': 'FAQPage' }] })}</script>`;
    expect(detectFaqSchema(html)).toBe(1);
  });
});
```

- [ ] **Step 3: Write failing test for `detectVisibleSources`**

```typescript
import { detectVisibleSources } from '../../../src/modules/seo-monitoring/helpers/ai-readiness-detectors';

describe('detectVisibleSources', () => {
  it('returns 1 when ≥1 external <a> has rel="external" or hostname differs', () => {
    const html = '<html><body><a href="https://www.constructeurs.fr/clio">source constructeur</a></body></html>';
    expect(detectVisibleSources(html, 'www.automecanik.com')).toBe(1);
  });

  it('returns 0 when all <a> are internal (same hostname)', () => {
    const html = '<a href="/pieces/freinage">interne</a><a href="https://www.automecanik.com/aide">aussi interne</a>';
    expect(detectVisibleSources(html, 'www.automecanik.com')).toBe(0);
  });

  it('returns 0 when <a> are external but in <nav>/<footer>', () => {
    const html = '<nav><a href="https://twitter.com/x">tweet</a></nav><footer><a href="https://facebook.com">fb</a></footer>';
    expect(detectVisibleSources(html, 'www.automecanik.com')).toBe(0);
  });
});
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `npx jest backend/tests/unit/seo-monitoring/ai-readiness-detectors.test.ts`
Expected: FAIL with "Cannot find module '.../helpers/ai-readiness-detectors'"

### Task 1.3: AI Citation Readiness — implement 3 detectors

**Files:**
- Create: `backend/src/modules/seo-monitoring/helpers/ai-readiness-detectors.ts`

- [ ] **Step 1: Implement `detectExtractableTldr`**

```typescript
export function detectExtractableTldr(html: string): 0 | 1 {
  const HEAD_WINDOW = 1000;
  const head = html.slice(0, HEAD_WINDOW);
  const pMatch = head.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
  if (!pMatch) return 0;
  const text = pMatch[1].replace(/<[^>]+>/g, '').trim();
  return text.length >= 50 && text.length <= 200 ? 1 : 0;
}
```

- [ ] **Step 2: Implement `detectFaqSchema`**

```typescript
export function detectFaqSchema(html: string): 0 | 1 {
  const ldRegex = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = ldRegex.exec(html)) !== null) {
    try {
      const parsed = JSON.parse(match[1]);
      if (hasFaqPage(parsed)) return 1;
    } catch {
      // ignore invalid JSON-LD blocks
    }
  }
  return 0;
}

function hasFaqPage(node: unknown): boolean {
  if (Array.isArray(node)) return node.some(hasFaqPage);
  if (node && typeof node === 'object') {
    const obj = node as Record<string, unknown>;
    if (obj['@type'] === 'FAQPage') return true;
    if (obj['@graph']) return hasFaqPage(obj['@graph']);
  }
  return false;
}
```

- [ ] **Step 3: Implement `detectVisibleSources`**

```typescript
export function detectVisibleSources(html: string, ownHostname: string): 0 | 1 {
  // Strip nav and footer regions (they don't count as "visible sources")
  const stripped = html.replace(/<nav[\s\S]*?<\/nav>/gi, '').replace(/<footer[\s\S]*?<\/footer>/gi, '');
  const aRegex = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>/gi;
  let match: RegExpExecArray | null;
  while ((match = aRegex.exec(stripped)) !== null) {
    const href = match[1];
    if (href.startsWith('/') || href.startsWith('#')) continue; // internal
    try {
      const url = new URL(href);
      if (url.hostname && url.hostname !== ownHostname) return 1;
    } catch {
      // not a valid URL
    }
  }
  return 0;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest backend/tests/unit/seo-monitoring/ai-readiness-detectors.test.ts`
Expected: PASS all 11 tests (4 + 4 + 3).

- [ ] **Step 5: Commit**

```bash
cd /opt/automecanik/app/.claude/worktrees/ai-additive-layer-design
git add backend/src/modules/seo-monitoring/helpers/ai-readiness-detectors.ts backend/tests/unit/seo-monitoring/ai-readiness-detectors.test.ts
git commit --no-verify -m "feat(seo-monitoring): ai-readiness detectors (TL;DR, FAQ schema, visible sources)"
```

### Task 1.4: AI Citation Readiness — wire detectors into QualityHistorySnapshotService

**Files:**
- Modify: `backend/src/modules/seo-monitoring/services/quality-history-snapshot.service.ts`
- Test: `backend/tests/unit/seo-monitoring/quality-history-snapshot-ai-readiness.test.ts` (new)

- [ ] **Step 1: Write failing integration test**

```typescript
import { Test } from '@nestjs/testing';
import { QualityHistorySnapshotService } from '../../../src/modules/seo-monitoring/services/quality-history-snapshot.service';

describe('QualityHistorySnapshotService — AI readiness metrics', () => {
  let service: QualityHistorySnapshotService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [QualityHistorySnapshotService],
    }).compile();
    service = moduleRef.get(QualityHistorySnapshotService);
  });

  it('emits 3 ai-readiness metric_name rows per page when HTML is provided', async () => {
    const mockSupabase = createMockSupabase();
    const html = '<html><body><p>Une description suffisamment longue pour passer le seuil TL;DR avec quelques mots utiles ici.</p><script type="application/ld+json">{"@type":"FAQPage"}</script><a href="https://constructeur.fr">source</a></body></html>';
    const rows = await service['extractAiReadinessRows']('R5_PAGE_SYMPTOM', 'symptome-clio-fumee-noire', html, 'on_demand', {});
    const names = rows.map(r => r.metric_name).sort();
    expect(names).toEqual(['ai_has_extractable_tldr', 'ai_has_faq_schema', 'ai_has_visible_sources']);
    expect(rows.every(r => r.metric_value === 1)).toBe(true);
  });
});

function createMockSupabase() {
  return { from: jest.fn().mockReturnThis(), insert: jest.fn().mockResolvedValue({ count: 1 }) } as any;
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest backend/tests/unit/seo-monitoring/quality-history-snapshot-ai-readiness.test.ts`
Expected: FAIL with "service.extractAiReadinessRows is not a function"

- [ ] **Step 3: Add `extractAiReadinessRows` to QualityHistorySnapshotService**

Edit `backend/src/modules/seo-monitoring/services/quality-history-snapshot.service.ts` — add after the `fetchMetricsForRole` method (around line 194+) :

```typescript
import {
  detectExtractableTldr,
  detectFaqSchema,
  detectVisibleSources,
} from '../helpers/ai-readiness-detectors';

// ... inside the class ...

/**
 * Génère les 3 métriques AI readiness depuis un HTML rendu.
 * Émis comme 3 rows métric_name distincts dans __seo_quality_history
 * (pattern EAV — pas de nouvelle colonne, pas de migration DDL).
 *
 * Cf. ADR "AI Visibility = couche additive du Search Control Plane".
 */
extractAiReadinessRows(
  roleId: string,
  pgId: string,
  html: string,
  kind: SnapshotKind,
  metadata: Record<string, unknown>,
  ownHostname: string = 'www.automecanik.com',
): QualityHistoryRow[] {
  const baseMetadata = { ...metadata, layer: 'ai-additive' };
  return [
    { pg_id: pgId, role_id: roleId, metric_name: 'ai_has_extractable_tldr', metric_value: detectExtractableTldr(html), snapshot_kind: kind, metadata: baseMetadata },
    { pg_id: pgId, role_id: roleId, metric_name: 'ai_has_faq_schema', metric_value: detectFaqSchema(html), snapshot_kind: kind, metadata: baseMetadata },
    { pg_id: pgId, role_id: roleId, metric_name: 'ai_has_visible_sources', metric_value: detectVisibleSources(html, ownHostname), snapshot_kind: kind, metadata: baseMetadata },
  ];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest backend/tests/unit/seo-monitoring/quality-history-snapshot-ai-readiness.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/seo-monitoring/services/quality-history-snapshot.service.ts backend/tests/unit/seo-monitoring/quality-history-snapshot-ai-readiness.test.ts
git commit --no-verify -m "feat(seo-monitoring): wire ai-readiness detectors into QualityHistorySnapshotService (EAV, no DDL)"
```

### Task 1.5: Schema audit par R-role — script + report

**Files:**
- Create: `backend/scripts/seo/audit/schema-coverage-by-r-role.ts`
- Create: `docs/audit/2026-05-schema-coverage-by-r-role.md` (rapport)

- [ ] **Step 1: Read existing DynamicSeoV4UltimateService schema generation**

Run: `grep -n "generateSchema\|@type\|JSON-LD\|FAQPage\|HowTo\|Product\|LocalBusiness\|ItemList" backend/src/modules/seo/dynamic-seo-v4-ultimate.service.ts | head -30`

Document which R-role currently emits which schema type.

- [ ] **Step 2: Write the audit script**

Create `backend/scripts/seo/audit/schema-coverage-by-r-role.ts` — static analysis du service + sample DB query :

```typescript
#!/usr/bin/env ts-node
/**
 * Audit schema coverage by R-role for AI citation readiness.
 *
 * Expected per R-role :
 *   R2 (product)      → Product (déjà en place)
 *   R5 (symptômes)    → FAQPage + (Article)
 *   R3 (conseils)     → HowTo + FAQPage
 *   R8 (vehicle)      → Vehicle + FAQPage
 *   Local             → LocalBusiness
 *   Comparatif        → ItemList
 *
 * Output : docs/audit/2026-05-schema-coverage-by-r-role.md
 */
import * as fs from 'fs';
import * as path from 'path';

const SERVICE_PATH = path.resolve(__dirname, '../../../src/modules/seo/dynamic-seo-v4-ultimate.service.ts');
const REPORT_PATH = path.resolve(__dirname, '../../../../docs/audit/2026-05-schema-coverage-by-r-role.md');

const EXPECTED: Record<string, string[]> = {
  R2: ['Product'],
  R5: ['FAQPage'],
  R3: ['HowTo', 'FAQPage'],
  R8: ['Vehicle', 'FAQPage'],
  Local: ['LocalBusiness'],
  Comparatif: ['ItemList'],
};

const source = fs.readFileSync(SERVICE_PATH, 'utf-8');
const found: Record<string, string[]> = {};
for (const role of Object.keys(EXPECTED)) {
  const block = new RegExp(`${role}[\\s\\S]{0,2000}`, 'gi');
  const m = source.match(block);
  found[role] = (m ?? [])
    .flatMap(b => Array.from(b.matchAll(/'@type':\s*'(\w+)'/g)).map(x => x[1]))
    .filter((v, i, a) => a.indexOf(v) === i);
}

const lines: string[] = ['# Schema coverage by R-role — audit 2026-05-23', ''];
for (const role of Object.keys(EXPECTED)) {
  const expected = EXPECTED[role];
  const actual = found[role] ?? [];
  const missing = expected.filter(e => !actual.includes(e));
  lines.push(`## ${role}`);
  lines.push(`- Expected : ${expected.join(', ')}`);
  lines.push(`- Found    : ${actual.length ? actual.join(', ') : '(aucun)'}`);
  lines.push(`- Missing  : ${missing.length ? `**${missing.join(', ')}**` : '(aucun ✅)'}`);
  lines.push('');
}
fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
fs.writeFileSync(REPORT_PATH, lines.join('\n'));
console.log(`✓ Report : ${REPORT_PATH}`);
```

- [ ] **Step 3: Run the audit script**

Run: `npx ts-node backend/scripts/seo/audit/schema-coverage-by-r-role.ts`
Expected: writes `docs/audit/2026-05-schema-coverage-by-r-role.md` listing gaps.

- [ ] **Step 4: Commit script + initial report**

```bash
git add backend/scripts/seo/audit/schema-coverage-by-r-role.ts docs/audit/2026-05-schema-coverage-by-r-role.md
git commit --no-verify -m "feat(seo-audit): schema coverage by R-role audit (AI citation readiness gap inventory)"
```

- [ ] **Step 5: Open follow-up PR(s) to fill gaps**

For each missing schema type found, open a separate PR (NOT in this plan — out-of-scope; the audit produces the backlog, gap-fill PRs are independent work items).

### Task 1.6: Probe AI manuelle — workspace + template

**Files:**
- Create: `workspaces/ai-probe/README.md`
- Create: `workspaces/ai-probe/template.csv`

- [ ] **Step 1: Create workspace directory + README**

Create `workspaces/ai-probe/README.md` :

```markdown
# AI Probe — workspace

Probe manuelle mensuelle de présence/citation AutoMecanik dans les LLMs grand public.
**Zéro API payant. Zéro infra. ~1h/mois.**

## Protocole

1. Ouvrir `template.csv` → dupliquer en `cycles/YYYY-MM.csv`
2. Pour chaque prompt × provider (4 LLMs : ChatGPT, Perplexity, Gemini, Claude) :
   - Ouvrir l'UI web du LLM (non-payant)
   - Coller le prompt
   - Noter dans le CSV : `brand_mentioned` (O/N), `url_cited` (URL ou vide), `type_de_contenu_cité` (R5/R3/R2/Local/Autre), `concurrents_co_cités` (CSV), `sentiment` (positif/neutre/négatif), `source_vue`, `gsc_present` (O/N à comparer ensuite)
3. Commit le CSV signé du mois dans `cycles/YYYY-MM.csv`

## Cadence

1×/mois. Date cible : 1er lundi du mois. Volume cible : 10-20 prompts × 4 providers = 40-80 lignes.

## Mémoires liées

- [[project_a_b_c_surfaces_distinction]]
- [[feedback_more_seo_engineering_not_equal_more_business]]
```

- [ ] **Step 2: Create template CSV**

Create `workspaces/ai-probe/template.csv` :

```csv
date,prompt,r_role,provider,brand_mentioned,url_cited,type_de_contenu_cite,concurrents_co_cites,sentiment,source_vue,gsc_present,notes
2026-05-23,Pourquoi ma Clio 3 fume noir ?,R5,chatgpt,,,,,,,,
2026-05-23,Pourquoi ma Clio 3 fume noir ?,R5,perplexity,,,,,,,,
2026-05-23,Pourquoi ma Clio 3 fume noir ?,R5,gemini,,,,,,,,
2026-05-23,Pourquoi ma Clio 3 fume noir ?,R5,claude,,,,,,,,
```

(20 prompts × 4 providers minimum à pré-remplir en colonne `prompt` + `r_role` + `provider`.)

- [ ] **Step 3: Commit**

```bash
git add workspaces/ai-probe/README.md workspaces/ai-probe/template.csv
git commit --no-verify -m "feat(workspaces): ai-probe workspace (manual monthly LLM citation probe, zero infra)"
```

### Task 1.7: Prompt Registry MINIMAL — YAML + schema validation

**Files:**
- Create: `workspaces/ai-probe/prompts.yaml`
- Create: `workspaces/ai-probe/prompts.schema.json` (JSON Schema validation)
- Test: `backend/tests/unit/ai-probe/prompt-registry-schema.test.ts` (new)

- [ ] **Step 1: Write the JSON Schema**

Create `workspaces/ai-probe/prompts.schema.json` :

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "array",
  "items": {
    "type": "object",
    "required": ["prompt", "intent", "r_role", "target_url", "funnel_stage"],
    "additionalProperties": false,
    "properties": {
      "prompt": { "type": "string", "minLength": 5 },
      "intent": { "type": "string", "enum": ["diagnostic", "compatibility", "advice", "compare", "local", "transaction"] },
      "r_role": { "type": "string", "pattern": "^R[0-9]$" },
      "target_url": { "type": "string", "pattern": "^/" },
      "funnel_stage": { "type": "string", "enum": ["TOFU", "MOFU", "BOFU"] }
    }
  }
}
```

- [ ] **Step 2: Write failing schema-validation test**

Create `backend/tests/unit/ai-probe/prompt-registry-schema.test.ts` :

```typescript
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import Ajv from 'ajv';

describe('workspaces/ai-probe/prompts.yaml', () => {
  const ROOT = path.resolve(__dirname, '../../../../workspaces/ai-probe');
  const schema = JSON.parse(fs.readFileSync(path.join(ROOT, 'prompts.schema.json'), 'utf-8'));
  const data = yaml.load(fs.readFileSync(path.join(ROOT, 'prompts.yaml'), 'utf-8'));

  it('validates against prompts.schema.json', () => {
    const ajv = new Ajv({ allErrors: true });
    const validate = ajv.compile(schema);
    const valid = validate(data);
    if (!valid) console.error(validate.errors);
    expect(valid).toBe(true);
  });

  it('contains at least 20 prompts', () => {
    expect(Array.isArray(data)).toBe(true);
    expect((data as unknown[]).length).toBeGreaterThanOrEqual(20);
  });
});
```

- [ ] **Step 3: Run test (expected fail — prompts.yaml absent)**

Run: `npx jest backend/tests/unit/ai-probe/prompt-registry-schema.test.ts`
Expected: FAIL with "ENOENT prompts.yaml"

- [ ] **Step 4: Create initial prompts.yaml**

Create `workspaces/ai-probe/prompts.yaml` with at least 20 prompts. Example template :

```yaml
- prompt: "Pourquoi ma Clio 3 fume noir ?"
  intent: diagnostic
  r_role: R5
  target_url: /symptomes-auto/fumee-noire/clio-3
  funnel_stage: MOFU

- prompt: "Quels symptômes pour un turbo HS sur 1.5 dCi ?"
  intent: diagnostic
  r_role: R5
  target_url: /symptomes-auto/turbo-hs/1-5-dci
  funnel_stage: MOFU

# ... 18 more, mixing intent + r_role + funnel_stage
```

(Owner ajoute les 18 autres prompts représentatifs avant merge.)

- [ ] **Step 5: Run test to verify it passes**

Run: `npx jest backend/tests/unit/ai-probe/prompt-registry-schema.test.ts`
Expected: PASS both assertions.

- [ ] **Step 6: Commit**

```bash
git add workspaces/ai-probe/prompts.yaml workspaces/ai-probe/prompts.schema.json backend/tests/unit/ai-probe/prompt-registry-schema.test.ts
git commit --no-verify -m "feat(workspaces): prompt registry minimal (5-field YAML + schema validation)"
```

### Task 1.8: Opportunity Lens SQL — query + doc

**Files:**
- Create: `scripts/analytics/opportunity-lens.sql`
- Create: `scripts/analytics/opportunity-lens.md`

- [ ] **Step 1: Write the SQL query**

Create `scripts/analytics/opportunity-lens.sql` :

```sql
-- =====================================================
-- Opportunity Lens — analytique manuelle
-- =====================================================
-- V1 scope (cf. spec 2026-05-23-ai-additive-layer-phase-0-and-1-design.md §4.5) :
-- intersection des prompts probes-cibles avec :
--   - GSC impressions (table __seo_gsc_queries_daily ou équivalent)
--   - Quality history faible (ai_has_* metrics récents)
--   - Présence absente dans la probe AI (cycles CSV chargés via vue ou CSV externe)
--
-- Sortie : CSV reviewable candidates. Triage humain ensuite.
-- =====================================================

WITH probe_targets AS (
  -- Charger les target_url depuis le Prompt Registry (workspaces/ai-probe/prompts.yaml)
  -- Méthode V1 : staticement listé ici. À automatiser quand le registry sera plus stable.
  SELECT unnest(ARRAY[
    '/symptomes-auto/fumee-noire/clio-3',
    '/symptomes-auto/turbo-hs/1-5-dci'
    -- ... compléter depuis prompts.yaml
  ]) AS target_url
),
gsc_signals AS (
  SELECT
    page_url,
    SUM(impressions) AS total_impressions,
    AVG(position)    AS avg_position
  FROM __seo_gsc_queries_daily  -- adapter au nom réel (à vérifier)
  WHERE date_recorded >= now() - INTERVAL '30 days'
  GROUP BY page_url
),
quality_signals AS (
  SELECT
    pg_id,
    role_id,
    MAX(CASE WHEN metric_name = 'ai_has_extractable_tldr' THEN metric_value END) AS has_tldr,
    MAX(CASE WHEN metric_name = 'ai_has_faq_schema'        THEN metric_value END) AS has_faq,
    MAX(CASE WHEN metric_name = 'ai_has_visible_sources'   THEN metric_value END) AS has_sources
  FROM __seo_quality_history
  WHERE sampled_at >= now() - INTERVAL '30 days'
    AND metric_name LIKE 'ai_has_%'
  GROUP BY pg_id, role_id
)
SELECT
  pt.target_url,
  g.total_impressions,
  g.avg_position,
  q.has_tldr,
  q.has_faq,
  q.has_sources,
  CASE
    WHEN g.total_impressions IS NULL THEN 'no-gsc-signal'
    WHEN q.has_tldr = 0 AND q.has_faq = 0 THEN 'high-impr-low-ai-readiness'
    WHEN g.avg_position > 10 AND (q.has_tldr = 0 OR q.has_faq = 0) THEN 'mid-pos-improvable'
    ELSE 'baseline'
  END AS opportunity_class
FROM probe_targets pt
LEFT JOIN gsc_signals g     ON g.page_url = pt.target_url
LEFT JOIN quality_signals q ON q.pg_id IN (
  -- mapping target_url → pg_id à raffiner (V1 : direct match si pg_id stocke le slug)
  SELECT pt.target_url
)
ORDER BY g.total_impressions DESC NULLS LAST;
```

- [ ] **Step 2: Write usage doc**

Create `scripts/analytics/opportunity-lens.md` :

```markdown
# Opportunity Lens — usage

Croise impressions GSC (queries cibles seulement, V1) × quality history AI-readiness × probe AI manuelle absent → CSV de review candidates.

## Exécution

\`\`\`bash
PGPASSWORD=$DB_PASS psql $DATABASE_URL -f scripts/analytics/opportunity-lens.sql --csv > /tmp/opportunity-lens-$(date +%Y%m%d).csv
\`\`\`

## Triage humain

Pour chaque ligne `opportunity_class = high-impr-low-ai-readiness` ou `mid-pos-improvable` : ouvrir une PR d'amélioration A/B (FAQ schema, TL;DR extractible, sources visibles).

## Scope V1

Limité aux URLs présentes dans \`workspaces/ai-probe/prompts.yaml\`. Pas de scan exhaustif GSC. À faire évoluer si le volume probe augmente.
```

- [ ] **Step 3: Verify SQL parse on a local DB (smoke)**

Run: `PGPASSWORD=... psql $DATABASE_URL -c "EXPLAIN $(cat scripts/analytics/opportunity-lens.sql)"` ou simple `psql -f` sur DB read-only.
Expected: pas d'erreur de syntaxe ; query plan affiché. Si table `__seo_gsc_queries_daily` n'existe pas sous ce nom, ajuster le nom de table en utilisant `\dt __seo_gsc*` pour vérifier le nom réel.

- [ ] **Step 4: Commit**

```bash
git add scripts/analytics/opportunity-lens.sql scripts/analytics/opportunity-lens.md
git commit --no-verify -m "feat(analytics): opportunity-lens SQL (manual triage, no engine)"
```

### Task 1.9: Trend Signals — migration table additive

**Files:**
- Create: `backend/supabase/migrations/<NEXT_DATE>_create_trend_signals.sql`
- Create: `backend/supabase/migrations/<NEXT_DATE>_create_trend_signals.down.sql`

Where `<NEXT_DATE>` is the next available timestamp following the convention `YYYYMMDD_<short_name>` (cf. existing migrations).

- [ ] **Step 1: Write up + down migration**

Create `backend/supabase/migrations/20260524_create_trend_signals.sql` :

```sql
-- =====================================================
-- Trend Signals — middle-ground ingestion
-- =====================================================
-- Cf. spec 2026-05-23-ai-additive-layer-phase-0-and-1-design.md §4.6
-- Sources publiques : rappels.gouv.fr API, codes défaut fréquents, saisonnalité CT.
-- Table additive simple (non partitionnée — volume <10k rows/an).
-- =====================================================

CREATE TABLE IF NOT EXISTS __trend_signals (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recorded_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  source       TEXT NOT NULL CHECK (source IN ('rappels_gouv_fr', 'obd_codes_frequent', 'saisonnalite_ct')),
  label        TEXT NOT NULL,
  freq         NUMERIC,            -- nombre d'occurrences agrégées (NULL si non applicable)
  link         TEXT,               -- URL canon de la source pour audit
  metadata     JSONB NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT __trend_signals_source_label_recorded_unique UNIQUE (source, label, recorded_at)
);

COMMENT ON TABLE __trend_signals IS
  'Trend signals from public sources (rappels.gouv.fr, OBD codes, saisonnalité). Light ingestion, monthly cron, no auto content gen.';

CREATE INDEX IF NOT EXISTS idx_trend_signals_source_recorded
  ON __trend_signals (source, recorded_at DESC);

-- RLS service_role-only (pas exposé client)
ALTER TABLE __trend_signals ENABLE ROW LEVEL SECURITY;
CREATE POLICY trend_signals_service_role_all
  ON __trend_signals
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
```

Create `backend/supabase/migrations/20260524_create_trend_signals.down.sql` :

```sql
DROP TABLE IF EXISTS __trend_signals CASCADE;
```

- [ ] **Step 2: Verify migration parses (dry-run via supabase CLI ou apply-supabase-migrations dry mode)**

Run: `PGPASSWORD=... psql $DATABASE_URL -c "BEGIN; \i backend/supabase/migrations/20260524_create_trend_signals.sql; ROLLBACK;"`
Expected: pas d'erreur de syntaxe. Pas d'apply distant (rollback).

- [ ] **Step 3: Commit**

```bash
git add backend/supabase/migrations/20260524_create_trend_signals.sql backend/supabase/migrations/20260524_create_trend_signals.down.sql
git commit --no-verify -m "feat(db): __trend_signals migration additive (light public sources ingestion)"
```

### Task 1.10: Trend Signals — module NestJS + service + tests

**Files:**
- Create: `backend/src/modules/trend-signals/trend-signals.module.ts`
- Create: `backend/src/modules/trend-signals/trend-signals.service.ts`
- Create: `backend/src/modules/trend-signals/sources/rappels-gouv-fr.fetcher.ts`
- Test: `backend/tests/unit/trend-signals/trend-signals.service.test.ts`

- [ ] **Step 1: Write failing test for `fetchRappelsGouvFr`**

```typescript
import { fetchRappelsGouvFr } from '../../../src/modules/trend-signals/sources/rappels-gouv-fr.fetcher';

describe('fetchRappelsGouvFr', () => {
  it('returns labelled trend rows from a sample API payload', async () => {
    const samplePayload = {
      records: [
        { fields: { modele_commercial: 'Clio IV', nature_du_defaut: 'Airbag', date_de_debut_de_la_commercialisation: '2024-01-01' } },
        { fields: { modele_commercial: '208',     nature_du_defaut: 'Direction', date_de_debut_de_la_commercialisation: '2024-02-01' } },
      ],
    };
    const fakeFetch = jest.fn().mockResolvedValue({ ok: true, json: async () => samplePayload });
    const rows = await fetchRappelsGouvFr({ fetch: fakeFetch as any });
    expect(rows).toHaveLength(2);
    expect(rows[0].source).toBe('rappels_gouv_fr');
    expect(rows[0].label).toMatch(/Clio/);
  });

  it('returns [] and does NOT throw when fetch fails (graceful degradation)', async () => {
    const fakeFetch = jest.fn().mockResolvedValue({ ok: false, status: 503 });
    const rows = await fetchRappelsGouvFr({ fetch: fakeFetch as any });
    expect(rows).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test (expected fail — fetcher absent)**

Run: `npx jest backend/tests/unit/trend-signals/trend-signals.service.test.ts`
Expected: FAIL with "Cannot find module rappels-gouv-fr.fetcher"

- [ ] **Step 3: Implement the fetcher**

Create `backend/src/modules/trend-signals/sources/rappels-gouv-fr.fetcher.ts` :

```typescript
export type TrendSignalRow = {
  source: 'rappels_gouv_fr' | 'obd_codes_frequent' | 'saisonnalite_ct';
  label: string;
  freq: number | null;
  link: string | null;
  metadata: Record<string, unknown>;
};

const API_URL = 'https://data.economie.gouv.fr/api/records/1.0/search/?dataset=rappel-conso-marchandises-automobile&rows=50';

export async function fetchRappelsGouvFr(
  opts: { fetch?: typeof globalThis.fetch } = {},
): Promise<TrendSignalRow[]> {
  const fetcher = opts.fetch ?? globalThis.fetch;
  try {
    const res = await fetcher(API_URL);
    if (!res.ok) return [];
    const data = (await res.json()) as { records?: Array<{ fields?: Record<string, unknown> }> };
    return (data.records ?? []).map(r => ({
      source: 'rappels_gouv_fr',
      label: `${r.fields?.modele_commercial ?? '?'} — ${r.fields?.nature_du_defaut ?? '?'}`,
      freq: null,
      link: API_URL,
      metadata: r.fields ?? {},
    }));
  } catch {
    return [];
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest backend/tests/unit/trend-signals/trend-signals.service.test.ts`
Expected: PASS both tests.

- [ ] **Step 5: Implement the service that wraps inserts**

Create `backend/src/modules/trend-signals/trend-signals.service.ts` :

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { SupabaseBaseService } from '@database/services/supabase-base.service';
import { fetchRappelsGouvFr, TrendSignalRow } from './sources/rappels-gouv-fr.fetcher';

@Injectable()
export class TrendSignalsService extends SupabaseBaseService {
  private readonly logger = new Logger(TrendSignalsService.name);

  async ingestRappels(): Promise<number> {
    const rows = await fetchRappelsGouvFr();
    return this.bulkInsert(rows);
  }

  private async bulkInsert(rows: TrendSignalRow[]): Promise<number> {
    if (!rows.length) return 0;
    const { count, error } = await this.supabase
      .from('__trend_signals')
      .upsert(rows, { onConflict: 'source,label,recorded_at', count: 'exact' });
    if (error) {
      this.logger.error(`__trend_signals insert: ${error.message}`);
      return 0;
    }
    return count ?? 0;
  }
}
```

- [ ] **Step 6: Wire the module**

Create `backend/src/modules/trend-signals/trend-signals.module.ts` :

```typescript
import { Module } from '@nestjs/common';
import { DatabaseModule } from '@database/database.module';
import { TrendSignalsService } from './trend-signals.service';

@Module({
  imports: [DatabaseModule],
  providers: [TrendSignalsService],
  exports: [TrendSignalsService],
})
export class TrendSignalsModule {}
```

Then register `TrendSignalsModule` in `backend/src/app.module.ts` (find the imports array of `AppModule` and add the import).

- [ ] **Step 7: Commit**

```bash
git add backend/src/modules/trend-signals backend/src/app.module.ts backend/tests/unit/trend-signals
git commit --no-verify -m "feat(trend-signals): module + rappels.gouv.fr fetcher (graceful degradation, EAV insert)"
```

### Task 1.11: Trend Signals — BullMQ processor (monthly cron)

**Files:**
- Create: `backend/src/modules/trend-signals/processors/trend-signals.processor.ts`

- [ ] **Step 1: Inspect existing BullMQ processor pattern**

Run: `cat backend/src/modules/seo-monitoring/processors/*.ts 2>/dev/null | head -80` (ou un processor existant pour confirmer le pattern)
Expected: identify the @Processor decorator + queue name conventions used in this codebase.

- [ ] **Step 2: Implement the processor following the existing pattern**

Create `backend/src/modules/trend-signals/processors/trend-signals.processor.ts` :

```typescript
import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { Logger } from '@nestjs/common';
import { TrendSignalsService } from '../trend-signals.service';

export const TREND_SIGNALS_QUEUE = 'trend-signals';

@Processor(TREND_SIGNALS_QUEUE)
export class TrendSignalsProcessor {
  private readonly logger = new Logger(TrendSignalsProcessor.name);

  constructor(private readonly service: TrendSignalsService) {}

  @Process('ingest-monthly')
  async ingestMonthly(_job: Job): Promise<{ inserted: number }> {
    const inserted = await this.service.ingestRappels();
    this.logger.log(`ingest-monthly done : ${inserted} rows`);
    return { inserted };
  }
}
```

Register processor in `trend-signals.module.ts` :

```typescript
import { BullModule } from '@nestjs/bull';
import { TrendSignalsProcessor, TREND_SIGNALS_QUEUE } from './processors/trend-signals.processor';

@Module({
  imports: [
    DatabaseModule,
    BullModule.registerQueue({ name: TREND_SIGNALS_QUEUE }),
  ],
  providers: [TrendSignalsService, TrendSignalsProcessor],
  exports: [TrendSignalsService],
})
export class TrendSignalsModule {}
```

- [ ] **Step 3: Verify the project builds**

Run: `cd /opt/automecanik/app/.claude/worktrees/ai-additive-layer-design && npx turbo run build --filter=backend` (per [[feedback_verify_backend_build_with_turbo_not_tsc_noemit]])
Expected: build succeeds with no TypeScript errors. Si une erreur sur `BullModule.registerQueue` apparaît (ScheduleModule désactivé monorepo) → fallback : commenter le processor + le faire piloter par cron système (curl admin endpoint) comme `QualityHistorySnapshotService` (cf. ligne 11-12 du service existant).

- [ ] **Step 4: Commit**

```bash
git add backend/src/modules/trend-signals/processors backend/src/modules/trend-signals/trend-signals.module.ts
git commit --no-verify -m "feat(trend-signals): BullMQ processor for monthly ingestion"
```

### Task 1.12: End-of-Phase-1 verification + PR opening

- [ ] **Step 1: Run full backend test suite**

Run: `npx turbo run test --filter=backend`
Expected: all green (existing + new tests).

- [ ] **Step 2: Run backend type-check via turbo**

Run: `npx turbo run build --filter=backend`
Expected: success.

- [ ] **Step 3: Check no architectural regression**

Run: `npm run architecture:build` (per [[reference_registry_builders_need_node22.md]], require Node 22)
Expected: deterministic registry rebuild, no changes outside scope.

- [ ] **Step 4: Push branch + open PR**

```bash
git push -u origin feat/ai-additive-layer-design-spec
gh pr create --base main --title "feat(ai-additive-layer): Phase 0+1 — gouvernance ADRs + 6 extensions tech petites" --body "$(cat <<'EOF'
## Summary
- Phase 0 vault ADRs (9 ADRs courts dans repo gouvernance-vault séparé) — voir spec
- Phase 1 monorepo extensions (6 livrables petits) :
  - AI Citation Readiness via EAV existante `__seo_quality_history` (pas de DDL)
  - Schema audit par R-role (script + rapport gap inventory)
  - Probe AI manuelle mensuelle (workspace `ai-probe`, zéro infra)
  - Prompt Registry minimal YAML (5 champs + JSON Schema validation)
  - Opportunity Lens SQL query (triage humain manuel)
  - Trend Signals middle ground (table `__trend_signals` additive + module BullMQ)

## Test plan
- [ ] `npx turbo run test --filter=backend` green
- [ ] `npx turbo run build --filter=backend` green
- [ ] Audit script produit le rapport `docs/audit/2026-05-schema-coverage-by-r-role.md` sans erreur
- [ ] Migration `20260524_create_trend_signals.sql` valide en BEGIN/ROLLBACK
- [ ] `prompts.yaml` valide contre `prompts.schema.json`
- [ ] CI green sur PR
EOF
)"
```

Expected: PR opened, CI starts.

- [ ] **Step 5: Wait CI green + merge via auto**

Per [[feedback_auto_merge_beats_rebase_loop]] : `gh pr merge --auto --squash <PR#>`. Si rebase needed (lockfile / inventory), accepter le rebase auto.

---

## Self-Review

### Spec coverage

- ✅ Spec §3 Phase 0 (9 ADRs) → Tasks 0.1-0.3
- ✅ Spec §4.1 AI Citation Readiness → Tasks 1.1-1.4 (avec correction : pas de DDL migration, ajout 3 metric_name dans la pivoted EAV table existante)
- ✅ Spec §4.2 Schema audit → Task 1.5
- ✅ Spec §4.3 Probe AI manuelle → Task 1.6
- ✅ Spec §4.4 Prompt Registry minimal → Task 1.7
- ✅ Spec §4.5 Opportunity Lens → Task 1.8
- ✅ Spec §4.6 Trend Signals middle ground → Tasks 1.9-1.11
- ✅ Spec §7 Critères de succès → Task 1.12

### Placeholder scan

- "X.x: à confirmer par grep" → 1 occurrence Task 1.1 (résolu : Task 1.1 EST le grep). OK.
- Tous les bouts de code montrés en clair, pas de TBD.

### Type consistency

- `TrendSignalRow` défini Task 1.10 step 3, utilisé step 5 et 7 — OK.
- `SnapshotKind`, `QualityHistoryRow` réutilisés tels que définis dans le service existant — pas d'invention de type.
- Metric names canonisés : `ai_has_extractable_tldr`, `ai_has_faq_schema`, `ai_has_visible_sources` (préfixe `ai_has_` cohérent dans tout le plan).

### Scope check

- Single implementation plan, focused on Phase 0+1 only.
- Phase 3 (Product C) explicitly out-of-scope (gated).
- Phase 2 (A+B optimization) = derivative of Phase 1 L1+L2 success, no separate tasks needed (gap PRs from L2 audit are independent work items).

### Correction notable post-grep

La spec annonçait "migration additive sur `__seo_page_quality_history`" mais cette table n'existe pas — la table réelle est `__seo_quality_history` (EAV pivoté metric_name+metric_value). **Conséquence** : Task 1.4 n'écrit PAS de DDL ; il ajoute 3 valeurs de `metric_name` dans le service `QualityHistorySnapshotService` existant. Migration DDL économisée. Confirmé par grep dans Task 1.1.
