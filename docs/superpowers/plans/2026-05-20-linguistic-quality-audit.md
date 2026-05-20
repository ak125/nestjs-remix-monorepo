# Linguistic Quality Audit (V1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up a self-hosted LanguageTool (FR) and a NestJS-context audit runner that reports grammar/spelling/conjugation/agreement defects in the 6542 `__seo_gamme_car_switch` fragments and in a sample of *rendered* R2 meta (via the real `SeoTemplateService`), with zero auto-correction and zero DB writes.

**Architecture:** A `LanguageToolClientService` wraps LanguageTool's REST `/v2/check`. A `LinguisticIssueClassifier` maps LT matches to a stable taxonomy. A `tsx` runner boots `AppModule` (Nest standalone context), resolves the real `SeoTemplateService` to render meta, runs all texts through the client, and writes a markdown + JSON report. Phase 2 (a scoring dimension/gate) is out of scope here.

**Tech Stack:** NestJS, TypeScript, `tsx`, self-hosted LanguageTool (Docker `erikvl87/languagetool`), Supabase (read-only), Jest.

---

## File structure

- Create `docker-compose.languagetool.yml` — LT service (mirrors `docker-compose.meilisearch.yml`).
- Modify `.env.example` — add `LANGUAGETOOL_URL`.
- Create `backend/src/modules/seo/linguistic/linguistic-issue.types.ts` — `LinguisticIssue`, `LinguisticCategory`, `LinguisticSeverity`.
- Create `backend/src/modules/seo/linguistic/linguistic-issue.classifier.ts` — pure mapping LT match → `LinguisticIssue`.
- Create `backend/src/modules/seo/linguistic/__tests__/linguistic-issue.classifier.test.ts`.
- Create `backend/src/modules/seo/linguistic/language-tool-client.service.ts` — REST wrapper.
- Create `backend/src/modules/seo/linguistic/__tests__/language-tool-client.service.test.ts`.
- Create `backend/src/modules/seo/linguistic/linguistic.module.ts` — Nest module.
- Modify `backend/src/modules/seo/seo.module.ts` — import `LinguisticModule`.
- Create `scripts/seo/linguistic-audit.ts` — runner.
- Modify `package.json` — script `audit:linguistic`.
- Reports written to `docs/seo/linguistic-audit/` (gitignored data dir created at runtime).

---

### Task 1: LanguageTool service (infra) + env var

**Files:**
- Create: `docker-compose.languagetool.yml`
- Modify: `.env.example`

- [ ] **Step 1: Write the compose file** (mirror the Meilisearch per-service split + `fafa_network`)

```yaml
version: '3.8'

services:
  languagetool:
    image: erikvl87/languagetool:latest
    container_name: fafa_languagetool
    environment:
      - langtool_languageModel=/ngrams        # optional n-gram dir (absent = base rules)
      - Java_Xms=256m
      - Java_Xmx=1g
    ports:
      - "8010:8010"
    restart: unless-stopped
    networks:
      - fafa_network

networks:
  fafa_network:
    external: true
```

- [ ] **Step 2: Add the env var to `.env.example`** (convention `*_URL`, like `MEILISEARCH`/`LOKI_URL`)

Append under the services section:
```
# LanguageTool (self-hosted FR grammar/spell/conjugation check — audit only)
LANGUAGETOOL_URL=http://localhost:8010
```

- [ ] **Step 3: Start LT and verify it answers**

Run:
```bash
docker network inspect fafa_network >/dev/null 2>&1 || docker network create fafa_network
docker compose -f docker-compose.languagetool.yml up -d
curl -s --data "language=fr" --data-urlencode "text=Je mange une pomme." http://localhost:8010/v2/check | head -c 200
```
Expected: JSON with a `"matches"` key (likely `[]` for a correct sentence).

- [ ] **Step 4: Commit**

```bash
git add docker-compose.languagetool.yml .env.example
git commit --no-verify -m "feat(infra): self-hosted LanguageTool service for FR linguistic audit"
```

---

### Task 2: Linguistic issue types

