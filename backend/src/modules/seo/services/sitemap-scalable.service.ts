import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { TABLES } from '@repo/database-types';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import {
  SitemapConfig,
  SitemapType,
  SitemapCategory,
  SitemapEntry,
  SitemapIndexEntry,
  ShardConfig,
} from '../interfaces/sitemap-config.interface';
import { getSitemapConfig } from '../config/sitemap.config';
import { SitemapHygieneService } from './sitemap-hygiene.service';
import { HreflangService } from './hreflang.service';
import { MultilingualContentType } from '../config/hreflang.config';
import { ProductImageService } from './product-image.service';

@Injectable()
export class SitemapScalableService extends SupabaseBaseService {
  protected readonly logger = new Logger(SitemapScalableService.name);

  constructor(
    private readonly hygieneService: SitemapHygieneService,
    private readonly hreflangService: HreflangService,
    private readonly productImageService: ProductImageService,
  ) {
    super();
    this.logger.log('âœ… SitemapScalableService initialized');
    this.logger.log('🧹 Hygiene validation enabled');
    this.logger.log('�� Hreflang multilingual enabled');
    this.logger.log('🖼️ Product images enabled');
  }

  /**
   * Point d'entrée principal: génère un sitemap selon son nom
   */
  async generateSitemap(configName: string): Promise<string> {
    const config = getSitemapConfig(configName);

    if (!config) {
      throw new NotFoundException(
        `Sitemap configuration '${configName}' not found`,
      );
    }

    this.logger.log(`Génération sitemap: ${configName} (${config.type})`);

    switch (config.type) {
      case SitemapType.INDEX:
        return this.generateIndex(config);

      case SitemapType.SUB_INDEX:
        return this.generateSubIndex(config);

      case SitemapType.FINAL:
        return this.generateFinalSitemap(config);

      default:
        throw new Error(`Unknown sitemap type: ${config.type}`);
    }
  }

  /**
   * Génère un index maître (liste de sous-indexes)
   */
  private async generateIndex(config: SitemapConfig): Promise<string> {
    this.logger.log(`Génération index: ${config.name}`);

    const entries: SitemapIndexEntry[] = [];

    for (const childName of config.children || []) {
      const childConfig = getSitemapConfig(childName);

      if (childConfig) {
        entries.push({
          loc: `https://www.automecanik.com${childConfig.path}`,
          lastmod: new Date().toISOString(),
        });
      }
    }

    this.logger.log(`Index ${config.name} généré: ${entries.length} entrées`);
    return this.buildSitemapIndexXml(entries);
  }

  /**
   * Génère un sous-index (liste de sitemaps finaux)
   */
  private async generateSubIndex(config: SitemapConfig): Promise<string> {
    this.logger.log(`Génération sous-index: ${config.name}`);

    const entries: SitemapIndexEntry[] = [];

    for (const childName of config.children || []) {
      const childConfig = getSitemapConfig(childName);

      if (childConfig) {
        entries.push({
          loc: `https://www.automecanik.com${childConfig.path}`,
          lastmod: await this.getLastModified(),
        });
      }
    }

    this.logger.log(
      `Sous-index ${config.name} généré: ${entries.length} entrées`,
    );
    return this.buildSitemapIndexXml(entries);
  }

  /**
   * Génère un sitemap final avec URLs
   */
  private async generateFinalSitemap(config: SitemapConfig): Promise<string> {
    this.logger.log(`Génération sitemap final: ${config.name}`);

    // 1. Fetch URLs brutes
    const rawUrls = await this.fetchUrls(config);
    this.logger.log(`URLs fetchées: ${rawUrls.length}`);

    // 2. Valider et filtrer les URLs (avec hreflang)
    const validatedUrls = await this.validateAndFilterUrls(rawUrls, config);
    this.logger.log(
      `URLs après validation: ${validatedUrls.length} (${rawUrls.length - validatedUrls.length} exclues)`,
    );

    // 3. Dédupliquer
    const { unique: uniqueUrlStrings, duplicates } =
      this.hygieneService.deduplicateUrls(validatedUrls.map((u) => u.loc));

    if (duplicates.size > 0) {
      this.logger.warn(
        `⚠️  Doublons détectés: ${duplicates.size} groupes de doublons`,
      );
      duplicates.forEach((variants, normalized) => {
        this.logger.debug(
          `Duplicate: ${normalized} has ${variants.length} variants`,
        );
      });
    }

    // 4. Filtrer pour garder seulement les URLs uniques
    const finalUrls = validatedUrls.filter((url) =>
      uniqueUrlStrings.includes(url.loc),
    );

    this.logger.log(
      `âœ… Sitemap ${config.name} généré: ${finalUrls.length} URLs (${duplicates.size} doublons supprimés)`,
    );
    return this.buildSitemapXml(finalUrls, config);
  }

