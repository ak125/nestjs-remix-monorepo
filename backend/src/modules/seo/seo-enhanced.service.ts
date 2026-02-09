import { TABLES } from '@repo/database-types';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseBaseService } from '../../database/services/supabase-base.service';
import { DomainNotFoundException, ErrorCodes } from '../../common/exceptions';
import { getErrorMessage } from '../../common/utils/error.utils';

// Interfaces pour les types de données SEO enhancées
interface SeoVariables {
  gamme?: string;
  marque?: string;
  modele?: string;
  type?: string;
  annee?: string;
  nbCh?: string;
  minPrice?: number;
  prixPasCher?: string;
}

interface SeoTemplate {
  pg_id: number;
  pg_title: string;
  pg_description: string;
  pg_h1: string;
  pg_content: string;
  pg_keywords: string;
}

interface SeoSwitch {
  sgcs_id: number;
  sgcs_alias: string;
  sgcs_content: string;
}

export interface SeoGenerationResult {
  title: string;
  description: string;
  h1: string;
  content: string;
  keywords: string;
}

interface PiecesSeoRequest {
  marque: string;
  modele: string;
  type: string;
  gamme: string;
  annee?: string;
  nbCh?: string;
  minPrice?: number;
}

@Injectable()
export class SeoEnhancedService extends SupabaseBaseService {
  protected readonly logger = new Logger(SeoEnhancedService.name);

  // Variations de prix pour la diversité du contenu
  private enhancedPriceVariations = [
    'à prix imbattables',
    'pas cher',
    'à petit prix',
    'économique',
    'à prix réduit',
    'à tarif avantageux',
  ];

  constructor(configService: ConfigService) {
    super(configService);
    this.logger.log(
      '🎯 SeoEnhancedService initialisé avec templates dynamiques',
    );
  }

  /**
   * Génère un contenu SEO avancé avec templates et switches
   */
  async generateSeoContent(
    pgId: number,
    typeId: number,
    variables: SeoVariables,
  ): Promise<SeoGenerationResult> {
    try {
      // Récupération du template
      const supabase = this.supabase;
      const { data: template } = await supabase
        .from(TABLES.seo_gamme_car)
        .select('*')
        .eq('pg_id', pgId)
        .single();

      if (!template) {
        throw new DomainNotFoundException({
          code: ErrorCodes.SEO.TEMPLATE_NOT_FOUND,
          message: `Template non trouvé pour pg_id: ${pgId}`,
        });
      }

      // Récupération des switches
      const { data: switches } = await supabase
        .from(TABLES.seo_gamme_car_switch)
        .select('*');

      // Traitement du template
      const result = await this.processTemplate(
        template,
        typeId,
        variables,
        switches || [],
      );

      this.logger.log(
        `✅ Contenu SEO généré pour pgId=${pgId}, typeId=${typeId}`,
      );
      return result;
    } catch (error) {
      this.logger.error(`❌ Erreur génération SEO: ${getErrorMessage(error)}`);
      return this.getFallbackSeoContent(variables);
    }
  }

  /**
   * Traite un template avec variables et switches
   */
  private async processTemplate(
    template: SeoTemplate,
    typeId: number,
    variables: SeoVariables,
    switches: SeoSwitch[],
  ): Promise<SeoGenerationResult> {
    // Traitement de base des variables
    let processedTitle = this.replaceVariables(
      template.pg_title,
      variables,
      typeId,
    );
    let processedDescription = this.replaceVariables(
      template.pg_description,
      variables,
      typeId,
    );
    let processedH1 = this.replaceVariables(template.pg_h1, variables, typeId);
    let processedContent = this.replaceVariables(
      template.pg_content,
      variables,
      typeId,
    );
    let processedKeywords = this.replaceVariables(
      template.pg_keywords,
      variables,
      typeId,
    );

    // Traitement des switches dynamiques
    processedTitle = await this.processSwitches(
      processedTitle,
      typeId,
      switches,
    );
    processedDescription = await this.processSwitches(
      processedDescription,
      typeId,
      switches,
    );
    processedH1 = await this.processSwitches(processedH1, typeId, switches);
    processedContent = await this.processSwitches(
      processedContent,
      typeId,
      switches,
    );
    processedKeywords = await this.processSwitches(
      processedKeywords,
      typeId,
      switches,
    );

    return {
      title: this.cleanText(processedTitle),
      description: this.cleanText(processedDescription),
      h1: this.cleanText(processedH1),
      content: this.cleanText(processedContent),
      keywords: this.cleanText(processedKeywords),
    };
  }

