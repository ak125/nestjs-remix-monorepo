import { TABLES } from '@repo/database-types';
// 📁 backend/src/modules/catalog/services/gamme-unified.service.ts
// 🎯 Service unifié pour les gammes - remplace gamme.service + catalog-gamme.service + pieces-gamme.service

import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import { CacheService } from '../../cache/cache.service';
import { SeoSwitchesService } from './seo-switches.service';
import {
  Gamme,
  FamilyWithGammes,
  GammeHierarchyResponse,
} from '../types/gamme.types';

@Injectable()
export class GammeUnifiedService extends SupabaseBaseService {
  protected readonly logger = new Logger(GammeUnifiedService.name);

  constructor(
    private readonly cacheService: CacheService,
    private readonly seoSwitchesService: SeoSwitchesService,
  ) {
    super();
  }

  /**
   * 🎯 Récupère toutes les gammes avec leurs vraies données
   */
  async getAllGammes(): Promise<Gamme[]> {
    try {
      this.logger.log('🎯 Récupération de toutes les gammes...');

      // 1. Récupérer les gammes depuis pieces_gamme (source de vérité pour les noms)
      const { data: piecesGammes, error: piecesError } = await this.supabase
        .from(TABLES.pieces_gamme)
        .select(
          `
          pg_id,
          pg_name,
          pg_alias,
          pg_img,
          pg_display,
          pg_top,
          pg_level,
          pg_parent
        `,
        )
        .eq('pg_display', '1')
        .order('pg_id', { ascending: true });

      if (piecesError) {
        this.logger.error('❌ Erreur pieces_gamme:', piecesError);
        throw new BadRequestException(
          `Erreur récupération gammes: ${piecesError.message}`,
        );
      }

      // 2. Transformer vers le format unifié
      const gammes: Gamme[] = (piecesGammes || []).map((pg) => ({
        id: pg.pg_id,
        alias: pg.pg_alias || undefined,
        name: pg.pg_name,
        description: undefined, // Pas de description dans pieces_gamme
        image: pg.pg_img || undefined,
        is_active: true,
        is_featured: pg.pg_top === '1',
        is_displayed: pg.pg_display === '1',
        family_id: undefined, // À enrichir si nécessaire
        level: parseInt(pg.pg_level) || 0,
        sort_order: parseInt(pg.pg_id), // Tri par ID par défaut
        products_count: 0,
      }));

      this.logger.log(`✅ ${gammes.length} gammes récupérées`);
      return gammes;
    } catch (error) {
      this.logger.error('❌ Erreur getAllGammes:', error);
      throw new BadRequestException(
        'Erreur lors de la récupération des gammes',
      );
    }
  }