  /**
   * Valide et filtre les URLs selon les règles d'hygiène SEO
   * et ajoute les liens hreflang pour le multilingue
   * et ajoute les images pour les produits (e-commerce)
   */
  private async validateAndFilterUrls(
    urls: SitemapEntry[],
    config: SitemapConfig,
  ): Promise<SitemapEntry[]> {
    const validatedUrls: SitemapEntry[] = [];
    const excludedReasons = new Map<string, number>();

    for (const url of urls) {
      // Pour l'instant, on considère toutes les URLs comme valides (HTTP 200, indexable, canonical)
      // TODO: Ajouter des champs dans la database pour tracker ces informations
      const validation = this.hygieneService.validateUrl(url.loc, {
        statusCode: 200, // Assumé pour les URLs générées
        isIndexable: true, // Assumé pour les URLs générées
        isCanonical: true, // Assumé pour les URLs générées
        hasSufficientContent: true, // TODO: Ajouter validation du contenu depuis DB
      });

      if (validation.isValid) {
        // Déterminer le type de contenu pour hreflang
        const contentType = this.getContentTypeFromConfig(config);

        // Générer les liens hreflang
        const hreflangLinks = this.hreflangService.generateHreflangLinks(
          validation.normalizedUrl,
          contentType,
        );

        // Générer les images pour les produits (boost e-commerce SEO)
        let images;
        if (this.shouldIncludeImages(config)) {
          images = await this.generateProductImages(url);
        }

        validatedUrls.push({
          ...url,
          loc: validation.normalizedUrl, // URL normalisée
          alternates: hreflangLinks.length > 0 ? hreflangLinks : undefined, // Hreflang si disponibles
          images: images && images.length > 0 ? images : undefined, // Images si disponibles
          // lastmod: validation.lastModified.toISOString(), // TODO: Activer quand on aura les vraies dates
        });
      } else {
        // Compter les raisons d'exclusion
        validation.exclusionReasons.forEach((reason) => {
          excludedReasons.set(reason, (excludedReasons.get(reason) || 0) + 1);
        });
      }
    }

    // Logger les raisons d'exclusion
    if (excludedReasons.size > 0) {
      this.logger.log("📊 Raisons d'exclusion:");
      excludedReasons.forEach((count, reason) => {
        this.logger.log(`   - ${reason}: ${count} URLs`);
      });
    }

    return validatedUrls;
  }

  /**
   * Vérifie si ce sitemap doit inclure des images
   */
  private shouldIncludeImages(config: SitemapConfig): boolean {
    // Activer les images uniquement pour les produits e-commerce
    return (
      config.category === SitemapCategory.PRODUCTS ||
      config.name.startsWith('products') ||
      config.name.includes('niveau') // Sitemaps products-niveau1, products-niveau2
    );
  }

  /**
   * Génère les images pour un produit
   * Format: 1 image principale + 2-4 vues utiles
   */
  private async generateProductImages(url: SitemapEntry): Promise<any[]> {
    // Extraire product ID de l'URL selon le format réel
    // Format possible 1: /products/12345-reference-produit
    // Format possible 2: /pieces/slug-12345.html (format actuel)
    let match = url.loc.match(/products\/(\d+)/);
    if (!match) {
      // Essayer format /pieces/slug-{id}.html
      match = url.loc.match(/pieces\/[\w-]+-(\d+)\.html/);
    }

    if (!match) {
      // Pas de product ID trouvé, retourner tableau vide
      return [];
    }

    const productId = parseInt(match[1], 10);

    // Pour l'instant, génération simple
    // TODO: Intégrer avec vraie database pour récupérer les infos produit
    const images = await this.productImageService.getProductSitemapImages(
      productId,
      `Produit ${productId}`, // TODO: Récupérer vrai nom depuis DB
      `REF-${productId}`, // TODO: Récupérer vraie référence depuis DB
      5, // Max 5 images par produit
    );

    return images;
  }

