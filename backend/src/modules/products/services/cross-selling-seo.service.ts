import { Injectable, Logger } from '@nestjs/common';
import { TABLES } from '@repo/database-types';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import { decodeHtmlEntities } from '../../../utils/html-entities';
import type {
  CrossGamme,
  VehicleContext,
  SeoVariables,
  SeoSwitch,
  CrossSellingSeo,
} from './cross-selling.service';

/**
 * CrossSellingSeoService - SEO generation and switch processing for cross-selling.
 *
 * Extracted from CrossSellingService to isolate:
 * - Template-based SEO generation (seo_gamme_car)
 * - Switch resolution (gamme, family, external)
 * - Variable replacement and text cleaning
 * - Keyword generation
 */
@Injectable()
export class CrossSellingSeoService extends SupabaseBaseService {
  protected readonly logger = new Logger(CrossSellingSeoService.name);

  /**
   * Generate advanced cross-selling SEO content using templates and switches.
   */
  async generateAdvancedCrossSellingSeo(
    crossGamme: CrossGamme,
    typeId: number,
    pgId: number,
    vehicleContext: VehicleContext,
  ): Promise<CrossSellingSeo> {
    const startTime = Date.now();

    try {
      // Template SEO from seo_gamme_car
      const { data: seoTemplate } = await this.supabase
        .from(TABLES.seo_gamme_car)
        .select('sgc_title, sgc_descrip, sgc_h1, sgc_content')
        .eq('sgc_pg_id', crossGamme.pg_id)
        .single();

      if (!seoTemplate) {
        return this.getDefaultCrossSeo(crossGamme, vehicleContext, startTime);
      }

      // Parallel switch retrieval
      const [switches, familySwitches, externalSwitches] = await Promise.all([
        this.getGammeSwitches(crossGamme.pg_id),
        this.getFamilySwitches(vehicleContext.mfId),
        this.getExternalSwitches(typeId),
      ]);

      // Cross-selling enriched variables
      const variables: SeoVariables = {
        gammeMeta: crossGamme.pg_name,
        gammeAlias: crossGamme.pg_alias,
        marque: vehicleContext.marque_name || 'véhicule',
        modele: vehicleContext.modele_name || 'modèle',
        type: vehicleContext.type_name || 'type',
        nbCh: vehicleContext.type_nbch || 0,
        annee: vehicleContext.type_date || new Date().getFullYear().toString(),
      };

      // Parallel template processing with switches
      const [title, description, h1, content] = await Promise.all([
        this.processWithSwitches(
          seoTemplate.sgc_title,
          variables,
          switches,
          typeId,
          1,
        ),
        this.processWithSwitches(
          seoTemplate.sgc_descrip,
          variables,
          [...switches, ...familySwitches],
          typeId,
          2,
        ),
        this.processWithSwitches(
          seoTemplate.sgc_h1 || '',
          variables,
          switches,
          typeId,
          3,
        ),
        this.processWithSwitches(
          seoTemplate.sgc_content || '',
          variables,
          [...switches, ...externalSwitches],
          typeId,
          4,
        ),
      ]);

      return {
        title: this.cleanSeoText(title),
        description: this.cleanSeoText(description),
        h1: this.cleanSeoText(h1),
        content: this.cleanSeoText(content),
        keywords: this.generateCrossKeywords(variables),
        generation_meta: {
          switches_processed:
            switches.length + familySwitches.length + externalSwitches.length,
          variables_replaced: this.countVariablesReplaced(
            title + description + content,
          ),
          generation_time: Date.now() - startTime,
          template_source: 'seo_gamme_car',
        },
      };
    } catch (error) {
      this.logger.error('❌ Erreur génération SEO cross-selling:', error);
      return this.getDefaultCrossSeo(crossGamme, vehicleContext, startTime);
    }
  }

  /**
   * Process a template string by replacing variables and applying switches.
   */
  async processWithSwitches(
    template: string,
    variables: SeoVariables,
    switches: SeoSwitch[],
    typeId: number,
    context: number,
  ): Promise<string> {
    let processed = template;

    // Base variables
    processed = this.replaceVariables(processed, variables);

    // Switches
    processed = await this.processSwitches(
      processed,
      switches,
      typeId,
      context,
    );

    return processed;
  }