  /**
   * Remplace les variables dans un template
   */
  private replaceVariables(
    content: string,
    variables: SeoVariables,
    typeId: number,
  ): string {
    let processed = content;

    // Variables de base
    if (variables.gamme) {
      processed = processed.replace(/#Gamme#/g, variables.gamme);
    }
    if (variables.marque) {
      processed = processed.replace(/#VMarque#/g, variables.marque);
    }
    if (variables.modele) {
      processed = processed.replace(/#VModele#/g, variables.modele);
    }
    if (variables.type) {
      processed = processed.replace(/#VType#/g, variables.type);
    }
    if (variables.annee) {
      processed = processed.replace(/#VAnnee#/g, variables.annee);
    }
    if (variables.nbCh) {
      processed = processed.replace(/#VNbCh#/g, variables.nbCh);
    }

    // Prix minimum
    if (variables.minPrice) {
      processed = processed.replace(/#MinPrice#/g, `à ${variables.minPrice} €`);
    }

    // Prix pas cher (variation basée sur l'ID)
    const priceVariationIndex = typeId % this.enhancedPriceVariations.length;
    processed = processed.replace(
      /#PrixPasCher#/g,
      this.enhancedPriceVariations[priceVariationIndex],
    );

    return processed;
  }

  /**
   * Traite les switches dynamiques
   */
  private async processSwitches(
    content: string,
    typeId: number,
    switches: SeoSwitch[],
  ): Promise<string> {
    let processed = content;

    // Recherche des patterns #CompSwitch_X_Y#
    const switchPattern = /#CompSwitch_(\d+)_(\d+)#/g;
    const matches = [];
    let match;
    while ((match = switchPattern.exec(content)) !== null) {
      matches.push(match);
    }

    for (const match of matches) {
      const aliasId = parseInt(match[1]);
      const optionIndex = parseInt(match[2]);
      const fullMatch = match[0];

      try {
        const relevantSwitches = switches.filter(
          (s) => s.sgcs_alias === aliasId.toString(),
        );

        if (relevantSwitches.length > 0) {
          // Sélection basée sur typeId et optionIndex
          const selectedIndex =
            (typeId + optionIndex) % relevantSwitches.length;
          const selectedSwitch = relevantSwitches[selectedIndex];
          processed = processed.replace(fullMatch, selectedSwitch.sgcs_content);
        } else {
          // Supprimer le switch si pas de contenu
          processed = processed.replace(fullMatch, '');
        }
      } catch (error) {
        this.logger.warn(
          `⚠️ Erreur switch ${aliasId}_${optionIndex}: ${getErrorMessage(error)}`,
        );
        processed = processed.replace(fullMatch, '');
      }
    }

    return processed;
  }

  /**
   * Nettoie le texte généré
   */
  private cleanText(content: string): string {
    return content
      .replace(/\s+/g, ' ')
      .replace(/\s+([,.])/g, '$1')
      .trim();
  }

  /**
   * Contenu SEO de fallback en cas d'erreur
   */
  private getFallbackSeoContent(variables: SeoVariables): SeoGenerationResult {
    const baseTitle = variables.gamme
      ? `${variables.gamme} ${variables.marque} ${variables.modele}`
      : `Pièces ${variables.marque} ${variables.modele}`;

    return {
      title: baseTitle,
      description: `${baseTitle} - Pièces détachées de qualité à prix compétitif`,
      h1: baseTitle,
      content: `Découvrez notre sélection de pièces détachées pour ${variables.marque} ${variables.modele}`,
      keywords: `${variables.marque}, ${variables.modele}, pièces détachées`,
    };
  }

  /**
   * Génération SEO spécifique aux pièces détachées
   */
  async generatePiecesSeoContent(
    request: PiecesSeoRequest,
  ): Promise<SeoGenerationResult> {
    const variables: SeoVariables = {
      gamme: request.gamme,
      marque: request.marque,
      modele: request.modele,
      type: request.type,
      annee: request.annee,
      nbCh: request.nbCh,
      minPrice: request.minPrice,
    };

    // Utiliser un template par défaut pour les pièces (pgId=1 par exemple)
    return await this.generateSeoContent(1, 100, variables);
  }

  /**
   * Obtention des statistiques des templates SEO
   */
  async getSeoAnalytics(): Promise<{
    templates?: { total: number; switches: number };
    enhancement?: { version: string; features: string[] };
    error?: string;
  }> {
    try {
      const supabase = this.supabase;

      // Statistiques des templates (pour usage futur)
      const { count: totalTemplates } = await supabase
        .from(TABLES.seo_gamme_car)
        .select('*', { count: 'exact' });

      // Statistiques des switches (pour usage futur)
      const { count: totalSwitches } = await supabase
        .from(TABLES.seo_gamme_car_switch)
        .select('*', { count: 'exact' });

      return {
        templates: {
          total: totalTemplates || 0,
          switches: totalSwitches || 0,
        },
        enhancement: {
          version: '2.0.0',
          features: [
            'Templates dynamiques',
            'Switches conditionnels',
            'Variables SEO avancées',
            'Prix dynamiques',
            'Contenu personnalisé',
          ],
        },
      };
    } catch (error) {
      this.logger.error(`❌ Erreur analytics SEO: ${getErrorMessage(error)}`);
      return { error: getErrorMessage(error) };
    }
  }
}
