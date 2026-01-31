/**
 * 🔍 AdminSeoPreviewService
 *
 * Service pour prévisualiser les templates SEO interpolés.
 * Permet de détecter les variables non-interpolées avant déploiement.
 */

import { Injectable, Logger } from '@nestjs/common';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import {
  SeoTemplateService,
  SeoContext,
  SeoTemplates,
  ProcessedSeo,
} from '../../catalog/services/seo-template.service';

export interface VehicleOption {
  type_id: number;
  label: string;
  marque_name: string;
  modele_name: string;
  type_name: string;
}

export interface SeoPreviewResult {
  raw: SeoTemplates;
  interpolated: ProcessedSeo;
  context: SeoContext;
  warnings: string[] | null;
  isValid: boolean;
}

@Injectable()
export class AdminSeoPreviewService extends SupabaseBaseService {
  protected readonly logger = new Logger(AdminSeoPreviewService.name);

  // Regex pour détecter les variables non-interpolées
  private readonly UNINTERPOLATED_REGEX = /#[A-Za-z_]+#|%[a-z_]+%/g;

  constructor(private readonly seoTemplateService: SeoTemplateService) {
    super();
  }

  /**
   * 🚗 Liste des véhicules de test pour une gamme
   */
  async getTestVehicles(pgId: number): Promise<VehicleOption[]> {
    try {
      // Récupérer quelques véhicules avec des pièces pour cette gamme
      const { data, error } = await this.supabase
        .from('pieces_relation_type')
        .select(
          `
          rtp_type_id,
          auto_type:rtp_type_id (
            type_id,
            type_name,
            type_power_ps,
            auto_modele:type_modele_id (
              modele_name,
              auto_marque:modele_marque_id (marque_name)
            )
          )
        `,
        )
        .eq('rtp_pg_id', pgId)
        .limit(20);

      if (error) {
        this.logger.error('Erreur récupération véhicules:', error);
        return [];
      }

      // Dédupliquer et formater
      const uniqueVehicles = new Map<number, VehicleOption>();
      for (const row of data || []) {
        const vehicle = row.auto_type as any;
        if (vehicle && !uniqueVehicles.has(vehicle.type_id)) {
          uniqueVehicles.set(vehicle.type_id, {
            type_id: parseInt(vehicle.type_id),
            marque_name: vehicle.auto_modele?.auto_marque?.marque_name || '',
            modele_name: vehicle.auto_modele?.modele_name || '',
            type_name: vehicle.type_name || '',
            label:
              `${vehicle.auto_modele?.auto_marque?.marque_name || ''} ${vehicle.auto_modele?.modele_name || ''} ${vehicle.type_name || ''} ${vehicle.type_power_ps ? `(${vehicle.type_power_ps} ch)` : ''}`.trim(),
          });
        }
      }

      return Array.from(uniqueVehicles.values()).slice(0, 10);
    } catch (error) {
      this.logger.error('Erreur getTestVehicles:', error);
      return [];
    }
  }

  /**
   * 🔍 Prévisualisation SEO complète
   */
  async previewSeo(pgId: number, typeId: number): Promise<SeoPreviewResult> {
    // 1. Récupérer les templates bruts de la DB
    const templates = await this.getTemplatesFromDB(pgId);

    // 2. Récupérer le contexte véhicule
    const context = await this.buildSeoContext(typeId, pgId);

    // 3. Interpoler (sans cache pour prévisualisation)
    const interpolated = await this.seoTemplateService.processTemplates(
      templates,
      context,
    );

    // 4. Détecter variables non-interpolées
    const warnings = this.detectUninterpolatedVars(interpolated);

    this.logger.log(
      `🔍 SEO Preview généré - pg=${pgId} type=${typeId} - valid=${warnings.length === 0}`,
    );

    return {
      raw: templates,
      interpolated,
      context,
      warnings: warnings.length > 0 ? warnings : null,
      isValid: warnings.length === 0,
    };
  }

