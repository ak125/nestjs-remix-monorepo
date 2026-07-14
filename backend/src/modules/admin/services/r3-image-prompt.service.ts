import { Injectable, Logger } from '@nestjs/common';
import { SupabaseBaseService } from '@database/services/supabase-base.service';

/**
 * R3 image-prompt CURATION service.
 *
 * B5 (ADR-059 §Fermeture RAG, owner-gated) removed the RAG prompt-GENERATION surface
 * from this service: the RAG-knowledge disk reads (the rag-config knowledge path), all
 * prompt builders, the slot-richness scoring/selection, and the generated-column write
 * that produced the prompt/negative/alt/caption/rag-* fields AND, as a side effect,
 * reset the status to pending + the selection flag on every regeneration. That was the
 * ONLY path that could downgrade an approved image.
 *
 * What remains is curation over human-owned rows: list / export (read-only, incl. the
 * historical generated columns) + the promote-only writers approvePrompt (status →
 * approved) and setImageUrl (image url). No write here sets the status to pending or
 * touches the selection flag, so an approved image cannot be reset.
 *
 * Historical rows, schema, grants and RLS are untouched (no migration, no REVOKE —
 * revoke_safe=false: the shared service_role serves these preserved curation writers).
 * Re-introducing a RAG read here is blocked by the seo-no-rag-as-content-source ratchet.
 */
@Injectable()
export class R3ImagePromptService extends SupabaseBaseService {
  protected readonly logger = new Logger(R3ImagePromptService.name);

  constructor() {
    super();
  }

  // ── Public API ──

  async listPrompts(filters: {
    status?: string;
    slot_id?: string;
    pg_alias?: string;
    selected_only?: boolean;
    limit: number;
    offset: number;
  }) {
    let query = this.supabase
      .from('__seo_r3_image_prompts')
      .select('*', { count: 'exact' });

    if (filters.status) query = query.eq('rip_status', filters.status);
    if (filters.slot_id) query = query.eq('rip_slot_id', filters.slot_id);
    if (filters.pg_alias) query = query.eq('rip_pg_alias', filters.pg_alias);
    if (filters.selected_only) query = query.eq('rip_selected', true);

    query = query
      .order('rip_pg_alias')
      .order('rip_slot_id')
      .range(filters.offset, filters.offset + filters.limit - 1);

    const { data, count, error } = await query;
    if (error) throw error;
    return { data: data ?? [], total: count ?? 0 };
  }

  async getPromptsForGamme(pgAlias: string) {
    const { data, error } = await this.supabase
      .from('__seo_r3_image_prompts')
      .select('*')
      .eq('rip_pg_alias', pgAlias)
      .order('rip_slot_id');

    if (error) throw error;
    return data ?? [];
  }

  async approvePrompt(id: number) {
    const { data, error } = await this.supabase
      .from('__seo_r3_image_prompts')
      .update({ rip_status: 'approved' })
      .eq('rip_id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async setImageUrl(id: number, imageUrl: string) {
    const { data, error } = await this.supabase
      .from('__seo_r3_image_prompts')
      .update({ rip_image_url: imageUrl })
      .eq('rip_id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async exportCsv(filters: {
    status?: string;
    slot_id?: string;
    selected_only?: boolean;
  }): Promise<string> {
    let query = this.supabase
      .from('__seo_r3_image_prompts')
      .select('*')
      .order('rip_pg_alias')
      .order('rip_slot_id');

    if (filters.status) query = query.eq('rip_status', filters.status);
    if (filters.slot_id) query = query.eq('rip_slot_id', filters.slot_id);
    if (filters.selected_only) query = query.eq('rip_selected', true);

    const { data, error } = await query;
    if (error) throw error;

    const rows = data ?? [];
    const headers = [
      'pg_alias',
      'gamme_name',
      'slot_id',
      'section_id',
      'topic',
      'aspect_ratio',
      'min_width',
      'prompt_text',
      'neg_prompt',
      'alt_text',
      'caption',
      'selected',
      'priority_rank',
      'rag_richness_score',
      'rag_fields_used',
      'status',
      'generated_at',
    ];

    const csvRows = rows.map((r) =>
      [
        r.rip_pg_alias,
        this.csvEscape(r.rip_gamme_name),
        r.rip_slot_id,
        r.rip_section_id,
        r.rip_topic,
        r.rip_aspect_ratio,
        r.rip_min_width,
        this.csvEscape(r.rip_prompt_text),
        this.csvEscape(r.rip_neg_prompt ?? ''),
        this.csvEscape(r.rip_alt_text),
        this.csvEscape(r.rip_caption ?? ''),
        r.rip_selected ? 'true' : 'false',
        r.rip_priority_rank ?? '',
        r.rip_rag_richness_score ?? '',
        (r.rip_rag_fields_used ?? []).join(';'),
        r.rip_status,
        r.rip_generated_at,
      ].join(','),
    );

    // BOM for Excel + header + rows
    return '\uFEFF' + headers.join(',') + '\n' + csvRows.join('\n');
  }

  async exportJson(filters: {
    status?: string;
    slot_id?: string;
    selected_only?: boolean;
  }) {
    let query = this.supabase
      .from('__seo_r3_image_prompts')
      .select('*')
      .order('rip_pg_alias')
      .order('rip_slot_id');

    if (filters.status) query = query.eq('rip_status', filters.status);
    if (filters.slot_id) query = query.eq('rip_slot_id', filters.slot_id);
    if (filters.selected_only) query = query.eq('rip_selected', true);

    const { data, error } = await query;
    if (error) throw error;
    return data ?? [];
  }

  private csvEscape(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }
}
