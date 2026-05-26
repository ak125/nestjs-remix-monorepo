// 📁 backend/src/modules/catalog/services/seo-template.service.ts
// ⚡ Service de traitement SEO côté NestJS avec cache Redis
// 🎯 Remplace process_seo_template() PL/pgSQL (5-7s → <50ms)

import { Injectable, Logger } from '@nestjs/common';
import { CacheService } from '@cache/cache.service';
import {
  SEO_PRICE_VARIATIONS,
  SEO_PROPOSE_VARIATIONS,
  selectVariation,
} from '../../../config/seo-variations.config';
import { enrichTypeNameForHeadings } from '@repo/seo-types';
import { composeVehicleAwareDescription } from './vehicle-aware-description.composer';

/**
 * 📝 Contexte SEO pour le remplacement des variables
 */
export interface SeoContext {
  type_id: number;
  pg_id: number;
  mf_id: number;
  marque_name: string;
  marque_alias: string;
  modele_name: string;
  modele_alias: string;
  type_name: string;
  type_alias: string;
  gamme_name: string;
  gamme_alias: string;
  min_price?: number;
  count?: number;
  year_from?: string;
  year_to?: string;
  motor_codes?: string;
  fuel?: string;
  power_ps?: string;
  power_kw?: string;
  /**
   * Fragments switch PAR GAMME (`__seo_gamme_car_switch`), indexés par alias
   * (« 1 », « 2 », « 3 »…). Résolus dans #CompSwitch_alias[_pgid]# par rotation
   * déterministe (type_id + pg_id + alias). Chargés par l'appelant (rm-builder),
   * cachés. Absent → le placeholder est stripté (fallback).
   */
  comp_switches?: Record<string, string[]>;
  /**
   * Fragments switch PAR VÉHICULE (`__seo_type_switch`, R8, gamme-agnostique),
   * indexés par alias. Résolus dans #Switch_alias#.
   */
  type_switches?: Record<string, string[]>;
  /**
   * Modifieur mot-clé DÉJÀ VALIDÉ (cf. `pickGammeKeywordModifier`) injecté par
   * l'appelant (rm-builder). Ajouté au terme produit dans la description composée.
   * Absent/null → terme produit = nom de gamme seul.
   */
  gamme_keyword_modifier?: string | null;
}

/**
 * 📝 Templates SEO bruts (non processés)
 */
export interface SeoTemplates {
  h1: string;
  title: string;
  description: string;
  content: string;
  preview: string;
}

/**
 * 📝 SEO processé (output final)
 */
export interface ProcessedSeo {
  success: boolean;
  h1: string;
  title: string;
  description: string;
  content: string;
  preview: string;
  keywords: string | null;
}

/**
 * ⚡ SeoTemplateService
 *
 * Traite les templates SEO bruts en remplaçant les variables par leur valeur.
 * Cache les résultats dans Redis (TTL 24h par gamme_id + type_id).
 *
 * Performance:
 * - PL/pgSQL process_seo_template(): ~1-1.5s × 5 appels = 5-7s
 * - NestJS SeoTemplateService: ~5-10ms × 5 = 25-50ms + 0ms si cache hit
 *
 * Variables supportées:
 * - %gamme_name%, %gamme_alias%
 * - %marque_name%, %marque_alias%
 * - %modele_name%, %modele_alias%
 * - %type_name%, %type_alias%
 * - %min_price%, %count%
 * - %year_from%, %year_to%
 * - %motor_codes%, %fuel%, %power_ps%, %power_kw%
 */
@Injectable()
export class SeoTemplateService {
  private readonly logger = new Logger(SeoTemplateService.name);

  // TTL cache SEO: 24h (templates quasi-statiques)
  private readonly SEO_CACHE_TTL = 86400;

