/**
 * R1ImagePromptService — Génère les prompts image pour les 5 emplacements
 * de chaque page gamme R1. Utilise des builders par slot + RAG contexte.
 */
import { Inject, Injectable, Logger } from '@nestjs/common';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import { SLOT_BUILDERS, SLOT_META, SLOT_IDS } from './r1-image-prompt-builders';
import { RagGammeReaderService } from './rag-gamme-reader.service';

@Injectable()
export class R1ImagePromptService extends SupabaseBaseService {
  protected readonly logger = new Logger(R1ImagePromptService.name);

  @Inject() private readonly ragReader: RagGammeReaderService;

  // ── Generation ──

  async generateForGamme(
    pgId: number,
    pgAlias: string,
    pgName: string,
    options?: { force?: boolean },
  ) {
    // Charger les slots existants pour protéger ceux qui ont déjà une image
    const { data: existing } = await this.supabase
      .from('__seo_r1_image_prompts')
      .select('rip_slot_id, rip_image_url, rip_status')
      .eq('rip_pg_id', pgId);

    const existingMap = new Map(
      (existing ?? []).map((e) => [e.rip_slot_id, e]),
    );

    // Skip si tous les slots existent et pas de force
    if (!options?.force && existing && existing.length >= SLOT_IDS.length) {
      return { pgAlias, status: 'skipped' as const, slots: [] };
    }

    // En mode force : régénérer TOUS les prompts (même ceux avec image)
    // En mode normal : ne pas toucher les slots qui ont déjà une image uploadée
    const slotsToWrite = options?.force
      ? [...SLOT_IDS]
      : SLOT_IDS.filter((slotId) => {
          const ex = existingMap.get(slotId);
          return !ex?.rip_image_url;
        });

    if (slotsToWrite.length === 0) {
      return { pgAlias, status: 'skipped' as const, slots: [] };
    }

    // Lire le RAG (contexte gamme)
    // Lire le RAG via service centralisé
    const ragData = this.ragReader.readAndParse(pgAlias);
    if (ragData) {
      this.logger.log(`[R1-IMG] RAG loaded for ${pgAlias}`);
    }

    // Construire les prompts via builders enrichis
    const rows = slotsToWrite.map((slotId) => {
      const builder = SLOT_BUILDERS[slotId];
      const meta = SLOT_META[slotId];
      const result = builder(pgName, ragData);
      const hasExistingImage = existingMap.get(slotId)?.rip_image_url;

      return {
        rip_pg_id: pgId,
        rip_pg_alias: pgAlias,
        rip_gamme_name: pgName,
        rip_slot_id: slotId,
        rip_section_id: meta.section,
        rip_topic: slotId.toLowerCase(),
        rip_aspect_ratio: meta.aspect,
        rip_min_width: meta.width,
        rip_prompt_text: result.prompt,
        rip_alt_text: result.alt,
        rip_neg_prompt: result.neg,
        rip_caption: result.caption,
        rip_budget_cost: meta.cost,
        rip_selected: true,
        rip_priority_rank: meta.rank,
        rip_rag_fields_used: result.ragFieldsUsed,
        rip_rag_richness_score: result.richnessScore,
        // En mode force avec image existante : garder le statut approved + marquer stale
        rip_status: hasExistingImage ? 'approved' : 'pending',
        rip_stale: hasExistingImage ? true : false,
        rip_updated_at: new Date().toISOString(),
      };
    });

    const { error } = await this.supabase
      .from('__seo_r1_image_prompts')
      .upsert(rows, { onConflict: 'rip_pg_id,rip_slot_id' });

    if (error) {
      this.logger.error(`Upsert failed ${pgAlias}: ${error.message}`);
      return {
        pgAlias,
        status: 'failed' as const,
        slots: [],
        reason: error.message,
      };
    }

    const totalRichness = rows.reduce(
      (sum, r) => sum + r.rip_rag_richness_score,
      0,
    );
    this.logger.log(
      `[R1-IMG] Generated ${rows.length} slots for ${pgAlias} (RAG richness: ${totalRichness})`,
    );

    return {
      pgAlias,
      status: 'generated' as const,
      slots: rows.map((r) => r.rip_slot_id),
      ragRichness: totalRichness,
    };
  }

  async generateBatch(pgAliases: string[], options?: { force?: boolean }) {
    const { data: gammes } = await this.supabase
      .from('pieces_gamme')
      .select('pg_id, pg_alias, pg_name')
      .in('pg_alias', pgAliases);

    const items = [];
    for (const g of gammes ?? []) {
      items.push(
        await this.generateForGamme(g.pg_id, g.pg_alias, g.pg_name, options),
      );
    }
    return this.summarize(items);
  }

  async generateAll(options?: { force?: boolean; limit?: number }) {
    const { data: gammes } = await this.supabase
      .from('__seo_r1_keyword_plan')
      .select('rkp_pg_id, rkp_pg_alias, rkp_gamme_name')
      .eq('rkp_status', 'validated')
      .order('rkp_quality_score', { ascending: false })
      .limit(options?.limit ?? 300);

    if (!gammes?.length) return this.summarize([]);

    const items = [];
    for (const g of gammes) {
      items.push(
        await this.generateForGamme(
          g.rkp_pg_id,
          g.rkp_pg_alias,
          g.rkp_gamme_name ?? g.rkp_pg_alias.replace(/-/g, ' '),
          options,
        ),
      );
    }
    return this.summarize(items);
  }

