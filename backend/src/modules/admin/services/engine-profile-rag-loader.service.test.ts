/**
 * Unit tests for EngineProfileRagLoader.
 *
 * Uses Jest's module-level mock of `node:fs` to feed the loader controlled
 * file contents (mapping YAML + gamme frontmatter), so the tests don't depend
 * on the actual /opt/automecanik/rag/knowledge tree.
 */

// Must mock before importing the service under test.
jest.mock('node:fs', () => {
  const real = jest.requireActual('node:fs');
  return {
    ...real,
    existsSync: jest.fn(),
    readFileSync: jest.fn(),
  };
});

import { existsSync, readFileSync } from 'node:fs';
import { EngineProfileRagLoader } from './engine-profile-rag-loader.service';
import type { EngineProfileKey } from '../../../config/engine-profile.config';

const mockExistsSync = existsSync as jest.MockedFunction<typeof existsSync>;
const mockReadFileSync = readFileSync as jest.MockedFunction<
  typeof readFileSync
>;

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────────────────────

const MAPPING_YAML = `
schema_version: 1
updated_at: '2026-04-24'
profiles:
  diesel_p3_moyenne:
    description: >
      Diesel common rail seconde génération, turbo à géométrie variable (VGT),
      FAP + gestion électronique EDC.
    gammes:
      - vanne-egr
      - fap
      - turbo
  essence_p2_basse:
    description: Moteur essence 4 cylindres injection séquentielle.
    gammes:
      - bougie-d-allumage
      - capteur-vilebrequin
  inconnu_p3_moyenne:
    description: Motorisation spécifique — voir docs constructeur.
    gammes:
      - alternateur
      - thermostat
seo_openers:
  - "Problèmes techniques récurrents de {type} {power} ch {fuel}."
  - "Faiblesses connues de la {brand} {model} ({power} ch)."
`;

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
      severity: confort
---
# content
`;

const GAMME_FAP = `---
title: FAP
slug: fap
domain:
  role: Filtrer les particules fines issues de la combustion diesel.
diagnostic:
  symptoms:
    - id: S1
      label: Voyant FAP allumé sur le tableau de bord
      severity: confort
    - id: S2
      label: Passage en mode dégradé
      severity: confort
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
---
# content
`;

const GAMME_BOUGIE = `---
title: Bougie d'allumage
slug: bougie-d-allumage
domain:
  role: Allumer le mélange air-carburant dans la chambre de combustion.
diagnostic:
  symptoms:
    - id: S1
      label: Démarrage difficile à froid
    - id: S2
      label: Ratés moteur cylindre
---
`;

const GAMME_CAPTEUR_VILEBREQUIN = `---
title: Capteur de vilebrequin
slug: capteur-vilebrequin
domain:
  role: Mesurer la position du vilebrequin pour synchroniser l'injection.
diagnostic:
  symptoms:
    - id: S1
      label: Calages intempestifs
    - id: S2
      label: Refus de démarrer à chaud
---
`;

const GAMME_ALTERNATEUR = `---
title: Alternateur
slug: alternateur
domain:
  role: Produire l'électricité embarquée.
diagnostic:
  symptoms:
    - id: S1
      label: Voyant batterie allumé moteur tournant
---
`;

const GAMME_THERMOSTAT = `---
title: Thermostat
slug: thermostat
domain:
  role: Réguler la température du liquide de refroidissement.
diagnostic:
  symptoms:
    - id: S1
      label: Moteur monte trop vite en température
---
`;

const GAMME_NO_SYMPTOMS = `---
title: Partie mystérieuse
slug: mystery
domain:
  role: Faire quelque chose d'utile.