  // 🚀 Regex compilé une seule fois (singleton) - Performance: 350ms → 50ms
  // Matche toutes les variables %xxx% en une seule passe
  private readonly SEO_REGEX =
    /%(gamme_name|gamme_alias|pg_name|pg_alias|marque_name|marque_alias|mf_name|brand_name|modele_name|modele_alias|model_name|type_name|type_alias|motorization|min_price|count|pieces_count|year_from|year_to|years|motor_codes|fuel|power_ps|power_kw)%/g;

  // 🔄 Regex pour le format LEGACY #Vxxx# et #Xxx# (templates existants en base)
  // Inclut: #VMarque#, #VGamme#, mais aussi #Gamme#, #MinPrice#
  private readonly LEGACY_REGEX =
    /#(VMarque|VModele|VType|VNbCh|VAnnee|VGamme|VAnneeFrom|VAnneeTo|VFuel|VPower|Gamme|MinPrice|Count)#/g;

  constructor(private readonly cacheService: CacheService) {
    this.logger.log(
      '🚀 SeoTemplateService initialisé - Mode NestJS Processing (Regex Single-Pass)',
    );
  }

  /**
   * 🎯 Traite tous les templates SEO avec cache
   *
   * @param templates - Templates bruts de RPC V4
   * @param context - Contexte pour le remplacement des variables
   * @returns ProcessedSeo - SEO avec variables remplacées
   */
  async processTemplates(
    templates: SeoTemplates,
    context: SeoContext,
  ): Promise<ProcessedSeo> {
    const startTime = Date.now();
    // Le modifieur mot-clé fait partie de la clé : sinon une valeur null
    // transitoire (erreur lookup) resterait figée 24h dans le résultat caché.
    const cacheKey = `seo:processed:${context.pg_id}:${context.type_id}:${context.gamme_keyword_modifier ?? ''}`;

    try {
      // 1. Tentative lecture cache Redis
      const cached = await this.cacheService.get<ProcessedSeo>(cacheKey);
      if (cached) {
        this.logger.debug(
          `⚡ SEO Cache HIT - pg=${context.pg_id} type=${context.type_id}`,
        );
        return cached;
      }

      // 2. Traitement des templates
      // Enrichissement conditionnel `type_name` pour H1 + title uniquement
      // (audit empirique 2026-05-26 : 3 duplicates R2 H1 + 1 EXACT title dûs
      // à `type_name` ambigu — ex. "2.0 HDi" partagé par 140 ch et 163 ch).
      // `description` (composer PR #665), `content`, `preview` reçoivent le
      // context ORIGINAL (zero impact hors H1/title).
      const enrichedTypeName = enrichTypeNameForHeadings({
        typeName: context.type_name,
        powerPs: context.power_ps,
        fuel: context.fuel,
      });
      const headingContext: SeoContext = enrichedTypeName.isEnriched
        ? { ...context, type_name: enrichedTypeName.value }
        : context;

      const processed: ProcessedSeo = {
        success: true,
        h1: this.processTemplate(templates.h1, headingContext),
        title: this.processTemplate(templates.title, headingContext),
        description: this.composeDescription(templates.description, context),
        content: this.processTemplate(templates.content, context),
        preview: this.processTemplate(templates.preview, context),
        keywords: this.generateKeywords(context),
      };

      // 3. Mise en cache Redis
      await this.cacheService.set(cacheKey, processed, this.SEO_CACHE_TTL);

      const duration = Date.now() - startTime;
      this.logger.log(
        `✅ SEO processé en ${duration}ms - pg=${context.pg_id} type=${context.type_id}`,
      );

      return processed;
    } catch (error) {
      this.logger.error('❌ Erreur processTemplates:', error);
      return this.getDefaultSeo(context);
    }
  }

