import { Injectable, Logger } from '@nestjs/common';
import { SupabaseBaseService } from '@database/services/supabase-base.service';

/** Raw DB row shape from __seo_r1_gamme_slots */
interface R1SlotsDbRow {
  r1s_pg_id: string;
  r1s_h1_override?: string | null;
  r1s_hero_subtitle?: string | null;
  r1s_selector_microcopy?: string[] | null;
  r1s_micro_seo_block?: string | null;
  r1s_compatibilities_intro?: string | null;
  r1s_equipementiers_line?: string | null;
  r1s_family_cross_sell_intro?: string | null;
  r1s_interest_nuggets?: unknown;
  r1s_serp_variants?: unknown;
  r1s_intent_lock?: unknown;
  r1s_safe_table_rows?: unknown;
  r1s_arg1_title?: string | null;
  r1s_arg1_content?: string | null;
  r1s_arg1_icon?: string | null;
  r1s_arg2_title?: string | null;
  r1s_arg2_content?: string | null;
  r1s_arg2_icon?: string | null;
  r1s_arg3_title?: string | null;
  r1s_arg3_content?: string | null;
  r1s_arg3_icon?: string | null;
  r1s_arg4_title?: string | null;
  r1s_arg4_content?: string | null;
  r1s_arg4_icon?: string | null;
  r1s_faq?: unknown;
  r1s_gatekeeper_score?: number | null;
  r1s_gatekeeper_flags?: string[] | null;
  r1s_gatekeeper_checks?: unknown;
}

/** R1 rendering data returned to frontend */
export interface R1GammeSlotsData {
  pgId: string;
  h1Override?: string | null;
  heroSubtitle?: string | null;
  selectorMicrocopy?: string[] | null;
  microSeoBlock?: string | null;
  compatibilitiesIntro?: string | null;
  equipementiersLine?: string | null;
  familyCrossSellIntro?: string | null;
  interestNuggets?: unknown;
  serpVariants?: unknown;
  intentLock?: unknown;
  safeTableRows?: unknown;
  arguments: Array<{ title: string; content: string; icon: string }>;
  faq?: Array<{ question: string; answer: string }> | null;
  gatekeeperScore?: number | null;
}

/** Raw DB row shape from __seo_gamme_purchase_guide */
interface PurchaseGuideDbRow {
  sgpg_id: number;
  sgpg_pg_id: number;
  sgpg_intro_title?: string | null;
  sgpg_intro_role?: string | null;
  sgpg_intro_sync_parts?: unknown;
  sgpg_risk_title?: string | null;
  sgpg_risk_explanation?: string | null;
  sgpg_risk_consequences?: unknown;
  sgpg_risk_cost_range?: string | null;
  sgpg_risk_conclusion?: string | null;
  sgpg_timing_title?: string | null;
  sgpg_timing_years?: string | null;
  sgpg_timing_km?: string | null;
  sgpg_timing_note?: string | null;
  sgpg_arg1_title?: string | null;
  sgpg_arg1_content?: string | null;
  sgpg_arg1_icon?: string | null;
  sgpg_arg2_title?: string | null;
  sgpg_arg2_content?: string | null;
  sgpg_arg2_icon?: string | null;
  sgpg_arg3_title?: string | null;
  sgpg_arg3_content?: string | null;
  sgpg_arg3_icon?: string | null;
  sgpg_arg4_title?: string | null;
  sgpg_arg4_content?: string | null;
  sgpg_arg4_icon?: string | null;
  sgpg_h1_override?: string | null;
  sgpg_how_to_choose?: string | null;
  sgpg_symptoms?: unknown;
  sgpg_faq?: unknown;
  [key: string]: unknown;
}

/**
 * Interface pour les données du guide d'achat V2
 * Structure orientée client avec sections intro/risk/timing/arguments
 */
export interface PurchaseGuideDataV2 {
  id: number;
  pgId: string;
  // Section 1: À quoi ça sert
  intro: {
    title: string;
    role: string;
    syncParts: string[];
  };
  // Section 2: Pourquoi c'est critique
  risk: {
    title: string;
    explanation: string;
    consequences: string[];
    costRange: string;
    conclusion: string;
  };
  // Section 3: Quand changer
  timing: {
    title: string;
    years: string;
    km: string;
    note: string;
  };
  // Section 4: Pourquoi acheter chez nous (4 arguments)
  arguments: Array<{
    title: string;
    content: string;
    icon: string;
  }>;
  // Nouvelles sections (Phase 2)
  h1Override?: string | null;
  howToChoose?: string | null;
  symptoms?: string[] | null;
  faq?: Array<{ question: string; answer: string }> | null;
}

