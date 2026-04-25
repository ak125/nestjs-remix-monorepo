/**
 * Unit tests for GammeSymptomReader.
 * `node:fs` is mocked at module level so the tests don't depend on the real
 * `/opt/automecanik/rag/knowledge/gammes/` tree.
 */
jest.mock('node:fs', () => {
  const real = jest.requireActual('node:fs');
  return {
    ...real,
    existsSync: jest.fn(),
    readFileSync: jest.fn(),
  };
});

import { existsSync, readFileSync } from 'node:fs';
import { GammeSymptomReader } from './gamme-symptom-reader.service';

const mockExistsSync = existsSync as jest.MockedFunction<typeof existsSync>;
const mockReadFileSync = readFileSync as jest.MockedFunction<
  typeof readFileSync
>;

const GAMME_VANNE_EGR = `---
title: Vanne EGR
slug: vanne-egr
domain:
  role: Recycler une partie des gaz d'échappement vers l'admission.
diagnostic:
  symptoms:
    - id: S1
      label: Perte de puissance à bas régime
      severity: confort
    - id: S2
      label: Fumée noire à l'accélération
      severity: confort
    - id: S3
      label: Voyant moteur allumé code P0401
---
# content
`;

const GAMME_TURBO = `---
title: Turbo
slug: turbo
domain:
  role: Suralimenter le moteur en air comprimé.
diagnostic:
  symptoms:
    - id: S1
      label: Fumée bleue excessive à l'échappement
    - id: S2
      label: Sifflement métallique du turbo
---
`;

const GAMME_BOUGIE = `---
title: Bougie d'allumage
slug: bougie-d-allumage
domain:
  role: Allumer le mélange air-carburant.
diagnostic:
  symptoms:
    - id: S1
      label: Démarrage difficile à froid
    - id: S2
      label: Ratés moteur cylindre
---
`;

const GAMME_NO_SYMPTOMS = `---
title: Pièce mystérieuse
slug: mystery
domain:
  role: Faire quelque chose d'utile.
---
`;

const GAMME_NO_FRONTMATTER = `# Just markdown content, no YAML.`;

const FIXTURES: Record<string, string | null> = {
  '/opt/automecanik/rag/knowledge/gammes/vanne-egr.md': GAMME_VANNE_EGR,
  '/opt/automecanik/rag/knowledge/gammes/turbo.md': GAMME_TURBO,
  '/opt/automecanik/rag/knowledge/gammes/bougie-d-allumage.md': GAMME_BOUGIE,
};

function installFixture(overrides: Record<string, string | null> = {}): void {
  const effective: Record<string, string | null> = {
    ...FIXTURES,
    ...overrides,
  };
  mockExistsSync.mockImplementation((p) => {
    const path = typeof p === 'string' ? p : p.toString();
    return effective[path] !== undefined && effective[path] !== null;
  });
  mockReadFileSync.mockImplementation((p) => {
    const path = typeof p === 'string' ? p : p.toString();
    const content = effective[path];
    if (content === undefined || content === null) {
      throw new Error(`ENOENT: no such file or directory, open '${path}'`);
    }
    return content;
  });
}

