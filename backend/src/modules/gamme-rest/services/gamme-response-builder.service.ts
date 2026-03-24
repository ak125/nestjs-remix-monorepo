import { Injectable, Logger } from '@nestjs/common';
import {
  GammeDataTransformerService,
  ConseilRow,
  InformationRow,
  EquipementierRow,
  CatalogueFamilleRow,
} from './gamme-data-transformer.service';
import { GammeRpcService } from './gamme-rpc.service';
import { BuyingGuideDataService } from './buying-guide-data.service';
import { ReferenceService } from '../../seo/services/reference.service';
import { SeoTitleEngineService } from '../../seo/services/seo-title-engine.service';
import { buildPieceVehicleUrlRaw } from '../../../common/utils/url-builder.utils';
import { stripHtmlForMeta } from '../../../utils/html-entities';
// ⚠️ IMAGES: Utiliser image-urls.utils.ts - NE PAS définir de constantes locales
import {
  buildGammeImageUrl,
  buildModelImageUrl,
  buildProxyImageUrl,
  IMAGE_CONFIG,
} from '../../catalog/utils/image-urls.utils';
import {
  normalizeR1Images,
  type NormalizeResult,
} from '../utils/r1-image-normalizer';
import { R1RelatedResourcesService } from './r1-related-resources.service';

interface MotorizationRow {
  type_id: number;
  marque_name?: string;
  marque_id?: number;
  marque_alias?: string;
  modele_name?: string;
  modele_id?: number;
  modele_alias?: string;
  modele_pic?: string;
  type_name?: string;
  type_fuel?: string;
  type_year_from?: string;
  type_year_to?: string;
  type_engine_code?: string;
  type_alias?: string;
  type_power_ps?: number;
  cgc_level?: string;
  [key: string]: unknown;
}

interface SeoFragmentRow {
  sis_id: number;
  sis_content: string;
  [key: string]: unknown;
}

/** RPC result shape for page data (aggregated + page + timings) */
interface GammeRpcPageData {
  aggregatedData: { [k: string]: unknown };
  pageData: { [k: string]: string | number | null | undefined };
  timings: {
    rpcTime?: number;
    totalTime: number;
    cacheHit: boolean;
    [k: string]: unknown;
  };
}

/**
 * Service de construction de la réponse finale
 */
@Injectable()
export class GammeResponseBuilderService {
  private readonly logger = new Logger(GammeResponseBuilderService.name);

  constructor(
    private readonly transformer: GammeDataTransformerService,
    private readonly rpcService: GammeRpcService,
    private readonly buyingGuideService: BuyingGuideDataService,
    private readonly referenceService: ReferenceService,
    private readonly seoTitleEngine: SeoTitleEngineService,
    private readonly relatedResources: R1RelatedResourcesService,
  ) {}

