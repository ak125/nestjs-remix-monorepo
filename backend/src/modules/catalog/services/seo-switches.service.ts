// 📁 backend/src/modules/catalog/services/seo-switches.service.ts
// 🎯 Service dédié à la gestion des switches SEO (3 sources: SIS, SGCS, SFGCS)

import { Injectable, Logger } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Types de switches SEO
 */
export interface ItemSwitch {
  sis_id: number;
  sis_pg_id: number;
  sis_alias: number;
  sis_content: string;
}

export interface GammeCarSwitch {
  sgcs_id: number;
  sgcs_pg_id: number;
  sgcs_alias: string;
  sgcs_content: string;
}

export interface FamilyGammeCarSwitch {
  sfgcs_id: number;
  sfgcs_mf_id: number;
  sfgcs_pg_id: number;
  sfgcs_alias: number;
  sfgcs_content: string;
}

/**
 * Contexte pour le remplacement de variables
 */
export interface SwitchContext {
  typeId: number;
  pgId: number;
  mfId?: number;
}

@Injectable()
export class SeoSwitchesService {
  protected readonly logger = new Logger(SeoSwitchesService.name);

  /**
   * 📊 Récupère les switches depuis __seo_item_switch
   * Utilisés pour: #CompSwitch# (alias 1, 2, 3)
   * Formule: ($type_id + offset) % count
   */
  async getItemSwitches(
    supabase: SupabaseClient,
    pgId: number,
    alias: number
  ): Promise<ItemSwitch[]> {
    const { data, error } = await supabase
      .from('__seo_item_switch')
      .select('*')
      .eq('sis_pg_id', pgId)
      .eq('sis_alias', alias);

    if (error) {
      this.logger.warn(
        `⚠️ Erreur récupération item switches pg_id=${pgId}, alias=${alias}:`,
        error.message
      );
      return [];
    }

    return data || [];
  }

  /**
   * 📊 Récupère les switches depuis __seo_gamme_car_switch
   * Utilisés pour: #CompSwitch_X_Y#, #LinkGammeCar_X#
   * Formule: ($type_id + $pg_id + offset) % count
   */
  async getGammeCarSwitches(
    supabase: SupabaseClient,
    pgId: number,
    alias?: string
  ): Promise<GammeCarSwitch[]> {
    let query = supabase
      .from('__seo_gamme_car_switch')
      .select('*')
      .eq('sgcs_pg_id', pgId);

    if (alias) {
      query = query.eq('sgcs_alias', alias);
    }

    const { data, error } = await query;

    if (error) {
      this.logger.warn(
        `⚠️ Erreur récupération gamme_car switches pg_id=${pgId}, alias=${alias}:`,
        error.message
      );
      return [];
    }

    return data || [];
  }

  /**
   * 📊 Récupère les switches depuis __seo_family_gamme_car_switch
   * Utilisés pour: #CompSwitch_11_Y# à #CompSwitch_16_Y# (switches par famille)
   * Formule: ($type_id + $pg_id + $alias) % count
   */
  async getFamilyGammeCarSwitches(
    supabase: SupabaseClient,
    mfId: number,
    pgId: number,
    alias: number
  ): Promise<FamilyGammeCarSwitch[]> {
    const { data, error } = await supabase
      .from('__seo_family_gamme_car_switch')
      .select('*')
      .eq('sfgcs_mf_id', mfId)
      .eq('sfgcs_alias', alias)
      .or(`sfgcs_pg_id.eq.0,sfgcs_pg_id.eq.${pgId}`);

    if (error) {
      this.logger.warn(
        `⚠️ Erreur récupération family switches mf_id=${mfId}, pg_id=${pgId}, alias=${alias}:`,
        error.message
      );
      return [];
    }

    return data || [];
  }

  /**
   * 🎲 Sélectionne un switch par rotation (réplication logique PHP)
   * Formule générique: (typeId + offset) % count
   */
  selectSwitchByRotation<T extends { [key: string]: any }>(
    switches: T[],
    typeId: number,
    offset: number = 0
  ): T | null {
    if (!switches || switches.length === 0) return null;
    const index = (typeId + offset) % switches.length;
    return switches[index];
  }