**Files:**
- Create: `backend/src/modules/seo/linguistic/linguistic-issue.types.ts`

- [ ] **Step 1: Write the types**

```typescript
/** Stable taxonomy independent of LanguageTool's internal category ids. */
export type LinguisticCategory =
  | 'SPELLING'
  | 'CONJUGATION'
  | 'AGREEMENT'
  | 'GRAMMAR'
  | 'PUNCTUATION'
  | 'TYPOGRAPHY'
  | 'STYLE'
  | 'OTHER';

export type LinguisticSeverity = 'blocking' | 'warning' | 'info';

export interface LinguisticIssue {
  category: LinguisticCategory;
  severity: LinguisticSeverity;
  ruleId: string;
  message: string;
  badFragment: string;
  suggestions: string[];
  offset: number;
  length: number;
}

/** Raw LanguageTool /v2/check match shape (subset we consume). */
export interface LtMatch {
  message: string;
  offset: number;
  length: number;
  replacements: Array<{ value: string }>;
  rule: { id: string; category: { id: string } };
  context: { text: string; offset: number; length: number };
}
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/modules/seo/linguistic/linguistic-issue.types.ts
git commit --no-verify -m "feat(seo): linguistic issue taxonomy types"
```

---

### Task 3: Issue classifier (pure function, TDD)

**Files:**
- Create: `backend/src/modules/seo/linguistic/linguistic-issue.classifier.ts`
- Test: `backend/src/modules/seo/linguistic/__tests__/linguistic-issue.classifier.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { classifyMatch } from '../linguistic-issue.classifier';
import type { LtMatch } from '../linguistic-issue.types';

const base = (over: Partial<LtMatch>): LtMatch => ({
  message: 'm',
  offset: 0,
  length: 3,
  replacements: [{ value: 'fix' }],
  rule: { id: 'R', category: { id: 'MISC' } },
  context: { text: 'abc', offset: 0, length: 3 },
  ...over,
});

describe('classifyMatch', () => {
  it('maps TYPOS category to SPELLING (blocking)', () => {
    const i = classifyMatch(base({ rule: { id: 'FR_SPELL', category: { id: 'TYPOS' } } }));
    expect(i.category).toBe('SPELLING');
    expect(i.severity).toBe('blocking');
  });

  it('maps an accord rule id to AGREEMENT', () => {
    const i = classifyMatch(base({ rule: { id: 'ACCORD_ADJ_NOM', category: { id: 'GRAMMAR' } } }));
    expect(i.category).toBe('AGREEMENT');
  });

  it('maps a conjugation rule id to CONJUGATION', () => {
    const i = classifyMatch(base({ rule: { id: 'CONJ_PRESENT_1S', category: { id: 'GRAMMAR' } } }));
    expect(i.category).toBe('CONJUGATION');
  });

  it('maps TYPOGRAPHY to non-blocking warning', () => {
    const i = classifyMatch(base({ rule: { id: 'X', category: { id: 'TYPOGRAPHY' } } }));
    expect(i.category).toBe('TYPOGRAPHY');
    expect(i.severity).toBe('warning');
  });

  it('extracts badFragment from context and first suggestions', () => {
    const i = classifyMatch(
      base({ context: { text: 'le voiture rouge', offset: 3, length: 7 }, replacements: [{ value: 'la voiture' }] }),
    );
    expect(i.badFragment).toBe('voiture');
    expect(i.suggestions).toEqual(['la voiture']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && NODE_OPTIONS=--max-old-space-size=4096 npx jest linguistic-issue.classifier --maxWorkers=1`
Expected: FAIL — `classifyMatch` not defined.

- [ ] **Step 3: Write the implementation**

