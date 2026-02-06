import { TABLES } from '@repo/database-types';
import { Injectable, Logger } from '@nestjs/common';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import { RedisCacheService } from '../../../database/services/redis-cache.service';
// ⚠️ IMAGES: Utiliser image-urls.utils.ts - NE PAS définir de constantes locales
import { buildRackImageUrl } from '../../catalog/utils/image-urls.utils';

type SearchFilters = {
  marqueIds?: number[];
  gammeIds?: number[];
};

type Pagination = {
  page?: number;
  limit?: number;
};

type SearchParams = {
  query: string;
  filters?: SearchFilters;
  pagination?: Pagination;
  /** Si false (défaut), exclut les équivalences OEM (prs_kind >= 3) */
  includeEquivalences?: boolean;
};

@Injectable()
export class SearchSimpleService extends SupabaseBaseService {
  protected readonly logger = new Logger(SearchSimpleService.name);

  // 🔑 Cache
  private readonly OEM_CACHE_PREFIX = 'search:v2:oem:';
  private readonly OEM_CACHE_TTL = 3600; // 1h
  private readonly GENERAL_CACHE_TTL = 1800; // 30min

  constructor(private readonly redisCache: RedisCacheService) {
    super();
  }

  // Dictionnaire mots-clés catégorie
  private readonly CATEGORY_KEYWORDS: Record<string, string[]> = {
    plaquette: ['plaquette', 'plaquettes', 'frein', 'freins'],
    filtre: ['filtre', 'filtres', 'air', 'huile', 'carburant', 'habitacle'],
    kit: ['kit', 'distribution', 'courroie', 'timing'],
    disque: ['disque', 'disques', 'frein', 'freinage'],
    amortisseur: ['amortisseur', 'amortisseurs', 'suspension'],
    bougie: ['bougie', 'bougies', 'allumage'],
    demarreur: ['demarreur', 'démarreur', 'starter'],
    alternateur: ['alternateur', 'alternateurs'],
    radiateur: ['radiateur', 'refroidissement'],
    pompe: ['pompe', 'eau', 'carburant'],
  };

  /**
   * Extrait un éventuel mot-clé de catégorie et renvoie la ref sans ce mot.
   */
  private extractCategoryKeywords(query: string): {
    refPart: string;
    keyword: string | null;
  } {
    const lower = query.toLowerCase();
    const words = lower.split(/\s+/);

    for (const keywords of Object.values(this.CATEGORY_KEYWORDS)) {
      for (const kw of keywords) {
        if (words.includes(kw)) {
          const refPart = query
            .replace(new RegExp(`\\b${kw}\\b`, 'gi'), '')
            .trim();
          this.logger.log(
            `✂️ Séparation: "${query}" → REF="${refPart}" + CATÉGORIE="${kw}"`,
          );
          return { refPart, keyword: kw };
        }
      }
    }
    return { refPart: query, keyword: null };
  }

  /** Nettoie une référence (supprime espaces/tirets/points) */
  private cleanReference(ref: string): string {
    return ref.replace(/[\s\-\.]/g, '');
  }

  /** Niveau de qualité: 1=OES, 2=Aftermarket, 4=Adaptable (3=ES à implémenter via consigne) */
  private getQualityLevel(marqueOes: string | null): number {
    if (marqueOes === 'O' || marqueOes === 'OES') return 1;
    if (marqueOes === 'A') return 2;
    return 4;
  }

  /**
   * Vraie OEM constructeur si majoritairement numérique et commence par chiffre.
   * Exclut les refs équipementiers qui commencent par lettres (K015212, TCKH221…)
   */
  private isRealOemReference(ref: string): boolean {
    const cleaned = this.cleanReference(ref);

    if (/^[a-z]{2,}/i.test(cleaned)) return false; // 2+ lettres au début -> équipementier
    if (/^[a-z]\d/i.test(cleaned)) return false; // lettre puis chiffre -> équipementier

    const digitCount = (cleaned.match(/\d/g) || []).length;
    const letterCount = (cleaned.match(/[a-z]/gi) || []).length;

    return (
      /^\d/.test(cleaned) &&
      (digitCount === 0 || digitCount / Math.max(letterCount, 1) > 3)
    );
  }

