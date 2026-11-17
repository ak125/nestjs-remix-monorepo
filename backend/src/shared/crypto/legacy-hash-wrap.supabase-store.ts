/**
 * Stockage Supabase (PostgREST) de l'enveloppe des anciennes empreintes.
 * Toute erreur PostgREST est levée : rien n'est converti en résultat vide.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { HashRow, WrapStore, WrapTarget } from './legacy-hash-wrap.runner';

export class SupabaseWrapStore implements WrapStore {
  constructor(private readonly client: SupabaseClient) {}

  private async headCount(
    target: WrapTarget,
    apply: (q: any) => any, // eslint-disable-line @typescript-eslint/no-explicit-any
  ): Promise<number> {
    const query = this.client
      .from(target.table)
      .select(target.idColumn, { count: 'exact', head: true });
    const { count, error } = await apply(query);
    if (error)
      throw new Error(`${target.table} count failed: ${error.message}`);
    if (typeof count !== 'number') {
      throw new Error(`${target.table} count missing`);
    }
    return count;
  }

  countTotal(target: WrapTarget): Promise<number> {
    return this.headCount(target, (q) => q);
  }

  countNull(target: WrapTarget): Promise<number> {
    return this.headCount(target, (q) => q.is(target.hashColumn, null));
  }

  countMatching(target: WrapTarget, regex: string): Promise<number> {
    return this.headCount(target, (q) =>
      q.filter(target.hashColumn, 'imatch', regex),
    );
  }

  async fetchCandidates(
    target: WrapTarget,
    afterId: string | null,
    limit: number,
  ): Promise<HashRow[]> {
    let query = this.client
      .from(target.table)
      .select(`${target.idColumn}, ${target.hashColumn}`)
      .not(target.hashColumn, 'is', null)
      .not(target.hashColumn, 'like', '$*')
      .order(target.idColumn, { ascending: true })
      .limit(limit);
    if (afterId !== null) query = query.gt(target.idColumn, afterId);
    const { data, error } = await query;
    if (error) {
      throw new Error(`${target.table} fetch failed: ${error.message}`);
    }
    return ((data ?? []) as unknown as Record<string, string | null>[]).map(
      (r) => ({
        id: String(r[target.idColumn]),
        hash: r[target.hashColumn],
      }),
    );
  }

  async replaceIfUnchanged(
    target: WrapTarget,
    id: string,
    expectedHash: string,
    newHash: string,
  ): Promise<boolean> {
    const { data, error } = await this.client
      .from(target.table)
      .update({ [target.hashColumn]: newHash })
      .eq(target.idColumn, id)
      .eq(target.hashColumn, expectedHash)
      .select(target.idColumn);
    if (error) {
      throw new Error(`${target.table} update failed: ${error.message}`);
    }
    return (data ?? []).length === 1;
  }
}
