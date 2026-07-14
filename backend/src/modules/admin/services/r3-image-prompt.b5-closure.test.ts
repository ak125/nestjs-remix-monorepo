import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

/**
 * B5 (ADR-059 §Fermeture RAG) — column-level regression test for R3 image prompts.
 *
 * B5 removes the RAG prompt-GENERATION surface but the SAME table `__seo_r3_image_prompts`
 * holds both generated content and human curation state. A table-level "no writes" check is
 * therefore too coarse — curation writes MUST stay. These assertions are COLUMN-LEVEL:
 *   - no app code writes a GENERATED column to the table (0 insert/upsert; every update
 *     payload ⊆ the curation allowlist);
 *   - no app code can reset an APPROVED image (never writes rip_status='pending' nor
 *     rip_selected in an update payload on THIS table);
 *   - the generation surface + RAG reads are gone from the service and controller.
 * Scope is the literal table name '__seo_r3_image_prompts' — the R1 reset writers
 * (rip_status='pending' / rip_selected=false) target '__seo_r1_image_prompts' (B4) and
 * must not be caught here.
 */

const BACKEND_ROOT = join(__dirname, '..', '..', '..', '..'); // backend/
const SRC = join(BACKEND_ROOT, 'src');
const R3_TABLE = '__seo_r3_image_prompts';

const SERVICE = join(SRC, 'modules/admin/services/r3-image-prompt.service.ts');
const CONTROLLER = join(
  SRC,
  'modules/admin/controllers/admin-r3-image-prompts.controller.ts',
);

// Columns produced by the (now-removed) RAG generation — must never be written by app code.
const GENERATED_COLUMNS = [
  'rip_prompt_text',
  'rip_alt_text',
  'rip_neg_prompt',
  'rip_caption',
  'rip_rag_fields_used',
  'rip_rag_richness_score',
  'rip_topic',
  'rip_section_id',
  'rip_aspect_ratio',
  'rip_min_width',
  'rip_budget_cost',
  'rip_priority_rank',
  'rip_gamme_name',
  'rip_selected', // selection was algorithmic in generation — no curation writer sets it
];
// The only columns a curation writer may set on this table.
const CURATION_WRITE_ALLOW = new Set(['rip_image_url', 'rip_status']);

/** All backend/src files that reference the R3 table, excluding generated DB types. */
function r3Files(): string[] {
  const out = execFileSync('grep', ['-rl', R3_TABLE, SRC], {
    encoding: 'utf-8',
  })
    .trim()
    .split('\n')
    .filter(
      (f) =>
        f &&
        !f.endsWith('database.types.ts') &&
        !f.endsWith(__filename.split('/').pop()!),
    );
  return out;
}

/** Extract each `.from('<R3_TABLE>')` fluent chain as a bounded window. */
function chains(src: string): string[] {
  const marker = `.from('${R3_TABLE}')`;
  const res: string[] = [];
  let i = src.indexOf(marker);
  while (i !== -1) {
    const next = src.indexOf(marker, i + marker.length);
    const end = next === -1 ? Math.min(i + 700, src.length) : next;
    res.push(src.slice(i, end));
    i = next;
  }
  return res;
}

describe('B5 — R3 image-prompt generation removed, curation preserved', () => {
  it('the service and controller still exist (surgical strip, not a full delete)', () => {
    expect(existsSync(SERVICE)).toBe(true);
    expect(existsSync(CONTROLLER)).toBe(true);
  });

  it('NO insert/upsert to __seo_r3_image_prompts anywhere in backend/src', () => {
    for (const f of r3Files()) {
      for (const chain of chains(readFileSync(f, 'utf-8'))) {
        expect(chain).not.toMatch(/\.insert\s*\(/);
        expect(chain).not.toMatch(/\.upsert\s*\(/);
      }
    }
  });

  it('every .update() on the table writes ONLY curation columns (no generated column)', () => {
    for (const f of r3Files()) {
      const src = readFileSync(f, 'utf-8');
      for (const chain of chains(src)) {
        const upd = chain.match(/\.update\(\s*\{([\s\S]*?)\}/);
        if (!upd) continue;
        const keys = [...upd[1].matchAll(/(\w+)\s*:/g)].map((m) => m[1]);
        for (const k of keys) {
          expect(CURATION_WRITE_ALLOW.has(k)).toBe(true); // fails loudly with the offending key
        }
        // explicit: no generated column key ever appears in an update payload
        for (const g of GENERATED_COLUMNS) {
          expect(keys).not.toContain(g);
        }
      }
    }
  });

  it('an approved image cannot be reset: no update sets rip_status=pending or writes rip_selected', () => {
    for (const f of r3Files()) {
      const src = readFileSync(f, 'utf-8');
      for (const chain of chains(src)) {
        const upd = chain.match(/\.update\(\s*\{([\s\S]*?)\}/);
        if (!upd) continue;
        const payload = upd[1];
        // never downgrade status to pending
        expect(payload).not.toMatch(/rip_status\s*:\s*['"]pending['"]/);
        // never write the selection flag as a payload key (reads via .eq() are fine)
        expect(payload).not.toMatch(/rip_selected\s*:/);
      }
    }
  });

  it('the RAG generation surface is gone from the service (0 symbols)', () => {
    const src = readFileSync(SERVICE, 'utf-8');
    for (const sym of [
      'RAG_KNOWLEDGE_PATH',
      'RAG_GAMMES_DIR',
      'generateForGamme',
      'generateBatch',
      'readRagFromDisk',
      'parseRagData',
      'buildPromptRow',
      'buildHeroPrompt',
      'computeSlotRichnessScores',
      'selectInArticleSlots',
      'EnricherYamlParser',
      'NEGATIVE_PROMPT',
    ]) {
      expect(src).not.toContain(sym);
    }
    expect(src).not.toMatch(/\.upsert\s*\(/);
    // curation methods preserved
    for (const m of [
      'approvePrompt',
      'setImageUrl',
      'listPrompts',
      'exportCsv',
      'exportJson',
    ]) {
      expect(src).toContain(m);
    }
  });

  it('the generation endpoints are gone from the controller (no @Post / generate handler)', () => {
    const src = readFileSync(CONTROLLER, 'utf-8');
    expect(src).not.toMatch(/@Post\s*\(/);
    expect(src).not.toContain('generateBatch');
    expect(src).not.toContain('generateSingle');
    // curation endpoints preserved
    expect(src).toContain('approvePrompt');
    expect(src).toContain('setImageUrl');
  });

  it('scoping guard: the R1 reset writers target the R1 table, not the R3 table', () => {
    const r1 = join(SRC, 'modules/admin/services/r1-image-prompt.service.ts');
    if (!existsSync(r1)) return; // R1/B4 is a separate tranche; skip if absent
    const src = readFileSync(r1, 'utf-8');
    if (/rip_selected\s*:\s*false/.test(src)) {
      // if R1 resets selection, it must be on the R1 table (proving our R3 scope is correct)
      expect(src).toContain('__seo_r1_image_prompts');
    }
  });
});