  /**
   * Apply CompSwitch patterns from switches to content.
   */
  async processSwitches(
    content: string,
    switches: SeoSwitch[],
    typeId: number,
    context: number,
  ): Promise<string> {
    let processed = content;

    // Process CompSwitch patterns
    for (let alias = 1; alias <= 3; alias++) {
      const regex = new RegExp(`#CompSwitch_${alias}_\\d+#`, 'g');
      const matches = processed.match(regex);

      if (matches) {
        for (const match of matches) {
          const aliasSwitches = switches.filter((s) => s.sgcs_alias === alias);
          if (aliasSwitches.length > 0) {
            const index = (typeId + context) % aliasSwitches.length;
            processed = processed.replace(
              match,
              aliasSwitches[index].sgcs_content || '',
            );
          }
        }
      }
    }

    return processed;
  }

  /**
   * Replace #variable# placeholders in content.
   */
  replaceVariables(content: string, variables: SeoVariables): string {
    let processed = content;

    Object.entries(variables).forEach(([key, value]) => {
      const regex = new RegExp(`#${key}#`, 'gi');
      processed = processed.replace(regex, String(value));
    });

    return processed;
  }

  /**
   * Get gamme-level SEO switches.
   */
  async getGammeSwitches(pgId: number): Promise<SeoSwitch[]> {
    const { data } = await this.supabase
      .from(TABLES.seo_gamme_car_switch)
      .select('*')
      .eq('sgcs_pg_id', pgId);
    return data || [];
  }

  /**
   * Get family-level SEO switches.
   */
  async getFamilySwitches(mfId: number | undefined): Promise<SeoSwitch[]> {
    if (!mfId) return [];
    const { data } = await this.supabase
      .from(TABLES.seo_family_gamme_car_switch)
      .select('*')
      .eq('sfgcs_mf_id', mfId);
    return data || [];
  }

  /**
   * Get external (type-level) SEO switches.
   */
  async getExternalSwitches(typeId: number): Promise<SeoSwitch[]> {
    const { data } = await this.supabase
      .from('__seo_type_switch')
      .select('*')
      .eq('sts_type_id', typeId);
    return data || [];
  }

  /**
   * Clean SEO text: decode HTML entities, collapse whitespace, remove unreplaced variables.
   */
  cleanSeoText(content: string): string {
    return decodeHtmlEntities(content)
      .replace(/\s+/g, ' ')
      .replace(/#+\w*#+/g, '')
      .trim();
  }

  /**
   * Count remaining unreplaced #variable# placeholders.
   */
  countVariablesReplaced(content: string): number {
    const matches = content.match(/#\w+#/g);
    return matches ? matches.length : 0;
  }

  /**
   * Generate default/fallback SEO content when no template is found.
   */
  getDefaultCrossSeo(
    gamme: CrossGamme,
    vehicleContext: VehicleContext,
    startTime: number,
  ): CrossSellingSeo {
    return {
      title: `${gamme.pg_name} - Pièces ${vehicleContext.marque_name} | Automecanik`,
      description: `Découvrez notre gamme ${gamme.pg_name} pour ${vehicleContext.marque_name}. Large choix de pièces détachées auto au meilleur prix.`,
      h1: `Pièces ${gamme.pg_name} ${vehicleContext.marque_name}`,
      content: `Gamme complète de ${gamme.pg_name} disponible pour votre ${vehicleContext.marque_name}.`,
      keywords: `${gamme.pg_name}, pièces ${vehicleContext.marque_name}, pièces détachées`,
      generation_meta: {
        switches_processed: 0,
        variables_replaced: 0,
        generation_time: Date.now() - startTime,
        template_source: 'default_fallback',
      },
    };
  }

  /**
   * Generate cross-selling keywords from SEO variables.
   */
  generateCrossKeywords(variables: SeoVariables): string {
    return [
      variables.gammeMeta,
      'pièces ' + variables.marque,
      variables.gammeAlias,
      'pièces détachées',
      'automecanik',
    ]
      .filter(Boolean)
      .join(', ');
  }
}