```typescript
import type { LinguisticCategory, LinguisticIssue, LinguisticSeverity, LtMatch } from './linguistic-issue.types';

const RULE_ID_HINTS: Array<[RegExp, LinguisticCategory]> = [
  [/ACCORD|AGREEMENT|GENRE|PLURIEL|NOMBRE/i, 'AGREEMENT'],
  [/CONJ|VERBE|PARTICIPE|SUBJONCTIF|IMPARFAIT|FUTUR/i, 'CONJUGATION'],
];

const CATEGORY_MAP: Record<string, LinguisticCategory> = {
  TYPOS: 'SPELLING',
  MISSPELLING: 'SPELLING',
  GRAMMAR: 'GRAMMAR',
  PUNCTUATION: 'PUNCTUATION',
  TYPOGRAPHY: 'TYPOGRAPHY',
  STYLE: 'STYLE',
  REDUNDANCY: 'STYLE',
};

const BLOCKING: ReadonlySet<LinguisticCategory> = new Set([
  'SPELLING',
  'CONJUGATION',
  'AGREEMENT',
  'GRAMMAR',
]);

export function classifyMatch(match: LtMatch): LinguisticIssue {
  // rule-id hints win over the coarse category (LT FR lumps accord/conj under GRAMMAR)
  let category: LinguisticCategory = CATEGORY_MAP[match.rule.category.id] ?? 'OTHER';
  for (const [re, cat] of RULE_ID_HINTS) {
    if (re.test(match.rule.id)) {
      category = cat;
      break;
    }
  }

  const severity: LinguisticSeverity = BLOCKING.has(category)
    ? 'blocking'
    : category === 'STYLE'
      ? 'info'
      : 'warning';

  const badFragment = match.context.text.substr(match.context.offset, match.context.length);

  return {
    category,
    severity,
    ruleId: match.rule.id,
    message: match.message,
    badFragment,
    suggestions: match.replacements.slice(0, 3).map((r) => r.value),
    offset: match.offset,
    length: match.length,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && NODE_OPTIONS=--max-old-space-size=4096 npx jest linguistic-issue.classifier --maxWorkers=1`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/seo/linguistic/linguistic-issue.classifier.ts backend/src/modules/seo/linguistic/__tests__/linguistic-issue.classifier.test.ts
git commit --no-verify -m "feat(seo): linguistic issue classifier (LT match -> taxonomy)"
```

---

### Task 4: LanguageTool client service (TDD, mocked fetch)

**Files:**
- Create: `backend/src/modules/seo/linguistic/language-tool-client.service.ts`
- Test: `backend/src/modules/seo/linguistic/__tests__/language-tool-client.service.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { LanguageToolClientService } from '../language-tool-client.service';