  /**
   * 🔄 Traite #CompSwitch# (sans alias, switches génériques)
   * Source: __seo_item_switch avec sis_pg_id=0, sis_alias=3
   */
  async processGenericSwitch(
    supabase: SupabaseClient,
    text: string,
    context: SwitchContext
  ): Promise<string> {
    if (!text.includes('#CompSwitch#')) return text;

    // Récupérer switches globaux (pg_id=0, alias=3)
    const switches = await this.getItemSwitches(supabase, 0, 3);
    const selected = this.selectSwitchByRotation(
      switches,
      context.typeId + context.pgId,
      0
    );

    return selected
      ? text.replace(/#CompSwitch#/g, selected.sis_content)
      : text.replace(/#CompSwitch#/g, '');
  }

  /**
   * 🔄 Traite #CompSwitch_X# (switches avec alias pour la gamme courante)
   * Source: __seo_gamme_car_switch
   */
  async processAliasedSwitch(
    supabase: SupabaseClient,
    text: string,
    alias: string,
    context: SwitchContext
  ): Promise<string> {
    const marker = `#CompSwitch_${alias}#`;
    if (!text.includes(marker)) return text;

    const switches = await this.getGammeCarSwitches(
      supabase,
      context.pgId,
      alias
    );
    const selected = this.selectSwitchByRotation(
      switches,
      context.typeId,
      parseInt(alias)
    );

    return selected
      ? text.replace(new RegExp(marker, 'g'), selected.sgcs_content)
      : text.replace(new RegExp(marker, 'g'), '');
  }

  /**
   * 🔄 Traite #CompSwitch_X_Y# (switches cross-gamme)
   * Alias X pour gamme Y différente
   */
  async processCrossGammeSwitch(
    supabase: SupabaseClient,
    text: string,
    alias: string,
    targetPgId: number,
    context: SwitchContext
  ): Promise<string> {
    const marker = `#CompSwitch_${alias}_${targetPgId}#`;
    if (!text.includes(marker)) return text;

    const switches = await this.getGammeCarSwitches(
      supabase,
      targetPgId,
      alias
    );
    const selected = this.selectSwitchByRotation(
      switches,
      context.typeId + targetPgId + parseInt(alias),
      0
    );

    return selected
      ? text.replace(new RegExp(marker, 'g'), selected.sgcs_content)
      : text.replace(new RegExp(marker, 'g'), '');
  }

  /**
   * 🔄 Traite #CompSwitch_11_Y# à #CompSwitch_16_Y# (switches famille)
   * Source: __seo_family_gamme_car_switch
   */
  async processFamilySwitch(
    supabase: SupabaseClient,
    text: string,
    alias: number,
    targetPgId: number,
    context: SwitchContext
  ): Promise<string> {
    if (!context.mfId) return text;

    const marker = `#CompSwitch_${alias}_${targetPgId}#`;
    if (!text.includes(marker)) return text;

    const switches = await this.getFamilyGammeCarSwitches(
      supabase,
      context.mfId,
      targetPgId,
      alias
    );
    const selected = this.selectSwitchByRotation(
      switches,
      context.typeId + targetPgId + alias,
      0
    );

    return selected
      ? text.replace(new RegExp(marker, 'g'), selected.sfgcs_content)
      : text.replace(new RegExp(marker, 'g'), '');
  }

  /**
   * 🔄 Traite #LinkGammeCar_Y# (lien vers autre gamme avec switches)
   * Combine alias 1 et 2 pour créer un lien complet
   */
  async processLinkGammeCar(
    supabase: SupabaseClient,
    text: string,
    targetPgId: number,
    vehicle: {
      marque: string;
      modele: string;
      type: string;
      nbCh: string;
    },
    context: SwitchContext
  ): Promise<string> {
    const marker = `#LinkGammeCar_${targetPgId}#`;
    if (!text.includes(marker)) return text;

    // Récupérer nom de la gamme cible
    const { data: targetGamme } = await supabase
      .from('pieces_gamme')
      .select('pg_name')
      .eq('pg_id', targetPgId)
      .single();

    if (!targetGamme) {
      return text.replace(new RegExp(marker, 'g'), '');
    }

    // Récupérer switches alias 1 et 2
    const switches1 = await this.getGammeCarSwitches(supabase, targetPgId, '1');
    const switches2 = await this.getGammeCarSwitches(supabase, targetPgId, '2');

    const selected1 = this.selectSwitchByRotation(
      switches1,
      context.typeId + targetPgId,
      2
    );
    const selected2 = this.selectSwitchByRotation(
      switches2,
      context.typeId + targetPgId,
      3
    );

    if (!selected1 || !selected2) {
      return text.replace(new RegExp(marker, 'g'), '');
    }

    // Construire le texte du lien
    const linkText = `${selected1.sgcs_content} les ${targetGamme.pg_name} ${vehicle.marque} ${vehicle.modele} ${vehicle.type} ${vehicle.nbCh} ch et ${selected2.sgcs_content}`;

    return text.replace(new RegExp(marker, 'g'), linkText);
  }

  /**
   * 🚀 Traite TOUS les types de switches dans un texte
   * Point d'entrée principal
   */
  async processAllSwitches(
    supabase: SupabaseClient,
    text: string,
    vehicle: {
      marque: string;
      modele: string;
      type: string;
      nbCh: string;
    },
    context: SwitchContext
  ): Promise<string> {
    let result = text;

    // 1. Traiter #CompSwitch# (générique)
    result = await this.processGenericSwitch(supabase, result, context);

    // 2. Traiter #CompSwitch_X# (alias gamme courante)
    const aliasPattern = /#CompSwitch_(\d+)#/g;
    const aliasMatches = [...text.matchAll(aliasPattern)];
    for (const match of aliasMatches) {
      const alias = match[1];
      result = await this.processAliasedSwitch(supabase, result, alias, context);
    }

    // 3. Traiter #CompSwitch_X_Y# (cross-gamme ou famille)
    const crossPattern = /#CompSwitch_(\d+)_(\d+)#/g;
    const crossMatches = [...text.matchAll(crossPattern)];
    
    for (const match of crossMatches) {
      const alias = parseInt(match[1]);
      const targetPgId = parseInt(match[2]);

      // Alias 11-16: switches famille
      if (alias >= 11 && alias <= 16 && context.mfId) {
        result = await this.processFamilySwitch(
          supabase,
          result,
          alias,
          targetPgId,
          context
        );
      }
      // Autres alias: switches cross-gamme normaux
      else {
        result = await this.processCrossGammeSwitch(
          supabase,
          result,
          alias.toString(),
          targetPgId,
          context
        );
      }
    }

    // 4. Traiter #LinkGammeCar_Y#
    const linkPattern = /#LinkGammeCar_(\d+)#/g;
    const linkMatches = [...text.matchAll(linkPattern)];
    for (const match of linkMatches) {
      const targetPgId = parseInt(match[1]);
      result = await this.processLinkGammeCar(
        supabase,
        result,
        targetPgId,
        vehicle,
        context
      );
    }

    // 5. Nettoyer les switches non résolus
    result = result.replace(/#CompSwitch[^#]*#/g, '');
    result = result.replace(/#LinkGammeCar_\d+#/g, '');

    return result;
  }
}