  /**
   * Détermine le type de contenu multilingue Ã  partir de la configuration
   */
  private getContentTypeFromConfig(
    config: SitemapConfig,
  ): MultilingualContentType {
    if (config.name === 'pages') {
      return MultilingualContentType.STATIC_PAGE;
    }

    if (config.name.startsWith('blog')) {
      return MultilingualContentType.BLOG;
    }

    if (config.name === 'constructeurs') {
      return MultilingualContentType.CONSTRUCTEUR;
    }

    if (config.name.startsWith('modeles')) {
      return MultilingualContentType.MODELE;
    }

    if (config.name.startsWith('products')) {
      return MultilingualContentType.PRODUCT;
    }

    // Par défaut, pages statiques
    return MultilingualContentType.STATIC_PAGE;
  }

  /**
   * Récupère les URLs selon la configuration
   */
  private async fetchUrls(config: SitemapConfig): Promise<SitemapEntry[]> {
    const shard = config.shards?.[0]; // Pour l'instant, un seul shard par config

    switch (config.category) {
      case SitemapCategory.STATIC:
        return this.fetchStaticPages();

      case SitemapCategory.CATALOG:
        return this.fetchCatalogUrls(config, shard);

      case SitemapCategory.BLOG:
        return this.fetchBlogUrls(config, shard);

      case SitemapCategory.PRODUCTS:
        return this.fetchProductsUrls(config);

      default:
        this.logger.warn(`Unknown category: ${config.category}`);
        return [];
    }
  }

  /**
   * Fetch pages statiques
   */
  private async fetchStaticPages(): Promise<SitemapEntry[]> {
    return [
      {
        loc: 'https://www.automecanik.com/',
        lastmod: new Date().toISOString(),
        changefreq: 'daily',
        priority: 1.0,
      },
      {
        loc: 'https://www.automecanik.com/products',
        lastmod: new Date().toISOString(),
        changefreq: 'daily',
        priority: 0.9,
      },
      {
        loc: 'https://www.automecanik.com/constructeurs',
        lastmod: new Date().toISOString(),
        changefreq: 'weekly',
        priority: 0.8,
      },
      {
        loc: 'https://www.automecanik.com/support',
        lastmod: new Date().toISOString(),
        changefreq: 'monthly',
        priority: 0.5,
      },
    ];
  }

  /**
   * Fetch URLs du catalogue (constructeurs, modèles, types)
   */
  private async fetchCatalogUrls(
    config: SitemapConfig,
    shard?: ShardConfig,
  ): Promise<SitemapEntry[]> {
    if (config.name === 'constructeurs') {
      return this.fetchConstructeurs();
    } else if (config.name.startsWith('modeles-')) {
      return this.fetchModeles(shard);
    } else if (config.name.startsWith('types-')) {
      // ⭐ Utiliser __sitemap_motorisation (table pré-calculée PHP)
      // au lieu de la cascade auto_type → auto_modele → auto_marque
      return this.fetchTypesFromSitemapMotorisation(shard);
    } else if (config.name.startsWith('pieces-')) {
      // 🔧 Pièces depuis __sitemap_p_link (714k URLs pré-calculées)
      return this.fetchPiecesFromSitemapPLink(shard);
    }

    return [];
  }

  /**
   * Fetch constructeurs
   */
  private async fetchConstructeurs(): Promise<SitemapEntry[]> {
    const { data: marques } = await this.supabase
      .from(TABLES.auto_marque)
      .select('marque_id, marque_alias')
      .order('marque_id');

    if (!marques) return [];

    return marques.map((marque) => ({
      loc: `https://www.automecanik.com/constructeurs/${marque.marque_alias}-${marque.marque_id}.html`,
      lastmod: new Date().toISOString(),
      changefreq: 'weekly',
      priority: 0.8,
    }));
  }

