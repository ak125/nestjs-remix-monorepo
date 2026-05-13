/**
 * Garde-fous architecturaux PR-6b vérifiés par analyse statique des fichiers.
 *
 * Cohérence avec ADR-059 :
 *  - REFRESH MV uniquement dans refresh processor (jamais dans write)
 *  - 2 queues totalement découplées (pas de fan-in)
 *  - Aucun write-back wiki dans le module backend
 *  - Aucun replay logic (= PR-6c)
 *  - Aucun RPC public (= PR-7)
 *  - Aucun import LLM
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const MODULE_DIR = join(__dirname, '..');

function read(file: string): string {
  return readFileSync(join(MODULE_DIR, file), 'utf-8');
}

describe('PR-6b architectural guards (static file analysis)', () => {
  describe('write processor', () => {
    const writeSrc = read('seo-projection-write.processor.ts');

    it('never references REFRESH MATERIALIZED VIEW (must be in refresh processor)', () => {
      // Doit NE PAS appeler REFRESH dans le write processor.
      // Strings dans commentaires/docstrings autorisées.
      const codeOnly = writeSrc
        .split('\n')
        .filter((line) => !line.trim().startsWith('*') && !line.trim().startsWith('//'))
        .join('\n');
      expect(codeOnly).not.toMatch(/REFRESH\s+MATERIALIZED\s+VIEW/i);
      expect(codeOnly).not.toMatch(/refreshMaterializedView/);
    });

    it('enqueues refresh job AFTER COMMIT (after updateRunStatus success)', () => {
      // L'enqueue refresh doit apparaître après l'UPDATE status='success'.
      const updateIdx = writeSrc.indexOf("updateRunStatus(runId, 'success'");
      const enqueueIdx = writeSrc.indexOf('this.refreshQueue.add');
      expect(updateIdx).toBeGreaterThan(0);
      expect(enqueueIdx).toBeGreaterThan(updateIdx);
    });

    it('uses sha256 jobId for idempotency', () => {
      expect(writeSrc).toMatch(/createHash\(['"]sha256['"]\)/);
      expect(writeSrc).toMatch(/jobId/);
    });

    it('has READ_ONLY env gate at processor level', () => {
      expect(writeSrc).toMatch(/process\.env\.READ_ONLY/);
      expect(writeSrc).toMatch(/skipped_read_only/);
    });

    it('calls assertCompatibleProjectionContract', () => {
      expect(writeSrc).toMatch(/assertCompatibleProjectionContract\(/);
    });

    it('contains NO git/push/wiki write-back', () => {
      // Scan code-only (les docstrings d'interdiction sont autorisées).
      const codeOnly = writeSrc
        .split('\n')
        .filter((line) => !line.trim().startsWith('*') && !line.trim().startsWith('//'))
        .join('\n');
      expect(codeOnly).not.toMatch(/\bgit\s+push\b/);
      expect(codeOnly).not.toMatch(/\bspawn.*git/);
      expect(codeOnly).not.toMatch(/execSync.*wiki/);
      expect(codeOnly).not.toMatch(/automecanik-wiki/);
    });

    it('contains NO replay logic (= PR-6c)', () => {
      const codeOnly = writeSrc
        .split('\n')
        .filter((line) => !line.trim().startsWith('*') && !line.trim().startsWith('//'))
        .join('\n');
      expect(codeOnly).not.toMatch(/replay_projection\.py/);
      expect(codeOnly).not.toMatch(/tar\.zst/);
      // trigger_kind === 'replay' est OK (juste un enum value sur input job)
    });
  });

  describe('refresh processor', () => {
    const refreshSrc = read('seo-projection-refresh.processor.ts');

    it('never INSERT or UPDATE projection tables', () => {
      const codeOnly = refreshSrc
        .split('\n')
        .filter((line) => !line.trim().startsWith('*') && !line.trim().startsWith('//'))
        .join('\n');
      expect(codeOnly).not.toMatch(/\.insert\(/);
      expect(codeOnly).not.toMatch(/\.update\(/);
    });

    it('only mentions REFRESH ... CONCURRENTLY (never bare REFRESH)', () => {
      // Si REFRESH est présent, doit toujours être suivi de CONCURRENTLY
      const refreshOccurrences = refreshSrc.match(/REFRESH\s+MATERIALIZED\s+VIEW[^;]*/gi) ?? [];
      for (const occ of refreshOccurrences) {
        expect(occ).toMatch(/CONCURRENTLY/i);
      }
    });

    it('declares concurrency=1 (single-flight)', () => {
      expect(refreshSrc).toMatch(/concurrency:\s*REFRESH_CONCURRENCY/);
    });

    it('has READ_ONLY env gate', () => {
      expect(refreshSrc).toMatch(/process\.env\.READ_ONLY/);
      expect(refreshSrc).toMatch(/skipped_read_only/);
    });

    it('contains NO write-back wiki', () => {
      expect(refreshSrc).not.toMatch(/\bgit\s+push\b/);
      expect(refreshSrc).not.toMatch(/automecanik-wiki/);
    });
  });

  describe('module wiring', () => {
    const moduleSrc = read('seo-projection.module.ts');

    it('registers exactly 2 queues (write + refresh)', () => {
      const matches = moduleSrc.match(/\{\s*name:\s*SEO_PROJECTION_(WRITE|REFRESH)_QUEUE\s*\}/g) ?? [];
      expect(matches).toHaveLength(2);
    });

    it('exposes no controllers (= PR-7)', () => {
      expect(moduleSrc).not.toMatch(/controllers:/);
      expect(moduleSrc).not.toMatch(/@Controller/);
    });

    it('imports both processors', () => {
      expect(moduleSrc).toMatch(/SeoProjectionWriteProcessor/);
      expect(moduleSrc).toMatch(/SeoProjectionRefreshProcessor/);
    });
  });

  describe('no LLM imports in any PR-6b file', () => {
    const files = [
      'seo-projection.module.ts',
      'seo-projection-write.processor.ts',
      'seo-projection-refresh.processor.ts',
      'seo-projection-conflict.service.ts',
      'projection-contract.constants.ts',
      'dto/projection-job.dto.ts',
    ];
    const forbiddenImports = [
      "from 'anthropic'",
      "from '@anthropic-ai",
      "from 'openai'",
      "from 'groq-sdk'",
      "from 'cohere-ai'",
    ];
    it.each(files)('%s contains no LLM SDK import', (file) => {
      const src = read(file);
      for (const needle of forbiddenImports) {
        expect(src).not.toContain(needle);
      }
    });
  });

  describe('no public RPC declaration (= PR-7)', () => {
    const files = [
      'seo-projection.module.ts',
      'seo-projection-write.processor.ts',
      'seo-projection-refresh.processor.ts',
      'seo-projection-conflict.service.ts',
    ];
    it.each(files)('%s declares no @Controller / no @Get / no @Post', (file) => {
      const src = read(file);
      expect(src).not.toMatch(/@Controller\b/);
      expect(src).not.toMatch(/@Get\(/);
      expect(src).not.toMatch(/@Post\(/);
      expect(src).not.toMatch(/@Put\(/);
      expect(src).not.toMatch(/@Delete\(/);
    });
  });
});
