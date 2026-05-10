import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { R2VolumeStats } from './types';

export interface R2VolumeOptions {
  supabase: SupabaseClient;
}

/**
 * Volet 4 — count croisé sur 3 sources :
 *   1. `pieces` (raw)             — total brut, inclut références sans prix/stock/image
 *   2. `v_pieces_seo_safe` (vue)  — filtre SEO officiel applicatif (proxy fiable)
 *   3. `__sitemap_p_xml`          — sitemap actuellement exposé (R1 catalogue, pas R2 fiche)
 *
 * Erreurs Supabase exposées dans `R2VolumeStats.errors[]` plutôt que silencieuses
 * (sinon le rapport ment : count=0 indistinguable de "rien à compter" vs "RLS denial").
 *
 * @see backend/src/modules/seo/services/sitemap-v10-pieces.service.ts pour la définition canonique du sitemap.
 */
export async function runR2VolumeSample(opts: R2VolumeOptions): Promise<R2VolumeStats> {
  const errors: Array<{ source: string; message: string }> = [];

  const totalRaw = await countTable(opts.supabase, 'pieces', errors);
  const seoSafe = await countTable(opts.supabase, 'v_pieces_seo_safe', errors);
  const withImg = await countWhere(opts.supabase, 'pieces', (q) => q.eq('piece_has_img', true), errors);

  return {
    total_pieces: totalRaw,
    indexable_estimate: seoSafe,
    breakdown: {
      // null = "non mesuré dans cette itération" (vs 0 = "mesuré, vide"). Voir gap matrix priorité P1 PR-2.
      with_price: null as unknown as number,
      with_stock: null as unknown as number,
      with_image: withImg,
      with_oem_ref: null as unknown as number,
    },
    errors,
    complete: errors.length === 0,
  } as R2VolumeStats & { errors: typeof errors; complete: boolean };
}

async function countTable(
  supabase: SupabaseClient,
  table: string,
  errors: Array<{ source: string; message: string }>,
): Promise<number> {
  const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
  if (error) {
    errors.push({ source: `count ${table}`, message: error.message });
    return 0;
  }
  return count ?? 0;
}

async function countWhere(
  supabase: SupabaseClient,
  table: string,
  apply: (q: ReturnType<SupabaseClient['from']>) => unknown,
  errors: Array<{ source: string; message: string }>,
): Promise<number> {
  const base = supabase.from(table).select('*', { count: 'exact', head: true });
  const filtered = apply(base) as typeof base;
  const { count, error } = await filtered;
  if (error) {
    errors.push({ source: `count where ${table}`, message: error.message });
    return 0;
  }
  return count ?? 0;
}

/** Nombre d'URLs actuellement dans le sitemap pieces — exposé pour info séparée. */
export async function countSitemapPiecesUrls(supabase: SupabaseClient): Promise<number> {
  const errors: Array<{ source: string; message: string }> = [];
  return countTable(supabase, '__sitemap_p_xml', errors);
}

export function makeSupabaseFromEnv(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requis');
  }
  return createClient(url, key, { auth: { persistSession: false } });
}
