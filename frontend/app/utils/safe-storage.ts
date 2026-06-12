/**
 * Drop-in remplacement de window.sessionStorage / window.localStorage qui ne
 * throw jamais. Couvre :
 *  - SSR (window === undefined)
 *  - SecurityError (storage bloqué par browser settings ou WebView in-app)
 *  - QuotaExceededError (storage plein, mode privé Safari iOS, etc.)
 *
 * Si storage indisponible :
 *  - getItem retourne null
 *  - setItem / removeItem retournent false (no-op)
 *
 * Sentry context : voir issue 181aeb23 (Chrome Mobile 148 / Android 10 WebView).
 */

type StorageKind = "session" | "local";

function getStore(kind: StorageKind): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return kind === "session" ? window.sessionStorage : window.localStorage;
  } catch {
    return null;
  }
}

function readItem(kind: StorageKind, key: string): string | null {
  const store = getStore(kind);
  if (!store) return null;
  try {
    return store.getItem(key);
  } catch {
    return null;
  }
}

function writeItem(kind: StorageKind, key: string, value: string): boolean {
  const store = getStore(kind);
  if (!store) return false;
  try {
    store.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function deleteItem(kind: StorageKind, key: string): boolean {
  const store = getStore(kind);
  if (!store) return false;
  try {
    store.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

export const safeSessionStorage = {
  getItem: (key: string): string | null => readItem("session", key),
  setItem: (key: string, value: string): boolean =>
    writeItem("session", key, value),
  removeItem: (key: string): boolean => deleteItem("session", key),
};

export const safeLocalStorage = {
  getItem: (key: string): string | null => readItem("local", key),
  setItem: (key: string, value: string): boolean =>
    writeItem("local", key, value),
  removeItem: (key: string): boolean => deleteItem("local", key),
};