  /**
   * 🔎 Recherche OEM/simple avec tri OES prioritaire, cache Redis, facettes & pagination
   */
  async search(params: SearchParams) {
    const startTime = Date.now();
    const { query, filters, pagination, includeEquivalences = true } = params;
    const page = Math.max(1, pagination?.page ?? 1);
    const limit = Math.min(100, Math.max(1, pagination?.limit ?? 20));
    const offset = (page - 1) * limit;

    const cleanQuery = query.trim();
    const category = this.extractCategoryKeywords(cleanQuery);
    const refQuery = category.refPart;
    const categoryFilter = category.keyword;

    // Variantes de recherche (comme ClearSearchQuest PHP - UPPERCASE)
    const cleanedForSearch = refQuery.trim().toUpperCase();
    const queryVariants = [
      cleanedForSearch, // Version originale
      cleanedForSearch.replace(/\s+/g, ''), // Sans espaces "KH22"
      cleanedForSearch.replace(/([A-Z])(\d)/g, '$1 $2'), // Avec espace "KH 22"
      cleanedForSearch.replace(/([A-Z])(\d)/g, '$1-$2'), // Avec tiret "KH-22"
    ];
    const uniqueVariants = [...new Set(queryVariants)];

    const cacheKey = `${this.OEM_CACHE_PREFIX}${cleanQuery}:p${page}:l${limit}:f${JSON.stringify(
      filters || {},
    )}:eq${includeEquivalences ? '1' : '0'}:v${uniqueVariants.join('|')}`;

    // ⚡ Try cache
    try {
      const cached = await this.redisCache.get(cacheKey);
      if (cached) {
        this.logger.log(
          `⚡ Cache HIT pour "${cleanQuery}" (${Date.now() - startTime}ms)`,
        );
        return {
          ...cached,
          executionTime: Date.now() - startTime,
          cached: true,
        };
      }
    } catch (e) {
      this.logger.warn(`⚠️ Erreur lecture cache Redis:`, e);
    }

    this.logger.log(
      `🔍 Recherche: "${refQuery}" → variantes: ${uniqueVariants.join(', ')}`,
    );

    // 🆕 SHORT-CIRCUIT: Si refQuery est vide (la requête entière est un mot-clé catégorie),
    // aller directement au fallback gamme-name au lieu de chercher "" dans les refs
    if (cleanedForSearch === '' && categoryFilter) {
      this.logger.log(
        `🎯 Requête catégorielle pure: "${cleanQuery}" → fallback gamme-name direct`,
      );
      const gammeResult = await this.searchByGammeName(categoryFilter);

      if (gammeResult.pieces.length > 0) {
        this.logger.log(
          `✅ Gamme-name direct: ${gammeResult.matchedGammes.map((g) => g.name).join(', ')} (${gammeResult.pieces.length} pièces)`,
        );
        const result = await this.processResults(
          gammeResult.pieces,
          cleanQuery,
          filters,
          page,
          limit,
          offset,
          startTime,
          null, // pas de categoryFilter ici, les pièces sont déjà filtrées par gamme
          cacheKey,
        );
        if (result.data) {
          (result.data as any).fallbackType = 'gamme-name';
          (result.data as any).matchedGammes = gammeResult.matchedGammes;
        }
        return result;
      }
    }

    // 1) refs dans pieces_ref_search
    const searchRefsResult = await this.client
      .from(TABLES.pieces_ref_search)
      .select('prs_piece_id, prs_ref, prs_search, prs_kind')
      .in('prs_search', uniqueVariants)
      .limit(1000);

    const searchRefs = searchRefsResult.data || [];
    this.logger.log(
      `📋 ${searchRefs.length} références trouvées dans pieces_ref_search`,
    );

    // Distribution des kinds (debug)
    if (searchRefs.length > 0) {
      const kindCounts = searchRefs.reduce<Record<string, number>>((acc, r) => {
        const k = r.prs_kind ?? 'null';
        acc[k] = (acc[k] || 0) + 1;
        return acc;
      }, {});
      this.logger.log(`📊 prs_kind: ${JSON.stringify(kindCounts)}`);
    }

    // FALLBACK: Si pieces_ref_search est vide, rechercher dans pieces_price.pri_ref (beaucoup plus rapide !)
    let pieceIds: number[] = [];
    const prsKindMap = new Map<string, string>();

    if (searchRefs.length === 0) {
      this.logger.log(
        `⚠️ pieces_ref_search vide, fallback OPTIMISÉ sur pieces_price.pri_ref`,
      );

      // ✅ OPTIMISATION: Rechercher dans pieces_price.pri_ref (indexé et plus rapide)
      // Utiliser seulement la variante principale pour la performance
      const mainVariant = uniqueVariants[0];
      const fallbackPricesResult = await this.client
        .from(TABLES.pieces_price)
        .select('pri_piece_id, pri_ref, pri_pm_id, pri_dispo')
        .ilike('pri_ref', `%${mainVariant}%`)
        .eq('pri_dispo', '1')
        .limit(100); // Limite raisonnable pour la performance

      const priceMatches = fallbackPricesResult.data || [];
      this.logger.log(
        `🔄 Fallback: ${priceMatches.length} prix trouvés via pri_ref`,
      );

      if (priceMatches.length === 0) {
        // 🆕 Fallback 3: Recherche par nom de gamme (dernière chance)
        const gammeResult = await this.searchByGammeName(cleanQuery);

        if (gammeResult.pieces.length > 0) {
          this.logger.log(
            `🔍 Fallback gamme-name: "${cleanQuery}" → ${gammeResult.matchedGammes.map((g) => g.name).join(', ')} (${gammeResult.pieces.length} pièces)`,
          );
          const result = await this.processResults(
            gammeResult.pieces,
            refQuery,
            filters,
            page,
            limit,
            offset,
            startTime,
            categoryFilter,
            cacheKey,
          );
          if (result.data) {
            (result.data as any).fallbackType = 'gamme-name';
            (result.data as any).matchedGammes = gammeResult.matchedGammes;
          }
          return result;
        }

        return this.processResults(
          [],
          refQuery,
          filters,
          page,
          limit,
          offset,
          startTime,
          categoryFilter,
          cacheKey,
        );
      }

      // Récupérer les pièces correspondantes
      const matchedPieceIds = [
        ...new Set(priceMatches.map((p) => p.pri_piece_id)),
      ];
      const directPiecesResult = await this.client
        .from(TABLES.pieces)
        .select(
          'piece_id, piece_ref, piece_pg_id, piece_pm_id, piece_qty_sale, piece_display',
        )
        .in('piece_id', matchedPieceIds)
        .eq('piece_display', true);

      const directPieces = directPiecesResult.data || [];
      this.logger.log(`🔄 Fallback: ${directPieces.length} pièces trouvées`);

      // Utiliser ces pièces directement (prs_kind = '0' par défaut)
      pieceIds = directPieces.map((p) => p.piece_id);
      directPieces.forEach((p) => prsKindMap.set(String(p.piece_id), '0'));

      // Passer directement au traitement des prix (sauter la seconde requête pieces)
      const pieces = directPieces;

      // 3) Charger les prix disponibles (pri_dispo='1')
      const pricesResult = await this.client
        .from(TABLES.pieces_price)
        .select(
          'pri_piece_id, pri_pm_id, pri_vente_ttc, pri_consigne_ttc, pri_dispo',
        )
        .in(
          'pri_piece_id',
          pieces.map((p) => String(p.piece_id)),
        )
        .eq('pri_dispo', '1');

      const prices = pricesResult.data || [];
      this.logger.log(`💰 ${prices.length} prix (pri_dispo='1')`);

      // Map des prix
      const priceMap = new Map<string, any>();
      for (const pr of prices) {
        priceMap.set(`${pr.pri_piece_id}-${pr.pri_pm_id}`, pr);
      }

      // Enrichir avec prs_kind et prix
      const enrichedPieces = pieces.map((p) => {
        const key = `${p.piece_id}-${p.piece_pm_id}`;
        const price = priceMap.get(key);
        const _prsKind = prsKindMap.get(String(p.piece_id)) ?? '0';

        return {
          ...p,
          _prsKind,
          _price: price ? parseFloat(price.pri_vente_ttc || '0') : 0,
          _deposit: price ? parseFloat(price.pri_consigne_ttc || '0') : 0,
          _hasPrice: !!price,
        };
      });

      // Tri par prs_kind puis prix*quantité
      const sortedPieces = enrichedPieces.sort((a, b) => {
        const kindA = parseInt(a._prsKind) || 99;
        const kindB = parseInt(b._prsKind) || 99;
        if (kindA !== kindB) return kindA - kindB;
        const priceA = (a._price || 0) * (a.piece_qty_sale || 1);
        const priceB = (b._price || 0) * (b.piece_qty_sale || 1);
        return priceB - priceA;
      });

      return this.processResults(
        sortedPieces,
        refQuery,
        filters,
        page,
        limit,
        offset,
        startTime,
        categoryFilter,
        cacheKey,
      );
    }

    // 2) Récupérer pièces visibles (piece_display=1) + champs utiles
    pieceIds = [
      ...new Set(searchRefs.map((r: any) => parseInt(r.prs_piece_id))),
    ].filter((v) => Number.isFinite(v));

    if (pieceIds.length === 0) {
      return this.processResults(
        [],
        refQuery,
        filters,
        page,
        limit,
        offset,
        startTime,
        categoryFilter,
        cacheKey,
      );
    }

    const piecesResult = await this.client
      .from(TABLES.pieces)
      .select(
        'piece_id, piece_ref, piece_pg_id, piece_pm_id, piece_qty_sale, piece_display',
      )
      .in('piece_id', pieceIds)
      .eq('piece_display', true)
      .limit(1000);

    const pieces = piecesResult.data || [];
    this.logger.log(`📦 ${pieces.length} pièces (piece_display=1)`);

    if (pieces.length === 0) {
      return this.processResults(
        [],
        refQuery,
        filters,
        page,
        limit,
        offset,
        startTime,
        categoryFilter,
        cacheKey,
      );
    }

    // 3) Charger les prix disponibles (pri_dispo='1') — colonnes TEXT
    const pricesResult = await this.client
      .from(TABLES.pieces_price)
      .select(
        'pri_piece_id, pri_pm_id, pri_vente_ttc, pri_consigne_ttc, pri_dispo',
      )
      .in(
        'pri_piece_id',
        pieces.map((p) => String(p.piece_id)),
      )
      .eq('pri_dispo', '1');

    const prices = pricesResult.data || [];
    this.logger.log(`💰 ${prices.length} prix (pri_dispo='1')`);

    // Maps
    const priceMap = new Map<string, any>();
    for (const pr of prices) {
      priceMap.set(`${pr.pri_piece_id}-${pr.pri_pm_id}`, pr);
    }

    // Remplir prsKindMap pour le flux normal (déjà déclaré plus haut)
    for (const ref of searchRefs) {
      const pid = String(ref.prs_piece_id);
      const current = prsKindMap.get(pid);
      const next = ref.prs_kind ?? '999';
      if (!current || next < current) prsKindMap.set(pid, next);
    }

    // 4) Enrichir & filtrer uniquement pièces ayant un prix dispo
    const enrichedPieces = pieces
      .map((piece: any) => {
        const priceKey = `${piece.piece_id}-${piece.piece_pm_id}`;
        const price = priceMap.get(priceKey);
        if (!price) return null;

        const prsKind = parseInt(
          prsKindMap.get(String(piece.piece_id)) ?? '999',
          10,
        );
        const _priceVenteTTC = parseFloat(price.pri_vente_ttc) || 0;
        const _priceConsigneTTC = parseFloat(price.pri_consigne_ttc) || 0;

        return {
          ...piece,
          _prsKind: Number.isFinite(prsKind) ? prsKind : 999,
          _priceVenteTTC,
          _priceConsigneTTC,
          _isOEM: true, // car trouvé via pieces_ref_search
          _oemRef: null as string | null, // renseigné plus bas
        };
      })
      .filter(Boolean) as Array<any>;

    // attacher une ref OEM pour affichage si dispo
    const oemRefMap = new Map<string, string>();
    for (const r of searchRefs)
      oemRefMap.set(String(r.prs_piece_id), r.prs_ref);
    for (const p of enrichedPieces)
      p._oemRef = oemRefMap.get(String(p.piece_id)) ?? null;

    this.logger.log(`✅ ${enrichedPieces.length} pièces enrichies`);

    // 5) Filtrer les équivalences si non demandées (par défaut: matchs exacts + OEM directes)
    let piecesToSort = enrichedPieces;
    if (!includeEquivalences) {
      const beforeCount = piecesToSort.length;
      // prs_kind: 0=direct, 1=OEM équipementier, 2=OEM constructeur → garder tous
      // prs_kind: 3, 4 = équivalences croisées → exclure
      piecesToSort = piecesToSort.filter((p) => p._prsKind <= 2);
      const filteredOut = beforeCount - piecesToSort.length;
      if (filteredOut > 0) {
        this.logger.log(
          `🎯 Filtrage exact: ${filteredOut} équivalences exclues (prs_kind >= 3)`,
        );
      }
    }

    // 6) Tri façon PHP: PRS_KIND puis QTY*PRICE (desc)
    const sortedPieces = piecesToSort.sort((a, b) => {
      if (a._prsKind !== b._prsKind) return a._prsKind - b._prsKind;
      const scoreA = (a.piece_qty_sale || 1) * a._priceVenteTTC;
      const scoreB = (b.piece_qty_sale || 1) * b._priceVenteTTC;
      return scoreB - scoreA;
    });

    this.logger.log(
      `🔄 Tri: ${sortedPieces.filter((p) => p._prsKind === 0).length} direct (kind=0), ` +
        `${sortedPieces.filter((p) => p._prsKind === 1).length} OEM (kind=1)`,
    );

    // DEBUG: Vérifier ordre AVANT processResults
    if (sortedPieces.length > 0) {
      this.logger.log(
        `🔧 AVANT processResults - Premier: ${sortedPieces[0].piece_ref} (kind=${sortedPieces[0]._prsKind}), Dernier: ${sortedPieces[sortedPieces.length - 1].piece_ref} (kind=${sortedPieces[sortedPieces.length - 1]._prsKind})`,
      );
    }

    // 6) Retour formaté + facettes + pagination + cache
    return this.processResults(
      sortedPieces,
      refQuery,
      filters,
      page,
      limit,
      offset,
      startTime,
      categoryFilter,
      cacheKey,
    );
  }

