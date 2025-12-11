import { TABLES } from '@repo/database-types';
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

export interface PrefetchedSwitches {
  itemSwitches: ItemSwitch[];
  gammeSwitches: GammeCarSwitch[];
  familySwitches: FamilyGammeCarSwitch[];
}

@Injectable()
export class SeoSwitchesService {
  protected readonly logger = new Logger(SeoSwitchesService.name);

  /**
   * 🚀 SUPER PREFETCH: Pré-charge TOUTES les données nécessaires pour traiter N templates
   * Analyse tous les templates pour extraire les pgIds cibles, puis charge tout en batch
   */
  async prefetchAllSwitchesForTemplates(
    supabase: SupabaseClient,
    templates: (string | null)[],
    pgId: number,
    mfId?: number,
  ): Promise<{
    prefetched: PrefetchedSwitches;
    gammesMap: Map<number, { pg_id: number; pg_name: string; pg_alias: string }>;
    switchesByPgAndAlias: Map<string, GammeCarSwitch[]>;
    switchesByPg: Map<number, GammeCarSwitch[]>;
  }> {
    // Combiner tous les templates pour extraire tous les patterns
    const allText = templates.filter(Boolean).join(' ');
    
    // Extraire tous les pgIds cibles depuis les patterns
    const allTargetPgIds = new Set<number>();
    
    // Patterns à scanner
    const crossPattern = /#CompSwitch_(\d+)_(\d+)#/g;
    const linkGammeCarPattern = /#LinkGammeCar_(\d+)#/g;
    const linkGammePattern = /#LinkGamme_(\d+)#/g;
    const aliasPattern = /#CompSwitch_(\d+)#/g;
    
    for (const match of allText.matchAll(crossPattern)) {
      allTargetPgIds.add(parseInt(match[2]));
    }
    for (const match of allText.matchAll(linkGammeCarPattern)) {
      allTargetPgIds.add(parseInt(match[1]));
    }
    for (const match of allText.matchAll(linkGammePattern)) {
      allTargetPgIds.add(parseInt(match[1]));
    }
    for (const match of allText.matchAll(aliasPattern)) {
      const alias = match[1];
      if (/^\d+$/.test(alias) && parseInt(alias) !== pgId) {
        allTargetPgIds.add(parseInt(alias));
      }
    }
    
    // Exclure la gamme courante des cibles (elle est chargée séparément)
    allTargetPgIds.delete(pgId);
    
    const targetPgIdsArray = Array.from(allTargetPgIds);
    this.logger.log(`🔍 [SUPER PREFETCH] pgIds cibles trouvés: [${targetPgIdsArray.join(', ')}]`);
    
    // Charger TOUT en parallèle (5 requêtes max)
    const [itemResult, gammeResult, familyResult, targetGammesResult, targetSwitchesResult] = await Promise.all([
      // 1. Switches globaux
      supabase.from(TABLES.seo_item_switch).select('*').eq('sis_pg_id', 0),
      
      // 2. Switches de la gamme courante
      supabase.from(TABLES.seo_gamme_car_switch).select('*').eq('sgcs_pg_id', pgId),
      
      // 3. Switches famille
      mfId
        ? supabase.from(TABLES.seo_family_gamme_car_switch).select('*').eq('sfgcs_mf_id', mfId).or(`sfgcs_pg_id.eq.0,sfgcs_pg_id.eq.${pgId}`)
        : Promise.resolve({ data: [], error: null }),
      
      // 4. Infos gammes cibles (pour LinkGamme)
      targetPgIdsArray.length > 0
        ? supabase.from(TABLES.pieces_gamme).select('pg_id, pg_name, pg_alias').in('pg_id', targetPgIdsArray)
        : Promise.resolve({ data: [], error: null }),
      
      // 5. Switches des gammes cibles
      targetPgIdsArray.length > 0
        ? supabase.from(TABLES.seo_gamme_car_switch).select('*').in('sgcs_pg_id', targetPgIdsArray)
        : Promise.resolve({ data: [], error: null }),
    ]);
    
    this.logger.log(`🔍 [SUPER PREFETCH] Résultats: gammes=${targetGammesResult.data?.length || 0}, switches=${targetSwitchesResult.data?.length || 0}`);
    
    // Construire les Maps
    const gammesMap = new Map<number, { pg_id: number; pg_name: string; pg_alias: string }>();
    for (const g of (targetGammesResult.data || [])) {
      gammesMap.set(g.pg_id, g);
    }
    
    const switchesByPgAndAlias = new Map<string, GammeCarSwitch[]>();
    const switchesByPg = new Map<number, GammeCarSwitch[]>();
    
    for (const sw of (targetSwitchesResult.data || [])) {
      const key = `${sw.sgcs_pg_id}_${sw.sgcs_alias}`;
      if (!switchesByPgAndAlias.has(key)) switchesByPgAndAlias.set(key, []);
      switchesByPgAndAlias.get(key)!.push(sw);
      
      if (!switchesByPg.has(sw.sgcs_pg_id)) switchesByPg.set(sw.sgcs_pg_id, []);
      switchesByPg.get(sw.sgcs_pg_id)!.push(sw);
    }
    
    return {
      prefetched: {
        itemSwitches: itemResult.data || [],
        gammeSwitches: gammeResult.data || [],
        familySwitches: familyResult.data || [],
      },
      gammesMap,
      switchesByPgAndAlias,
      switchesByPg,
    };
  }

