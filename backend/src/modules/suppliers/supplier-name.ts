/**
 * Contrôle de doublon des fournisseurs sur le nom normalisé (mandat CH ;
 * cas réels de modele-fiche.md §c : 26 « DISTRICASH (DCA) » / 71 « DCA »,
 * 35 « JACKOPARTS » / 36 « JAKOPARTS », 56 « RCA » / « RCA France »).
 *
 * Fonctions pures, sans base : le service leur passe la liste lue.
 *
 *  - Clé = nom sans accents, en majuscules, réduit à [A-Z0-9]
 *    (« Herth+Buss » → HERTHBUSS, « Meat & Doria » → MEATDORIA).
 *  - Un fournisseur porte plusieurs clés : nom entier, nom sans sa
 *    parenthèse, contenu de chaque parenthèse, alias.
 *  - Clé commune = DOUBLON (création ou renommage refusés).
 *  - Clés voisines (préfixe de 3 caractères ou plus, ou une seule lettre
 *    d'écart à partir de 5 caractères) = DOUBLON POSSIBLE : signalé, non
 *    bloquant, tranché par Marwane.
 */

export interface SupplierNameEntry {
  splId: string;
  name: string | null;
  alias: string | null;
}

export interface DuplicateMatch {
  splId: string;
  name: string | null;
  /** `exact` bloque ; `voisin` est un signalement. */
  kind: 'exact' | 'voisin';
  key: string;
}

export function normalizeSupplierKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

export function supplierNameKeys(
  name: string | null,
  alias: string | null,
): Set<string> {
  const keys = new Set<string>();
  const add = (v: string | null | undefined) => {
    const k = v ? normalizeSupplierKey(v) : '';
    if (k) keys.add(k);
  };
  if (name) {
    add(name);
    add(name.replace(/\([^)]*\)/g, ' '));
    for (const m of name.matchAll(/\(([^)]*)\)/g)) add(m[1]);
  }
  add(alias);
  return keys;
}

/** Slug d'alias à la manière des alias existants (« districash-dca »). */
export function slugifySupplierAlias(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function withinOneEdit(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++;
      j++;
      continue;
    }
    if (++edits > 1) return false;
    if (a.length > b.length) i++;
    else if (b.length > a.length) j++;
    else {
      i++;
      j++;
    }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

function areNeighbours(a: string, b: string): boolean {
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  if (short.length >= 3 && long.startsWith(short)) return true;
  return short.length >= 5 && withinOneEdit(a, b);
}

/**
 * Doublons du couple (nom, alias) parmi `existing`, `excludeSplId` exclu
 * (le fournisseur lui-même lors d'une mise à jour). Un fournisseur n'apparaît
 * qu'une fois, en `exact` s'il a au moins une clé commune.
 */
export function findSupplierDuplicates(
  name: string | null,
  alias: string | null,
  existing: SupplierNameEntry[],
  excludeSplId?: string,
): DuplicateMatch[] {
  const mine = supplierNameKeys(name, alias);
  const out: DuplicateMatch[] = [];
  for (const other of existing) {
    if (other.splId === excludeSplId) continue;
    const theirs = supplierNameKeys(other.name, other.alias);
    let match: DuplicateMatch | null = null;
    for (const k of mine) {
      if (theirs.has(k)) {
        match = { splId: other.splId, name: other.name, kind: 'exact', key: k };
        break;
      }
    }
    if (!match) {
      outer: for (const k of mine) {
        for (const t of theirs) {
          if (areNeighbours(k, t)) {
            match = {
              splId: other.splId,
              name: other.name,
              kind: 'voisin',
              key: k,
            };
            break outer;
          }
        }
      }
    }
    if (match) out.push(match);
  }
  return out.sort((a, b) =>
    a.kind === b.kind
      ? a.splId.localeCompare(b.splId, 'fr', { numeric: true })
      : a.kind === 'exact'
        ? -1
        : 1,
  );
}
