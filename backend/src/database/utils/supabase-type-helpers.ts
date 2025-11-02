/**
 * 🔧 Helpers Type-Safe pour Supabase
 *
 * Supabase retourne les types PostgreSQL bigint/integer comme strings en JSON.
 * Ces helpers assurent une conversion cohérente dans toute l'application.
 */

/**
 * Convertit un ID Supabase (string) en number
 * Gère les cas null/undefined de manière sûre
 */
export function parseSupabaseId(
  id: string | number | null | undefined,
): number {
  if (id === null || id === undefined) {
    return 0;
  }

  if (typeof id === 'number') {
    return id;
  }

  const parsed = parseInt(id, 10);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Convertit un tableau d'objets Supabase en convertissant tous les champs ID
 * Usage: convertSupabaseIds(data, ['mf_id', 'pg_id'])
 */
export function convertSupabaseIds<T extends Record<string, any>>(
  data: T[],
  idFields: string[],
): T[] {
  return data.map((item) => {
    const converted = { ...item } as Record<string, any>;

    for (const field of idFields) {
      if (field in converted) {
        converted[field] = parseSupabaseId(converted[field]);
      }
    }

    return converted as T;
  });
}

/**
 * Créer un Map type-safe depuis des données Supabase
 * Convertit automatiquement les clés en nombres
 */
export function createSupabaseMap<T>(
  data: T[],
  keyField: keyof T,
): Map<number, T> {
  return new Map(
    data.map((item) => [parseSupabaseId(item[keyField] as any), item]),
  );
}

/**
 * Grouper des données Supabase par un champ ID
 * Convertit automatiquement les clés en nombres
 */
export function groupSupabaseBy<T>(
  data: T[],
  keyField: keyof T,
): Map<number, T[]> {
  const grouped = new Map<number, T[]>();

  for (const item of data) {
    const key = parseSupabaseId(item[keyField] as any);

    if (!grouped.has(key)) {
      grouped.set(key, []);
    }

    grouped.get(key)!.push(item);
  }
  return grouped;
}

/**
 * Exemples d'utilisation:
 *
 * // 1. Parse simple
 * const id = parseSupabaseId(supabaseData.mf_id);  // "123" → 123
 *
 * // 2. Convertir plusieurs champs
 * const families = convertSupabaseIds(rawFamilies, ['mf_id', 'mf_sort']);
 *
 * // 3. Créer un Map
 * const gammeMap = createSupabaseMap(gammes, 'pg_id');
 * const gamme = gammeMap.get(7);  // Clé en nombre
 *
 * // 4. Grouper par ID
 * const byFamily = groupSupabaseBy(liaisons, 'mc_mf_id');
 * const familyGammes = byFamily.get(1);
 */