describe('GammeSymptomReader', () => {
  let reader: GammeSymptomReader;

  beforeEach(() => {
    jest.clearAllMocks();
    installFixture();
    reader = new GammeSymptomReader();
  });

  describe('compose', () => {
    it('returns one line per gamme with the first 2 symptom labels', () => {
      const lines = reader.compose(['vanne-egr', 'turbo', 'bougie-d-allumage']);
      expect(lines).toEqual([
        "Vanne EGR : Perte de puissance à bas régime, Fumée noire à l'accélération",
        "Turbo : Fumée bleue excessive à l'échappement, Sifflement métallique du turbo",
        "Bougie d'allumage : Démarrage difficile à froid, Ratés moteur cylindre",
      ]);
    });

    it('respects maxSymptomsPerGamme=1', () => {
      const lines = reader.compose(['vanne-egr'], 1);
      expect(lines).toEqual(['Vanne EGR : Perte de puissance à bas régime']);
    });

    it('silently skips slugs that have no .md file', () => {
      const lines = reader.compose(['vanne-egr', 'does-not-exist', 'turbo']);
      expect(lines).toHaveLength(2);
      expect(lines[0]).toContain('Vanne EGR');
      expect(lines[1]).toContain('Turbo');
    });

    it('falls back to domain.role when symptoms array is empty', () => {
      installFixture({
        '/opt/automecanik/rag/knowledge/gammes/mystery.md': GAMME_NO_SYMPTOMS,
      });
      reader.clearCache();
      const lines = reader.compose(['mystery']);
      expect(lines).toHaveLength(1);
      expect(lines[0]).toContain('Pièce mystérieuse');
      expect(lines[0]).toContain("à vérifier lors de l'entretien");
    });

    it('skips a gamme with no frontmatter and no symptoms', () => {
      installFixture({
        '/opt/automecanik/rag/knowledge/gammes/broken.md': GAMME_NO_FRONTMATTER,
      });
      reader.clearCache();
      const lines = reader.compose(['broken']);
      expect(lines).toEqual([]);
    });

    it('returns [] when all slugs are unknown', () => {
      const lines = reader.compose(['nope', 'also-nope']);
      expect(lines).toEqual([]);
    });

    it('preserves the input slug ordering', () => {
      const lines = reader.compose(['turbo', 'vanne-egr']);
      expect(lines[0]).toContain('Turbo');
      expect(lines[1]).toContain('Vanne EGR');
    });

    it('produces sibling-distinct output (Jaccard < 0.50)', () => {
      const dieselLines = reader.compose(['turbo', 'vanne-egr']);
      const essenceLines = reader.compose(['bougie-d-allumage']);
      const words = (lines: string[]) =>
        new Set(
          lines
            .join(' ')
            .toLowerCase()
            .normalize('NFD')
            .replace(/[̀-ͯ]/g, '')
            .split(/\W+/)
            .filter((w) => w.length >= 4),
        );
      const a = words(dieselLines);
      const b = words(essenceLines);
      const inter = new Set([...a].filter((w) => b.has(w)));
      const union = new Set([...a, ...b]);
      const jaccard = inter.size / union.size;
      expect(jaccard).toBeLessThan(0.5);
    });
  });

  describe('cache', () => {
    it('reads each gamme file only once across multiple compose calls', () => {
      reader.compose(['vanne-egr', 'turbo']);
      reader.compose(['vanne-egr', 'turbo', 'bougie-d-allumage']);
      const reads = mockReadFileSync.mock.calls.map((c) => String(c[0]));
      expect(reads.filter((r) => r.endsWith('vanne-egr.md'))).toHaveLength(1);
      expect(reads.filter((r) => r.endsWith('turbo.md'))).toHaveLength(1);
      expect(
        reads.filter((r) => r.endsWith('bougie-d-allumage.md')),
      ).toHaveLength(1);
    });

    it('reloads after clearCache()', () => {
      reader.compose(['vanne-egr']);
      reader.clearCache();
      reader.compose(['vanne-egr']);
      const reads = mockReadFileSync.mock.calls.map((c) => String(c[0]));
      expect(reads.filter((r) => r.endsWith('vanne-egr.md'))).toHaveLength(2);
    });

    it('does not re-attempt a missing gamme during the TTL window', () => {
      reader.compose(['nope']);
      reader.compose(['nope']);
      reader.compose(['nope']);
      // existsSync is the cheap check ; called repeatedly is fine.
      // What we want : readFileSync should never be called for a missing slug.
      const reads = mockReadFileSync.mock.calls.map((c) => String(c[0]));
      expect(reads.filter((r) => r.endsWith('nope.md'))).toHaveLength(0);
    });
  });
});