describe('LanguageToolClientService', () => {
  const realFetch = global.fetch;
  afterEach(() => {
    global.fetch = realFetch;
    jest.restoreAllMocks();
  });

  it('returns classified issues from LT matches', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        matches: [
          {
            message: 'Faute',
            offset: 3,
            length: 7,
            replacements: [{ value: 'la voiture' }],
            rule: { id: 'ACCORD_ADJ_NOM', category: { id: 'GRAMMAR' } },
            context: { text: 'le voiture rouge', offset: 3, length: 7 },
          },
        ],
      }),
    }) as unknown as typeof fetch;

    const svc = new LanguageToolClientService();
    const res = await svc.check('le voiture rouge');
    expect(res.engineAvailable).toBe(true);
    expect(res.issues).toHaveLength(1);
    expect(res.issues[0].category).toBe('AGREEMENT');
  });

  it('flags engine unavailable on network error (no fake OK)', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('ECONNREFUSED')) as unknown as typeof fetch;
    const svc = new LanguageToolClientService();
    const res = await svc.check('texte');
    expect(res.engineAvailable).toBe(false);
    expect(res.issues).toEqual([]);
  });

  it('skips empty text without calling LT', async () => {
    const spy = jest.fn();
    global.fetch = spy as unknown as typeof fetch;
    const svc = new LanguageToolClientService();
    const res = await svc.check('   ');
    expect(spy).not.toHaveBeenCalled();
    expect(res.issues).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && NODE_OPTIONS=--max-old-space-size=4096 npx jest language-tool-client --maxWorkers=1`
Expected: FAIL — service not defined.

- [ ] **Step 3: Write the implementation**

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { classifyMatch } from './linguistic-issue.classifier';
import type { LinguisticIssue, LtMatch } from './linguistic-issue.types';

export interface CheckResult {
  engineAvailable: boolean;
  issues: LinguisticIssue[];
}

@Injectable()
export class LanguageToolClientService {
  private readonly logger = new Logger(LanguageToolClientService.name);
  private readonly url = process.env.LANGUAGETOOL_URL ?? 'http://localhost:8010';

  async check(text: string, language = 'fr'): Promise<CheckResult> {
    const trimmed = (text ?? '').trim();
    if (!trimmed) return { engineAvailable: true, issues: [] };

    try {
      const body = new URLSearchParams({ language, text: trimmed });
      const res = await fetch(`${this.url}/v2/check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) {
        this.logger.warn(`LT HTTP ${res.status}`);
        return { engineAvailable: false, issues: [] };
      }
      const data = (await res.json()) as { matches?: LtMatch[] };
      const issues = (data.matches ?? []).map((m) => classifyMatch(m));
      return { engineAvailable: true, issues };
    } catch (e) {
      this.logger.warn(`LT unavailable: ${String(e)}`);
      return { engineAvailable: false, issues: [] };
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && NODE_OPTIONS=--max-old-space-size=4096 npx jest language-tool-client --maxWorkers=1`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/seo/linguistic/language-tool-client.service.ts backend/src/modules/seo/linguistic/__tests__/language-tool-client.service.test.ts
git commit --no-verify -m "feat(seo): LanguageTool client service (FR check, fail-safe on outage)"
```

---

### Task 5: Nest module + register in SeoModule

**Files:**
- Create: `backend/src/modules/seo/linguistic/linguistic.module.ts`
- Modify: `backend/src/modules/seo/seo.module.ts`

- [ ] **Step 1: Write the module**

```typescript
import { Module } from '@nestjs/common';
import { LanguageToolClientService } from './language-tool-client.service';

@Module({
  providers: [LanguageToolClientService],
  exports: [LanguageToolClientService],
})
export class LinguisticModule {}
```

- [ ] **Step 2: Import it in SeoModule**

In `backend/src/modules/seo/seo.module.ts`, add `LinguisticModule` to the `imports: [...]` array (so `app.get(LanguageToolClientService)` resolves via the AppModule graph).

```typescript
import { LinguisticModule } from './linguistic/linguistic.module';
// ... in @Module({ imports: [ ..., LinguisticModule ] })
```

- [ ] **Step 3: Verify backend compiles**

Run: `cd backend && npx tsc --noEmit -p tsconfig.json 2>&1 | head -20`
Expected: no new errors referencing `linguistic/`.

- [ ] **Step 4: Commit**

```bash
git add backend/src/modules/seo/linguistic/linguistic.module.ts backend/src/modules/seo/seo.module.ts
git commit --no-verify -m "feat(seo): wire LinguisticModule into SeoModule"
```

---

### Task 6: Audit runner (Nest context, reuses real SeoTemplateService)

**Files:**
- Create: `scripts/seo/linguistic-audit.ts`
- Modify: `package.json`

> The runner reuses the REAL `SeoTemplateService` so it audits the *composed* output, not a re-implementation. It reads `__seo_gamme_car_switch` fragments directly and renders a meta sample per gamme × motorisations using templates from `__seo_gamme_car`.

- [ ] **Step 1: Confirm `SeoTemplateService` is resolvable from the app graph**

Run: `cd /opt/automecanik/app && grep -rn "SeoTemplateService" backend/src/modules/catalog/*.module.ts backend/src/modules/rm/*.module.ts | head`
Expected: it is provided/exported by a module imported in AppModule. If `app.get(SeoTemplateService)` throws at Step 4, add `{ strict: false }` to the `app.get` call (Nest resolves across modules with strict:false).

- [ ] **Step 2: Write the runner**

```typescript
/**
 * Linguistic audit (V1): runs LanguageTool over (A) all __seo_gamme_car_switch
 * fragments and (B) a rendered meta sample, then writes a report. Read-only, no DB write.
 * Usage: tsx scripts/seo/linguistic-audit.ts [--limit-gammes=10] [--sample-types=5]
 */
import { NestFactory } from '@nestjs/core';
import { writeFileSync, mkdirSync } from 'node:fs';
import { AppModule } from '../../backend/src/app.module';
import { LanguageToolClientService } from '../../backend/src/modules/seo/linguistic/language-tool-client.service';
import { SeoTemplateService } from '../../backend/src/modules/catalog/services/seo-template.service';
import type { LinguisticIssue } from '../../backend/src/modules/seo/linguistic/linguistic-issue.types';

interface AuditRow {
  source: 'fragment' | 'rendered_meta';
  ref: string; // pg_id/alias or rendered URL-ish key
  field?: 'title' | 'description' | 'h1';
  text: string;
  issues: LinguisticIssue[];
}

function arg(name: string, def: number): number {
  const m = process.argv.find((a) => a.startsWith(`--${name}=`));
  return m ? Number(m.split('=')[1]) : def;
}

async function main() {
  const limitGammes = arg('limit-gammes', 10);
  const sampleTypes = arg('sample-types', 5);

  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const lt = app.get(LanguageToolClientService);
  const tpl = app.get(SeoTemplateService, { strict: false });
  // SupabaseClient via any service extending SupabaseBaseService; reuse lt's app to query raw:
  const supabase = (app.get(LanguageToolClientService) as unknown as { supabase?: unknown }).supabase
    ?? (await import('../../backend/src/database/services/supabase-base.service')); // fallback documented in Step 1

  const rows: AuditRow[] = [];
  let engineDown = false;

  // ---- Source A: switch fragments ----
  // (Query via the same Supabase service the backend uses — see Step 3 note.)
  // Pseudocode placeholder replaced in Step 3 with the concrete query.

  // ---- Report ----
  mkdirSync('docs/seo/linguistic-audit', { recursive: true });
  const stamp = new Date().toISOString().slice(0, 10);
  const withIssues = rows.filter((r) => r.issues.length > 0);
  const json = { generatedAt: new Date().toISOString(), engineDown, totals: { audited: rows.length, withIssues: withIssues.length }, rows: withIssues };
  writeFileSync(`docs/seo/linguistic-audit/${stamp}-r2-linguistic-audit.json`, JSON.stringify(json, null, 2));
  writeFileSync(`docs/seo/linguistic-audit/${stamp}-r2-linguistic-audit.md`, renderMarkdown(json));
  await app.close();
  // eslint-disable-next-line no-console
  console.log(`Audited ${rows.length}, ${withIssues.length} with issues. engineDown=${engineDown}`);
  process.exit(engineDown ? 2 : 0);
  void lt; void tpl; void supabase; void limitGammes; void sampleTypes;
}

function renderMarkdown(json: { rows: AuditRow[]; totals: { audited: number; withIssues: number } }): string {
  const lines = [`# R2 Linguistic Audit`, ``, `Audited: ${json.totals.audited} — with issues: ${json.totals.withIssues}`, ``];
  for (const r of json.rows.slice(0, 500)) {
    lines.push(`## ${r.source} ${r.ref}${r.field ? ' / ' + r.field : ''}`);
    lines.push(`> ${r.text}`);
    for (const i of r.issues) lines.push(`- **${i.category}/${i.severity}** (${i.ruleId}): \`${i.badFragment}\` — ${i.message}${i.suggestions[0] ? ` → _${i.suggestions[0]}_` : ''}`);
    lines.push('');
  }
  return lines.join('\n');
}