  /**
   * 🏗️ Récupère la hiérarchie familles → gammes unifiée
   * ⚡ Cache Redis: TTL 1h pour optimiser la homepage
   */
  async getHierarchy(): Promise<GammeHierarchyResponse> {
    const cacheKey = 'catalog:hierarchy:full';

    try {
      // 1. Tentative de lecture cache
      const cached = await this.cacheService.get(cacheKey);
      if (cached && typeof cached === 'string') {
        this.logger.log('✅ Cache HIT - Hiérarchie depuis Redis (<10ms)');
        return JSON.parse(cached);
      }

      this.logger.log('🔍 Cache MISS - Construction hiérarchie unifiée...');

      // 1. Récupérer les familles
      const { data: families, error: familiesError } = await this.supabase
        .from(TABLES.catalog_family)
        .select('*')
        .eq('mf_display', '1')
        .order('mf_sort', { ascending: true });

      if (familiesError) {
        throw new BadRequestException(
          `Erreur familles: ${familiesError.message}`,
        );
      }

      // 2. Récupérer les gammes avec liaison famille
      const { data: catalogGammes, error: catalogError } = await this.supabase
        .from(TABLES.catalog_gamme)
        .select('*')
        .order('mc_sort', { ascending: true });

      if (catalogError) {
        throw new BadRequestException(
          `Erreur catalog_gamme: ${catalogError.message}`,
        );
      }

      // 3. Récupérer les noms des gammes
      const allGammes = await this.getAllGammes();
      // Créer une Map avec des clés en string pour éviter les problèmes de type
      const gammeNameMap = new Map(allGammes.map((g) => [String(g.id), g]));

      // 4. Construire la hiérarchie
      const familiesWithGammes: FamilyWithGammes[] = (families || [])
        .map((family) => {
          // Filtrer les gammes de cette famille
          const familyGammes = (catalogGammes || [])
            .filter((cg) => cg.mc_mf_prime === family.mf_id)
            .map((cg) => {
              const baseGamme = gammeNameMap.get(String(cg.mc_pg_id));
              if (!baseGamme) {
                this.logger.warn(
                  `⚠️ Gamme ${cg.mc_pg_id} non trouvée dans pieces_gamme`,
                );
              }
              return {
                id: cg.mc_pg_id,
                alias: baseGamme?.alias,
                name: baseGamme?.name || `Gamme #${cg.mc_pg_id}`,
                description: baseGamme?.description,
                image: baseGamme?.image,
                is_active: true,
                is_featured: baseGamme?.is_featured || false,
                is_displayed: true,
                family_id: family.mf_id,
                level: baseGamme?.level || 0,
                sort_order: parseInt(cg.mc_sort),
                products_count: 0,
              };
            })
            .sort((a, b) => a.sort_order - b.sort_order);

          return {
            id: family.mf_id,
            name: family.mf_name,
            system_name: family.mf_name_system,
            description: family.mf_description,
            image: family.mf_pic,
            sort_order: parseInt(family.mf_sort) || 0,
            gammes: familyGammes,
            stats: {
              total_gammes: familyGammes.length,
              manufacturers_count: new Set(
                catalogGammes
                  ?.filter((cg) => cg.mc_mf_prime === family.mf_id)
                  .map((cg) => cg.mc_mf_id),
              ).size,
            },
          };
        })
        .filter((family) => family.gammes.length > 0)
        .sort((a, b) => a.sort_order - b.sort_order);

      // 5. Calculer les statistiques globales
      const totalGammes = familiesWithGammes.reduce(
        (sum, f) => sum + f.stats.total_gammes,
        0,
      );
      const totalManufacturers = new Set(
        catalogGammes?.map((cg) => cg.mc_mf_id),
      ).size;

      const response: GammeHierarchyResponse = {
        families: familiesWithGammes,
        stats: {
          total_families: familiesWithGammes.length,
          total_gammes: totalGammes,
          total_manufacturers: totalManufacturers,
        },
      };

      this.logger.log(
        `✅ Hiérarchie: ${response.stats.total_families} familles, ${response.stats.total_gammes} gammes`,
      );

      // 2. Mise en cache Redis (TTL: 1h)
      try {
        await this.cacheService.set(cacheKey, JSON.stringify(response), 3600);
        this.logger.log('💾 Hiérarchie mise en cache (TTL: 1h)');
      } catch (cacheError) {
        this.logger.warn('⚠️ Erreur mise en cache:', cacheError);
      }

      return response;
    } catch (error) {
      this.logger.error('❌ Erreur getHierarchy:', error);
      throw new BadRequestException(
        'Erreur lors de la construction de la hiérarchie',
      );
    }
  }

  /**
   * 🎯 Récupère les gammes en vedette pour la homepage
   */
  async getFeaturedGammes(limit = 8): Promise<Gamme[]> {
    try {
      const allGammes = await this.getAllGammes();
      return allGammes.filter((g) => g.is_featured).slice(0, limit);
    } catch (error) {
      this.logger.error('❌ Erreur getFeaturedGammes:', error);
      return [];
    }
  }

  /**
   * 🔍 Recherche de gammes par nom
   */
  async searchGammes(query: string, limit = 20): Promise<Gamme[]> {
    try {
      const allGammes = await this.getAllGammes();
      const searchLower = query.toLowerCase();

      return allGammes
        .filter(
          (g) =>
            g.name.toLowerCase().includes(searchLower) ||
            g.alias?.toLowerCase().includes(searchLower),
        )
        .slice(0, limit);
    } catch (error) {
      this.logger.error('❌ Erreur searchGammes:', error);
      return [];
    }
  }

