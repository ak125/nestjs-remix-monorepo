/**
 * R1ImagePromptService — Génère les prompts image pour les 5 emplacements
 * de chaque page gamme R1. Template + nom de gamme, c'est tout.
 */
import { Injectable, Logger } from '@nestjs/common';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';

// Negative prompts par intention visuelle
const NEG_PHOTO =
  'cartoon, illustration, clipart, sketch, diagram, infographic, low quality, watermark, blurry, text overlay, human hands, visible logo, brand name, 3D render';
const NEG_SCHEMA =
  'photograph, photo, photorealistic, product catalog, studio lighting, depth of field, bokeh, cartoon, low quality, watermark, blurry, human hands, visible logo, brand name';

const SLOTS = [
  {
    id: 'HERO',
    section: 'R1_S1_HERO',
    aspect: '16:9',
    width: 1200,
    cost: 0,
    neg: NEG_PHOTO,
    prompt: (n: string) =>
      `Photo produit sur fond neutre. ${n} neuf, plusieurs variantes côte à côte si elles existent. Pièce automobile. Éclairage studio, détail des points de fixation et connectique. Format 16:9.`,
    alt: (n: string) => `${n} — photo produit`,
    caption: (n: string) => `${n} — vue détaillée`,
  },
  {
    id: 'TYPES',
    section: 'R1_S4_MICRO_SEO',
    aspect: '4:3',
    width: 800,
    cost: 1,
    neg: NEG_SCHEMA,
    prompt: (n: string) =>
      `Schéma technique comparatif, fond blanc, style flat design vectoriel. Les différents types de ${n} avec flèches sur les différences physiques. Légendes et cotes dimensionnelles. Rendu net sans ombre. Format 4:3.`,
    alt: (n: string) => `Types de ${n.toLowerCase()} — schéma comparatif`,
    caption: (n: string) =>
      `Comment distinguer les types de ${n.toLowerCase()}`,
  },
  {
    id: 'PRICE',
    section: 'R1_S4_MICRO_SEO',
    aspect: '4:3',
    width: 800,
    cost: 1,
    neg: NEG_SCHEMA,
    prompt: (n: string) =>
      `Infographie prix, design minimaliste flat, fond blanc. Fourchettes de prix du ${n} par niveau de gamme (éco, standard, premium). Barres horizontales, code couleur vert/bleu/orange. Sans ombre, rendu vectoriel. Format 4:3.`,
    alt: (n: string) => `Prix ${n.toLowerCase()} — fourchettes par gamme`,
    caption: (n: string) => `Fourchettes de prix ${n.toLowerCase()}`,
  },
  {
    id: 'LOCATION',
    section: 'R1_S5_COMPAT',
    aspect: '4:3',
    width: 800,
    cost: 1,
    neg: NEG_SCHEMA,
    prompt: (n: string) =>
      `Vue éclatée technique, dessin technique automobile, fond blanc. ${n} à son emplacement sur le moteur ou le véhicule. Pièces adjacentes visibles avec flèches légendées et numéros de repère. Trait fin, rendu schématique. Format 4:3.`,
    alt: (n: string) => `Emplacement du ${n.toLowerCase()} sur le véhicule`,
    caption: (n: string) =>
      `Où se trouve le ${n.toLowerCase()} sur le véhicule`,
  },
  {
    id: 'OG',
    section: 'META',
    aspect: '1200:630',
    width: 1200,
    cost: 0,
    neg: NEG_PHOTO,
    prompt: (n: string) =>
      `Image partage social 1200x630. Fond sombre dégradé automobile. ${n} neuf centré, éclairage dramatique latéral. Pas de texte. Format 1200:630.`,
    alt: (n: string) => `${n} — AutoMecanik`,
    caption: () => null as string | null,
  },
] as const;

@Injectable()
export class R1ImagePromptService extends SupabaseBaseService {
  protected readonly logger = new Logger(R1ImagePromptService.name);

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
    if (!options?.force && existing && existing.length >= SLOTS.length) {
      return { pgAlias, status: 'skipped' as const, slots: [] };
    }

    // Ne jamais écraser un slot qui a une image uploadée
    const slotsToWrite = SLOTS.filter((slot) => {
      const ex = existingMap.get(slot.id);
      return !ex?.rip_image_url;
    });

    if (slotsToWrite.length === 0) {
      return { pgAlias, status: 'skipped' as const, slots: [] };
    }

    const rows = slotsToWrite.map((slot, i) => ({
      rip_pg_id: pgId,
      rip_pg_alias: pgAlias,
      rip_gamme_name: pgName,
      rip_slot_id: slot.id,
      rip_section_id: slot.section,
      rip_topic: slot.id.toLowerCase(),
      rip_aspect_ratio: slot.aspect,
      rip_min_width: slot.width,
      rip_prompt_text: slot.prompt(pgName),
      rip_alt_text: slot.alt(pgName),
      rip_neg_prompt: slot.neg,
      rip_caption: slot.caption(pgName),
      rip_budget_cost: slot.cost,
      rip_selected: true,
      rip_priority_rank: i + 1,
      rip_rag_fields_used: [] as string[],
      rip_rag_richness_score: 0,
      rip_status: 'pending',
    }));

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

    return {
      pgAlias,
      status: 'generated' as const,
      slots: SLOTS.map((s) => s.id),
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