  private async processResults(
    pieces: any[],
    cleanQuery: string,
    filters: SearchFilters | undefined,
    page: number,
    limit: number,
    offset: number,
    startTime: number,
    categoryFilter: string | null = null,
    cacheKey: string,
  ) {
    if (!pieces || pieces.length === 0) {
      this.logger.log(`❌ 0 résultat pour "${cleanQuery}"`);
      const empty = {
        success: true,
        data: {
          items: [],
          total: 0,
          page,
          limit,
          pages: 0,
          executionTime: Date.now() - startTime,
          facets: [],
        },
      };
      return empty;
    }

    // Filtres marque/gamme
    let filtered = pieces;
    if (filters?.marqueIds?.length) {
      filtered = filtered.filter((p) =>
        filters.marqueIds!.includes(p.piece_pm_id),
      );
    }
    if (filters?.gammeIds?.length) {
      filtered = filtered.filter((p) =>
        filters.gammeIds!.includes(p.piece_pg_id),
      );
    }
    this.logger.log(`✅ ${filtered.length} pièces (après filtres)`);

    // Charger métadonnées marques/gammes + IMAGES
    const marqueIds = [
      ...new Set(filtered.map((p) => p.piece_pm_id).filter(Boolean)),
    ];
    const gammeIds = [
      ...new Set(filtered.map((p) => p.piece_pg_id).filter(Boolean)),
    ];
    const pieceIds = filtered.map((p) => p.piece_id);

    const [marquesResult, gammesResult, imagesResult] = await Promise.all([
      marqueIds.length
        ? this.client
            .from(TABLES.pieces_marque)
            .select('pm_id, pm_name, pm_oes, pm_alias')
            .in('pm_id', marqueIds.map(String))
        : Promise.resolve({ data: [] as any[] }),
      gammeIds.length
        ? this.client
            .from(TABLES.pieces_gamme)
            .select('pg_id, pg_name, pg_alias')
            .in('pg_id', gammeIds.map(String))
        : Promise.resolve({ data: [] as any[] }),
      // 🖼️ Charger les images principales
      pieceIds.length
        ? this.client
            .from(TABLES.pieces_media_img)
            .select('pmi_piece_id, pmi_folder, pmi_name')
            .in('pmi_piece_id', pieceIds)
            .eq('pmi_display', 1)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const marqueMap = new Map<
      number,
      { name: string; oes: string | null; alias: string | null }
    >(
      (marquesResult.data || []).map((m: any) => [
        parseInt(m.pm_id, 10),
        { name: m.pm_name, oes: m.pm_oes, alias: m.pm_alias },
      ]),
    );
    const gammeMap = new Map<number, { name: string; alias: string | null }>(
      (gammesResult.data || []).map((g: any) => [
        parseInt(g.pg_id, 10),
        { name: g.pg_name, alias: g.pg_alias },
      ]),
    );
    // 🖼️ Map des images: pmi_piece_id -> URL complète via fonction centralisée
    const imageMap = new Map<number, string>(
      (imagesResult.data || []).map((img: any) => [
        parseInt(img.pmi_piece_id, 10),
        buildRackImageUrl({
          pmi_folder: img.pmi_folder,
          pmi_name: img.pmi_name,
        }),
      ]),
    );
    this.logger.log(`🖼️ ${imagesResult.data?.length || 0} images chargées`);

    // Formatter + qualité + OEM + IMAGE
    let items = filtered.map((p) => {
      const m = marqueMap.get(p.piece_pm_id);
      const g = gammeMap.get(p.piece_pg_id);
      const qualityLevel = this.getQualityLevel(m?.oes ?? null);
      const image = imageMap.get(p.piece_id) || '/images/pieces/default.png';

      const item: any = {
        id: String(p.piece_id),
        piece_id: p.piece_id, // 🔧 ID numérique aussi
        reference: p.piece_ref ?? '',
        brand: m?.name ?? '',
        brandId: p.piece_pm_id,
        brandAlias: m?.alias ?? null, // 🔧 Alias marque pour logo
        category: g?.name ?? '',
        categoryId: p.piece_pg_id,
        categoryAlias: g?.alias ?? null, // 🔧 Alias gamme pour URL
        price: p._priceVenteTTC ?? 0, // ✅ Prix (0 si non dispo)
        prices: {
          vente_ttc: p._priceVenteTTC ?? 0,
          consigne_ttc: p._priceConsigneTTC ?? 0,
          total_ttc: (p._priceVenteTTC ?? 0) + (p._priceConsigneTTC ?? 0),
        },
        image, // 🖼️ URL image principale
        hasImage: image !== '/images/pieces/default.png',
        inStock: (p._priceVenteTTC ?? 0) > 0, // ✅ En stock si prix > 0
        qualite: qualityLevel === 1 ? 'OES' : 'AFTERMARKET',
        stars: qualityLevel === 1 ? 6 : qualityLevel === 2 ? 5 : 3, // 🔧 Note qualité
        _isOEM: !!p._isOEM,
        _oemRef: p._oemRef ?? null,
        _qualityLevel: qualityLevel,
        _isExactMatch: false,
        _isVariantMatch: false,
        // Préserver les champs enrichis du tri précédent
        _prsKind: p._prsKind ?? null,
        _priceVenteTTC: p._priceVenteTTC ?? null,
        _priceConsigneTTC: p._priceConsigneTTC ?? null,
      };

      // exposer oemRef seulement si différente & OEM plausible
      if (item._oemRef) {
        const co = this.cleanReference(item._oemRef);
        const cr = this.cleanReference(item.reference);
        if (co !== cr && this.isRealOemReference(item._oemRef)) {
          item.oemRef = item._oemRef;
        }
      }
      return item;
    });

    // Filtre catégorie via mot-clé éventuel
    if (categoryFilter) {
      const before = items.length;
      items = items.filter((it) =>
        it.category.toLowerCase().includes(categoryFilter.toLowerCase()),
      );
      this.logger.log(
        `🔎 Filtre catégorie "${categoryFilter}": ${items.length}/${before} résultats`,
      );
    }

    // PAS DE TRI ICI - Les pièces sont déjà triées par prs_kind puis prix avant l'appel à processResults()
    // Le tri initial (ligne 318-323) respecte la logique PHP : ORDER BY PRS_KIND, PIECE_QTY_SALE*PRI_VENTE_TTC
    const isOEMSearch = items.some((it) => it._isOEM);

    // DEBUG: Vérifier que l'ordre est préservé
    const kindDistribution = items.reduce((acc: Record<string, number>, it) => {
      const k = String(it._prsKind ?? 'null');
      acc[k] = (acc[k] || 0) + 1;
      return acc;
    }, {});
    this.logger.log(
      `🔧 Distribution prs_kind finale: ${JSON.stringify(kindDistribution)}`,
    );
    if (items.length > 0) {
      this.logger.log(
        `🔧 Premier: ${items[0]?.reference} (kind=${items[0]?._prsKind}), Dernier: ${items[items.length - 1]?.reference} (kind=${items[items.length - 1]?._prsKind})`,
      );
    }

    // Nettoyage flags internes
    for (const it of items) {
      delete it._isVariantMatch;
      delete it._isExactMatch;
      delete it._qualityLevel;
      delete it._isOEM;
      delete it._oemRef;
    }

    // Facettes
    const facets = this.generateFacets(items);

    // Pagination
    const total = items.length;
    const pageItems = items.slice(offset, offset + limit);

    this.logger.log(
      `✅ Retour: ${pageItems.length}/${total} en ${Date.now() - startTime}ms`,
    );

    const result = {
      success: true,
      data: {
        items: pageItems,
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
        executionTime: Date.now() - startTime,
        facets,
      },
    };

    // 💾 Cache (calculer OEM à partir de la liste nettoyée: on l’a avant nettoyage via isOEMSearch)
    try {
      const cacheTTL = isOEMSearch
        ? this.OEM_CACHE_TTL
        : this.GENERAL_CACHE_TTL;
      await this.redisCache.set(cacheKey, result, cacheTTL);
      this.logger.log(`💾 Mis en cache (TTL: ${cacheTTL}s)`);
    } catch (e) {
      this.logger.warn(`⚠️ Erreur sauvegarde cache Redis:`, e);
    }

    return result;
  }

  /**
   * 🆕 Fallback: Recherche par nom de gamme (text search)
   * Quand la recherche par référence retourne 0 résultats,
   * on cherche dans pieces_gamme.pg_name pour trouver des catégories correspondantes.
   */
  private async searchByGammeName(
    query: string,
    limit: number = 200,
  ): Promise<{
    pieces: any[];
    matchedGammes: { id: number; name: string; alias: string }[];
  }> {
    this.logger.log(`🔍 Fallback gamme-name: "${query}"`);

    // 1) Chercher gammes correspondantes - priorité aux catégories principales (pg_level=1)
    //    pg_level='1' = catégories principales (Amortisseur, Plaquette de frein, Filtre à air...)
    //    pg_level='0' = sous-catégories obscures (Kit adaptateur-amortisseur...)
    const gammesResult = await this.client
      .from(TABLES.pieces_gamme)
      .select('pg_id, pg_name, pg_alias, pg_level')
      .ilike('pg_name', `%${query}%`)
      .eq('pg_display', '1')
      .order('pg_level', { ascending: false }) // Level 1 (main) avant level 0 (obscur)
      .limit(10);

    if (gammesResult.error) {
      this.logger.error(
        `❌ Erreur Supabase gamme: ${JSON.stringify(gammesResult.error)}`,
      );
      return { pieces: [], matchedGammes: [] };
    }

    const gammes = gammesResult.data;
    this.logger.log(`📊 Gammes brutes: ${JSON.stringify(gammes?.slice(0, 3))}`);

    if (!gammes?.length) {
      this.logger.log(`❌ Aucune gamme trouvée pour "${query}"`);
      return { pieces: [], matchedGammes: [] };
    }

    this.logger.log(
      `📋 ${gammes.length} gamme(s): ${gammes.map((g: any) => g.pg_name).join(', ')}`,
    );

    const gammeIds = gammes.map((g: any) => g.pg_id);

    // 2) Charger pièces visibles de ces gammes
    const { data: pieces } = await this.client
      .from(TABLES.pieces)
      .select(
        'piece_id, piece_ref, piece_pg_id, piece_pm_id, piece_qty_sale, piece_display',
      )
      .in('piece_pg_id', gammeIds)
      .eq('piece_display', true)
      .limit(limit);

    if (!pieces?.length) {
      this.logger.log(`❌ Aucune pièce visible dans ces gammes`);
      return { pieces: [], matchedGammes: [] };
    }

    this.logger.log(`📦 ${pieces.length} pièces trouvées dans ces gammes`);

    // 3) Charger les prix disponibles
    const { data: prices } = await this.client
      .from(TABLES.pieces_price)
      .select(
        'pri_piece_id, pri_pm_id, pri_vente_ttc, pri_consigne_ttc, pri_dispo',
      )
      .in(
        'pri_piece_id',
        pieces.map((p: any) => String(p.piece_id)),
      )
      .eq('pri_dispo', '1');

    const priceMap = new Map<string, any>();
    for (const pr of prices || []) {
      priceMap.set(`${pr.pri_piece_id}-${pr.pri_pm_id}`, pr);
    }

    // 4) Enrichir et filtrer (garder uniquement celles avec prix)
    const enrichedPieces = pieces
      .map((p: any) => {
        const key = `${p.piece_id}-${p.piece_pm_id}`;
        const price = priceMap.get(key);
        if (!price) return null;

        return {
          ...p,
          _prsKind: 0,
          _priceVenteTTC: parseFloat(price.pri_vente_ttc || '0'),
          _priceConsigneTTC: parseFloat(price.pri_consigne_ttc || '0'),
          _isOEM: false,
          _oemRef: null,
        };
      })
      .filter(Boolean);

    // 5) Tri par prix décroissant
    enrichedPieces.sort((a: any, b: any) => {
      const priceA = (a._priceVenteTTC || 0) * (a.piece_qty_sale || 1);
      const priceB = (b._priceVenteTTC || 0) * (b.piece_qty_sale || 1);
      return priceB - priceA;
    });

    this.logger.log(
      `✅ Fallback gamme-name: ${enrichedPieces.length} pièces enrichies`,
    );

    return {
      pieces: enrichedPieces,
      matchedGammes: gammes.map((g: any) => ({
        id: g.pg_id,
        name: g.pg_name,
        alias: g.pg_alias,
      })),
    };
  }

  private generateFacets(
    items: Array<{
      brandId?: number;
      brand?: string;
      categoryId?: number;
      category?: string;
    }>,
  ) {
    // MARQUE
    const m = new Map<number, { label: string; count: number }>();
    for (const it of items) {
      if (it.brandId && it.brand) {
        const ex = m.get(it.brandId);
        if (ex) ex.count++;
        else m.set(it.brandId, { label: it.brand, count: 1 });
      }
    }
    const marqueValues = Array.from(m.entries())
      .map(([id, v]) => ({ value: String(id), label: v.label, count: v.count }))
      .sort((a, b) => b.count - a.count);

    // GAMME
    const g = new Map<number, { label: string; count: number }>();
    for (const it of items) {
      if (it.categoryId && it.category) {
        const ex = g.get(it.categoryId);
        if (ex) ex.count++;
        else g.set(it.categoryId, { label: it.category, count: 1 });
      }
    }
    const gammeValues = Array.from(g.entries())
      .map(([id, v]) => ({ value: String(id), label: v.label, count: v.count }))
      .sort((a, b) => b.count - a.count);

    return [
      { field: 'marque', label: 'Marque', values: marqueValues },
      { field: 'gamme', label: 'Gamme', values: gammeValues },
    ];
  }
}