  /**
   * 📄 Récupère le contenu SEO pour une gamme depuis les tables SEO
   * ⚡ Cache Redis: TTL 15min avec clé composite type_id:pg_id:marque_id (évite requêtes lentes 5-13s)
   */
  async getGammeSeoContent(
    pgId: number,
    typeId: number,
    marqueId?: number,
    modeleId?: number,
  ) {
    const cacheKey = `catalog:seo:${typeId}:${pgId}:${marqueId || 0}`;

    try {
      // 1. Tentative lecture cache Redis
      const cached = await this.cacheService.get(cacheKey);
      if (cached && typeof cached === 'string') {
        this.logger.log(
          `⚡ Cache HIT SEO - type_id=${typeId}, pg_id=${pgId} (<10ms)`,
        );
        return JSON.parse(cached);
      }

      this.logger.log(
        `🔍 Cache MISS - Récupération SEO pour pg_id=${pgId}, type_id=${typeId}`,
      );

      // Requête directe sur la table __seo_gamme_car
      const { data, error } = await this.supabase
        .from(TABLES.seo_gamme_car)
        .select(
          'sgc_id, sgc_pg_id, sgc_title, sgc_descrip, sgc_h1, sgc_content, sgc_preview',
        )
        .eq('sgc_pg_id', pgId)
        .limit(1)
        .single();

      if (error) {
        this.logger.warn(
          `⚠️ Aucun template SEO trouvé pour pg_id=${pgId}:`,
          error.message,
        );
        return {
          success: false,
          h1: null,
          content: null,
          description: null,
          keywords: null,
        };
      }

      if (!data) {
        this.logger.warn(`⚠️ Aucun template SEO pour pg_id=${pgId}`);
        return {
          success: false,
          h1: null,
          content: null,
          description: null,
          keywords: null,
        };
      }

      this.logger.log(
        `✅ SEO template trouvé (${data.sgc_content?.length || 0} caractères)`,
      );

      // Récupérer infos véhicule pour remplacement variables
      const vehicleInfo = await this.getVehicleInfo(typeId, marqueId, modeleId);
      const gammeInfo = await this.getGammeInfo(pgId);

      // Récupérer mf_id pour les switches famille
      const { data: catalogGamme } = await this.supabase
        .from(TABLES.catalog_gamme)
        .select('mc_mf_prime')
        .eq('mc_pg_id', pgId)
        .single();

      const mfId = catalogGamme?.mc_mf_prime;

      this.logger.log(
        `🔍 [DEBUG-SEO] vehicleInfo:`,
        JSON.stringify(vehicleInfo),
      );
      this.logger.log(`🔍 [DEBUG-SEO] gammeInfo:`, JSON.stringify(gammeInfo));
      this.logger.log(`🔍 [DEBUG-SEO] mfId: ${mfId}`);

      // 5. Préparer les objets pour le traitement
      const vehicle = {
        marque: vehicleInfo.marque,
        modele: vehicleInfo.modele,
        type: vehicleInfo.type,
        nbCh: vehicleInfo.nbCh,
      };

      const context = { typeId, pgId, mfId };

      // 🚀 OPTIMISATION: Pré-récupérer les switches pour éviter N+1 requêtes
      this.logger.log(
        `🚀 [SEO] Pré-récupération des switches pour pgId=${pgId}, mfId=${mfId}`,
      );
      const prefetchedSwitches = await this.seoSwitchesService.prefetchSwitches(
        this.supabase,
        pgId,
        mfId,
      );

      // 🚀 OPTIMISATION: Paralléliser 5 champs SEO (30s → 6-8s)
      // Principe #6 Constitution: Performance-Driven, Not Guess-Driven
      const [
        processedH1,
        processedContent,
        processedDescription,
        processedTitle,
        processedPreview,
      ] = await Promise.all([
        this.replaceVariablesAndSwitches(
          data.sgc_h1,
          vehicle,
          vehicleInfo,
          gammeInfo,
          context,
          prefetchedSwitches,
        ),
        this.replaceVariablesAndSwitches(
          data.sgc_content,
          vehicle,
          vehicleInfo,
          gammeInfo,
          context,
          prefetchedSwitches,
        ),
        this.replaceVariablesAndSwitches(
          data.sgc_descrip,
          vehicle,
          vehicleInfo,
          gammeInfo,
          context,
          prefetchedSwitches,
        ),
        this.replaceVariablesAndSwitches(
          data.sgc_title,
          vehicle,
          vehicleInfo,
          gammeInfo,
          context,
          prefetchedSwitches,
        ),
        this.replaceVariablesAndSwitches(
          data.sgc_preview,
          vehicle,
          vehicleInfo,
          gammeInfo,
          context,
          prefetchedSwitches,
        ),
      ]);

      const finalResult = {
        success: true,
        h1: processedH1,
        content: processedContent,
        description: processedDescription,
        title: processedTitle,
        preview: processedPreview,
        keywords: null,
      };

      // 7. Mise en cache Redis (TTL: 15min)
      try {
        await this.cacheService.set(cacheKey, JSON.stringify(finalResult), 900);
        this.logger.log(`💾 SEO mis en cache Redis (TTL: 15min) - ${cacheKey}`);
      } catch (cacheError) {
        this.logger.warn('⚠️ Erreur mise en cache SEO:', cacheError);
      }

      return finalResult;
    } catch (error) {
      this.logger.error('❌ Erreur getGammeSeoContent:', error);
      return {
        success: false,
        h1: null,
        content: null,
        description: null,
        keywords: null,
      };
    }
  }