  async getPromptsForGamme(pgAlias: string) {
    const { data } = await this.supabase
      .from('__seo_r1_image_prompts')
      .select('*')
      .eq('rip_pg_alias', pgAlias)
      .order('rip_priority_rank', { ascending: true });
    return data ?? [];
  }

  /**
   * Mark all prompts for a gamme as stale (RAG context changed).
   * Called by RagChangeWatcherService when RAG files change.
   */
  async markStaleByGamme(pgAlias: string): Promise<number> {
    const { data } = await this.supabase
      .from('__seo_r1_image_prompts')
      .update({ rip_stale: true, rip_updated_at: new Date().toISOString() })
      .eq('rip_pg_alias', pgAlias)
      .eq('rip_stale', false)
      .select('rip_id');

    const count = data?.length ?? 0;
    if (count > 0) {
      this.logger.log(`[R1-IMG] Marked ${count} prompts stale for ${pgAlias}`);
    }
    return count;
  }

  /**
   * Clear stale flag (after regeneration).
   */
  async clearStale(pgAlias: string): Promise<void> {
    await this.supabase
      .from('__seo_r1_image_prompts')
      .update({ rip_stale: false, rip_updated_at: new Date().toISOString() })
      .eq('rip_pg_alias', pgAlias);
  }

  async approvePrompt(id: number) {
    const { error } = await this.supabase
      .from('__seo_r1_image_prompts')
      .update({
        rip_status: 'approved',
        rip_updated_at: new Date().toISOString(),
      })
      .eq('rip_id', id);
    return { success: !error, error: error?.message };
  }

  /**
   * Set image URL on a prompt.
   * - Auto-approve always
   * - Auto-select only if no other approved+selected image with URL exists on same slot
   * - forceSelect=true → atomic swap (deselect old, select new)
   */
  async setImageUrl(
    id: number,
    imageUrl: string,
    options?: { forceSelect?: boolean },
  ) {
    const { data: prompt } = await this.supabase
      .from('__seo_r1_image_prompts')
      .select('rip_pg_id, rip_slot_id')
      .eq('rip_id', id)
      .single();

    if (!prompt) return { success: false, error: 'Prompt not found' };

    // Check if another image is already active on this slot
    const { data: activeOnSlot } = await this.supabase
      .from('__seo_r1_image_prompts')
      .select('rip_id')
      .eq('rip_pg_id', prompt.rip_pg_id)
      .eq('rip_slot_id', prompt.rip_slot_id)
      .eq('rip_selected', true)
      .eq('rip_status', 'approved')
      .not('rip_image_url', 'is', null)
      .neq('rip_id', id)
      .limit(1);

    const slotOccupied = (activeOnSlot?.length ?? 0) > 0;
    const shouldSelect = !slotOccupied || options?.forceSelect;

    if (shouldSelect && slotOccupied) {
      // Atomic swap: deselect the existing active image first
      await this.supabase
        .from('__seo_r1_image_prompts')
        .update({
          rip_selected: false,
          rip_updated_at: new Date().toISOString(),
        })
        .eq('rip_pg_id', prompt.rip_pg_id)
        .eq('rip_slot_id', prompt.rip_slot_id)
        .neq('rip_id', id);
    }

    const { error } = await this.supabase
      .from('__seo_r1_image_prompts')
      .update({
        rip_image_url: imageUrl,
        rip_status: 'approved',
        rip_selected: shouldSelect,
        rip_updated_at: new Date().toISOString(),
      })
      .eq('rip_id', id);

    return { success: !error, error: error?.message, selected: shouldSelect };
  }

  /**
   * Upload image file + set URL.
   * - Slot vide → approved + selected=true (visible immédiatement)
   * - Slot occupé → approved + selected=false (pas d'écrasement silencieux)
   * - forceSelect=true → swap atomique
   */
  async uploadAndSetImage(
    ripId: number,
    file: Express.Multer.File,
    options?: { forceSelect?: boolean },
  ) {
    const { data: prompt } = await this.supabase
      .from('__seo_r1_image_prompts')
      .select('rip_pg_alias, rip_slot_id, rip_pg_id')
      .eq('rip_id', ripId)
      .single();

    if (!prompt) return { success: false, error: 'Prompt not found' };

    // Storage path: {alias}.webp for HERO, {alias}-{n}.webp for others
    const slotSuffix: Record<string, string> = {
      HERO: '',
      TYPES: '-2',
      PRICE: '-3',
      LOCATION: '-4',
      OG: '-og',
    };
    const suffix =
      slotSuffix[prompt.rip_slot_id] ?? `-${prompt.rip_slot_id.toLowerCase()}`;
    const path = `articles/gammes-produits/r1/${prompt.rip_pg_alias}${suffix}.webp`;

    // Upload to Supabase Storage
    const { error: uploadError } = await this.supabase.storage
      .from('uploads')
      .upload(path, file.buffer, {
        contentType: file.mimetype,
        upsert: true,
      });

    if (uploadError) return { success: false, error: uploadError.message };

    // Get public URL
    const { data: urlData } = this.supabase.storage
      .from('uploads')
      .getPublicUrl(path);

    const imageUrl = urlData.publicUrl;

    // Delegate to setImageUrl (handles slot occupancy + forceSelect)
    const result = await this.setImageUrl(ripId, imageUrl, options);
    return { ...result, imageUrl };
  }

  private summarize(items: Array<{ status: string }>) {
    return {
      processed: items.length,
      generated: items.filter((i) => i.status === 'generated').length,
      skipped: items.filter((i) => i.status === 'skipped').length,
      failed: items.filter((i) => i.status === 'failed').length,
      items,
    };
  }
}
