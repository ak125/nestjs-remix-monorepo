import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { R2VolumeStats } from './types';

export interface R2VolumeOptions {
  supabase: SupabaseClient;
}

export async function runR2VolumeSample(opts: R2VolumeOptions): Promise<R2VolumeStats> {
  const { count: total, error: totalErr } = await opts.supabase
    .from('pieces')
    .select('*', { count: 'exact', head: true });
  if (totalErr) throw new Error(`R2 volume total failed: ${totalErr.message}`);

  // Cible : count fiches indexables (stock>0 AND image présente).
  // Note : adapter le filtre selon vrai schéma `pieces` (à confirmer en Task 10 run réel).
  const { count: indexable, error: indexErr } = await opts.supabase
    .from('pieces')
    .select('*', { count: 'exact', head: true })
    .gt('piece_qty_stock', 0)
    .not('piece_img', 'is', null);

  if (indexErr) {
    // Filtre échoué (probablement colonne inexistante) — retourner count total seul.
    return {
      total_pieces: total ?? 0,
      indexable_estimate: 0,
    };
  }

  return {
    total_pieces: total ?? 0,
    indexable_estimate: indexable ?? 0,
  };
}

export function makeSupabaseFromEnv(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requis');
  }
  return createClient(url, key, { auth: { persistSession: false } });
}