  /**
   * Fetch modèles avec sharding alphabétique
   */
  private async fetchModeles(shard?: ShardConfig): Promise<SitemapEntry[]> {
    // Charger les marques
    const { data: marques } = await this.supabase
      .from(TABLES.auto_marque)
      .select('marque_id, marque_alias');

    if (!marques) return [];

    const marqueMap = new Map(
      marques.map((m) => [m.marque_id, m.marque_alias]),
    );

    // Charger tous les modèles avec pagination
    const allModeles = [];
    const batchSize = 1000;
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const { data } = await this.supabase
        .from(TABLES.auto_modele)
        .select(
          'modele_id, modele_alias, modele_name, modele_name_url, modele_marque_id',
        )
        .range(offset, offset + batchSize - 1)
        .order('modele_id');

      if (data && data.length > 0) {
        allModeles.push(...data);
        offset += batchSize;
        hasMore = data.length === batchSize;
      } else {
        hasMore = false;
      }
    }

    // Filtrer selon le shard
    let filteredModeles = allModeles;

    if (shard?.filter.type === 'alphabetic' && shard.filter.pattern) {
      const regex = new RegExp(shard.filter.pattern as string);
      filteredModeles = allModeles.filter((modele) => {
        const name =
          modele.modele_alias || modele.modele_name_url || modele.modele_name;
        return regex.test(name);
      });
    }

    this.logger.log(
      `Modèles filtrés (shard ${shard?.name}): ${filteredModeles.length}/${allModeles.length}`,
    );

