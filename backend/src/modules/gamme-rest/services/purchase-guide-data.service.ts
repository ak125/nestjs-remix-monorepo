import { Injectable, Logger } from '@nestjs/common';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';

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
  private transformToV2(raw: any): PurchaseGuideDataV2 {
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
    const parseSyncParts = (val: any): string[] => {
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

    const parseConsequences = (val: any): string[] => {
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
      val: any,
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