  /**
   * 🚀 Pré-récupère tous les switches pour une gamme et une famille données
   * Permet d'éviter le problème N+1 requêtes
   */
  async prefetchSwitches(
    supabase: SupabaseClient,
    pgId: number,
    mfId?: number,
  ): Promise<PrefetchedSwitches> {
    const [itemResult, gammeResult, familyResult] = await Promise.all([
      // 1. Switches globaux (pg_id=0)
      supabase.from(TABLES.seo_item_switch).select('*').eq('sis_pg_id', 0),

      // 2. Switches de la gamme courante
      supabase
        .from(TABLES.seo_gamme_car_switch)
        .select('*')
        .eq('sgcs_pg_id', pgId),

      // 3. Switches de la famille (si mfId existe)
      mfId
        ? supabase
            .from(TABLES.seo_family_gamme_car_switch)
            .select('*')
            .eq('sfgcs_mf_id', mfId)
            .or(`sfgcs_pg_id.eq.0,sfgcs_pg_id.eq.${pgId}`)
        : Promise.resolve({ data: [], error: null }),
    ]);

    return {
      itemSwitches: itemResult.data || [],
      gammeSwitches: gammeResult.data || [],
      familySwitches: familyResult.data || [],
    };
  }

  /**
   * 📊 Récupère les switches depuis __seo_item_switch
   * Utilisés pour: #CompSwitch# (alias 1, 2, 3)
   * Formule: ($type_id + offset) % count
   */
  async getItemSwitches(
    supabase: SupabaseClient,
    pgId: number,
    alias: number,
    prefetched?: PrefetchedSwitches,
  ): Promise<ItemSwitch[]> {
    // Utiliser le cache si disponible et pertinent (pgId=0 pour global)
    if (prefetched && pgId === 0) {
      // ⚠️ Correction type: comparaison souple pour gérer string/number
      return prefetched.itemSwitches.filter((s) => s.sis_alias == alias);
    }

    const { data, error } = await supabase
      .from(TABLES.seo_item_switch)
      .select('*')
      .eq('sis_pg_id', pgId)
      .eq('sis_alias', alias);

    if (error) {
      this.logger.warn(
        `⚠️ Erreur récupération item switches pg_id=${pgId}, alias=${alias}:`,
        error.message,
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
    alias?: string,
    prefetched?: PrefetchedSwitches,
  ): Promise<GammeCarSwitch[]> {
    // Utiliser le cache si disponible et pertinent (gamme courante)
    if (
      prefetched &&
      prefetched.gammeSwitches.length > 0 &&
      prefetched.gammeSwitches[0].sgcs_pg_id === pgId
    ) {
      if (alias) {
        // ⚠️ Correction type: comparaison string pour être sûr
        return prefetched.gammeSwitches.filter(
          (s) => String(s.sgcs_alias) === String(alias),
        );
      }
      return prefetched.gammeSwitches;
    }

    // 1. Chercher dans __seo_gamme_car_switch
    let query = supabase
      .from(TABLES.seo_gamme_car_switch)
      .select('*')
      .eq('sgcs_pg_id', pgId);

    if (alias) {
      query = query.eq('sgcs_alias', alias);
    }

    const { data, error } = await query;

    if (error) {
      this.logger.warn(
        `⚠️ Erreur récupération gamme_car switches pg_id=${pgId}, alias=${alias}:`,
        error.message,
      );
    }

    // Si trouvé, retourner
    if (data && data.length > 0) {
      return data;
    }

    // 2. FALLBACK: Chercher dans __seo_item_switch (car certaines gammes stockent leurs switches ici)
    // ex: PG 82, 407, etc.
    let itemQuery = supabase
      .from(TABLES.seo_item_switch)
      .select('*')
      .eq('sis_pg_id', pgId);

    if (alias) {
      itemQuery = itemQuery.eq('sis_alias', alias);
    }

    const { data: itemData, error: itemError } = await itemQuery;

    if (itemError) {
      this.logger.warn(
        `⚠️ Erreur récupération item switches fallback pg_id=${pgId}, alias=${alias}:`,
        itemError.message,
      );
      return [];
    }

    if (itemData && itemData.length > 0) {
      // Mapper vers GammeCarSwitch
      return itemData.map((s) => ({
        sgcs_id: s.sis_id,
        sgcs_pg_id: s.sis_pg_id,
        sgcs_alias: String(s.sis_alias),
        sgcs_content: s.sis_content,
      }));
    }

    return [];
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
    alias: number,
    prefetched?: PrefetchedSwitches,
  ): Promise<FamilyGammeCarSwitch[]> {
    // Utiliser le cache si disponible
    if (
      prefetched &&
      prefetched.familySwitches.length > 0 &&
      prefetched.familySwitches[0].sfgcs_mf_id === mfId
    ) {
      // ⚠️ Correction type: comparaison souple pour alias et pg_id
      return prefetched.familySwitches.filter(
        (s) =>
          s.sfgcs_alias == alias &&
          (s.sfgcs_pg_id == 0 || s.sfgcs_pg_id == pgId),
      );
    }

    const { data, error } = await supabase
      .from(TABLES.seo_family_gamme_car_switch)
      .select('*')
      .eq('sfgcs_mf_id', mfId)
      .eq('sfgcs_alias', alias)
      .or(`sfgcs_pg_id.eq.0,sfgcs_pg_id.eq.${pgId}`);

    if (error) {
      this.logger.warn(
        `⚠️ Erreur récupération family switches mf_id=${mfId}, pg_id=${pgId}, alias=${alias}:`,
        error.message,
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
    offset: number = 0,
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
    context: SwitchContext,
    prefetched?: PrefetchedSwitches,
  ): Promise<string> {
    if (!text.includes('#CompSwitch#')) return text;

    // Récupérer switches globaux (pg_id=0, alias=3)
    const switches = await this.getItemSwitches(supabase, 0, 3, prefetched);
    // 🎯 Formule PHP: $type_id % count (pas de pgId)
    const selected = this.selectSwitchByRotation(switches, context.typeId, 0);

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
    context: SwitchContext,
    prefetched?: PrefetchedSwitches,
  ): Promise<string> {
    const marker = `#CompSwitch_${alias}#`;
    if (!text.includes(marker)) return text;

    let switches = await this.getGammeCarSwitches(
      supabase,
      context.pgId,
      alias,
      prefetched,
    );

    // FALLBACK 1: Si l'alias ressemble à un PG_ID (ex: 407) et qu'on n'a rien trouvé dans la gamme courante
    // On essaie de charger les switches de cette gamme cible (ex: PG 407)
    if (
      (!switches || switches.length === 0) &&
      alias !== String(context.pgId) &&
      /^\d+$/.test(alias)
    ) {
      const targetPgId = parseInt(alias);
      // On cherche les switches pour ce PG_ID (sans filtrer par alias, ou avec alias par défaut ?)
      // Généralement, si on met #CompSwitch_407#, on veut probablement un switch générique de 407.
      // On va chercher TOUS les switches de 407 et laisser la rotation choisir.
      // OU on cherche Alias 1 (souvent "changer si rouillé" etc.)

      // Essai 1: Chercher Alias 1 pour ce PG_ID
      const targetSwitches = await this.getGammeCarSwitches(
        supabase,
        targetPgId,
        '1',
      );
      if (targetSwitches && targetSwitches.length > 0) {
        switches = targetSwitches;
        this.logger.log(
          `✅ Fallback: #CompSwitch_${alias}# trouvé via PG_ID ${targetPgId} (Alias 1)`,
        );
      } else {
        // Essai 2: Chercher tous les switches
        const allTargetSwitches = await this.getGammeCarSwitches(
          supabase,
          targetPgId,
        );
        if (allTargetSwitches && allTargetSwitches.length > 0) {
          switches = allTargetSwitches;
          this.logger.log(
            `✅ Fallback: #CompSwitch_${alias}# trouvé via PG_ID ${targetPgId} (Tous)`,
          );
        }
      }
    }

    // FALLBACK 2: Si aucun switch trouvé et que l'alias correspond à l'ID de la gamme (ex: #CompSwitch_479# pour pg_id=479)
    // On suppose que c'est un switch générique (Alias 3 global)
    if (
      (!switches || switches.length === 0) &&
      alias === String(context.pgId)
    ) {
      this.logger.log(
        `⚠️ Fallback: #CompSwitch_${alias}# non trouvé, utilisation du switch global Alias 3`,
      );
      const itemSwitches = await this.getItemSwitches(
        supabase,
        0,
        3,
        prefetched,
      );
      // On adapte le format ItemSwitch vers GammeCarSwitch pour la compatibilité
      switches = itemSwitches.map((s) => ({
        sgcs_id: s.sis_id,
        sgcs_pg_id: s.sis_pg_id,
        sgcs_alias: String(s.sis_alias),
        sgcs_content: s.sis_content,
      }));
    }

    // 🎯 Formule PHP Alias 3: ($type_id + $pg_id) % count
    // Pour autres alias: $type_id % count
    const offset = alias === '3' ? context.pgId : 0;
    const selected = this.selectSwitchByRotation(
      switches,
      context.typeId,
      offset,
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
    context: SwitchContext,
    counter: number,
    prefetched?: PrefetchedSwitches,
  ): Promise<string> {
    const marker = `#CompSwitch_${alias}_${targetPgId}#`;
    if (!text.includes(marker)) return text;

    // Note: prefetched ne contient que les switches de la gamme courante (context.pgId)
    // Donc pour cross-gamme, on fera toujours une requête DB sauf si targetPgId == context.pgId
    const usePrefetched = targetPgId === context.pgId ? prefetched : undefined;

    let switches = await this.getGammeCarSwitches(
      supabase,
      targetPgId,
      alias,
      usePrefetched,
    );

    // FALLBACK: Si aucun switch trouvé et alias=3, essayer le switch global Alias 3
    if ((!switches || switches.length === 0) && alias === '3') {
      this.logger.log(
        `⚠️ Fallback: #CompSwitch_${alias}_${targetPgId}# non trouvé, utilisation du switch global Alias 3`,
      );
      const itemSwitches = await this.getItemSwitches(
        supabase,
        0,
        3,
        prefetched,
      ); // pg_id=0 pour global
      switches = itemSwitches.map((s) => ({
        sgcs_id: s.sis_id,
        sgcs_pg_id: s.sis_pg_id,
        sgcs_alias: String(s.sis_alias),
        sgcs_content: s.sis_content,
      }));
    }

    // 🎯 Formule PHP: ($type_id + $target_pg_id + $counter + $alias) % count
    const offset = targetPgId + counter + parseInt(alias);
    const selected = this.selectSwitchByRotation(
      switches,
      context.typeId,
      offset,
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
    context: SwitchContext,
    prefetched?: PrefetchedSwitches,
  ): Promise<string> {
    if (!context.mfId) return text;

    const marker = `#CompSwitch_${alias}_${targetPgId}#`;
    if (!text.includes(marker)) return text;

    const switches = await this.getFamilyGammeCarSwitches(
      supabase,
      context.mfId,
      targetPgId,
      alias,
      prefetched,
    );
    // 🎯 Formule PHP: ($type_id + $pg_id + $alias) % count (pg_id, pas target)
    const selected = this.selectSwitchByRotation(
      switches,
      context.typeId + context.pgId + alias,
      0,
    );

    return selected
      ? text.replace(new RegExp(marker, 'g'), selected.sfgcs_content)
      : text.replace(new RegExp(marker, 'g'), '');
  }

  /**
   * 🔄 Traite #LinkGammeCar_Y# (lien vers autre gamme avec switches)
   * Combine alias 1 et 2 pour créer un lien complet avec URL
   * 🎯 Génère un lien HTML cliquable vers la page gamme+véhicule
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
    context: SwitchContext,
    prefetched?: PrefetchedSwitches,
    vehicleInfo?: {
      marqueId?: number;
      modeleId?: number;
      typeId?: number;
      marqueAlias?: string;
      modeleAlias?: string;
      typeAlias?: string;
    },
  ): Promise<string> {
    const marker = `#LinkGammeCar_${targetPgId}#`;
    if (!text.includes(marker)) return text;

    // Récupérer nom et alias de la gamme cible
    const { data: targetGamme } = await supabase
      .from(TABLES.pieces_gamme)
      .select('pg_name, pg_alias')
      .eq('pg_id', targetPgId)
      .single();

    if (!targetGamme) {
      return text.replace(new RegExp(marker, 'g'), '');
    }

    // Note: prefetched ne sert que si targetPgId == context.pgId
    const usePrefetched = targetPgId === context.pgId ? prefetched : undefined;

    // Récupérer switches alias 1 et 2
    const switches1 = await this.getGammeCarSwitches(
      supabase,
      targetPgId,
      '1',
      usePrefetched,
    );
    const switches2 = await this.getGammeCarSwitches(
      supabase,
      targetPgId,
      '2',
      usePrefetched,
    );

    // 🎯 Formule PHP: ($type_id + $target_pg_id + 2) % count pour alias 1
    // 🎯 Formule PHP: ($type_id + $target_pg_id + 3) % count pour alias 2
    const selected1 = this.selectSwitchByRotation(
      switches1,
      context.typeId,
      targetPgId + 2,
    );
    const selected2 = this.selectSwitchByRotation(
      switches2,
      context.typeId,
      targetPgId + 3,
    );

    if (!selected1 || !selected2) {
      return text.replace(new RegExp(marker, 'g'), '');
    }

    // 🎯 Construire le texte d'ancre du lien
    const anchorText = `${selected1.sgcs_content} les ${targetGamme.pg_name} ${vehicle.marque} ${vehicle.modele} ${vehicle.type} ${vehicle.nbCh} ch et ${selected2.sgcs_content}`;

    // 🔗 Construire l'URL du lien vers la page gamme+véhicule
    // Format: /pieces/{gamme-alias}-{gamme-id}/{marque-alias}-{marque-id}/{modele-alias}-{modele-id}/{type-alias}-{type-id}.html
    let linkUrl: string;

    if (vehicleInfo?.marqueId && vehicleInfo?.modeleId && vehicleInfo?.typeId) {
      // Lien complet vers gamme+véhicule
      const gammeSlug = `${targetGamme.pg_alias}-${targetPgId}`;
      const marqueSlug = `${vehicleInfo.marqueAlias || vehicle.marque.toLowerCase()}-${vehicleInfo.marqueId}`;
      const modeleSlug = `${vehicleInfo.modeleAlias || vehicle.modele.toLowerCase()}-${vehicleInfo.modeleId}`;
      const typeSlug = `${vehicleInfo.typeAlias || vehicle.type.toLowerCase()}-${vehicleInfo.typeId}`;
      linkUrl = `/pieces/${gammeSlug}/${marqueSlug}/${modeleSlug}/${typeSlug}.html`;
    } else {
      // Lien simple vers la gamme seule
      linkUrl = `/pieces/${targetGamme.pg_alias}-${targetPgId}.html`;
    }

    // 🎯 Construire le lien HTML avec data attributes pour tracking A/B
    const verbId = switches1.indexOf(selected1);
    const nounId = switches2.indexOf(selected2);
    const formula = `${verbId}:${nounId}`;

    const linkHtml = `<a href="${linkUrl}" class="seo-internal-link" data-link-type="LinkGammeCar" data-formula="${formula}" data-target-gamme="${targetPgId}">${anchorText}</a>`;

    return text.replace(new RegExp(marker, 'g'), linkHtml);
  }

  /**
   * 🔄 Traite #LinkGamme_Y# (lien simple vers une gamme)
   * Génère un lien HTML vers la page gamme
   * PHP: <a href="..."><b>NOM_GAMME</b></a>
   */
  async processLinkGamme(
    supabase: SupabaseClient,
    text: string,
    targetPgId: number,
  ): Promise<string> {
    const marker = `#LinkGamme_${targetPgId}#`;
    if (!text.includes(marker)) return text;

    // Récupérer nom et alias de la gamme cible
    const { data: targetGamme } = await supabase
      .from(TABLES.pieces_gamme)
      .select('pg_name, pg_alias')
      .eq('pg_id', targetPgId)
      .single();

    if (!targetGamme) {
      return text.replace(new RegExp(marker, 'g'), '');
    }

    // Construire le lien simple (sans variables de véhicule)
    // Format PHP: <a href='DOMAIN/Piece/ALIAS-ID.html'><b>NOM</b></a>
    const linkHtml = `<a href="/pieces/${targetGamme.pg_alias}-${targetPgId}.html" class="seo-internal-link" data-link-type="LinkGamme" data-target-gamme="${targetPgId}"><b>${targetGamme.pg_name}</b></a>`;

    return text.replace(new RegExp(marker, 'g'), linkHtml);
  }

  /**
   * 🚀 Traite TOUS les types de switches dans un texte
   * Point d'entrée principal - VERSION OPTIMISÉE avec batch queries
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
    context: SwitchContext,
    prefetched?: PrefetchedSwitches,
    vehicleInfo?: {
      marqueId?: number;
      modeleId?: number;
      typeId?: number;
      marqueAlias?: string;
      modeleAlias?: string;
      typeAlias?: string;
    },
    // 🚀 Nouveau: données pré-chargées pour éviter requêtes DB
    batchCacheData?: {
      gammesMap: Map<number, { pg_id: number; pg_name: string; pg_alias: string }>;
      switchesByPgAndAlias: Map<string, GammeCarSwitch[]>;
      switchesByPg: Map<number, GammeCarSwitch[]>;
    },
  ): Promise<string> {
    // 🚀 PHASE 1: Extraire TOUS les patterns en une seule passe
    const aliasPattern = /#CompSwitch_(\d+)#/g;
    const crossPattern = /#CompSwitch_(\d+)_(\d+)#/g;
    const linkGammeCarPattern = /#LinkGammeCar_(\d+)#/g;
    const linkGammePattern = /#LinkGamme_(\d+)#/g;

    const aliasMatches = [...text.matchAll(aliasPattern)];
    const crossMatches = [...text.matchAll(crossPattern)];
    const linkGammeCarMatches = [...text.matchAll(linkGammeCarPattern)];
    const linkGammeMatches = [...text.matchAll(linkGammePattern)];

    // Variables pour les Maps
    let gammesMap: Map<number, { pg_id: number; pg_name: string; pg_alias: string }>;
    let switchesByPgAndAlias: Map<string, GammeCarSwitch[]>;
    let switchesByPg: Map<number, GammeCarSwitch[]>;

    // 🚀 Si batchCacheData est fourni, utiliser les données pré-chargées (ZERO requête DB)
    if (batchCacheData) {
      gammesMap = batchCacheData.gammesMap;
      switchesByPgAndAlias = batchCacheData.switchesByPgAndAlias;
      switchesByPg = batchCacheData.switchesByPg;
    } else {
      // Fallback: charger les données (ancienne logique)
      // Collecter tous les pgIds nécessaires
      const allTargetPgIds = new Set<number>();
      
      for (const match of aliasMatches) {
        const alias = match[1];
        if (/^\d+$/.test(alias) && parseInt(alias) !== context.pgId) {
          allTargetPgIds.add(parseInt(alias));
        }
      }
      for (const match of crossMatches) {
        const targetPgId = parseInt(match[2]);
        if (targetPgId !== context.pgId) {
          allTargetPgIds.add(targetPgId);
        }
      }
      for (const match of linkGammeCarMatches) {
        allTargetPgIds.add(parseInt(match[1]));
      }
      for (const match of linkGammeMatches) {
        allTargetPgIds.add(parseInt(match[1]));
      }

      const targetPgIdsArray = Array.from(allTargetPgIds);
      
      const [gammesResult, switchesResult] = await Promise.all([
        targetPgIdsArray.length > 0
          ? supabase.from(TABLES.pieces_gamme).select('pg_id, pg_name, pg_alias').in('pg_id', targetPgIdsArray)
          : Promise.resolve({ data: [], error: null }),
        targetPgIdsArray.length > 0
          ? supabase.from(TABLES.seo_gamme_car_switch).select('sgcs_id, sgcs_pg_id, sgcs_alias, sgcs_content').in('sgcs_pg_id', targetPgIdsArray)
          : Promise.resolve({ data: [], error: null }),
      ]);

      gammesMap = new Map();
      for (const gamme of (gammesResult.data || [])) {
        gammesMap.set(gamme.pg_id, gamme);
      }

      switchesByPgAndAlias = new Map();
      switchesByPg = new Map();
      for (const sw of (switchesResult.data || [])) {
        const key = `${sw.sgcs_pg_id}_${sw.sgcs_alias}`;
        if (!switchesByPgAndAlias.has(key)) switchesByPgAndAlias.set(key, []);
        switchesByPgAndAlias.get(key)!.push(sw);
        
        if (!switchesByPg.has(sw.sgcs_pg_id)) switchesByPg.set(sw.sgcs_pg_id, []);
        switchesByPg.get(sw.sgcs_pg_id)!.push(sw);
      }
    }

    // 🚀 PHASE 3: Appliquer tous les remplacements (SANS nouvelles requêtes DB)
    let result = text;

    // 1. Traiter #CompSwitch# (générique) - utilise prefetched
    result = await this.processGenericSwitch(supabase, result, context, prefetched);

    // 2. Traiter #CompSwitch_X# (alias gamme courante ou cross-gamme)
    for (const match of aliasMatches) {
      const alias = match[1];
      const marker = `#CompSwitch_${alias}#`;
      if (!result.includes(marker)) continue;

      let switches: GammeCarSwitch[] = [];
      
      // Cas 1: Alias numérique qui pourrait être un pgId différent
      if (/^\d+$/.test(alias) && parseInt(alias) !== context.pgId) {
        const targetPgId = parseInt(alias);
        // Essayer alias 1 d'abord
        switches = switchesByPgAndAlias.get(`${targetPgId}_1`) || [];
        if (switches.length === 0) {
          // Fallback: tous les switches de ce pgId
          switches = switchesByPg.get(targetPgId) || [];
        }
      }
      
      // Cas 2: Alias pour la gamme courante (utilise prefetched)
      if (switches.length === 0 && prefetched) {
        switches = prefetched.gammeSwitches.filter(
          (s) => String(s.sgcs_alias) === String(alias),
        );
      }
      
      // Cas 3: Requête pour la gamme courante SEULEMENT si pas de batchCacheData
      // (évite les requêtes N+1 quand on a déjà tout pré-chargé)
      if (switches.length === 0 && !batchCacheData) {
        switches = await this.getGammeCarSwitches(supabase, context.pgId, alias, prefetched);
      }

      const offset = alias === '3' ? context.pgId : 0;
      const selected = this.selectSwitchByRotation(switches, context.typeId, offset);
      result = selected
        ? result.replace(new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), selected.sgcs_content)
        : result.replace(new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '');
    }

    // 3. Traiter #CompSwitch_X_Y# (cross-gamme ou famille)
    const crossGammeCounters = new Map<string, number>();
    
    for (const match of crossMatches) {
      const alias = parseInt(match[1]);
      const targetPgId = parseInt(match[2]);
      const marker = `#CompSwitch_${alias}_${targetPgId}#`;
      if (!result.includes(marker)) continue;

      // Alias 11-16: switches famille
      if (alias >= 11 && alias <= 16 && context.mfId) {
        result = await this.processFamilySwitch(supabase, result, alias, targetPgId, context, prefetched);
      } else {
        // Cross-gamme: utiliser le cache batch
        const key = `${alias}_${targetPgId}`;
        const counter = crossGammeCounters.get(key) || 0;
        crossGammeCounters.set(key, counter + 1);

        let switches = switchesByPgAndAlias.get(`${targetPgId}_${alias}`) || [];
        
        // Fallback pour alias 3: utiliser switches globaux
        if (switches.length === 0 && alias === 3) {
          const itemSwitches = await this.getItemSwitches(supabase, 0, 3, prefetched);
          switches = itemSwitches.map((s) => ({
            sgcs_id: s.sis_id,
            sgcs_pg_id: s.sis_pg_id,
            sgcs_alias: String(s.sis_alias),
            sgcs_content: s.sis_content,
          }));
        }

        const offset = targetPgId + counter + alias;
        const selected = this.selectSwitchByRotation(switches, context.typeId, offset);
        result = selected
          ? result.replace(new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), selected.sgcs_content)
          : result.replace(new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '');
      }
    }

    // 4. Traiter #LinkGammeCar_Y# - utiliser les données batch
    for (const match of linkGammeCarMatches) {
      const targetPgId = parseInt(match[1]);
      const marker = `#LinkGammeCar_${targetPgId}#`;
      if (!result.includes(marker)) continue;

      const targetGamme = gammesMap.get(targetPgId);
      if (!targetGamme) {
        result = result.replace(new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '');
        continue;
      }

      // Récupérer switches alias 1 et 2 depuis le cache batch
      const switches1 = switchesByPgAndAlias.get(`${targetPgId}_1`) || [];
      const switches2 = switchesByPgAndAlias.get(`${targetPgId}_2`) || [];

      const selected1 = this.selectSwitchByRotation(switches1, context.typeId, targetPgId + 2);
      const selected2 = this.selectSwitchByRotation(switches2, context.typeId, targetPgId + 3);

      if (!selected1 || !selected2) {
        result = result.replace(new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '');
        continue;
      }

      const anchorText = `${selected1.sgcs_content} les ${targetGamme.pg_name} ${vehicle.marque} ${vehicle.modele} ${vehicle.type} ${vehicle.nbCh} ch et ${selected2.sgcs_content}`;

      let linkUrl: string;
      if (vehicleInfo?.marqueId && vehicleInfo?.modeleId && vehicleInfo?.typeId) {
        const gammeSlug = `${targetGamme.pg_alias}-${targetPgId}`;
        const marqueSlug = `${vehicleInfo.marqueAlias || vehicle.marque.toLowerCase()}-${vehicleInfo.marqueId}`;
        const modeleSlug = `${vehicleInfo.modeleAlias || vehicle.modele.toLowerCase()}-${vehicleInfo.modeleId}`;
        const typeSlug = `${vehicleInfo.typeAlias || vehicle.type.toLowerCase()}-${vehicleInfo.typeId}`;
        linkUrl = `/pieces/${gammeSlug}/${marqueSlug}/${modeleSlug}/${typeSlug}.html`;
      } else {
        linkUrl = `/pieces/${targetGamme.pg_alias}-${targetPgId}.html`;
      }

      const verbId = switches1.indexOf(selected1);
      const nounId = switches2.indexOf(selected2);
      const formula = `${verbId}:${nounId}`;
      const linkHtml = `<a href="${linkUrl}" class="seo-internal-link" data-link-type="LinkGammeCar" data-formula="${formula}" data-target-gamme="${targetPgId}">${anchorText}</a>`;

      result = result.replace(new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), linkHtml);
    }

    // 5. Traiter #LinkGamme_Y# - utiliser les données batch
    for (const match of linkGammeMatches) {
      const targetPgId = parseInt(match[1]);
      const marker = `#LinkGamme_${targetPgId}#`;
      if (!result.includes(marker)) continue;

      const targetGamme = gammesMap.get(targetPgId);
      if (!targetGamme) {
        result = result.replace(new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '');
        continue;
      }

      const linkHtml = `<a href="/pieces/${targetGamme.pg_alias}-${targetPgId}.html" class="seo-internal-link" data-link-type="LinkGamme" data-target-gamme="${targetPgId}"><b>${targetGamme.pg_name}</b></a>`;
      result = result.replace(new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), linkHtml);
    }

    // 6. Traiter #PrixPasCher# (variations marketing) - local, pas de DB
    result = this.processPriceVariations(result, context.typeId);

    // 7. Nettoyer les switches non résolus
    result = result.replace(/#CompSwitch[^#]*#/g, '');
    result = result.replace(/#LinkGammeCar_\d+#/g, '');
    result = result.replace(/#LinkGamme_\d+#/g, '');
    result = result.replace(/#PrixPasCher#/g, '');

    return result;
  }

  /**
   * 🎯 Remplace #PrixPasCher# par rotation simple
   * Équivalent PHP: $PrixPasCher = array(...); $rand = typeId % count
   *
   * @param text Texte avec marqueur #PrixPasCher#
   * @param typeId ID du type de véhicule pour rotation
   * @returns Texte avec variation de prix
   */
  private processPriceVariations(text: string, typeId: number): string {
    const marker = '#PrixPasCher#';
    if (!text.includes(marker)) {
      return text;
    }

    // 🎯 7 variations de prix (équivalent PHP)
    const priceVariations = [
      'à prix pas cher',
      'pas cher',
      'à petit prix',
      'bon marché',
      'à prix discount',
      'à prix réduit',
      'économique',
    ];

    // Rotation basée sur type_id (même logique que PHP)
    const index = typeId % priceVariations.length;
    const variation = priceVariations[index];

    this.logger.debug(
      `🎯 Remplacement #PrixPasCher# → "${variation}" (type_id: ${typeId}, index: ${index})`,
    );

    return text.replace(new RegExp(marker, 'g'), variation);
  }

  /**
   * 🔄 Traite tous les switches génériques #CompSwitch_X# (cross-gamme)
   * Version batch pour éviter N+1 queries
   */
  async processGenericSwitches(
    supabase: SupabaseClient,
    text: string,
    typeId: number,
    pgId: number,
  ): Promise<string> {
    // Extraire tous les PG_IDs référencés
    const pattern = /#CompSwitch_(\d+)#/g;
    const matches = [...text.matchAll(pattern)];
    const targetPgIds = Array.from(
      new Set(matches.map((m) => parseInt(m[1]))),
    ).filter((id) => id !== pgId); // Exclure la gamme courante

    if (targetPgIds.length === 0) return text;

    // Récupérer tous les switches nécessaires en une requête
    const { data: switches } = await supabase
      .from(TABLES.seo_gamme_car_switch)
      .select('sgcs_pg_id, sgcs_content')
      .in('sgcs_pg_id', targetPgIds);

    if (!switches || switches.length === 0) return text;

    // Grouper par pg_id
    const switchesByPg = switches.reduce(
      (acc: any, s: any) => {
        if (!acc[s.sgcs_pg_id]) acc[s.sgcs_pg_id] = [];
        acc[s.sgcs_pg_id].push(s);
        return acc;
      },
      {} as Record<number, any[]>,
    );

    // Remplacer tous les markers
    let result = text;
    for (const targetPgId of targetPgIds) {
      const marker = `#CompSwitch_${targetPgId}#`;
      const pgSwitches = switchesByPg[targetPgId] || [];
      const selected = this.selectSwitchByRotation(pgSwitches, typeId, 0);

      if (selected) {
        result = result.replace(new RegExp(marker, 'g'), selected.sgcs_content);
      }
    }

    return result;
  }

  /**
   * 🔄 Traite tous les switches #CompSwitch_3_Y# (alias 3)
   */
  async processAlias3Switches(
    supabase: SupabaseClient,
    text: string,
    typeId: number,
    pgId: number,
  ): Promise<string> {
    // Extraire tous les PG_IDs référencés avec alias 3
    const pattern = /#CompSwitch_3_(\d+)#/g;
    const matches = [...text.matchAll(pattern)];
    const targetPgIds = Array.from(new Set(matches.map((m) => parseInt(m[1]))));

    if (targetPgIds.length === 0) return text;

    let result = text;
    for (const targetPgId of targetPgIds) {
      result = await this.processCrossGammeSwitch(
        supabase,
        result,
        '3',
        targetPgId,
        { typeId, pgId },
        0, // counter = 0 pour le premier
      );
    }

    return result;
  }

  /**
   * 🔄 Traite tous les switches #LinkGammeCar_Y#
   */
  async processLinkGammeCarSwitches(
    supabase: SupabaseClient,
    text: string,
    vehicle: {
      marque: string;
      modele: string;
      type: string;
      nbCh: string;
    },
    typeId: number,
    pgId: number,
  ): Promise<string> {
    const pattern = /#LinkGammeCar_(\d+)#/g;
    const matches = [...text.matchAll(pattern)];
    const targetPgIds = Array.from(new Set(matches.map((m) => parseInt(m[1]))));

    if (targetPgIds.length === 0) return text;

    let result = text;
    for (const targetPgId of targetPgIds) {
      result = await this.processLinkGammeCar(
        supabase,
        result,
        targetPgId,
        vehicle,
        { typeId, pgId },
      );
    }

    return result;
  }

  /**
   * 🔄 Traite tous les switches #LinkGamme_Y#
   */
  async processLinkGammeSwitches(
    supabase: SupabaseClient,
    text: string,
  ): Promise<string> {
    const pattern = /#LinkGamme_(\d+)#/g;
    const matches = [...text.matchAll(pattern)];
    const targetPgIds = Array.from(new Set(matches.map((m) => parseInt(m[1]))));

    if (targetPgIds.length === 0) return text;

    let result = text;
    for (const targetPgId of targetPgIds) {
      result = await this.processLinkGamme(supabase, result, targetPgId);
    }

    return result;
  }

  /**
   * 🔄 Traite tous les switches famille #CompSwitch_11_Y# à #CompSwitch_16_Y#
   */
  async processFamilySwitches(
    supabase: SupabaseClient,
    text: string,
    typeId: number,
    pgId: number,
    mfId: number,
  ): Promise<string> {
    // Extraire tous les switches famille
    const pattern = /#CompSwitch_(1[1-6])_(\d+)#/g;
    const matches = [...text.matchAll(pattern)];

    if (matches.length === 0) return text;

    let result = text;
    for (const match of matches) {
      const alias = parseInt(match[1]);
      const targetPgId = parseInt(match[2]);

      result = await this.processFamilySwitch(
        supabase,
        result,
        alias,
        targetPgId,
        { typeId, pgId, mfId },
      );
    }

    return result;
  }
}
