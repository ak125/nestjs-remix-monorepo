/**
 * DiagnosticContentService Unit Tests
 *
 * Vérifie lecture frontmatter YAML via gray-matter, cache LRU 5 min,
 * graceful degradation si fichier absent.
 *
 * Convention : Jest + mocks node:fs (pas de I/O réel).
 *
 * @see backend/src/modules/diagnostic-engine/services/diagnostic-content.service.ts
 * @see governance-vault/ledger/decisions/adr/ADR-032-diagnostic-maintenance-unification.md
 */
import { DiagnosticContentService } from '../../src/modules/diagnostic-engine/services/diagnostic-content.service';
import * as fs from 'node:fs';

jest.mock('node:fs');

describe('DiagnosticContentService (ADR-032 PR-6)', () => {
  let service: DiagnosticContentService;
  const mockExistsSync = fs.existsSync as jest.MockedFunction<
    typeof fs.existsSync
  >;
  const mockReadFileSync = fs.readFileSync as jest.MockedFunction<
    typeof fs.readFileSync
  >;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new DiagnosticContentService();
  });

  describe('read()', () => {
    it('parses frontmatter and returns entry when file exists', () => {
      const sampleMd = `---
schema_version: 1.0.0
slug: wizard-steps
title: Wizard test
entity_data:
  steps:
    - id: 1
      label: Step 1
---

# Body content
`;
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(sampleMd);

      const result = service.read('diagnostic', 'wizard-steps');

      expect(result).not.toBeNull();
      expect(result?.slug).toBe('wizard-steps');
      expect(result?.title).toBe('Wizard test');
      expect(result?.entity_data).toEqual({ steps: [{ id: 1, label: 'Step 1' }] });
      expect(result?.body).toContain('# Body content');
    });

    it('returns null when file is absent (graceful degradation)', () => {
      mockExistsSync.mockReturnValue(false);

      const result = service.read('diagnostic', 'missing-slug');

      expect(result).toBeNull();
      expect(mockReadFileSync).not.toHaveBeenCalled();
    });

    it('returns null and logs error when frontmatter is malformed', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockImplementation(() => {
        throw new Error('parse boom');
      });

      const result = service.read('diagnostic', 'broken');

      expect(result).toBeNull();
    });

    it('uses LRU cache (2nd read does not touch fs)', () => {
      const sampleMd = `---
slug: faq
title: Cached FAQ
entity_data:
  faq: []
---
body
`;
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(sampleMd);

      service.read('diagnostic', 'faq');
      service.read('diagnostic', 'faq');

      expect(mockReadFileSync).toHaveBeenCalledTimes(1);
    });
  });

  describe('shortcuts', () => {
    it('exposes 5 diagnostic shortcuts + 1 support shortcut', () => {
      mockExistsSync.mockReturnValue(false);

      // Smoke : tous les helpers callables sans crash, retournent null
      expect(service.getWizardSteps()).toBeNull();
      expect(service.getSafetyConfig()).toBeNull();
      expect(service.getVocabClusters()).toBeNull();
      expect(service.getSigns()).toBeNull();
      expect(service.getFaq()).toBeNull();
      expect(service.getControlesMensuels()).toBeNull();
    });
  });
});