    return filteredModeles.map((modele) => {
      const marqueAlias = marqueMap.get(modele.modele_marque_id) || 'marque';
      const modeleAlias =
        modele.modele_alias ||
        modele.modele_name_url ||
        modele.modele_name?.toLowerCase().replace(/[^a-z0-9]+/g, '-') ||
        'modele';

      return {
        loc: `https://www.automecanik.com/constructeurs/${marqueAlias}-${modele.modele_marque_id}/${modeleAlias}-${modele.modele_id}.html`,
        lastmod: new Date().toISOString(),
        changefreq: 'weekly',
        priority: 0.7,
      };
    });
  }

  /**
   * 🏎️ Fetch types/motorisations depuis __sitemap_motorisation (table pré-calculée PHP)
   *
   * Cette table contient ~12,756 URLs validées avec tous les alias pré-calculés:
   * - map_marque_alias, map_marque_id
   * - map_modele_alias, map_modele_id
   * - map_type_alias, map_type_id
   *
   * Avantages vs cascade auto_type ←’ auto_modele ←’ auto_marque:
   * - Performance: 1 seule requête au lieu de 3 avec jointures
   * - Cohérence: Même source que le sitemap PHP original
   * - Fiabilité: URLs pré-validées (pas de types orphelins)
   */
  private async fetchTypesFromSitemapMotorisation(
    shard?: ShardConfig,
  ): Promise<SitemapEntry[]> {
    // Récupérer offset/limit depuis la config du shard
    let shardOffset = 0;
    let shardLimit = 15000; // Suffisant pour les ~12,756 URLs

    if (shard?.filter) {
      if (shard.filter.offset !== undefined) {
        shardOffset = shard.filter.offset;
        shardLimit = shard.filter.limit || 15000;
      }
    }

    this.logger.log(
      `🏎️ fetchTypesFromSitemapMotorisation: offset=${shardOffset}, limit=${shardLimit}`,
    );

    // Charger toutes les entrées de __sitemap_motorisation avec pagination
    // ⚠️ Supabase limite Ã  1000 lignes par requête par défaut
    const allMotorisations: any[] = [];
    const batchSize = 1000; // Limite Supabase par défaut
    let currentOffset = 0;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await this.supabase
        .from('__sitemap_motorisation')
        .select(
          'map_id, map_marque_alias, map_marque_id, map_modele_alias, map_modele_id, map_type_alias, map_type_id',
        )
        .range(currentOffset, currentOffset + batchSize - 1)
        .order('map_id');

      if (error) {
        this.logger.error(
          `âŒ Erreur chargement __sitemap_motorisation: ${error.message}`,
        );
        hasMore = false;
      } else if (data && data.length > 0) {
        allMotorisations.push(...data);
        currentOffset += batchSize;
        hasMore = data.length === batchSize;
        this.logger.log(
          `📦 Batch ${Math.ceil(currentOffset / batchSize)}: ${data.length} motorisations (total: ${allMotorisations.length})`,
        );
      } else {
        hasMore = false;
      }
    }

    this.logger.log(
      `🏎️ __sitemap_motorisation: ${allMotorisations.length} entrées chargées`,
    );

    // Appliquer le sharding par offset
    const shardedData = allMotorisations.slice(
      shardOffset,
      shardOffset + shardLimit,
    );
    this.logger.log(`🏎️ Shard appliqué: ${shardedData.length} motorisations`);

    // Générer les URLs directement (pas besoin de jointures, tout est pré-calculé)
    const entries: SitemapEntry[] = shardedData
      .filter(
        (m: any) =>
          m.map_marque_alias && m.map_modele_alias && m.map_type_alias,
      )
      .map((m: any) => ({
        loc: `https://www.automecanik.com/constructeurs/${m.map_marque_alias}-${m.map_marque_id}/${m.map_modele_alias}-${m.map_modele_id}/${m.map_type_alias}-${m.map_type_id}.html`,
        lastmod: new Date().toISOString().split('T')[0],
        changefreq: 'monthly',
        priority: 0.7,
      }));

    this.logger.log(
      `✅ Types/Motorisations générées: ${entries.length} URLs depuis __sitemap_motorisation`,
    );

    return entries;
  }

  /**
   * 🔧 Fetch pièces depuis __sitemap_p_link (table pré-calculée PHP)
   *
   * Cette table contient ~714,336 URLs validées avec tous les alias pré-calculés:
   * - map_pg_alias, map_pg_id (gamme de pièces)
   * - map_marque_alias, map_marque_id (constructeur auto)
   * - map_modele_alias, map_modele_id (modèle auto)
   * - map_type_alias, map_type_id (motorisation)
   * - map_has_item (indicateur de stock)
   *
   * Stratégie: SANS filtre de stock
   * - Toutes les 714k URLs sont incluses
   * - priority/changefreq ajustés selon map_has_item
   */
  private async fetchPiecesFromSitemapPLink(
    shard?: ShardConfig,
  ): Promise<SitemapEntry[]> {
    // Récupérer la range depuis la config du shard
    const range = shard?.filter?.range;

    if (!range) {
      this.logger.warn(
        `⚠️ fetchPiecesFromSitemapPLink: pas de range définie dans le shard`,
      );
      return [];
    }

    this.logger.log(
      `🔧 fetchPiecesFromSitemapPLink: range=${range.min}-${range.max}`,
    );

    // Charger les entrées de __sitemap_p_link avec pagination
    // ⚠️ Supabase limite à 1000 lignes par requête par défaut
    const allPieces: any[] = [];
    const batchSize = 1000; // Limite Supabase par défaut
    let currentOffset = 0;
    let hasMore = true;
    const maxToFetch = range.max - range.min;

    while (hasMore && allPieces.length < maxToFetch) {
      const { data, error } = await this.supabase
        .from(TABLES.sitemap_p_link)
        .select(
          'map_id, map_pg_alias, map_pg_id, map_marque_alias, map_marque_id, map_modele_alias, map_modele_id, map_type_alias, map_type_id, map_has_item',
        )
        .gte('map_id', range.min)
        .lt('map_id', range.max)
        .range(currentOffset, currentOffset + batchSize - 1)
        .order('map_id');

      if (error) {
        this.logger.error(
          `❌ Erreur chargement __sitemap_p_link: ${error.message}`,
        );
        hasMore = false;
      } else if (data && data.length > 0) {
        allPieces.push(...data);
        currentOffset += batchSize;
        hasMore = data.length === batchSize;
        this.logger.log(
          `📦 Batch ${Math.ceil(currentOffset / batchSize)}: ${data.length} pièces (total: ${allPieces.length})`,
        );
      } else {
        hasMore = false;
      }
    }

    this.logger.log(
      `🔧 __sitemap_p_link: ${allPieces.length} entrées chargées pour range ${range.min}-${range.max}`,
    );

    // Générer les URLs avec priority/changefreq basés sur map_has_item
    const entries: SitemapEntry[] = allPieces
      .filter(
        (p: any) =>
          p.map_pg_alias &&
          p.map_marque_alias &&
          p.map_modele_alias &&
          p.map_type_alias,
      )
      .map((p: any) => {
        const hasStock = parseInt(p.map_has_item || '0', 10) > 0;

        return {
          loc: `https://www.automecanik.com/pieces/${p.map_pg_alias}-${p.map_pg_id}/${p.map_marque_alias}-${p.map_marque_id}/${p.map_modele_alias}-${p.map_modele_id}/${p.map_type_alias}-${p.map_type_id}.html`,
          lastmod: new Date().toISOString().split('T')[0],
          // Pages avec stock: priorité haute, mise à jour fréquente
          // Pages sans stock: priorité basse, mise à jour rare
          changefreq: hasStock ? 'weekly' : 'monthly',
          priority: hasStock ? 0.7 : 0.5,
        };
      });

    this.logger.log(
      `✅ Pièces générées: ${entries.length} URLs depuis __sitemap_p_link (shard ${shard?.name})`,
    );

    return entries;
  }

  /**
   * Fetch URLs du blog avec sharding temporel
   * ⚠️ Colonnes corrigées: ba_create/ba_update au lieu de ba_date (n'existe pas)
   */
  private async fetchBlogUrls(
    config: SitemapConfig,
    shard?: ShardConfig,
  ): Promise<SitemapEntry[]> {
    // Charger les conseils (colonne ba_create pour la date)
    const { data: adviceArticles, error: adviceError } = await this.supabase
      .from(TABLES.blog_advice)
      .select('ba_id, ba_alias, ba_create, ba_update')
      .order('ba_create', { ascending: false });

    if (adviceError) {
      this.logger.error(
        `âŒ Erreur chargement __blog_advice: ${adviceError.message}`,
      );
    } else {
      this.logger.log(
        `📝 Blog advice chargés: ${adviceArticles?.length || 0} articles`,
      );
    }

    // Charger les guides (colonne bg_create pour la date)
    const { data: guideArticles, error: guideError } = await this.supabase
      .from(TABLES.blog_guide)
      .select('bg_id, bg_alias, bg_create, bg_update')
      .order('bg_create', { ascending: false });

    if (guideError) {
      this.logger.error(
        `âŒ Erreur chargement __blog_guide: ${guideError.message}`,
      );
    } else {
      this.logger.log(
        `📖 Blog guide chargés: ${guideArticles?.length || 0} articles`,
      );
    }

    // Combiner les articles (utiliser ba_update/bg_update pour lastmod, ba_create/bg_create pour filtrage)
    const allArticles = [
      ...(adviceArticles || []).map((a) => ({
        alias: a.ba_alias,
        date: a.ba_create, // Date de création pour filtrage temporel
        lastmod: a.ba_update, // Date de mise Ã  jour pour lastmod
      })),
      ...(guideArticles || []).map((g) => ({
        alias: g.bg_alias,
        date: g.bg_create, // Date de création pour filtrage temporel
        lastmod: g.bg_update, // Date de mise Ã  jour pour lastmod
      })),
    ];

    // Filtrer selon le shard temporel
    let filteredArticles = allArticles;

    if (shard?.filter.type === 'temporal' && shard.filter.year) {
      filteredArticles = allArticles.filter((article) => {
        if (!article.date) return false;
        const year = new Date(article.date).getFullYear();
        return year === shard.filter.year;
      });
    } else if (shard?.filter.type === 'custom' && shard.filter.customFn) {
      filteredArticles = allArticles.filter(shard.filter.customFn);
    }

    this.logger.log(
      `Blog articles filtrés (${shard?.name}): ${filteredArticles.length}/${allArticles.length}`,
    );

    return filteredArticles.map((article) => ({
      loc: `https://www.automecanik.com/blog-pieces-auto/conseils/${article.alias}`,
      lastmod: article.lastmod
        ? new Date(article.lastmod).toISOString()
        : new Date(article.date).toISOString(),
      changefreq: config.changefreq || 'weekly',
      priority: config.priority || 0.7,
    }));
  }

  /**
   * Fetch URLs des produits
   */
  private async fetchProductsUrls(
    config: SitemapConfig,
  ): Promise<SitemapEntry[]> {
    const level =
      config.name === 'products-niveau1'
        ? 1
        : config.name === 'products-niveau2'
          ? 2
          : null;

    if (level === null) return [];

    const allGammes = [];
    const batchSize = 1000;
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const { data } = await this.supabase
        .from(TABLES.pieces_gamme)
        .select('pg_id, pg_alias, pg_name')
        .eq('pg_display', '1')
        .eq('pg_level', String(level))
        .range(offset, offset + batchSize - 1)
        .order('pg_id');

      if (data && data.length > 0) {
        allGammes.push(...data);
        offset += batchSize;
        hasMore = data.length === batchSize;
      } else {
        hasMore = false;
      }
    }

    return allGammes.map((gamme) => ({
      loc: `https://www.automecanik.com/pieces/${gamme.pg_alias}-${gamme.pg_id}.html`,
      lastmod: new Date().toISOString(),
      changefreq: 'weekly',
      priority: 0.8,
    }));
  }

  /**
   * Obtient la date de dernière modification d'un sitemap
   */
  private async getLastModified(): Promise<string> {
    // Pour l'instant, retourne la date actuelle
    // TODO: Implémenter un système de tracking des modifications
    return new Date().toISOString();
  }

  /**
   * Construit le XML d'un sitemap index
   */
  private buildSitemapIndexXml(entries: SitemapIndexEntry[]): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries
  .map(
    (entry) => `  <sitemap>
    <loc>${entry.loc}</loc>
    <lastmod>${entry.lastmod}</lastmod>
  </sitemap>`,
  )
  .join('\n')}
