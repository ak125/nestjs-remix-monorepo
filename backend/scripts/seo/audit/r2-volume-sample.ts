import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { R2VolumeStats } from './types';

export interface R2VolumeOptions {
  supabase: SupabaseClient;
}

export async function runR2VolumeSample(opts: R2VolumeOptions): Promise<R2VolumeStats> {
  // 3 sources croisées (vérifié 2026-05-08 sur DEV) :
  // 1. `pieces` (raw)             — total brut, inclut références sans prix/stock/image
  // 2. `v_pieces_seo_safe` (vue)  — filtre SEO officiel applicatif
  // 3. `__sitemap_p_xml`          — sitemap actuellement exposé (R1 catalogue, pas R2 fiche)

  const totalRaw = await countTable(opts.supabase, 'pieces');
  const seoSafe = await countTable(opts.supabase, 'v_pieces_seo_safe');
  const sitemapP = await countTable(opts.supabase, '__sitemap_p_xml');

  const withImg = await countWhere(opts.supabase, 'pieces', (q) =>
    q.eq('piece_has_img', true),
  );

  return {
    total_pieces: totalRaw,
    // indexable_estimate = vue SEO officielle (proxy le plus fiable, vérifié)
    indexable_estimate: seoSafe,
    breakdown: {
      with_price: 0, // table pieces_price séparée — non comptée dans cette itération
      with_stock: 0, // pas de colonne piece_qty_stock dans pieces — à clarifier en PR-2
      with_image: withImg,
      with_oem_ref: 0, // table pieces_ref_oem séparée
    },
  };
}

async function countTable(supabase: SupabaseClient, table: string): Promise<number> {
  const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
  if (error) {
    console.warn(`[volet 4] count ${table} failed: ${error.message}`);
    return 0;
  }
  return count ?? 0;
}

async function countWhere(
  supabase: SupabaseClient,
  table: string,
  apply: (q: ReturnType<SupabaseClient['from']>) => unknown,
): Promise<number> {
  const base = supabase.from(table).select('*', { count: 'exact', head: true });
  const filtered = apply(base) as typeof base;
  const { count, error } = await filtered;
  if (error) {
    console.warn(`[volet 4] count where ${table} failed: ${error.message}`);
    return 0;
  }
  return count ?? 0;
}

/** Nombre d'URLs actuellement dans le sitemap pieces — exposé pour info séparée. */
export async function countSitemapPiecesUrls(supabase: SupabaseClient): Promise<number> {
  return countTable(supabase, '__sitemap_p_xml');
}

export function makeSupabaseFromEnv(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requis');
  }
  return createClient(url, key, { auth: { persistSession: false } });
}
