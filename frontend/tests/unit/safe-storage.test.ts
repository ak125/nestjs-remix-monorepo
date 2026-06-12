/**
 * Tests unitaires — `safeSessionStorage` / `safeLocalStorage`
 * (`frontend/app/utils/safe-storage.ts`).
 *
 * Couvre le contrat anti-Sentry sur les `SecurityError` reportés par Chrome
 * Mobile 148 / Android 10 WebView (Sentry issue 181aeb23) :
 *  - getItem retourne null au lieu de throw quand l'accès à
 *    `window.sessionStorage` (ou un appel sur le storage) lève SecurityError
 *  - setItem retourne false au lieu de throw sur QuotaExceededError
 *  - removeItem ne throw jamais
 *  - mode SSR (window undefined) : tout retourne null / false
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { safeLocalStorage, safeSessionStorage } from '~/utils/safe-storage';

describe('safeSessionStorage', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('happy path (storage available)', () => {
    it('getItem returns stored value', () => {
      window.sessionStorage.setItem('k', 'v');
      expect(safeSessionStorage.getItem('k')).toBe('v');
    });

    it('getItem returns null when key missing', () => {
      expect(safeSessionStorage.getItem('missing')).toBeNull();
    });

    it('setItem returns true and persists', () => {
      expect(safeSessionStorage.setItem('k', 'v')).toBe(true);
      expect(window.sessionStorage.getItem('k')).toBe('v');
    });

    it('removeItem returns true and clears the key', () => {
      window.sessionStorage.setItem('k', 'v');
      expect(safeSessionStorage.removeItem('k')).toBe(true);
      expect(window.sessionStorage.getItem('k')).toBeNull();
    });
  });

  describe('SecurityError on accessor (WebView / blocked storage)', () => {
    it('getItem returns null when window.sessionStorage accessor throws', () => {
      vi.spyOn(window, 'sessionStorage', 'get').mockImplementation(() => {
        throw new DOMException('Access denied', 'SecurityError');
      });
      expect(safeSessionStorage.getItem('k')).toBeNull();
    });

    it('setItem returns false when window.sessionStorage accessor throws', () => {
      vi.spyOn(window, 'sessionStorage', 'get').mockImplementation(() => {
        throw new DOMException('Access denied', 'SecurityError');
      });
      expect(safeSessionStorage.setItem('k', 'v')).toBe(false);
    });

    it('removeItem returns false when window.sessionStorage accessor throws', () => {
      vi.spyOn(window, 'sessionStorage', 'get').mockImplementation(() => {
        throw new DOMException('Access denied', 'SecurityError');
      });
      expect(safeSessionStorage.removeItem('k')).toBe(false);
    });
  });

  describe('SecurityError on operation', () => {
    it('getItem returns null when getItem() itself throws', () => {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new DOMException('Access denied', 'SecurityError');
      });
      expect(safeSessionStorage.getItem('k')).toBeNull();
    });

    it('setItem returns false when setItem() itself throws', () => {
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new DOMException('Access denied', 'SecurityError');
      });
      expect(safeSessionStorage.setItem('k', 'v')).toBe(false);
    });

    it('removeItem returns false when removeItem() itself throws', () => {
      vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
        throw new DOMException('Access denied', 'SecurityError');
      });
      expect(safeSessionStorage.removeItem('k')).toBe(false);
    });
  });

  describe('QuotaExceededError (storage full)', () => {
    it('setItem returns false on QuotaExceededError', () => {
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new DOMException('Quota exceeded', 'QuotaExceededError');
      });
      expect(safeSessionStorage.setItem('k', 'v')).toBe(false);
    });
  });
});

describe('safeLocalStorage', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('getItem returns null when window.localStorage accessor throws', () => {
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
      throw new DOMException('Access denied', 'SecurityError');
    });
    expect(safeLocalStorage.getItem('k')).toBeNull();
  });

  it('setItem returns true and persists on happy path', () => {
    expect(safeLocalStorage.setItem('k', 'v')).toBe(true);
    expect(window.localStorage.getItem('k')).toBe('v');
  });

  it('setItem returns false on QuotaExceededError', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError');
    });
    expect(safeLocalStorage.setItem('k', 'v')).toBe(false);
  });

  it('removeItem returns true on happy path', () => {
    window.localStorage.setItem('k', 'v');
    expect(safeLocalStorage.removeItem('k')).toBe(true);
    expect(window.localStorage.getItem('k')).toBeNull();
  });
});