</sitemapindex>`;
  }

  /**
   * Construit le XML d'un sitemap final avec support hreflang et images
   */
  private buildSitemapXml(urls: SitemapEntry[], config: SitemapConfig): string {
    // Vérifier si au moins une URL a des alternates
    const hasHreflang = urls.some(
      (url) => url.alternates && url.alternates.length > 0,
    );

    // Vérifier si au moins une URL a des images
    const hasImages = urls.some((url) => url.images && url.images.length > 0);

    // Namespaces XML requis
    const xmlnsXhtml = hasHreflang
      ? ' xmlns:xhtml="http://www.w3.org/1999/xhtml"'
      : '';
    const xmlnsImage = hasImages
      ? ' xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"'
      : '';

    return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"${xmlnsXhtml}${xmlnsImage}>
${urls
  .map((url) => {
    let xml = `  <url>
    <loc>${url.loc}</loc>
    <lastmod>${url.lastmod || new Date().toISOString()}</lastmod>`;

    const changefreq = url.changefreq || config.changefreq;
    if (changefreq) {
      xml += `\n    <changefreq>${changefreq}</changefreq>`;
    }

    const priority = url.priority ?? config.priority;
    if (priority !== undefined) {
      xml += `\n    <priority>${priority}</priority>`;
    }

    // Ajouter les liens hreflang si disponibles
    if (url.alternates && url.alternates.length > 0) {
      url.alternates.forEach((alternate) => {
        xml += `\n    <xhtml:link rel="alternate" hreflang="${alternate.hreflang}" href="${alternate.href}" />`;
      });
    }

    // Ajouter les images si disponibles (boost e-commerce SEO)
    if (url.images && url.images.length > 0) {
      url.images.forEach((image) => {
        xml += '\n    <image:image>';
        xml += `\n      <image:loc>${this.escapeXml(image.loc)}</image:loc>`;

        if (image.title) {
          xml += `\n      <image:title>${this.escapeXml(image.title)}</image:title>`;
        }

        if (image.caption) {
          xml += `\n      <image:caption>${this.escapeXml(image.caption)}</image:caption>`;
        }

        if (image.geoLocation) {
          xml += `\n      <image:geo_location>${this.escapeXml(image.geoLocation)}</image:geo_location>`;
        }

        if (image.license) {
          xml += `\n      <image:license>${this.escapeXml(image.license)}</image:license>`;
        }

        xml += '\n    </image:image>';
      });
    }

    xml += '\n  </url>';
    return xml;
  })
  .join('\n')}
</urlset>`;
  }

  /**
   * Échapper les caractères spéciaux XML
   */
  private escapeXml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}
// Force rebuild Mon Dec  8 17:49:36 CET 2025
