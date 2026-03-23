/**
 * R1ImagePromptService — Génère les prompts image pour les 5 emplacements
 * de chaque page gamme R1. Template + nom de gamme, c'est tout.
 */
import { Injectable, Logger } from '@nestjs/common';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';

const SLOTS = [
  {
    id: 'HERO',
    section: 'R1_S1_HERO',
    aspect: '16:9',
    width: 1200,
    cost: 0,
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
    prompt: (n: string) =>
      `Schéma technique comparatif, fond blanc, style flat design. Les différents types de ${n} avec flèches sur les différences physiques. Légendes et cotes dimensionnelles. Format 4:3.`,
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
    prompt: (n: string) =>
      `Infographie prix, design minimaliste, fond blanc. Fourchettes de prix du ${n} par niveau de gamme (éco, standard, premium). Barres horizontales, code couleur vert/bleu/orange. Format 4:3.`,
    alt: (n: string) => `Prix ${n.toLowerCase()} — fourchettes par gamme`,
    caption: (n: string) => `Fourchettes de prix ${n.toLowerCase()}`,
  },
  {
    id: 'LOCATION',
    section: 'R1_S5_COMPAT',
    aspect: '4:3',
    width: 800,
    cost: 1,
    prompt: (n: string) =>
      `Vue éclatée technique, illustration automobile, fond blanc. ${n} à son emplacement sur le moteur ou le véhicule. Pièces adjacentes visibles avec flèches légendées et numéros de repère. Format 4:3.`,
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
    prompt: (n: string) =>
      `Image partage social 1200x630. Fond sombre dégradé automobile. ${n} neuf centré, éclairage dramatique latéral. Pas de texte. Format 1200:630.`,
    alt: (n: string) => `${n} — AutoMecanik`,
    caption: () => null as string | null,
  },
] as const;

const NEG =
  'cartoon, low quality, watermark, blurry, text overlay, human hands, visible logo, brand name, 3D render';

@Injectable()
export class R1ImagePromptService extends SupabaseBaseService {
  protected readonly logger = new Logger(R1ImagePromptService.name);

  async generateForGamme(
    pgId: number,
    pgAlias: string,
    pgName: string,
    options?: { force?: boolean },
  ) {
    if (!options?.force) {
      const { data: existing } = await this.supabase
        .from('__seo_r1_image_prompts')
        .select('rip_slot_id')
        .eq('rip_pg_id', pgId);
      if (existing && existing.length >= SLOTS.length) {
        return { pgAlias, status: 'skipped' as const, slots: [] };
      }
    }

    const rows = SLOTS.map((slot, i) => ({
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
      rip_neg_prompt: NEG,
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

  async setImageUrl(id: number, imageUrl: string) {
    const { error } = await this.supabase
      .from('__seo_r1_image_prompts')
      .update({
        rip_image_url: imageUrl,
        rip_status: 'approved',
        rip_updated_at: new Date().toISOString(),
      })
      .eq('rip_id', id);
    return { success: !error, error: error?.message };
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
