import { Injectable, Logger, NotFoundException } from '@nestjs/common';
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

@Injectable()
export class SitemapScalableService extends SupabaseBaseService {
  protected readonly logger = new Logger(SitemapScalableService.name);

  constructor(
    private readonly hygieneService: SitemapHygieneService,
    private readonly hreflangService: HreflangService,
  ) {
    super();
    this.logger.log('✅ SitemapScalableService initialized');
    this.logger.log('🧹 Hygiene validation enabled');
    this.logger.log('🌍 Hreflang multilingual enabled');
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
          loc: `https://automecanik.com${childConfig.path}`,
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
          loc: `https://automecanik.com${childConfig.path}`,
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
      `✅ Sitemap ${config.name} généré: ${finalUrls.length} URLs (${duplicates.size} doublons supprimés)`,
    );
    return this.buildSitemapXml(finalUrls, config);
  }

  /**
   * Valide et filtre les URLs selon les règles d'hygiène SEO
   * et ajoute les liens hreflang pour le multilingue
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

        validatedUrls.push({
          ...url,
          loc: validation.normalizedUrl, // URL normalisée
          alternates: hreflangLinks.length > 0 ? hreflangLinks : undefined, // Hreflang si disponibles
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
   * Détermine le type de contenu multilingue à partir de la configuration
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
        loc: 'https://automecanik.com/',
        lastmod: new Date().toISOString(),
        changefreq: 'daily',
        priority: 1.0,
      },
      {
        loc: 'https://automecanik.com/products',
        lastmod: new Date().toISOString(),
        changefreq: 'daily',
        priority: 0.9,
      },
      {
        loc: 'https://automecanik.com/constructeurs',
        lastmod: new Date().toISOString(),
        changefreq: 'weekly',
        priority: 0.8,
      },
      {
        loc: 'https://automecanik.com/support',
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
      return this.fetchTypes(shard);
    }

    return [];
  }

  /**
   * Fetch constructeurs
   */
  private async fetchConstructeurs(): Promise<SitemapEntry[]> {
    const { data: marques } = await this.supabase
      .from('auto_marque')
      .select('marque_id, marque_alias')
      .order('marque_id');

    if (!marques) return [];

    return marques.map((marque) => ({
      loc: `https://automecanik.com/constructeurs/${marque.marque_alias}-${marque.marque_id}.html`,
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
      .from('auto_marque')
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
        .from('auto_modele')
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
        loc: `https://automecanik.com/constructeurs/${marqueAlias}-${modele.modele_marque_id}/${modeleAlias}-${modele.modele_id}.html`,
        lastmod: new Date().toISOString(),
        changefreq: 'weekly',
        priority: 0.7,
      };
    });
  }

  /**
   * Fetch types avec sharding numérique
   */
  private async fetchTypes(shard?: ShardConfig): Promise<SitemapEntry[]> {
    if (!shard?.filter.range) {
      this.logger.error('Shard filter range requis pour les types');
      return [];
    }

    const { min, max } = shard.filter.range;

    // Charger les marques
    const { data: marques } = await this.supabase
      .from('auto_marque')
      .select('marque_id, marque_alias');

    if (!marques) return [];

    const marqueMap = new Map(
      marques.map((m) => [m.marque_id, m.marque_alias]),
    );

    // Charger tous les modèles
    const allModeles = [];
    const modeleBatchSize = 1000;
    let modeleOffset = 0;
    let hasMoreModeles = true;

    while (hasMoreModeles) {
      const { data } = await this.supabase
        .from('auto_modele')
        .select('modele_id, modele_alias, modele_name_url, modele_marque_id')
        .range(modeleOffset, modeleOffset + modeleBatchSize - 1)
        .order('modele_id');

      if (data && data.length > 0) {
        allModeles.push(...data);
        modeleOffset += modeleBatchSize;
        hasMoreModeles = data.length === modeleBatchSize;
      } else {
        hasMoreModeles = false;
      }
    }

    const modeleMap = new Map(
      allModeles.map((m) => [
        m.modele_id,
        {
          alias: m.modele_alias || m.modele_name_url || 'modele',
          marque_id: m.modele_marque_id,
        },
      ]),
    );

    // Charger les types dans la range
    const allTypes = [];
    const typeBatchSize = 1000;
    let typeOffset = min;
    let hasMoreTypes = true;

    while (hasMoreTypes && typeOffset <= max) {
      const { data } = await this.supabase
        .from('auto_type')
        .select('type_id, type_name, type_modele_id')
        .range(typeOffset, Math.min(typeOffset + typeBatchSize - 1, max))
        .order('type_id');

      if (data && data.length > 0) {
        allTypes.push(...data);
        typeOffset += typeBatchSize;
        hasMoreTypes = data.length === typeBatchSize && typeOffset <= max;
      } else {
        hasMoreTypes = false;
      }
    }

    this.logger.log(
      `Types chargés pour range ${min}-${max}: ${allTypes.length}`,
    );

    // Générer les URLs
    const entries: SitemapEntry[] = [];

    allTypes.forEach((type: any) => {
      const modeleId = parseInt(type.type_modele_id, 10);
      const modeleInfo = modeleMap.get(modeleId);

      if (modeleInfo) {
        const marqueAlias = marqueMap.get(modeleInfo.marque_id);

        if (marqueAlias) {
          const typeSlug =
            type.type_name?.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'type';

          entries.push({
            loc: `https://automecanik.com/constructeurs/${marqueAlias}-${modeleInfo.marque_id}/${modeleInfo.alias}-${type.type_modele_id}/${typeSlug}-${type.type_id}.html`,
            lastmod: new Date().toISOString(),
            changefreq: 'monthly',
            priority: 0.5,
          });
        }
      }
    });

    return entries;
  }

  /**
   * Fetch URLs du blog avec sharding temporel
   */
  private async fetchBlogUrls(
    config: SitemapConfig,
    shard?: ShardConfig,
  ): Promise<SitemapEntry[]> {
    // Charger les conseils
    const { data: adviceArticles } = await this.supabase
      .from('__blog_advice')
      .select('ba_id, ba_alias, ba_date')
      .order('ba_date', { ascending: false });

    // Charger les guides
    const { data: guideArticles } = await this.supabase
      .from('__blog_guide')
      .select('bg_id, bg_alias, bg_date')
      .order('bg_date', { ascending: false });

    // Combiner les articles
    const allArticles = [
      ...(adviceArticles || []).map((a) => ({
        alias: a.ba_alias,
        date: a.ba_date,
      })),
      ...(guideArticles || []).map((g) => ({
        alias: g.bg_alias,
        date: g.bg_date,
      })),
    ];

    // Filtrer selon le shard temporel
    let filteredArticles = allArticles;

    if (shard?.filter.type === 'temporal' && shard.filter.year) {
      filteredArticles = allArticles.filter((article) => {
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
      loc: `https://automecanik.com/blog-pieces-auto/conseils/${article.alias}`,
      lastmod: new Date(article.date).toISOString(),
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
        .from('pieces_gamme')
        .select('pg_id, pg_alias, pg_name')
        .eq('pg_display', 1)
        .eq('pg_level', level)
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
      loc: `https://automecanik.com/pieces/${gamme.pg_alias}-${gamme.pg_id}.html`,
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
   * Construit le XML d'un sitemap final avec support hreflang
   */
  private buildSitemapXml(urls: SitemapEntry[], config: SitemapConfig): string {
    // Vérifier si au moins une URL a des alternates
    const hasHreflang = urls.some(
      (url) => url.alternates && url.alternates.length > 0,
    );

    // Namespace xhtml requis pour hreflang
    const xmlnsXhtml = hasHreflang
      ? ' xmlns:xhtml="http://www.w3.org/1999/xhtml"'
      : '';

    return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"${xmlnsXhtml}>
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

    xml += '\n  </url>';
    return xml;
  })
  .join('\n')}
</urlset>`;
  }
}
