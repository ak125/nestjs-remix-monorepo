/**
 * 🛡️ TYPE GUARDS & NORMALIZERS
 *
 * Utilitaires pour normaliser les données provenant de l'API/RPC
 * Évite les bugs de comparaison de types (string vs number)
 *
 * @example
 * // Au lieu de: marque_display === '1' (BUG!)
 * // Utiliser: toBoolean(marque_display) (SAFE)
 *
 * @version 1.0.0
 * @since 2026-01-15
 */

/**
 * Convertit une valeur (string | number | boolean | null | undefined) en boolean
 *
 * PostgreSQL/Supabase peut retourner:
 * - number: 1, 0
 * - string: '1', '0', 'true', 'false'
 * - boolean: true, false
 * - null/undefined
 *
 * @param value - Valeur à convertir
 * @returns true si la valeur est truthy (1, '1', true, 'true')
 *
 * @example
 * toBoolean(1) // true
 * toBoolean('1') // true
 * toBoolean(0) // false
 * toBoolean('0') // false
 * toBoolean(null) // false
 */
export function toBoolean(
  value: string | number | boolean | null | undefined,
): boolean {
  if (value === null || value === undefined) {
    return false;
  }

  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value === 1;
  }

  if (typeof value === "string") {
    const normalized = value.toLowerCase().trim();
    return normalized === "1" || normalized === "true";
  }

  return false;
}

/**
 * Convertit une valeur en flag 0 ou 1 (format base de données)
 *
 * @param value - Valeur à convertir
 * @returns 1 si truthy, 0 sinon
 *
 * @example
 * toBooleanFlag(true) // 1
 * toBooleanFlag('1') // 1
 * toBooleanFlag(0) // 0
 * toBooleanFlag(null) // 0
 */
export function toBooleanFlag(
  value: string | number | boolean | null | undefined,
): 0 | 1 {
  return toBoolean(value) ? 1 : 0;
}

/**
 * Convertit une valeur en number de manière sécurisée
 *
 * @param value - Valeur à convertir
 * @param defaultValue - Valeur par défaut si conversion échoue
 * @returns Le nombre ou la valeur par défaut
 *
 * @example
 * toNumber('123') // 123
 * toNumber(456) // 456
 * toNumber(null, 0) // 0
 * toNumber('abc', -1) // -1
 */
export function toNumber(
  value: string | number | null | undefined,
  defaultValue: number = 0,
): number {
  if (value === null || value === undefined) {
    return defaultValue;
  }

  if (typeof value === "number") {
    return isNaN(value) ? defaultValue : value;
  }

  const parsed = parseFloat(value);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Convertit une valeur en integer de manière sécurisée
 *
 * @param value - Valeur à convertir
 * @param defaultValue - Valeur par défaut si conversion échoue
 * @returns L'entier ou la valeur par défaut
 */
export function toInt(
  value: string | number | null | undefined,
  defaultValue: number = 0,
): number {
  return Math.floor(toNumber(value, defaultValue));
}

/**
 * Convertit une valeur en string de manière sécurisée
 *
 * @param value - Valeur à convertir
 * @param defaultValue - Valeur par défaut si null/undefined
 * @returns La string ou la valeur par défaut
 */
export function toString(
  value: string | number | null | undefined,
  defaultValue: string = "",
): string {
  if (value === null || value === undefined) {
    return defaultValue;
  }
  return String(value);
}

/**
 * Type pour les réponses RPC brutes (avant normalisation)
 * Les valeurs peuvent être string ou number selon le contexte
 */
export type RawDatabaseValue = string | number | boolean | null | undefined;

/**
 * Interface pour les flags de base de données
 * Utilisée pour typer les colonnes 0/1 comme marque_display, marque_relfollow
 */
export interface DatabaseFlags {
  [key: string]: RawDatabaseValue;
}

/**
 * Normalise un objet contenant des flags de base de données
 *
 * @param obj - Objet avec des flags potentiellement mal typés
 * @param flagKeys - Liste des clés à normaliser en boolean flags
 * @returns Objet avec les flags normalisés en 0 | 1
 *
 * @example
 * normalizeFlags(
 *   { marque_display: '1', marque_relfollow: 0, name: 'Test' },
 *   ['marque_display', 'marque_relfollow']
 * )
 * // { marque_display: 1, marque_relfollow: 0, name: 'Test' }
 */
export function normalizeFlags<T extends DatabaseFlags>(
  obj: T,
  flagKeys: (keyof T)[],
): T {
  const result = { ...obj };

  for (const key of flagKeys) {
    if (key in result) {
      (result as any)[key] = toBooleanFlag(result[key]);
    }
  }

  return result;
}

/**
 * Vérifie si une valeur est un ID valide (entier positif)
 */
export function isValidId(value: unknown): value is number {
  if (typeof value === "number") {
    return Number.isInteger(value) && value > 0;
  }
  if (typeof value === "string") {
    const parsed = parseInt(value, 10);
    return !isNaN(parsed) && parsed > 0;
  }
  return false;
}

/**
 * Vérifie si une valeur est une string non vide
 */
export function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Constantes pour les flags de la table auto_marque
 */
export const BRAND_FLAGS = [
  "marque_display",
  "marque_relfollow",
  "marque_sitemap",
  "marque_top",
] as const;

export type BrandFlagKey = (typeof BRAND_FLAGS)[number];