  /**
   * Construit la réponse complète RPC V2
   */
  async buildRpcV2Response(pgId: string) {
    const startTime = performance.now();
    const rpcResult = await this.rpcService.getPageDataRpcV2(pgId);
    const { aggregatedData, pageData, timings } = rpcResult as GammeRpcPageData;

    const pgIdNum = parseInt(pgId, 10);
    const pgNameSite = String(pageData.pg_name || '');
    const pgNameMeta = String(pageData.pg_name_meta || '');
    const pgAlias = String(pageData.pg_alias || '');
    const pgRelfollow = pageData.pg_relfollow;
    const pgLevel = pageData.pg_level;
    const pgPic = pageData.pg_img ? String(pageData.pg_img) : undefined;
    const pgWall = pageData.pg_wall ? String(pageData.pg_wall) : undefined;

    // Extraction données agrégées (cast depuis Record<string, unknown>)
    const seoData = aggregatedData?.seo as
      | { [k: string]: string | null | undefined }
      | undefined;
    const conseilsRaw = (aggregatedData?.conseils || []) as ConseilRow[];
    const informationsRaw = (aggregatedData?.informations ||
      []) as InformationRow[];
    const equipementiersRaw = (aggregatedData?.equipementiers ||
      []) as EquipementierRow[];
    const blogData = aggregatedData?.blog as
      | { [k: string]: string | null | undefined }
      | undefined;
    const catalogueFamilleRaw = (aggregatedData?.catalogue_famille ||
      []) as CatalogueFamilleRow[];
    const familleInfo = aggregatedData?.famille_info as
      | { mf_name?: string; [k: string]: unknown }
      | undefined;
    const motorisationsEnriched = (aggregatedData?.motorisations_enriched ||
      []) as MotorizationRow[];
    const seoFragments1 = (aggregatedData?.seo_fragments_1 ||
      []) as SeoFragmentRow[];
    const seoFragments2 = (aggregatedData?.seo_fragments_2 ||
      []) as SeoFragmentRow[];
    const cgcLevelStats = (aggregatedData?.cgc_level_stats || {
      level_1: 0,
      level_2: 0,
      level_3: 0,
      level_5: 0,
      total: 0,
    }) as {
      level_1: number;
      level_2: number;
      level_3: number;
      level_5: number;
      total: number;
    };
    const motorisationsBlogRaw = (aggregatedData?.motorisations_blog ||
      []) as MotorizationRow[];

    // Traitement SEO — SeoTitleEngine (P1 draft → P2 dynamic → P3 legacy → P4 fallback)
    const gammeStats = (aggregatedData?.gamme_stats || {}) as {
      products_total?: number;
      vehicles_total?: number;
      top_brands?: Array<{
        name: string;
        count: number;
        top: string;
        stars: string;
      }>;
    };
    // Extraire les noms de marques depuis top_brands (pré-calculé, trié par notoriété)
    const brandNames = (gammeStats.top_brands || [])
      .map((b) => b.name)
      .filter((n): n is string => !!n);
    const seoResolved = this.seoTitleEngine.resolve({
      pgNameSite,
      pgNameMeta,
      seoData: seoData as Parameters<
        typeof this.seoTitleEngine.resolve
      >[0]['seoData'],
      gammeStats,
      brandNames,
    });
    const pageTitle = this.transformer.contentCleaner(seoResolved.title);
    const pageDescription = stripHtmlForMeta(seoResolved.description);
    const pageKeywords = this.transformer.contentCleaner(seoResolved.keywords);
    const pageH1 = this.transformer.contentCleaner(seoResolved.h1);
    // sg_content contains intentional HTML (H2, ul, li, details) — do NOT strip tags
    let pageContent = seoResolved.content || '';

    // 🖼️ Inject approved R1 editorial images into sg_content
    // If pageContent is empty, load it directly from __seo_gamme
    if (!pageContent || pageContent.length < 500) {
      try {
        const sbClient = this.buyingGuideService.getSupabaseClient();
        const { data: seoRow } = await sbClient
          .from('__seo_gamme')
          .select('sg_content')
          .eq('sg_pg_id', String(pgIdNum))
          .single();
        if (seoRow?.sg_content) {
          pageContent = seoRow.sg_content;
        }
      } catch (e) {
        this.logger.error(
          `[R1-IMG] seo_gamme load failed pg_id=${pgIdNum}: ${e}`,
        );
      }
    }

    // ── R1 Images: sélection déterministe via normalizer ──
    // Shape: see frontend/app/types/r1-images.types.ts (R1ImageItem)
    let r1HeroImageUrl: string | null = null;
    let r1Images: NormalizeResult['images'] = {};
    try {
      const sbClient = this.buyingGuideService.getSupabaseClient();
      const { data: allApproved } = await sbClient
        .from('__seo_r1_image_prompts')
        .select(
          'rip_slot_id, rip_image_url, rip_alt_text, rip_caption, rip_aspect_ratio, rip_selected, rip_updated_at',
        )
        .eq('rip_pg_id', pgIdNum)
        .eq('rip_status', 'approved')
        .not('rip_image_url', 'is', null)
        .order('rip_updated_at', { ascending: false });

      const normalized = normalizeR1Images(allApproved ?? [], {
        pgId: pgIdNum,
        logger: this.logger,
      });
      r1HeroImageUrl = normalized.heroImagePath;
      r1Images = normalized.images;
    } catch (e) {
      this.logger.warn(`[R1-IMG] query failed pg_id=${pgIdNum}: ${e}`);
    }

    // ── R1 Related Resources: maillage contextuel ──
    let relatedResources: {
      blocks: Array<{
        kind: string;
        heading: string;
        items: Array<{
          kind: string;
          title: string;
          href: string;
          reason: string;
          score: number;
        }>;
      }>;
    } = { blocks: [] };
    try {
      relatedResources = await this.relatedResources.buildRelatedBlocks(
        pgIdNum,
        pgAlias,
        pgNameSite,
      );
    } catch (e) {
      this.logger.warn(
        `[R1-LINKS] related blocks failed pg_id=${pgIdNum}: ${e}`,
      );
    }

    // 🎯 RÈGLE SEO: G1/G2 (pg_level='1') = INDEX, G3 = NOINDEX
    // pg_level='1' = gammes prioritaires (G1) ou importantes (G2)
    // pg_level≠'1' = gammes secondaires (G3)
    const seoValidation = (aggregatedData?.seo_validation || {
      family_count: 0,
      gamme_count: 0,
    }) as { family_count: number; gamme_count: number };
    // pg_level est TEXT en BDD ('1' ou '2'), '1' = INDEX
    const isG1orG2 = String(pgLevel) === '1';
    const pageRobots = isG1orG2 ? 'index, follow' : 'noindex, nofollow';
    const canonicalLink = `pieces/${pgAlias}-${pgIdNum}.html`;

    // Traitement données
    const conseils = this.transformer.processConseils(conseilsRaw);
    const informations = this.transformer.processInformations(informationsRaw);
    const catalogueFiltres =
      this.transformer.processCatalogueFamille(catalogueFamilleRaw);
    // Equipementiers: prefer top_brands (real data) over __seo_equip_gamme (manual/stale)
    let equipementiers =
      this.transformer.processEquipementiers(equipementiersRaw);

    // If top_brands has more brands than __seo_equip_gamme, use top_brands instead
    const topBrands = gammeStats.top_brands || [];
    if (topBrands.length > equipementiers.length) {
      equipementiers = topBrands
        .filter((b) => b.name && b.count > 0)
        .slice(0, 6)
        .map((b) => ({
          title: b.name,
          description: `${b.count} références disponibles — équipementier ${b.top === '1' ? 'première monte (OE)' : 'qualité équivalente OE'}`,
          image: null as string | null,
        }));
    }

    // ✅ Utilise fonctions centralisées depuis image-urls.utils.ts

    // Traitement motorisations
    const motorisations = motorisationsEnriched.map(
      (item: MotorizationRow, index: number) => {
        const { fragment1, fragment2 } =
          this.rpcService.getSeoFragmentsByTypeId(
            item.type_id,
            seoFragments1,
            seoFragments2,
          );

        // Sélectionner une explication technique de manière rotative depuis informations
        const getExplication = (): string => {
          if (informations.length === 0) return '';

          // Utiliser type_id + index pour rotation équilibrée
          const rotationIndex = (item.type_id + index) % informations.length;
          const explication = informations[rotationIndex];

          // Reformuler pour intégrer naturellement
          if (!explication) return '';

          // Extraire la partie "pour..." si elle existe, sinon prendre tout
          const pourMatch = explication.match(/pour\s+(.+)/i);
          if (pourMatch) {
            return `, ${pourMatch[0]}`;
          }

          // Si commence par "La courroie...", extraire l'action principale
          if (
            explication.toLowerCase().includes('entraîne') ||
            explication.toLowerCase().includes('permet')
          ) {
            return ', pour assurer le bon fonctionnement des équipements';
          }

          return '';
        };

        // Note: getExplication() est appelé pour effet de bord potentiel mais le résultat n'est pas utilisé
        getExplication();

        // ✅ Construire l'URL de l'image via fonction centralisée
        const marqueAlias =
          item.marque_alias ||
          item.marque_name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        const carImage = buildModelImageUrl(marqueAlias, item.modele_pic);

        // Slugify pour les URLs
        // ✅ Utilise buildPieceVehicleUrlRaw centralisé

        // Construire la période
        const yearFrom = (item.type_year_from || '').trim();
        const yearTo = (item.type_year_to || '').trim();
        const periode =
          yearFrom && yearTo
            ? `${yearFrom} – ${yearTo}`
            : yearFrom
              ? `Depuis ${yearFrom}`
              : yearTo
                ? `Jusqu'à ${yearTo}`
                : '';

        // Construire le lien vers la page gamme avec véhicule
        // Format: /pieces/gamme-alias-ID/marque-alias-ID/modele-alias-ID/type-alias-ID.html
        // ✅ Utilise les alias de la DB (marque_alias, modele_alias, type_alias) au lieu de slugifier
        const link = buildPieceVehicleUrlRaw(
          { alias: pgAlias, id: pgIdNum },
          { alias: item.marque_alias || item.marque_name, id: item.marque_id },
          { alias: item.modele_alias || item.modele_name, id: item.modele_id },
          { alias: item.type_alias || item.type_name, id: item.type_id },
        );

        // Valider et nettoyer les fragments SEO
        const validateFragment = (frag: string, marqueName: string): string => {
          const cleaned = this.transformer.cleanSeoText(frag || '', marqueName);
          // Éviter fragments trop courts ou invalides
          if (
            cleaned.length < 10 ||
            cleaned.includes('undefined') ||
            cleaned.includes('null')
          ) {
            return '';
          }
          // Éviter duplications de mots consécutifs (ex: "contrôler contrôler")
          const words = cleaned.split(' ');
          const deduped = words.filter(
            (word, idx) => idx === 0 || word !== words[idx - 1],
          );
          return deduped.join(' ');
        };

        const cleanedFragment1 = validateFragment(
          fragment1 || '',
          item.marque_name,
        );
        const cleanedFragment2 = validateFragment(
          fragment2 || '',
          item.marque_name,
        );

        // Construire le titre complet : "[Gamme] [marque] [modèle] [type], [fragment1]"
        const buildTitle = () => {
          const hasFragment1 =
            cleanedFragment1 && cleanedFragment1.trim().length > 3;
          if (hasFragment1) {
            return `${pgNameSite} ${item.marque_name} ${item.modele_name} ${item.type_name}, ${cleanedFragment1}`;
          }
          return `${pgNameSite} ${item.marque_name} ${item.modele_name} ${item.type_name}`;
        };

        // Construire la description avec templates variés et cohérents grammaticalement
        const buildDescription = () => {
          const hasFragment1 =
            cleanedFragment1 && cleanedFragment1.trim().length > 3;
          const hasFragment2 =
            cleanedFragment2 && cleanedFragment2.trim().length > 3;

          // Vérifier si les fragments sont identiques ou très similaires
          const fragmentsAreSimilar =
            hasFragment1 &&
            hasFragment2 &&
            (cleanedFragment1 === cleanedFragment2 ||
              cleanedFragment1
                .toLowerCase()
                .startsWith(cleanedFragment2.toLowerCase().slice(0, 10)));

          // Utiliser les informations de la DB (__seo_gamme_info) comme finitions dynamiques
          // Ces informations sont déjà chargées dans 'informations' depuis la RPC
          const getFinitionFromDb = (): string => {
            if (informations.length === 0) {
              // Fallback si pas d'informations en DB
              return 'pour votre sécurité et le bon fonctionnement de votre véhicule.';
            }

            // Sélection rotative basée sur type_id + index
            const infoIndex = (item.type_id + index) % informations.length;
            const info = informations[infoIndex];

            if (!info || info.length < 10) {
              return 'pour votre sécurité et le bon fonctionnement de votre véhicule.';
            }

            // Extraire une partie pertinente de l'information
            let finition = info;

            // Chercher "pour" dans le texte et extraire à partir de là
            const pourIndex = info.toLowerCase().indexOf(' pour ');
            if (pourIndex > 0 && pourIndex < info.length - 20) {
              finition = info.substring(pourIndex + 1).trim();
              // S'assurer que ça commence par une minuscule
              finition = finition.charAt(0).toLowerCase() + finition.slice(1);
            } else {
              // Si la phrase commence par "Les plaquettes...", "L'usure...", etc.
              // On la garde mais on la reformule pour qu'elle s'intègre mieux
              if (info.match(/^(Les |L'|Il |En |Quand |Attention)/i)) {
                // Mettre la première lettre en minuscule pour l'intégrer après une virgule
                finition = info.charAt(0).toLowerCase() + info.slice(1);
              } else {
                // Chercher le verbe principal pour extraire la partie utile
                const verbMatch = info.match(
                  /(servent à|jouent|permettent|assurent|doivent être|sont)/i,
                );
                if (verbMatch && verbMatch.index) {
                  // Ajouter "les plaquettes de frein" devant pour donner un sujet
                  const afterVerb = info.substring(verbMatch.index).trim();
                  if (afterVerb.length > 15) {
                    finition = 'les plaquettes de frein ' + afterVerb;
                  }
                }
              }
            }

            // Ajouter un point final si nécessaire
            if (!finition.endsWith('.')) {
              finition = finition + '.';
            }

            return finition;
          };

          const finition = getFinitionFromDb();

          // Formater la finition pour la ponctuation correcte
          // Si la finition est une phrase longue, utiliser un point avant
          const isLongFinition = finition.length > 50;
          const separator = isLongFinition ? '. ' : ', ';
          const formattedFinition = isLongFinition
            ? finition.charAt(0).toUpperCase() + finition.slice(1)
            : finition;

          // Si fragments identiques, utiliser un seul fragment avec template amélioré
          if (fragmentsAreSimilar || (hasFragment1 && !hasFragment2)) {
            const fragment = cleanedFragment1;
            const capitalizedFragment =
              fragment.charAt(0).toUpperCase() + fragment.slice(1);
            const templateIndex = item.type_id % 5;

            switch (templateIndex) {
              case 0:
                return `${capitalizedFragment} les ${pgNameSite.toLowerCase()} ${item.marque_name} ${item.modele_name} ${item.type_name} ${item.type_power_ps} ch${separator}${formattedFinition}`;
              case 1:
                return `Pensez à ${fragment.toLowerCase()} avant installation${separator}${formattedFinition}`;
              case 2:
                return `${pgNameSite} ${item.marque_name} ${item.modele_name} ${item.type_name} ${item.type_power_ps} ch : ${fragment.toLowerCase()}. Pensez à vérifier avant montage${separator}${formattedFinition}`;
              case 3:
                return `Pour votre ${item.marque_name} ${item.modele_name} ${item.type_name} ${item.type_power_ps} ch, ${fragment.toLowerCase()}${separator}${formattedFinition}`;
              case 4:
                return `${capitalizedFragment} pour ${item.marque_name} ${item.modele_name} ${item.type_name} ${item.type_power_ps} ch${separator}${formattedFinition}`;
            }
          }

          // Templates variés basés sur type_id avec deux fragments distincts
          if (hasFragment1 && hasFragment2) {
            const templateIndex = item.type_id % 4;
            const cap1 =
              cleanedFragment1.charAt(0).toUpperCase() +
              cleanedFragment1.slice(1);
            const cap2 =
              cleanedFragment2.charAt(0).toUpperCase() +
              cleanedFragment2.slice(1);

            switch (templateIndex) {
              case 0:
                return `${cap2} les ${pgNameSite.toLowerCase()} ${item.marque_name} ${item.modele_name} ${item.type_name} ${item.type_power_ps} ch${separator}${formattedFinition}`;
              case 1:
                return `${cap1} pour ${item.marque_name} ${item.modele_name} ${item.type_name} ${item.type_power_ps} ch. ${cap2} avant installation${separator}${formattedFinition}`;
              case 2:
                return `${pgNameSite} ${item.marque_name} ${item.modele_name} ${item.type_name} ${item.type_power_ps} ch : ${cleanedFragment1.toLowerCase()}. Pensez à ${cleanedFragment2.toLowerCase()} avant montage${separator}${formattedFinition}`;
              case 3:
                return `Pour votre ${item.marque_name} ${item.modele_name} ${item.type_name} ${item.type_power_ps} ch, ${cleanedFragment1.toLowerCase()}${separator}${formattedFinition}`;
            }
          }

          // Sinon, description par défaut améliorée
          return `Achetez ${pgNameSite.toLowerCase()} ${item.marque_name} ${item.modele_name} ${item.type_name} ${item.type_power_ps} ch ${periode}, ${finition}`;
        };

        return {
          cgc_level: item.cgc_level || '1', // Niveau CGC (1=page gamme, 2=page marque, 3=page type)
          cgc_type_id: item.type_id,
          type_name: item.type_name,
          type_power_ps: item.type_power_ps,
          puissance: `${item.type_power_ps} ch`,
          type_year_from: item.type_year_from,
          type_year_to: item.type_year_to,
          periode: periode,
          modele_id: item.modele_id,
          modele_name: item.modele_name,
          marque_id: item.marque_id,
          marque_name: item.marque_name,
          engine_code: item.type_engine_code || null,
          image: carImage,
          link: link,
          title: buildTitle(),
          content: buildDescription(),
          description: buildDescription(),
          advice: cleanedFragment2 || buildTitle(),
        };
      },
    );

    // Traitement motorisations blog (niveau 5)
    const motorisationsBlog = motorisationsBlogRaw.map(
      (item: MotorizationRow) => {
        // ✅ Utilise fonction centralisée
        const marqueAlias =
          item.marque_alias ||
          item.marque_name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        const carImage = buildModelImageUrl(marqueAlias, item.modele_pic);

        const yearFrom = (item.type_year_from || '').trim();
        const yearTo = (item.type_year_to || '').trim();
        const periode =
          yearFrom && yearTo
            ? `${yearFrom} – ${yearTo}`
            : yearFrom
              ? `Depuis ${yearFrom}`
              : yearTo
                ? `Jusqu'à ${yearTo}`
                : '';

        const link = buildPieceVehicleUrlRaw(
          { alias: pgAlias, id: pgIdNum },
          { alias: item.marque_alias || item.marque_name, id: item.marque_id },
          { alias: item.modele_alias || item.modele_name, id: item.modele_id },
          { alias: item.type_alias || item.type_name, id: item.type_id },
        );

        return {
          cgc_level: item.cgc_level,
          type_id: item.type_id,
          type_name: item.type_name,
          puissance: `${item.type_power_ps} ch`,
          periode,
          modele_id: item.modele_id,
          modele_name: item.modele_name,
          marque_id: item.marque_id,
          marque_name: item.marque_name,
          image: carImage,
          link,
          title: `${item.marque_name} ${item.modele_name} ${item.type_name}`,
        };
      },
    );

    // Guide d'achat
    const guideAchat = blogData
      ? {
          id: blogData.ba_id,
          title: this.transformer.contentCleaner(blogData.ba_h1 || ''),
          alias: blogData.ba_alias,
          preview: this.transformer.contentCleaner(blogData.ba_preview || ''),
          // ✅ Utilise fonction centralisée
          image: blogData.ba_wall
            ? buildProxyImageUrl(
                IMAGE_CONFIG.BUCKETS.UPLOADS,
                `blog/${blogData.ba_wall}`,
              )
            : null,
          wall: blogData.ba_wall || '',
          link: `/blog-pieces-auto/conseils/${blogData.ba_alias}`,
          updated: blogData.ba_update,
        }
      : null;

    // 🚀 LCP V9: Start reference lookup early (runs in parallel with buying guide)
    const referencePromise = this.referenceService
      .getByPgId(pgIdNum)
      .catch(() => null);

    // 🔧 Fetch CNIT/Type Mine codes for all motorisations (parallel with buying guide)
    const uniqueTypeIds = [
      ...new Set(motorisationsEnriched.map((m: MotorizationRow) => m.type_id)),
    ];
    const technicalCodesPromise = this.rpcService
      .getTechnicalCodesByTypeIds(uniqueTypeIds)
      .catch(() => []);

    // Récupérer le contrat éditorial puis construire le guide orienté achat.
    const buyingGuideContract =
      await this.buyingGuideService.getBuyingGuideContractV1(pgId);
    const mappedBuyingGuide = buyingGuideContract
      ? this.buyingGuideService.toBuyingGuideV1(buyingGuideContract)
      : null;
    const antiWikiGate =
      this.buyingGuideService.passesBuyingGuideAntiWikiGate(mappedBuyingGuide);
    const useFallbackBuyingGuide = !antiWikiGate.ok;
    const gammeBuyingGuide = useFallbackBuyingGuide
      ? this.buyingGuideService.buildAutoBuyingGuideV1({
          pgId,
          pgName: pgNameSite,
          familyName: familleInfo?.mf_name || null,
        })
      : mappedBuyingGuide;

    // Map contract data to purchaseGuideData for QuickGuideSection (intro/timing/budget cards)
    const purchaseGuideData = buyingGuideContract
      ? {
          id: pgIdNum,
          pgId: pgId,
          intro: buyingGuideContract.intro,
          risk: buyingGuideContract.risk,
          timing: buyingGuideContract.timing,
          arguments: buyingGuideContract.arguments,
          howToChoose: buyingGuideContract.howToChoose,
          symptoms: buyingGuideContract.symptoms,
          faq: buyingGuideContract.faq,
          h1Override: buyingGuideContract.h1Override || null,
          h2Overrides: buyingGuideContract.h2Overrides || null,
          heroSubtitle: buyingGuideContract.heroSubtitle || null,
          selectorMicrocopy: buyingGuideContract.selectorMicrocopy || null,
          microSeoBlock: buyingGuideContract.microSeoBlock || null,
          compatibilitiesIntro:
            buyingGuideContract.compatibilitiesIntro || null,
          equipementiersLine: buyingGuideContract.equipementiersLine || null,
          familyCrossSellIntro:
            buyingGuideContract.familyCrossSellIntro || null,
          interestNuggets: buyingGuideContract.interestNuggets || null,
          safeTableRows: buyingGuideContract.safeTableRows || null,
          visualPlan: buyingGuideContract.visualPlan || null,
          contentContract: buyingGuideContract.contentContract || null,
          hardRules: buyingGuideContract.hardRules || null,
        }
      : gammeBuyingGuide
        ? {
            id: pgIdNum,
            pgId: pgId,
            intro: {
              title: `À quoi sert ${pgNameSite} ?`,
              role: gammeBuyingGuide.compatibilityRules?.[0] || '',
              syncParts: gammeBuyingGuide.pairing?.recommended || [],
            },
            risk: {
              title: `Pourquoi remplacer ${pgNameSite} à temps ?`,
              explanation: '',
              consequences: [],
              costRange: '',
              conclusion: '',
            },
            timing: {
              title: 'Quand intervenir ?',
              years: 'Contrôle annuel recommandé',
              km: 'Contrôle à chaque révision',
              note: '',
            },
            arguments:
              gammeBuyingGuide.trustArguments?.slice(0, 4)?.map((a) => ({
                title: a.title,
                content: a.content,
                icon: a.icon,
              })) || [],
            howToChoose: null as string | null,
            symptoms: gammeBuyingGuide.symptoms || [],
            faq: gammeBuyingGuide.faq || [],
            h1Override: null as string | null,
            h2Overrides: null as Record<string, string> | null,
            heroSubtitle: null as string | null,
            selectorMicrocopy: null as string[] | null,
            microSeoBlock: null as string | null,
            compatibilitiesIntro: null as string | null,
            equipementiersLine: null as string | null,
            familyCrossSellIntro: null as string | null,
            interestNuggets: null as Record<string, unknown> | null,
            safeTableRows: null as Array<{
              element: string;
              howToCheck: string;
            }> | null,
            visualPlan: null as Record<string, unknown> | null,
            contentContract: null as Record<string, unknown> | null,
            hardRules: null as Record<string, unknown> | null,
          }
        : null;

    // 🚀 LCP V9: Await reference (started in parallel with buying guide above)
    let referenceData: {
      slug: string;
      title: string;
      definition: string;
      roleMecanique: string | null;
      canonicalUrl: string | null;
    } | null = null;
    const ref = await referencePromise;
    if (ref && ref.definition) {
      referenceData = {
        slug: ref.slug,
        title: ref.title,
        definition: ref.definition,
        roleMecanique: ref.roleMecanique,
        canonicalUrl: ref.canonicalUrl,
      };
    }

    // 🔧 Await CNIT/Type Mine codes and build technicalCodes
    const technicalCodesRaw = await technicalCodesPromise;
    let technicalCodes: {
      items: Array<{
        vehicleLabel: string;
        typeId: number;
        mines: string[];
        cnits: string[];
      }>;
      totalMines: number;
      totalCnits: number;
    } | null = null;

    if (technicalCodesRaw.length > 0) {
      // Group codes by type_id
      const codesByType = new Map<
        string,
        { mines: Set<string>; cnits: Set<string> }
      >();
      for (const row of technicalCodesRaw) {
        const tid = row.tnc_type_id;
        if (!codesByType.has(tid)) {
          codesByType.set(tid, { mines: new Set(), cnits: new Set() });
        }
        const entry = codesByType.get(tid)!;
        if (row.tnc_code?.trim()) entry.mines.add(row.tnc_code.trim());
        if (row.tnc_cnit?.trim()) entry.cnits.add(row.tnc_cnit.trim());
      }

      // Map to motorisation items for vehicle labels
      const items: Array<{
        vehicleLabel: string;
        typeId: number;
        mines: string[];
        cnits: string[];
      }> = [];
      let totalMines = 0;
      let totalCnits = 0;

      for (const motor of motorisationsEnriched) {
        const codes = codesByType.get(String(motor.type_id));
        if (!codes) continue;
        const mines = [...codes.mines];
        const cnits = [...codes.cnits];
        if (mines.length === 0 && cnits.length === 0) continue;

        totalMines += mines.length;
        totalCnits += cnits.length;
        items.push({
          vehicleLabel: `${motor.marque_name} ${motor.modele_name} ${motor.type_name}`,
          typeId: motor.type_id,
          mines,
          cnits,
        });
      }

      if (items.length > 0) {
        technicalCodes = { items, totalMines, totalCnits };
      }
    }

    const totalTime = performance.now() - startTime;

    // ✅ URLs via fonctions centralisées
    const imageUrl = pgPic
      ? buildGammeImageUrl(pgPic)
      : IMAGE_CONFIG.DEFAULT_IMAGE;
    const wallUrl = pgWall
      ? buildProxyImageUrl(
          IMAGE_CONFIG.BUCKETS.UPLOADS,
          `articles/gammes-produits/wall/${pgWall}`,
        )
      : null;

    return {
      status: 200,
      meta: {
        title: pageTitle,
        description: pageDescription,
        keywords: pageKeywords,
        robots: pageRobots,
        canonical: canonicalLink,
      },
      hero: {
        h1: pageH1,
        content: pageContent,
        pg_name: pgNameSite,
        pg_alias: pgAlias,
        image: r1HeroImageUrl
          ? buildProxyImageUrl(IMAGE_CONFIG.BUCKETS.UPLOADS, r1HeroImageUrl)
          : imageUrl,
        wall: wallUrl,
        famille_info: familleInfo || null,
      },
      r1Images: Object.keys(r1Images).length > 0 ? r1Images : undefined,
      relatedResources:
        relatedResources.blocks.length > 0 ? relatedResources : undefined,
      motorisations:
        motorisations.length > 0
          ? {
              title: `Motorisations compatibles`,
              items: motorisations,
            }
          : null,
      catalogueFiltres:
        catalogueFiltres.length > 0
          ? {
              title: familleInfo
                ? `Autres pièces de la famille ${familleInfo.mf_name}`
                : 'Pièces similaires',
              items: catalogueFiltres,
            }
          : null,
      // Alias pour compatibilité frontend
      catalogueMameFamille:
        catalogueFiltres.length > 0
          ? {
              title: familleInfo
                ? `Autres pièces de la famille ${familleInfo.mf_name}`
                : 'Pièces similaires',
              items: catalogueFiltres,
            }
          : null,
      equipementiers:
        equipementiers.length > 0
          ? {
              title: 'Nos équipementiers',
              items: equipementiers,
            }
          : null,
      conseils:
        conseils.length > 0
          ? {
              title: `Conseils d'entretien`,
              items: conseils,
            }
          : null,
      informations:
        informations.length > 0
          ? {
              title: `Informations sur ${pgNameSite || 'ce produit'}`,
              items: informations,
            }
          : null,
      guideAchat,
      // ✅ Nouveau contrat orienté décision d'achat (sans H1)
      gammeBuyingGuide: gammeBuyingGuide || null,
      // ✅ Données narratives pour QuickGuideSection (intro/timing/budget)
      purchaseGuideData,
      // ✅ Référence technique R4 (encart "En savoir plus")
      reference: referenceData,
      // 🔧 Codes CNIT / Type Mine pour fiche technique collapsible
      technicalCodes,
      motorisationsBlog:
        motorisationsBlog.length > 0
          ? {
              title: 'Véhicules cités dans nos guides',
              items: motorisationsBlog,
            }
          : null,
      seoValidation: {
        familyCount: seoValidation.family_count,
        gammeCount: seoValidation.gamme_count,
        relfollow: String(pgRelfollow) === '1' ? 1 : 0,
        isIndexable: isG1orG2,
        robots: pageRobots,
        pgLevel: pageData.pg_level,
        pgRelfollow: pageData.pg_relfollow,
      },
      cgcLevelStats: {
        level1: cgcLevelStats.level_1,
        level2: cgcLevelStats.level_2,
        level3: cgcLevelStats.level_3,
        level5: cgcLevelStats.level_5,
        total: cgcLevelStats.total,
        description:
          'CGC_LEVEL: 1=motorisations grille, 2=page marque, 3=page type, 5=section blog',
      },
      // 🔗 SEO Switches pour maillage interne (ancres variées)
      seoSwitches: {
        verbs: seoFragments1.slice(0, 20).map((s: SeoFragmentRow) => ({
          id: s.sis_id,
          content: s.sis_content,
        })),
        nouns: seoFragments2.slice(0, 20).map((s: SeoFragmentRow) => ({
          id: s.sis_id,
          content: s.sis_content,
        })),
        verbCount: seoFragments1.length,
        nounCount: seoFragments2.length,
      },
      performance: {
        total_time_ms: totalTime,
        rpc_time_ms: timings.rpcTime,
        motorisations_count: cgcLevelStats.level_3 || motorisations.length,
        motorisations_blog_count: motorisationsBlog.length,
        catalogue_famille_count: catalogueFiltres.length,
        equipementiers_count: equipementiers.length,
        conseils_count: conseils.length,
        informations_count: informations.length,
        guide_available: guideAchat ? 1 : 0,
        buying_guide_available: gammeBuyingGuide ? 1 : 0,
        buying_guide_source_verified:
          gammeBuyingGuide?.quality?.verified === true ? 1 : 0,
        buying_guide_quality_score: gammeBuyingGuide?.quality?.score ?? 0,
        buying_guide_fallback_used: useFallbackBuyingGuide ? 1 : 0,
        buying_guide_gate_ok: antiWikiGate.ok ? 1 : 0,
        buying_guide_gate_reasons: antiWikiGate.ok
          ? null
          : antiWikiGate.reasons.join(','),
      },
    };
  }

  /**
   * Inject approved R1 editorial images into sg_content HTML.
   * Matches slot to H2 by keyword, inserts <figure> after the H2.
   */
  // injectR1Images removed — images are now structured data in r1Images map
}