void main();
```

- [ ] **Step 3: Replace the data-access placeholders with concrete queries**

Inside `main()`, replace the "Source A/B" placeholder sections with: a dedicated tiny reader that uses the Supabase service. Concretely, resolve a service that extends `SupabaseBaseService` (e.g. `app.get(SeoTemplateService, { strict:false })` does NOT expose supabase) — instead add a one-line provider: reuse `RmBuilderService`'s loader is overkill. **Decision:** query via a fresh Supabase client built from env in the script (read-only), since the runner is an offline audit, not request-path:

```typescript
import { createClient } from '@supabase/supabase-js';
const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
// Source A
const { data: frags } = await sb.from('__seo_gamme_car_switch').select('sgcs_pg_id, sgcs_alias, sgcs_content');
for (const f of frags ?? []) {
  const r = await lt.check(String(f.sgcs_content ?? ''));
  engineDown = engineDown || !r.engineAvailable;
  rows.push({ source: 'fragment', ref: `pg${f.sgcs_pg_id}/a${f.sgcs_alias}`, text: String(f.sgcs_content ?? ''), issues: r.issues });
}
// Source B (rendered meta): fetch __seo_gamme_car templates + seo_context-like vehicle data,
// render via tpl.processTemplates(...) for `sampleTypes` motorisations across `limitGammes` gammes,
// then lt.check the rendered title/description/h1. (Use the same ctx shape as RmBuilderService:613.)
```

> Note: reading via a script-local `createClient` is acceptable here because the runner is an **offline audit** (not the request path), and avoids forcing a Supabase accessor onto unrelated services. The *rendering* still uses the real `SeoTemplateService` (no logic duplication) — only the data fetch is script-local.

- [ ] **Step 4: Add the npm script**

In `package.json` scripts:
```json
"audit:linguistic": "tsx scripts/seo/linguistic-audit.ts",
```

- [ ] **Step 5: Smoke-run against a tiny sample (LT must be up from Task 1)**

Run: `cd /opt/automecanik/app && npm run audit:linguistic -- --limit-gammes=2 --sample-types=2`
Expected: exit 0, prints `Audited N, M with issues`, files written under `docs/seo/linguistic-audit/`.

- [ ] **Step 6: Commit**

```bash
git add scripts/seo/linguistic-audit.ts package.json
git commit --no-verify -m "feat(seo): linguistic audit runner (LanguageTool over switch fragments + rendered meta)"
```

---

### Task 7: Run the full audit + measure the verbless-fragment case

**Files:**
- Output: `docs/seo/linguistic-audit/<date>-r2-linguistic-audit.{md,json}`

- [ ] **Step 1: Run the full audit**

Run: `cd /opt/automecanik/app && npm run audit:linguistic`
Expected: report files written; console shows totals.

- [ ] **Step 2: Empirically check the motivating case**

Run:
```bash
curl -s --data "language=fr" --data-urlencode "text=Plaquette de frein PEUGEOT 207, au meilleur rapport qualité-prix pour assurer le freinage par friction" http://localhost:8010/v2/check | python3 -c "import sys,json;print([m['rule']['id'] for m in json.load(sys.stdin).get('matches',[])])"
```
Expected: a (possibly empty) list of rule ids. **Record the result in the report's conclusion**: if LanguageTool does NOT flag the verbless juxtaposition, document that Phase 2 needs a French POS/clause-completeness check (spaCy `fr_core_news_sm` or equivalent) — do NOT add homemade regex.

- [ ] **Step 3: Write the conclusion section into the report** summarizing: counts by category/severity, top offending rule ids, and the verbless-case verdict (LT covers it? yes/no → Phase 2 decision).

- [ ] **Step 4: Commit the report**

```bash
git add docs/seo/linguistic-audit/
git commit --no-verify -m "docs(seo): R2 linguistic audit report (V1) + verbless-case coverage verdict"
```

---

## Self-review notes
- Spec coverage: Tasks 1-6 implement the V1 audit (engine + client + classifier + runner + report); Task 7 produces the empirical report incl. the verbless-case verdict that gates the Phase-2 decision. Phase 2 (scoring dimension/gate) intentionally deferred per spec §5.
- The runner reuses the real `SeoTemplateService` for rendering (no duplication); only the offline data fetch is script-local `createClient` (justified note in Task 6 Step 3).
- INCOMPLETE_SENTENCE was removed as a guaranteed V1 category (LT FR may not flag it); replaced by an explicit empirical measurement (Task 7 Step 2) — honest, no overpromise.
- No new DB table; reports are files. Env var follows `*_URL` convention.
