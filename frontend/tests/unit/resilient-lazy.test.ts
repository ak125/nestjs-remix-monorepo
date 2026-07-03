/**
 * Tests unitaires — `safeLazy` / `loadSafeModule` / `isValidDefaultModule`
 * (`frontend/app/utils/resilient-lazy.ts`).
 *
 * Contexte : crash PROD `TypeError: Cannot read properties of undefined
 * (reading 'default')` dans le `lazyInitializer` de React.lazy — un `import()`
 * dynamique qui **résout avec `undefined`** (artefact Rolldown mixed-chunk), pas
 * un rejet. `safeLazy` valide la forme du module résolu et, sur résolution
 * invalide, ÉMET une balise d'observabilité puis JETTE (dégradation via
 * `LazyBoundary`) — SANS retry, SANS reload (décision red-team : reload d'un
 * artefact déterministe = boucle + perte d'état panier/formulaire sur la R2).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  isValidDefaultModule,
  loadSafeModule,
} from '~/utils/resilient-lazy';

// DI par mock de module : on espionne la balise sans toucher au vrai sendBeacon.
// `vi.hoisted` + `vi.mock` (auto-hoisté) → le spy est disponible dans la factory.
const { reportChunkResolvedInvalid } = vi.hoisted(() => ({
  reportChunkResolvedInvalid: vi.fn(),
}));
vi.mock('~/utils/runtime-errors.client', () => ({ reportChunkResolvedInvalid }));

function Dummy() {
  return null;
}

beforeEach(() => {
  reportChunkResolvedInvalid.mockClear();
});

describe('isValidDefaultModule', () => {
  it('accepts a module namespace with a usable default export', () => {
    expect(isValidDefaultModule({ default: Dummy })).toBe(true);
  });

  it('rejects undefined (the fulfill-with-undefined crash shape)', () => {
    expect(isValidDefaultModule(undefined)).toBe(false);
  });

  it('rejects null', () => {
    expect(isValidDefaultModule(null)).toBe(false);
  });

  it('rejects a non-object primitive', () => {
    expect(isValidDefaultModule(42)).toBe(false);
  });

  it('rejects an object whose default is undefined', () => {
    expect(isValidDefaultModule({ default: undefined })).toBe(false);
  });

  it('rejects an object with no default key', () => {
    expect(isValidDefaultModule({ Toaster: Dummy })).toBe(false);
  });
});

describe('loadSafeModule', () => {
  it('returns the module when the default export is valid (no beacon)', async () => {
    const mod = { default: Dummy };
    const out = await loadSafeModule(() => Promise.resolve(mod), {
      name: 'GlobalFooter',
    });
    expect(out).toBe(mod);
    expect(reportChunkResolvedInvalid).not.toHaveBeenCalled();
  });

  it('on fulfill-with-undefined: beacons resolved_undefined then throws', async () => {
    await expect(
      loadSafeModule(() => Promise.resolve(undefined), { name: 'GlobalFooter' }),
    ).rejects.toThrow(/\[safeLazy:GlobalFooter\]/);
    expect(reportChunkResolvedInvalid).toHaveBeenCalledTimes(1);
    expect(reportChunkResolvedInvalid).toHaveBeenCalledWith({
      name: 'GlobalFooter',
      stage: 'resolved_undefined',
    });
  });

  it('does NOT retry the factory on invalid resolution (called exactly once)', async () => {
    const factory = vi.fn(() => Promise.resolve(undefined));
    await expect(
      loadSafeModule(factory, { name: 'BottomNav' }),
    ).rejects.toThrow();
    expect(factory).toHaveBeenCalledTimes(1);
  });

  it('on a genuine rejection: beacons stage=rejected and re-throws the original error', async () => {
    const boom = new Error('Failed to fetch dynamically imported module');
    await expect(
      loadSafeModule(() => Promise.reject(boom), { name: 'ChatWidget' }),
    ).rejects.toBe(boom);
    expect(reportChunkResolvedInvalid).toHaveBeenCalledTimes(1);
    expect(reportChunkResolvedInvalid).toHaveBeenCalledWith({
      name: 'ChatWidget',
      stage: 'rejected',
    });
  });
});

// En SSR le module `.client` de la balise est remplacé par un stub vide →
// `reportChunkResolvedInvalid` y est `undefined`. `loadSafeModule` est isomorphe
// (rendu par `root.tsx`/`LazyFooter` côté serveur) : il NE DOIT PAS appeler la
// balise hors navigateur, sinon `(void 0) is not a function` masquerait la vraie
// erreur (canon : no silent fallback). Garde `typeof window !== "undefined"`.
describe('loadSafeModule — contexte serveur (aucun `window`)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fulfill-with-undefined en SSR : jette la synthetic error SANS émettre la balise', async () => {
    vi.stubGlobal('window', undefined);
    await expect(
      loadSafeModule(() => Promise.resolve(undefined), { name: 'GlobalFooter' }),
    ).rejects.toThrow(/\[safeLazy:GlobalFooter\]/);
    expect(reportChunkResolvedInvalid).not.toHaveBeenCalled();
  });

  it('rejet réel en SSR : re-jette la cause SANS émettre la balise', async () => {
    vi.stubGlobal('window', undefined);
    const boom = new Error('server import failed');
    await expect(
      loadSafeModule(() => Promise.reject(boom), { name: 'ChatWidget' }),
    ).rejects.toBe(boom);
    expect(reportChunkResolvedInvalid).not.toHaveBeenCalled();
  });
});