  /**
   * 🧩 Description R2 : compose une vraie phrase véhicule-aware quand le
   * template DB est dégénéré (uniquement des placeholders, ex.
   * `#LinkGammeCar#, #CompSwitch#` → fragment sans verbe). Sinon (prose
   * rédigée à la main), on conserve le rendu du template tel quel
   * (`feedback_no_touch_meta_h1_if_optimized`).
   */
  private composeDescription(template: string, context: SeoContext): string {
    const rendered = this.processTemplate(template, context);
    if (!context.gamme_name) return rendered; // pas de terme produit fiable
    if (!this.isDegenerateDescriptionTemplate(template)) return rendered;
    return composeVehicleAwareDescription({
      gammeName: context.gamme_name,
      marqueName: context.marque_name,
      modeleName: context.modele_name,
      typeName: context.type_name,
      powerPs: context.power_ps,
      count: context.count,
      minPrice: context.min_price,
      typeId: context.type_id,
      pgId: context.pg_id,
      keywordModifier: context.gamme_keyword_modifier ?? null,
    });
  }

  /**
   * Un template description est "dégénéré" s'il ne contient quasiment que des
   * placeholders (#...#, %...%) → après substitution = fragment sans verbe.
   * Mesuré : 118/118 templates `sgc_descrip` sont dans ce cas.
   */
  private isDegenerateDescriptionTemplate(template?: string): boolean {
    if (!template || !template.trim()) return true;
    const stripped = template
      .replace(/#[^#]*#/g, '')
      .replace(/%[^%]*%/g, '')
      .replace(/[^\p{L}]/gu, '');
    return stripped.length < 5;
  }

  /**
   * 🔄 Traite un template individuel
   *
   * Remplace les variables %xxx% par leur valeur du contexte.
   * ⚡ OPTIMISÉ: Single-pass regex (350ms → 50ms)
   */
  private processTemplate(template: string, context: SeoContext): string {
    if (!template) return '';

    // 🗺️ Map des valeurs (clés SANS les %)
    const values: Record<string, string> = {
      // Gamme
      gamme_name: context.gamme_name || '',
      gamme_alias: context.gamme_alias || '',
      pg_name: context.gamme_name || '',
      pg_alias: context.gamme_alias || '',

      // Marque
      marque_name: context.marque_name || '',
      marque_alias: context.marque_alias || '',
      mf_name: context.marque_name || '',
      brand_name: context.marque_name || '',

      // Modèle
      modele_name: context.modele_name || '',
      modele_alias: context.modele_alias || '',
      model_name: context.modele_name || '',

      // Type
      type_name: context.type_name || '',
      type_alias: context.type_alias || '',
      motorization: context.type_name || '',

      // Prix et quantité
      min_price: context.min_price ? `${context.min_price.toFixed(2)}€` : '',
      count: context.count?.toString() || '',
      pieces_count: context.count?.toString() || '',

      // Années
      year_from: context.year_from || '',
      year_to: context.year_to || '',
      years: this.formatYears(context.year_from, context.year_to),

      // Technique
      motor_codes: context.motor_codes || '',
      fuel: context.fuel || '',
      power_ps: context.power_ps ? `${context.power_ps} ch` : '',
      power_kw: context.power_kw ? `${context.power_kw} kW` : '',
    };

    // 🗺️ Mapping legacy #Vxxx# et #Xxx# → valeurs contexte
    const legacyValues: Record<string, string> = {
      // Format #Vxxx#
      VMarque: context.marque_name || '',
      VModele: context.modele_name || '',
      VType: context.type_name || '',
      VNbCh: context.power_ps || '',
      VAnnee: this.formatYears(context.year_from, context.year_to),
      VGamme: context.gamme_name || '',
      VAnneeFrom: context.year_from || '',
      VAnneeTo: context.year_to || '',
      VFuel: context.fuel || '',
      VPower: context.power_ps ? `${context.power_ps} ch` : '',
      // Format #Xxx# (sans préfixe V)
      Gamme: context.gamme_name || '',
      MinPrice: context.min_price
        ? `à partir de ${context.min_price.toFixed(2)}€`
        : '',
      Count: context.count?.toString() || '',
    };

    // 🚀 Single-pass replacement avec regex compilée
    // Performance: O(n) au lieu de O(n × m) où m = nombre de variables

    // 1. Format moderne %xxx%
    let result = template.replace(this.SEO_REGEX, (match) => {
      const key = match.slice(1, -1); // Retire les % au début et à la fin
      return values[key] ?? '';
    });

    // 2. Format legacy #Vxxx#
    result = result.replace(this.LEGACY_REGEX, (match) => {
      const key = match.slice(1, -1); // Retire les # au début et à la fin
      return legacyValues[key] ?? '';
    });

    // 3. Traiter les switches statiques (#VousPropose#, #PrixPasCher#, #LinkCarAll#, etc.)
    result = this.processStaticSwitches(result, context);

    // 🧹 Nettoyage basique (espaces multiples uniquement)
    result = result
      .replace(/\s+/g, ' ') // Double espaces → simple
      .trim();

    return result;
  }

  /**
   * 🔄 Traite les switches statiques SEO
   *
   * Remplace les tags comme #VousPropose#, #PrixPasCher#, #LinkCarAll#, etc.
   * et supprime les switches non résolus (#CompSwitch_X_Y#, #FamilySwitch_X#, etc.)
   */
  private processStaticSwitches(text: string, context: SeoContext): string {
    if (!text) return '';

    // Construire les liens dynamiques
    const linkCarAll = `${context.marque_name} ${context.modele_name}`.trim();
    const linkCar =
      `${context.marque_name} ${context.modele_name} ${context.type_name}`.trim();
    const linkGammeCar = `${context.gamme_name} ${linkCarAll}`.trim();

    // 🔄 Sélection dynamique des variations (rotation par typeId + pgId)
    const prixPasCher = selectVariation(
      SEO_PRICE_VARIATIONS,
      context.type_id,
      context.pg_id,
    );
    const vousPropose = selectVariation(
      SEO_PROPOSE_VARIATIONS,
      context.type_id,
      context.pg_id,
      1, // offset pour décaler la rotation
    );

    const result = text
      // Tags de style texte (rotation dynamique)
      .replace(/#VousPropose#/gi, vousPropose)
      .replace(/#PrixPasCher#/gi, prixPasCher)
      .replace(/#Commander#/gi, 'commander')
      .replace(/#Controler#/gi, 'contrôler')

      // Tags de liens véhicule
      .replace(/#LinkCarAll#/gi, linkCarAll)
      .replace(/#LinkCar#/gi, linkCar)

      // Tags de liens gamme+véhicule (avec underscore pour pg_id)
      .replace(/#LinkGammeCar_\d+#/gi, linkGammeCar)
      .replace(/#LinkGammeCar#/gi, linkGammeCar)

      // 🔄 RÉSOUDRE les switches DB (legacy) au lieu de les stripper.
      // Format: #CompSwitch_X# ou #CompSwitch_X_Y# (X = alias, Y = pg_id facultatif).
      // Rotation déterministe par (type_id + pg_id + alias) → chaque slot tourne
      // indépendamment (offset = alias) = vraie divergence multi-slots.
      // Fallback : strip si aucun fragment chargé pour cet alias (comportement d'avant).
      .replace(/#CompSwitch_(\d+)(?:_\d+)?#/gi, (_match, aliasStr: string) => {
        const variants = context.comp_switches?.[aliasStr];
        if (variants && variants.length > 0) {
          return selectVariation(
            variants,
            context.type_id,
            context.pg_id,
            Number(aliasStr),
          );
        }
        return '';
      })

      // Format: #FamilySwitch_X# (non encore alimenté → strip)
      .replace(/#FamilySwitch_\d+#/gi, '')

      // Format: #Switch_X# (switch véhicule R8 ; résolu si fourni, sinon strip)
      .replace(/#Switch_(\d+)#/gi, (_match, aliasStr: string) => {
        const variants = context.type_switches?.[aliasStr];
        if (variants && variants.length > 0) {
          return selectVariation(
            variants,
            context.type_id,
            0,
            Number(aliasStr),
          );
        }
        return '';
      })

      // Autres liens non résolus
      .replace(/#Link[A-Za-z]+(_\d+)?#/gi, '')

      // Nettoyage : ponctuation orpheline laissée par un switch vide (ex. ", ," ou " .")
      .replace(/,\s*,/g, ',')
      .replace(/\s+([.,;:])/g, '$1')
      .replace(/(^[\s,;:]+)|([\s,;:]+$)/g, '')
      .trim();

    return result;
  }

  /**
   * 📅 Formate l'intervalle d'années
   */
  private formatYears(yearFrom?: string, yearTo?: string): string {
    if (!yearFrom && !yearTo) return '';
    if (yearFrom && yearTo) return `${yearFrom}-${yearTo}`;
    if (yearFrom) return `depuis ${yearFrom}`;
    if (yearTo) return `jusqu'à ${yearTo}`;
    return '';
  }

  /**
   * 🏷️ Génère les keywords SEO
   */
  private generateKeywords(context: SeoContext): string {
    const keywords: string[] = [];

    if (context.gamme_name) {
      keywords.push(context.gamme_name);
      keywords.push(`${context.gamme_name} ${context.marque_name}`.trim());
    }

    if (context.marque_name) {
      keywords.push(context.marque_name);
    }

    if (context.modele_name) {
      keywords.push(`${context.marque_name} ${context.modele_name}`.trim());
    }

    if (context.type_name) {
      keywords.push(
        `${context.gamme_name} ${context.marque_name} ${context.modele_name} ${context.type_name}`.trim(),
      );
    }

    // Ajouter variations SEO
    keywords.push(`${context.gamme_name} pas cher`.trim());
    keywords.push(`${context.gamme_name} prix`.trim());
    keywords.push(
      `${context.gamme_name} ${context.marque_name} pas cher`.trim(),
    );

    return keywords.filter(Boolean).join(', ');
  }

  /**
   * 🔄 SEO par défaut si erreur
   */
  private getDefaultSeo(context: SeoContext): ProcessedSeo {
    const gammeName = context.gamme_name || 'Pièces auto';
    const marqueName = context.marque_name || '';
    const modeleName = context.modele_name || '';
    const typeName = context.type_name || '';

    const fullVehicle = [marqueName, modeleName, typeName]
      .filter(Boolean)
      .join(' ');

    return {
      success: false,
      h1: `${gammeName} ${fullVehicle}`.trim(),
      title: `${gammeName} ${fullVehicle} | Automecanik`.trim(),
      description:
        `Découvrez notre sélection de ${gammeName.toLowerCase()} pour ${fullVehicle}. Livraison rapide et prix compétitifs.`.trim(),
      content: '',
      preview: `${gammeName} compatibles avec votre ${fullVehicle}`.trim(),
      keywords: this.generateKeywords(context),
    };
  }

  /**
   * 🧹 Invalide le cache SEO pour une gamme/type
   */
  async invalidateCache(pgId: number, typeId?: number): Promise<void> {
    if (typeId) {
      await this.cacheService.del(`seo:processed:${pgId}:${typeId}`);
      this.logger.log(`🧹 Cache SEO invalidé - pg=${pgId} type=${typeId}`);
    } else {
      // Invalider tous les types pour cette gamme
      await this.cacheService.clearByPattern(`seo:processed:${pgId}:*`);
      this.logger.log(`🧹 Cache SEO invalidé pour gamme pg=${pgId}`);
    }
  }

  /**
   * 🧹 Invalide tout le cache SEO (admin)
   */
  async invalidateAllCache(): Promise<void> {
    await this.cacheService.clearByPattern('seo:processed:*');
    this.logger.log('🧹 Tout le cache SEO invalidé');
  }
}