  /**
   * 🔧 Récupère les infos véhicule pour remplacement variables
   */
  private async getVehicleInfo(
    typeId: number,
    marqueId?: number,
    modeleId?: number,
  ) {
    this.logger.log(
      `🔍 [getVehicleInfo] Params: typeId=${typeId}, marqueId=${marqueId}, modeleId=${modeleId}`,
    );

    // 🚀 OPTIMISATION: Récupérer type d'abord pour obtenir marqueId/modeleId
    // 🎯 PHP: Ajouter type_body et type_fuel (NOMS CORRECTS)
    const { data: typeData, error: typeError } = await this.supabase
      .from(TABLES.auto_type)
      .select(
        'type_id, type_name, type_power_ps, type_year_from, type_year_to, type_marque_id, type_modele_id, type_body, type_fuel',
      )
      .eq('type_id', typeId)
      .single();

    this.logger.log(`🔍 [getVehicleInfo] typeData:`, JSON.stringify(typeData));
    if (typeError)
      this.logger.error(`❌ [getVehicleInfo] typeError:`, typeError);

    const finalMarqueId = typeData?.type_marque_id || marqueId;
    const finalModeleId = typeData?.type_modele_id || modeleId;

    this.logger.log(
      `🔍 [getVehicleInfo] finalMarqueId=${finalMarqueId}, finalModeleId=${finalModeleId}`,
    );

    // 🚀 OPTIMISATION: Paralléliser marque + modèle + codes moteur (5s → 1.5s)
    const [marqueResult, modeleResult, motorCodesResult] = await Promise.all([
      finalMarqueId
        ? this.supabase
            .from(TABLES.auto_marque)
            .select('marque_id, marque_name')
            .eq('marque_id', finalMarqueId)
            .single()
        : Promise.resolve({ data: null, error: null }),
      finalModeleId
        ? this.supabase
            .from(TABLES.auto_modele)
            .select('modele_id, modele_name')
            .eq('modele_id', finalModeleId)
            .single()
        : Promise.resolve({ data: null, error: null }),
      // 🎯 PHP: Récupérer codes moteur depuis auto_type_motor_code
      this.supabase
        .from(TABLES.auto_type_motor_code)
        .select('tmc_code')
        .eq('tmc_type_id', typeId),
    ]);

    const marqueName = marqueResult.data?.marque_name || '';
    const modeleName = modeleResult.data?.modele_name || '';

    // Concaténer les codes moteur séparés par virgules
    const codeMoteur =
      motorCodesResult.data
        ?.map((m: any) => m.tmc_code)
        .filter(Boolean)
        .join(', ') || '';

    this.logger.log(
      `🔍 [getVehicleInfo] marqueData:`,
      JSON.stringify(marqueResult.data),
    );
    if (marqueResult.error)
      this.logger.error(`❌ [getVehicleInfo] marqueError:`, marqueResult.error);

    this.logger.log(
      `🔍 [getVehicleInfo] modeleData:`,
      JSON.stringify(modeleResult.data),
    );
    if (modeleResult.error)
      this.logger.error(`❌ [getVehicleInfo] modeleError:`, modeleResult.error);

    this.logger.log(
      `🔍 [getVehicleInfo] motorCodesData:`,
      JSON.stringify(motorCodesResult.data),
    );
    if (motorCodesResult.error)
      this.logger.error(
        `❌ [getVehicleInfo] motorCodesError:`,
        motorCodesResult.error,
      );

    // Formater les années
    const yearFrom = typeData?.type_year_from || '';
    const yearTo = typeData?.type_year_to || '';
    let annee = yearFrom;
    if (yearFrom && yearTo && yearFrom !== yearTo) {
      annee = `${yearFrom} - ${yearTo}`;
    }

    const result = {
      type: typeData?.type_name || '',
      nbCh: typeData?.type_power_ps || '',
      annee: annee,
      marque: marqueName,
      modele: modeleName,
      marqueId: finalMarqueId,
      modeleId: finalModeleId,
      // 🎯 PHP: Ajouter les nouveaux champs
      carosserie: typeData?.type_body || '',
      motorisation: typeData?.type_fuel || '', // fuel = motorisation
      codeMoteur: codeMoteur,
    };

    this.logger.log(
      `✅ [getVehicleInfo] Résultat final:`,
      JSON.stringify(result),
    );
    return result;
  }