/**
 * Service pour récupérer les données du guide d'achat V2
 */
@Injectable()
export class PurchaseGuideDataService extends SupabaseBaseService {
  protected override readonly logger = new Logger(
    PurchaseGuideDataService.name,
  );

  /**
   * Récupère les slots R1 depuis __seo_r1_gamme_slots (table dédiée R1)
   */
  async getR1Slots(pgId: string): Promise<R1GammeSlotsData | null> {
    try {
      const { data, error } = await this.client
        .from('__seo_r1_gamme_slots')
        .select('*')
        .eq('r1s_pg_id', pgId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          this.logger.debug(`Pas de R1 slots pour gamme ${pgId}`);
          return null;
        }
        throw error;
      }

      if (!data) return null;

      const row = data as R1SlotsDbRow;
      const args: Array<{ title: string; content: string; icon: string }> = [];

      for (const i of [1, 2, 3, 4] as const) {
        const title = row[`r1s_arg${i}_title` as keyof R1SlotsDbRow] as
          | string
          | null;
        const content = row[`r1s_arg${i}_content` as keyof R1SlotsDbRow] as
          | string
          | null;
        const icon = row[`r1s_arg${i}_icon` as keyof R1SlotsDbRow] as
          | string
          | null;
        if (title && content) {
          args.push({ title, content, icon: icon || 'check-circle' });
        }
      }

      const parseFaq = (
        val: unknown,
      ): Array<{ question: string; answer: string }> | null => {
        if (!val) return null;
        if (Array.isArray(val)) return val;
        if (typeof val === 'string') {
          try {
            return JSON.parse(val);
          } catch {
            return null;
          }
        }
        return null;
      };

      return {
        pgId: String(row.r1s_pg_id),
        h1Override: row.r1s_h1_override || null,
        heroSubtitle: row.r1s_hero_subtitle || null,
        selectorMicrocopy: row.r1s_selector_microcopy || null,
        microSeoBlock: row.r1s_micro_seo_block || null,
        compatibilitiesIntro: row.r1s_compatibilities_intro || null,
        equipementiersLine: row.r1s_equipementiers_line || null,
        familyCrossSellIntro: row.r1s_family_cross_sell_intro || null,
        interestNuggets: row.r1s_interest_nuggets || null,
        serpVariants: row.r1s_serp_variants || null,
        intentLock: row.r1s_intent_lock || null,
        safeTableRows: row.r1s_safe_table_rows || null,
        arguments: args,
        faq: parseFaq(row.r1s_faq),
        gatekeeperScore: row.r1s_gatekeeper_score || null,
      };
    } catch (error) {
      this.logger.error(`Erreur R1 slots pour gamme ${pgId}:`, error);
      return null;
    }
  }

  /**
   * Upsert R1 slots into __seo_r1_gamme_slots.
   * Used by R1ContentPipelineService, r1-content-batch agent, /content-gen --r1.
   */
  async upsertR1Slots(
    pgId: string,
    slots: Partial<Omit<R1SlotsDbRow, 'r1s_pg_id'>>,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await this.client
        .from('__seo_r1_gamme_slots')
        .upsert({ r1s_pg_id: pgId, ...slots }, { onConflict: 'r1s_pg_id' });

      if (error) {
        this.logger.error(
          `Erreur upsert R1 slots pour gamme ${pgId}: ${error.message}`,
        );
        return { success: false, error: error.message };
      }

      this.logger.log(`R1 slots upserted pour gamme ${pgId}`);
      return { success: true };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Erreur upsert R1 slots pour gamme ${pgId}: ${msg}`);
      return { success: false, error: msg };
    }
  }

  /**
   * Récupère les données du guide d'achat V2 pour une gamme
   */
  async getPurchaseGuideV2(pgId: string): Promise<PurchaseGuideDataV2 | null> {
    try {
      const { data, error } = await this.client
        .from('__seo_gamme_purchase_guide')
        .select(
          `
          sgpg_id,
          sgpg_pg_id,
          sgpg_intro_title,
          sgpg_intro_role,
          sgpg_intro_sync_parts,
          sgpg_risk_title,
          sgpg_risk_explanation,
          sgpg_risk_consequences,
          sgpg_risk_cost_range,
          sgpg_risk_conclusion,
          sgpg_timing_title,
          sgpg_timing_years,
          sgpg_timing_km,
          sgpg_timing_note,
          sgpg_arg1_title,
          sgpg_arg1_content,
          sgpg_arg1_icon,
          sgpg_arg2_title,
          sgpg_arg2_content,
          sgpg_arg2_icon,
          sgpg_arg3_title,
          sgpg_arg3_content,
          sgpg_arg3_icon,
          sgpg_arg4_title,
          sgpg_arg4_content,
          sgpg_arg4_icon,
          sgpg_h1_override,
          sgpg_how_to_choose,
          sgpg_symptoms,
          sgpg_faq
        `,
        )
        .eq('sgpg_pg_id', pgId)
        .neq('sgpg_is_draft', true)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // Pas de données pour cette gamme (ou is_draft=true)
          this.logger.debug(`Pas de guide d'achat pour gamme ${pgId}`);
          return null;
        }
        throw error;
      }

      if (!data) {
        return null;
      }

      // Transformer les données brutes en structure V2
      return this.transformToV2(data);
    } catch (error) {
      this.logger.error(
        `Erreur lors de la récupération du guide d'achat pour gamme ${pgId}:`,
        error,
      );
      return null;
    }
  }

  /**
   * Transforme les données brutes de la DB en structure V2
   */
  private transformToV2(raw: PurchaseGuideDbRow): PurchaseGuideDataV2 {
    // Construire le tableau d'arguments (4 max)
    const args: Array<{ title: string; content: string; icon: string }> = [];

    if (raw.sgpg_arg1_title && raw.sgpg_arg1_content) {
      args.push({
        title: raw.sgpg_arg1_title,
        content: raw.sgpg_arg1_content,
        icon: raw.sgpg_arg1_icon || 'check-circle',
      });
    }
    if (raw.sgpg_arg2_title && raw.sgpg_arg2_content) {
      args.push({
        title: raw.sgpg_arg2_title,
        content: raw.sgpg_arg2_content,
        icon: raw.sgpg_arg2_icon || 'shield-check',
      });
    }
    if (raw.sgpg_arg3_title && raw.sgpg_arg3_content) {
      args.push({
        title: raw.sgpg_arg3_title,
        content: raw.sgpg_arg3_content,
        icon: raw.sgpg_arg3_icon || 'currency-euro',
      });
    }
    if (raw.sgpg_arg4_title && raw.sgpg_arg4_content) {
      args.push({
        title: raw.sgpg_arg4_title,
        content: raw.sgpg_arg4_content,
        icon: raw.sgpg_arg4_icon || 'cube',
      });
    }

    // Parser syncParts et consequences (peuvent être TEXT[] ou JSONB)
    const parseSyncParts = (val: unknown): string[] => {
      if (!val) return [];
      if (Array.isArray(val)) return val;
      if (typeof val === 'string') {
        try {
          return JSON.parse(val);
        } catch {
          return [val];
        }
      }
      return [];
    };

    const parseConsequences = (val: unknown): string[] => {
      if (!val) return [];
      if (Array.isArray(val)) return val;
      if (typeof val === 'string') {
        try {
          return JSON.parse(val);
        } catch {
          return [val];
        }
      }
      return [];
    };

    const parseFaq = (
      val: unknown,
    ): Array<{ question: string; answer: string }> => {
      if (!val) return [];
      if (Array.isArray(val)) return val;
      if (typeof val === 'string') {
        try {
          return JSON.parse(val);
        } catch {
          return [];
        }
      }
      return [];
    };

    return {
      id: raw.sgpg_id,
      pgId: String(raw.sgpg_pg_id),
      intro: {
        title: raw.sgpg_intro_title || 'À quoi ça sert ?',
        role: raw.sgpg_intro_role || '',
        syncParts: parseSyncParts(raw.sgpg_intro_sync_parts),
      },
      risk: {
        title: raw.sgpg_risk_title || 'Pourquoi ne jamais attendre ?',
        explanation: raw.sgpg_risk_explanation || '',
        consequences: parseConsequences(raw.sgpg_risk_consequences),
        costRange: raw.sgpg_risk_cost_range || '',
        conclusion: raw.sgpg_risk_conclusion || '',
      },
      timing: {
        title: raw.sgpg_timing_title || 'Quand faut-il la changer ?',
        years: raw.sgpg_timing_years || '',
        km: raw.sgpg_timing_km || '',
        note: raw.sgpg_timing_note || '',
      },
      arguments: args,
      // Nouvelles sections
      h1Override: raw.sgpg_h1_override || null,
      howToChoose: raw.sgpg_how_to_choose || null,
      symptoms: parseSyncParts(raw.sgpg_symptoms),
      faq: parseFaq(raw.sgpg_faq),
    };
  }
}
