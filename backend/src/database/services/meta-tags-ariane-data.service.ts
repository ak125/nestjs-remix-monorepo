import { Injectable, Logger } from '@nestjs/common';
import { SupabaseBaseService } from './supabase-base.service';
import { TABLES } from '@repo/database-types';

/**
 * MetaTagsArianeDataService — Acces centralise a la table ___meta_tags_ariane
 *
 * Colonnes : mta_id, mta_alias, mta_url, mta_title, mta_descrip,
 *            mta_keywords, mta_h1, mta_content, mta_ariane, mta_relfollow
 */
@Injectable()
export class MetaTagsArianeDataService extends SupabaseBaseService {
  protected readonly logger = new Logger(MetaTagsArianeDataService.name);

  // ─── READ ───────────────────────────────────────────────

  async getByAlias(alias: string): Promise<Record<string, any> | null> {
    const { data, error } = await this.supabase
      .from(TABLES.meta_tags_ariane)
      .select('*')
      .eq('mta_alias', alias)
      .single();

    if (error && error.code !== 'PGRST116') {
      this.logger.error(`getByAlias error for "${alias}":`, error.message);
    }
    return data ?? null;
  }

  async getByUrl(url: string): Promise<Record<string, any> | null> {
    const { data, error } = await this.supabase
      .from(TABLES.meta_tags_ariane)
      .select('*')
      .eq('mta_url', url)
      .single();

    if (error && error.code !== 'PGRST116') {
      this.logger.error(`getByUrl error for "${url}":`, error.message);
    }
    return data ?? null;
  }

  async getFieldsByUrl(
    url: string,
    fields: string,
  ): Promise<Record<string, any> | null> {
    const { data, error } = await this.supabase
      .from(TABLES.meta_tags_ariane)
      .select(fields)
      .eq('mta_url', url)
      .single();

    if (error && error.code !== 'PGRST116') {
      this.logger.error(`getFieldsByUrl error for "${url}":`, error.message);
    }
    return data ?? null;
  }

  async getByTypeIdPattern(
    typeId: number,
  ): Promise<Record<string, any> | null> {
    const { data, error } = await this.supabase
      .from(TABLES.meta_tags_ariane)
      .select('*')
      .ilike('mta_alias', `%-${typeId}`)
      .limit(1);

    if (error) {
      this.logger.error(
        `getByTypeIdPattern error for typeId ${typeId}:`,
        error.message,
      );
      return null;
    }
    return data?.[0] ?? null;
  }

  async getAll(options?: {
    orderBy?: string;
    ascending?: boolean;
  }): Promise<Record<string, any>[]> {
    const { data, error } = await this.supabase
      .from(TABLES.meta_tags_ariane)
      .select('*')
      .order(options?.orderBy ?? 'mta_id', {
        ascending: options?.ascending ?? false,
      });

    if (error) {
      this.logger.error('getAll error:', error.message);
      return [];
    }
    return data ?? [];
  }

  async getAliases(): Promise<string[]> {
    const { data, error } = await this.supabase
      .from(TABLES.meta_tags_ariane)
      .select('mta_alias')
      .not('mta_alias', 'is', null);

    if (error) {
      this.logger.error('getAliases error:', error.message);
      return [];
    }
    return data?.map((item) => item.mta_alias).filter(Boolean) ?? [];
  }

  async getPagesWithoutSeo(
    limit: number = 50,
  ): Promise<{ mta_alias: string; mta_title: string; mta_descrip: string }[]> {
    const { data, error } = await this.supabase
      .from(TABLES.meta_tags_ariane)
      .select('mta_alias, mta_title, mta_descrip')
      .or('mta_title.is.null,mta_descrip.is.null,mta_title.eq.,mta_descrip.eq.')
      .order('mta_id', { ascending: false })
      .limit(limit);

    if (error) {
      this.logger.error('getPagesWithoutSeo error:', error.message);
      return [];
    }
    return data ?? [];
  }

  // ─── COUNT ──────────────────────────────────────────────

  async countTotal(): Promise<number> {
    const { count, error } = await this.supabase
      .from(TABLES.meta_tags_ariane)
      .select('*', { count: 'exact', head: true });

    if (error) {
      this.logger.error('countTotal error:', error.message);
      return 0;
    }
    return count ?? 0;
  }

  async countOptimized(): Promise<number> {
    const { count, error } = await this.supabase
      .from(TABLES.meta_tags_ariane)
      .select('*', { count: 'exact', head: true })
      .not('mta_title', 'is', null)
      .not('mta_descrip', 'is', null);

    if (error) {
      this.logger.error('countOptimized error:', error.message);
      return 0;
    }
    return count ?? 0;
  }

  async countWithoutSeo(): Promise<number> {
    const { count, error } = await this.supabase
      .from(TABLES.meta_tags_ariane)
      .select('*', { count: 'exact', head: true })
      .or('mta_title.is.null,mta_descrip.is.null');

    if (error) {
      this.logger.error('countWithoutSeo error:', error.message);
      return 0;
    }
    return count ?? 0;
  }

  // ─── WRITE ──────────────────────────────────────────────

  async upsert(data: Record<string, any>): Promise<Record<string, any> | null> {
    const { data: result, error } = await this.supabase
      .from(TABLES.meta_tags_ariane)
      .upsert(data)
      .select()
      .single();

    if (error) {
      this.logger.error('upsert error:', error.message);
      throw error;
    }
    return result;
  }

  async upsertWithoutReturn(data: Record<string, any>): Promise<void> {
    const { error } = await this.supabase
      .from(TABLES.meta_tags_ariane)
      .upsert(data);

    if (error) {
      this.logger.error('upsertWithoutReturn error:', error.message);
      throw error;
    }
  }

  async updateById(
    mtaId: number | string,
    fields: Record<string, any>,
  ): Promise<void> {
    const { error } = await this.supabase
      .from(TABLES.meta_tags_ariane)
      .update(fields)
      .eq('mta_id', mtaId);

    if (error) {
      this.logger.error(`updateById error for ${mtaId}:`, error.message);
      throw error;
    }
  }

  async insert(data: Record<string, any>): Promise<void> {
    const { error } = await this.supabase
      .from(TABLES.meta_tags_ariane)
      .insert(data);

    if (error) {
      this.logger.error('insert error:', error.message);
      throw error;
    }
  }

  async deleteByAlias(alias: string): Promise<void> {
    const { error } = await this.supabase
      .from(TABLES.meta_tags_ariane)
      .delete()
      .eq('mta_alias', alias);

    if (error) {
      this.logger.error(`deleteByAlias error for "${alias}":`, error.message);
      throw error;
    }
  }

  async deleteByUrl(url: string): Promise<void> {
    const { error } = await this.supabase
      .from(TABLES.meta_tags_ariane)
      .delete()
      .eq('mta_url', url);

    if (error) {
      this.logger.error(`deleteByUrl error for "${url}":`, error.message);
      throw error;
    }
  }

  // ─── CHECK ──────────────────────────────────────────────

  async existsByUrl(url: string): Promise<boolean> {
    const { data, error } = await this.supabase
      .from(TABLES.meta_tags_ariane)
      .select('mta_id')
      .eq('mta_url', url)
      .single();

    return !error && !!data;
  }
}