  /**
   * 🔧 Récupère les infos gamme pour remplacement variables
   */
  private async getGammeInfo(pgId: number) {
    const { data } = await this.supabase
      .from(TABLES.pieces_gamme)
      .select('pg_id, pg_name, pg_alias')
      .eq('pg_id', pgId)
      .single();

    return {
      id: data?.pg_id || pgId,
      name: data?.pg_name || '',
      alias: data?.pg_alias || '',
    };
  }

  /**
   * 🔄 Remplace les variables ET traite tous les switches (méthode moderne)
   * Utilise le nouveau SeoSwitchesService
   */
  private async replaceVariablesAndSwitches(
    text: string | null,
    vehicle: { marque: string; modele: string; type: string; nbCh: string },
    vehicleInfo: any,
    gamme: any,
    context: { typeId: number; pgId: number; mfId?: number },
    prefetchedSwitches?: any,
  ): Promise<string | null> {
    if (!text) return null;

    let result = text;

    // 1. Remplacer variables simples (Premier passage)
    result = this.applyVariableReplacements(
      result,
      vehicle,
      vehicleInfo,
      gamme,
    );

    // 2. 🚀 Traiter TOUS les switches via le nouveau service
    result = await this.seoSwitchesService.processAllSwitches(
      this.supabase,
      result,
      vehicle,
      context,
      prefetchedSwitches,
    );

    // 3. Remplacer variables simples (Deuxième passage pour les variables dans les switches)
    // Ex: Un switch contient "pour votre #VMarque#" -> doit être remplacé
    result = this.applyVariableReplacements(
      result,
      vehicle,
      vehicleInfo,
      gamme,
    );

    // 4. 🧹 Nettoyer UNIQUEMENT les balises <p> orphelines en début de contenu
    result = this.cleanOrphanParagraphs(result);

    return result;
  }