---
`;

const FIXTURES: Record<string, string> = {
  '/opt/automecanik/rag/knowledge/seo/engine-profile-mapping.yaml':
    MAPPING_YAML,
  '/opt/automecanik/rag/knowledge/gammes/vanne-egr.md': GAMME_VANNE_EGR,
  '/opt/automecanik/rag/knowledge/gammes/fap.md': GAMME_FAP,
  '/opt/automecanik/rag/knowledge/gammes/turbo.md': GAMME_TURBO,
  '/opt/automecanik/rag/knowledge/gammes/bougie-d-allumage.md': GAMME_BOUGIE,
  '/opt/automecanik/rag/knowledge/gammes/capteur-vilebrequin.md':
    GAMME_CAPTEUR_VILEBREQUIN,
  '/opt/automecanik/rag/knowledge/gammes/alternateur.md': GAMME_ALTERNATEUR,
  '/opt/automecanik/rag/knowledge/gammes/thermostat.md': GAMME_THERMOSTAT,
};

function installFixture(overrides: Record<string, string | null> = {}): void {
  const effective = { ...FIXTURES, ...overrides };
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

describe('EngineProfileRagLoader', () => {
  let loader: EngineProfileRagLoader;

  beforeEach(() => {
    jest.clearAllMocks();
    installFixture();
    loader = new EngineProfileRagLoader();
  });

  describe('getIssues', () => {
    it('returns RAG-sourced issues for a mapped diesel profile', () => {
      const issues = loader.getIssues('diesel_p3_moyenne');
      expect(issues).toEqual([
        "Vanne EGR : Perte de puissance à bas régime, Fumée noire à l'accélération",
        'FAP : Voyant FAP allumé sur le tableau de bord, Passage en mode dégradé',
        "Turbo : Fumée bleue excessive à l'échappement",
      ]);
    });

    it('includes gammes that have a single symptom only', () => {
      const issues = loader.getIssues('diesel_p3_moyenne');
      const turboLine = issues.find((i) => i.startsWith('Turbo'));
      expect(turboLine).toBeDefined();
      expect(turboLine).toContain('Fumée bleue');
    });

    it('cascades ethanol → essence on same tier', () => {
      const ethanolIssues = loader.getIssues(
        'ethanol_p2_basse' as EngineProfileKey,
      );
      const essenceIssues = loader.getIssues('essence_p2_basse');
      expect(ethanolIssues).toEqual(essenceIssues);
    });

    it('cascades gpl → essence on same tier', () => {
      const gplIssues = loader.getIssues('gpl_p2_basse' as EngineProfileKey);
      const essenceIssues = loader.getIssues('essence_p2_basse');
      expect(gplIssues).toEqual(essenceIssues);
    });

    it('cascades hybride_essence → essence on same tier', () => {
      const hybridIssues = loader.getIssues(
        'hybride_essence_p2_basse' as EngineProfileKey,
      );
      const essenceIssues = loader.getIssues('essence_p2_basse');
      expect(hybridIssues).toEqual(essenceIssues);
    });

    it('falls back to inconnu_p3_moyenne when cascade yields no match', () => {
      const issues = loader.getIssues('inconnu_p1_mini' as EngineProfileKey);
      expect(issues.length).toBeGreaterThan(0);
      expect(issues.some((i) => i.startsWith('Alternateur'))).toBe(true);
    });

    it('returns hardcoded FALLBACK_ISSUES when mapping YAML is missing', () => {
      installFixture({
        '/opt/automecanik/rag/knowledge/seo/engine-profile-mapping.yaml': null,
      });
      loader.clearCache();
      const issues = loader.getIssues('diesel_p3_moyenne');
      expect(issues.length).toBeGreaterThan(0);
      // Fallback text mentions generic items like "batterie" or "plaquettes"
      expect(
        issues.some(
          (i) =>
            i.toLowerCase().includes('batterie') ||
            i.toLowerCase().includes('plaquette'),
        ),
      ).toBe(true);
    });

    it('skips gammes missing on disk but still returns the rest', () => {
      installFixture({
        '/opt/automecanik/rag/knowledge/gammes/fap.md': null, // FAP missing
      });
      loader.clearCache();
      const issues = loader.getIssues('diesel_p3_moyenne');
      expect(issues.some((i) => i.startsWith('Vanne EGR'))).toBe(true);
      expect(issues.some((i) => i.startsWith('FAP'))).toBe(false);
      expect(issues.some((i) => i.startsWith('Turbo'))).toBe(true);
    });

    it('falls back to domain.role phrasing when gamme has no symptoms', () => {
      installFixture({
        '/opt/automecanik/rag/knowledge/gammes/fap.md': GAMME_NO_SYMPTOMS,
      });
      loader.clearCache();
      const issues = loader.getIssues('diesel_p3_moyenne');
      const mystery = issues.find((i) => i.includes('mystérieuse'));
      expect(mystery).toBeDefined();
      expect(mystery).toContain("à vérifier lors de l'entretien");
    });

    it('sibling profiles have distinct vocabulary (Jaccard < 0.60)', () => {
      const dieselIssues = loader.getIssues('diesel_p3_moyenne');
      const essenceIssues = loader.getIssues('essence_p2_basse');
      const words = (arr: string[]) =>
        new Set(
          arr
            .join(' ')
            .toLowerCase()
            .normalize('NFD')
            .replace(/[̀-ͯ]/g, '')
            .split(/\W+/)
            .filter((w) => w.length >= 4),
        );
      const a = words(dieselIssues);
      const b = words(essenceIssues);
      const inter = new Set([...a].filter((w) => b.has(w)));
      const union = new Set([...a, ...b]);
      const jaccard = inter.size / union.size;
      expect(jaccard).toBeLessThan(0.6);
    });
  });

  describe('getDescription', () => {
    it('returns the RAG description for a mapped profile', () => {
      const desc = loader.getDescription('diesel_p3_moyenne');
      expect(desc).toContain('common rail seconde génération');
    });

    it('cascades same way as getIssues', () => {
      const ethanolDesc = loader.getDescription(
        'ethanol_p2_basse' as EngineProfileKey,
      );
      const essenceDesc = loader.getDescription('essence_p2_basse');
      expect(ethanolDesc).toBe(essenceDesc);
    });

    it('falls back when mapping is missing', () => {
      installFixture({
        '/opt/automecanik/rag/knowledge/seo/engine-profile-mapping.yaml': null,
      });
      loader.clearCache();
      const desc = loader.getDescription('diesel_p3_moyenne');
      expect(typeof desc).toBe('string');
      expect(desc.length).toBeGreaterThan(10);
    });
  });

  describe('getSeoOpeners', () => {
    it('returns RAG openers when mapping provides them', () => {
      const openers = loader.getSeoOpeners();
      expect(openers.length).toBeGreaterThanOrEqual(2);
      expect(openers[0]).toContain('{type}');
    });

    it('falls back when mapping YAML is missing', () => {
      installFixture({
        '/opt/automecanik/rag/knowledge/seo/engine-profile-mapping.yaml': null,
      });
      loader.clearCache();
      const openers = loader.getSeoOpeners();
      expect(openers.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('cache', () => {
    it('loads the mapping only once across multiple getIssues calls', () => {
      loader.getIssues('diesel_p3_moyenne');
      loader.getIssues('essence_p2_basse');
      loader.getIssues('diesel_p3_moyenne');
      // Mapping YAML reads : once. Gammes : 3 (EGR, FAP, turbo) + 2 (bougie, capteur) = 5.
      const mappingCalls = mockReadFileSync.mock.calls.filter((c) =>
        String(c[0]).endsWith('engine-profile-mapping.yaml'),
      );
      expect(mappingCalls.length).toBe(1);
    });

    it('reloads after clearCache()', () => {
      loader.getIssues('diesel_p3_moyenne');
      loader.clearCache();
      loader.getIssues('diesel_p3_moyenne');
      const mappingCalls = mockReadFileSync.mock.calls.filter((c) =>
        String(c[0]).endsWith('engine-profile-mapping.yaml'),
      );
      expect(mappingCalls.length).toBe(2);
    });
  });
});