  /**
   * 📝 Récupère les templates SEO bruts depuis __seo_gamme_car
   */
  private async getTemplatesFromDB(pgId: number): Promise<SeoTemplates> {
    const { data, error } = await this.supabase
      .from('__seo_gamme_car')
      .select('sgc_h1, sgc_title, sgc_descrip, sgc_content, sgc_preview')
      .eq('sgc_pg_id', pgId.toString())
      .single();

    if (error || !data) {
      this.logger.warn(`Pas de template SEO pour pg=${pgId}`);
      return {
        h1: '',
        title: '',
        description: '',
        content: '',
        preview: '',
      };
    }

    return {
      h1: data.sgc_h1 || '',
      title: data.sgc_title || '',
      description: data.sgc_descrip || '',
      content: data.sgc_content || '',
      preview: data.sgc_preview || '',
    };
  }

  /**
   * 🚗 Construit le contexte SEO depuis les données véhicule et gamme
   */
  private async buildSeoContext(
    typeId: number,
    pgId: number,
  ): Promise<SeoContext> {
    // Récupérer infos véhicule
    const { data: vehicleData } = await this.supabase
      .from('auto_type')
      .select(
        `
        type_id,
        type_name,
        type_alias,
        type_power_ps,
        type_power_kw,
        type_year_from,
        type_year_to,
        type_fuel,
        type_engine,
        auto_modele:type_modele_id (
          modele_id,
          modele_name,
          modele_alias,
          auto_marque:modele_marque_id (
            marque_id,
            marque_name,
            marque_alias
          )
        )
      `,
      )
      .eq('type_id', typeId.toString())
      .single();

    // Récupérer infos gamme
    const { data: gammeData } = await this.supabase
      .from('pieces_gamme')
      .select('pg_id, pg_name, pg_alias')
      .eq('pg_id', pgId)
      .single();

    // Récupérer prix minimum
    const { data: priceData } = await this.supabase
      .rpc('get_min_price_for_gamme_type', { p_pg_id: pgId, p_type_id: typeId })
      .single();

    // Récupérer codes moteur
    const { data: motorData } = await this.supabase
      .from('auto_type_motor_code')
      .select('tmc_code')
      .eq('tmc_type_id', typeId.toString());

    const vehicle = vehicleData as any;
    const gamme = gammeData as any;
    const price = priceData as any;

    return {
      type_id: typeId,
      pg_id: pgId,
      mf_id: vehicle?.auto_modele?.auto_marque?.marque_id
        ? parseInt(vehicle.auto_modele.auto_marque.marque_id)
        : 0,
      marque_name: vehicle?.auto_modele?.auto_marque?.marque_name || '',
      marque_alias: vehicle?.auto_modele?.auto_marque?.marque_alias || '',
      modele_name: vehicle?.auto_modele?.modele_name || '',
      modele_alias: vehicle?.auto_modele?.modele_alias || '',
      type_name: vehicle?.type_name || '',
      type_alias: vehicle?.type_alias || '',
      gamme_name: gamme?.pg_name || '',
      gamme_alias: gamme?.pg_alias || '',
      min_price: price?.min_price || 0,
      count: price?.count || 0,
      year_from: vehicle?.type_year_from || '',
      year_to: vehicle?.type_year_to || '',
      motor_codes: motorData?.map((m: any) => m.tmc_code).join(', ') || '',
      fuel: vehicle?.type_fuel || '',
      power_ps: vehicle?.type_power_ps || '',
      power_kw: vehicle?.type_power_kw || '',
    };
  }

  /**
   * 🚨 Détecte les variables non-interpolées dans le SEO
   */
  private detectUninterpolatedVars(seo: ProcessedSeo): string[] {
    const warnings: string[] = [];

    for (const [key, value] of Object.entries(seo)) {
      if (typeof value === 'string' && value.length > 0) {
        const matches = value.match(this.UNINTERPOLATED_REGEX);
        if (matches) {
          warnings.push(
            `⚠️ ${key}: variables non-interpolées: ${[...new Set(matches)].join(', ')}`,
          );
        }
      }
    }

    return warnings;
  }
}