  /**
   * 🛠️ Applique les remplacements de variables standard
   */
  private applyVariableReplacements(
    text: string,
    vehicle: { marque: string; modele: string; type: string; nbCh: string },
    vehicleInfo: any,
    gamme: any,
  ): string {
    let result = text;

    result = result.replace(/#VMarque#/g, vehicle.marque || '');
    result = result.replace(/#VModele#/g, vehicle.modele || '');
    result = result.replace(/#VType#/g, vehicle.type || '');
    result = result.replace(/#VNbCh#/g, vehicle.nbCh || '');
    result = result.replace(/#VAnnee#/g, vehicleInfo.annee || '');
    result = result.replace(/#VCarosserie#/g, vehicleInfo.carosserie || '');
    result = result.replace(/#VMotorisation#/g, vehicleInfo.motorisation || '');
    result = result.replace(/#VCodeMoteur#/g, vehicleInfo.codeMoteur || '');

    // Variables gamme
    result = result.replace(/#Gamme#/g, gamme.name || '');
    result = result.replace(/#GammeAlias#/g, gamme.alias || '');

    // Variables phrases génériques
    result = result.replace(/#VousPropose#/g, 'vous propose');
    result = result.replace(/#PrixPasCher#/g, 'pas cher');
    result = result.replace(/#MinPrice#/g, '');

    // Variables contextuelles
    // 🎯 PHP: LinkCarAll inclut carosserie, date (annee), codeMoteur
    result = result.replace(
      /#LinkCarAll#/g,
      `${vehicle.marque} ${vehicle.modele} ${vehicle.type} ${vehicleInfo.carosserie || ''} ${vehicleInfo.annee || ''} ${vehicle.nbCh} ch ${vehicleInfo.codeMoteur || ''}`.trim(),
    );
    // 🎯 PHP: LinkCar inclut motorisation (fuel)
    result = result.replace(
      /#LinkCar#/g,
      `${vehicle.marque} ${vehicle.modele} ${vehicle.type} ${vehicleInfo.motorisation || ''} ${vehicle.nbCh} ch`.trim(),
    );

    return result;
  }

  /**
   * 🧹 Nettoie les balises <p> orphelines ET la ponctuation orpheline
   * Ne touche PAS au reste du contenu pour éviter de casser les phrases
   */
  private cleanOrphanParagraphs(text: string): string {
    let result = text;

    // 1. Supprimer les <p> vides (<p></p> ou <p> </p>)
    result = result.replace(/<p>\s*<\/p>/gi, '');

    // 2. 🎯 Supprimer <p>...</p> qui ENTOURE TOUT LE CONTENU (début + fin)
    // Pattern: <p>Kit d'embrayage FIAT DOBLO I 1.3 D Multijet 84 ch 2005...</p>
    // Détecte: commence par <p> et finit par </p> avec rien avant/après
    result = result.replace(/^\s*<p>(.*)<\/p>\s*$/is, '$1');

    // 3. Supprimer la première balise <p>...</p> UNIQUEMENT si elle contient un titre de gamme
    // Pattern: <p>Plaquette de frein pour CITROËN... </p>
    // On garde le texte mais on enlève les balises <p></p>
    result = result.replace(/^<p>([^<]+pour\s+[A-Z].+?)<\/p>\s*/i, '$1\n');

    // 4. Si pas de "pour", essayer juste un titre de gamme seul
    // Pattern: <p>Kit d'embrayage RENAULT... </p>
    result = result.replace(
      /^<p>([A-Z][^<]+?(?:RENAULT|CITROËN|PEUGEOT|BMW|AUDI|VOLKSWAGEN|MERCEDES|FIAT|ALFA|FORD)[^<]+?)<\/p>\s*/i,
      '$1\n',
    );

    // 🎯 PHP: Nettoyage de ponctuation orpheline
    // Supprimer virgules orphelines: "de , les" → "de les"
    result = result.replace(/\s+,\s+/g, ', '); // Normaliser d'abord
    result = result.replace(/(\s+\w+)\s+,\s+/g, '$1 '); // "de , " → "de "

    // Supprimer doubles virgules: ", ," → ","
    result = result.replace(/,\s*,/g, ',');

    // Supprimer points orphelins en fin de phrase incomplète: "il faut ." → "il faut"
    result = result.replace(/\s+\.\s*$/gm, '');
    result = result.replace(/(\s+\w+)\s+\.\s+/g, '$1. '); // "faut . les" → "faut. les"

    // Nettoyer espaces multiples
    result = result.replace(/\s{2,}/g, ' ');

    return result;
  }

  /**
   * 🧹 Nettoie les phrases vides ou incomplètes après remplacement des variables
   * ⚠️ DÉSACTIVÉE - Trop agressive, supprime du contenu valide
   */
  private cleanEmptyPhrases(text: string): string {
    // FONCTION DÉSACTIVÉE - Ne fait plus rien pour éviter de casser le contenu
    return text;
  }
}
