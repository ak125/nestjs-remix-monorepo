/**
 * 📄 SERVICE GÉNÉRATEURS STATIQUES SITEMAP V10
 *
 * 8 générateurs de sitemaps indépendants:
 * 1. Racine (homepage, 1 URL)
 * 2. Catégories/Gammes INDEX (~123 URLs)
 * 3. Véhicules fusionnés (~13.8k URLs)
 * 4. Véhicules par marque (~30 files)
 * 5. Blog (~109 URLs)
 * 6. Pages statiques (~9 URLs)
 * 7. sitemap-diagnostic.xml
 * 8. sitemap-reference.xml
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs/promises';
import * as path from 'path';
import { SupabaseBaseService } from '@database/services/supabase-base.service';
import { RpcGateService } from '@security/rpc-gate/rpc-gate.service';
import { FeatureFlagsService } from '../../../config/feature-flags.service';
import { isR6GuideAchatSurface } from '../types/page-role.types';
import { SitemapV10DataService } from './sitemap-v10-data.service';
import { SitemapV10XmlService } from './sitemap-v10-xml.service';
import { type SitemapUrl, STATIC_PAGES } from './sitemap-v10.types';

/**
 * Retire la surface R6 guide-achat (hub + pages détail) d'une liste d'URLs de
 * sitemap. Fonction pure : la décision vient de `isR6GuideAchatSurface`.
 */
export function excludeR6GuideAchatUrls(urls: SitemapUrl[]): {
  kept: SitemapUrl[];
  excludedCount: number;
} {
  const kept = urls.filter((u) => !isR6GuideAchatSurface(u.url));
  return { kept, excludedCount: urls.length - kept.length };
}

/**
 * Retire d'une liste les URLs déjà portées par un autre fichier du même index
 * (une URL = un seul fichier). Comparaison sur la `<loc>` finale via `toLoc`
 * (relative ou absolue). Fonction pure, ordre conservé.
 */
export function excludeUrlsOwnedElsewhere(
  urls: SitemapUrl[],
  ownedLocs: ReadonlySet<string>,
  toLoc: (url: string) => string = (url) => url,
): { kept: SitemapUrl[]; excludedCount: number } {
  const kept = urls.filter((u) => !ownedLocs.has(toLoc(u.url)));
  return { kept, excludedCount: urls.length - kept.length };
}

@Injectable()
export class SitemapV10StaticService extends SupabaseBaseService {
  protected override readonly logger = new Logger(SitemapV10StaticService.name);

  constructor(
    configService: ConfigService,
    rpcGate: RpcGateService,
    private readonly dataService: SitemapV10DataService,
    private readonly xmlService: SitemapV10XmlService,
    private readonly featureFlags: FeatureFlagsService,
  ) {
    super(configService);
    this.rpcGate = rpcGate;
  }

  /**
   * 🏠 Génère sitemap-racine.xml (Homepage uniquement)
   */
  async generateRacineSitemap(): Promise<string | null> {
    try {
      const today = new Date().toISOString().split('T')[0];
      const urls: SitemapUrl[] = [
        {
          url: '/',
          page_type: 'homepage',
          changefreq: 'daily',
          priority: '1.0',
          last_modified_at: today,
        },
      ];

      const filePath = path.join(
        this.xmlService.OUTPUT_DIR,
        'sitemap-racine.xml',
      );
      await this.xmlService.writeStaticSitemapFile(filePath, urls);
      this.logger.log(`   ✅ sitemap-racine.xml: 1 URL`);
      return filePath;
    } catch (error) {
      this.logger.error(`❌ Failed to generate racine sitemap: ${error}`);
      return null;
    }
  }

  /**
   * 📂 Génère sitemap-categories.xml (Gammes INDEX)
   */
  async generateCategoriesSitemap(): Promise<string | null> {
    try {
      // pg_level = '1' : même règle que le rendu R1, qui sert
      // `noindex, nofollow` à toute gamme dont pg_level ≠ '1'
      // (gamme-response-builder.service.ts, RÈGLE SEO G1/G2).
      const { data: gammes, error } = await this.supabase
        .from('pieces_gamme')
        .select('pg_alias, pg_id')
        .eq('pg_display', '1')
        .eq('pg_relfollow', '1')
        .eq('pg_level', '1')
        .neq('pg_alias', '')
        .order('pg_alias');

      if (error) {
        this.logger.error(`❌ Error fetching categories: ${error.message}`);
        return null;
      }

      if (!gammes || gammes.length === 0) {
        this.logger.warn('⚠️ No categories found');
        return null;
      }

      const urls: SitemapUrl[] = gammes.map((g) => ({
        url: `/pieces/${g.pg_alias}-${g.pg_id}.html`,
        page_type: 'category',
        changefreq: 'weekly',
        priority: '0.8',
        last_modified_at: null,
      }));

      const filePath = path.join(
        this.xmlService.OUTPUT_DIR,
        'sitemap-categories.xml',
      );
      await this.xmlService.writeStaticSitemapFile(filePath, urls);
      this.logger.log(`   ✅ sitemap-categories.xml: ${urls.length} URLs`);
      return filePath;
    } catch (error) {
      this.logger.error(`❌ Failed to generate categories sitemap: ${error}`);
      return null;
    }
  }

  /**
   * 🚗 Génère sitemap-vehicules.xml (marques + modèles + motorisations)
   *
   * Les URLs marque appartiennent à sitemap-brands.xml : elles sont retirées
   * d'ici quand la même lecture les y place. `brandUrls` = résultat de
   * `collectBrandUrls()` partagé par l'orchestrateur (une lecture par run) ;
   * omis ⇒ lu ici. `unpublishedBrandUrls` = URLs marque lues mais non
   * publiées (écriture de sitemap-brands.xml en échec) : ajoutées ici si
   * absentes de la vue véhicules. `brandsPublished` = sitemap-brands.xml
   * écrit par ce run (seul cas où un fichier sans URL restante est retiré).
   * Écriture ou retrait en échec : erreur propagée (jamais de faux succès).
   */
  async generateVehiculesSitemap(
    brandUrls?: SitemapUrl[] | null,
    unpublishedBrandUrls: SitemapUrl[] = [],
    brandsPublished = false,
  ): Promise<string | null> {
    const filePath = path.join(
      this.xmlService.OUTPUT_DIR,
      'sitemap-vehicules.xml',
    );
    let urls: SitemapUrl[] = [];
    try {
      interface VehiculeType {
        niveau: number;
        url: string;
        priority: number;
        changefreq: string;
      }

      const { count, error: countError } = await this.supabase
        .from('__sitemap_vehicules')
        .select('*', { count: 'exact', head: true });

      if (countError) {
        this.logger.error(`❌ Error counting vehicules: ${countError.message}`);
        return null;
      }

      // count 0 (lecture saine) = vue vide : les URLs marque non publiées
      // restent à écrire. count > 0 puis liste vide/absente = lecture en
      // échec (fetchWithPagination journalise et rend [] sur erreur).
      const totalCount = count || 0;
      if (totalCount === 0) {
        this.logger.warn('⚠️ No vehicules found');
      }

      const vehicules =
        totalCount === 0
          ? []
          : await this.dataService.fetchWithPagination<VehiculeType>(
              '__sitemap_vehicules',
              'niveau, url, priority, changefreq',
              totalCount,
            );

      if (!Array.isArray(vehicules) || (totalCount > 0 && !vehicules.length)) {
        return null;
      }

      const allUrls: SitemapUrl[] = vehicules.map((v) => ({
        url: v.url,
        page_type: 'vehicule',
        changefreq: v.changefreq || 'monthly',
        priority: v.priority.toString(),
        last_modified_at: null,
      }));

      // Source marque indisponible (≠ vide) : sitemap-brands.xml n'est pas
      // écrit pour ce run, les URLs marque restent donc déclarées ici
      // (comportement antérieur), sans répétition dans l'index.
      const owned =
        brandUrls === undefined ? await this.collectBrandUrls() : brandUrls;
      if (owned === null) {
        this.logger.error(
          '❌ URLs marque indisponibles : sitemap-vehicules.xml garde les URLs marque (sitemap-brands.xml non écrit)',
        );
      }
      const toLoc = (url: string) =>
        url.startsWith('http') ? url : `${this.xmlService.BASE_URL}${url}`;
      const { kept, excludedCount } = excludeUrlsOwnedElsewhere(
        allUrls,
        new Set((owned ?? []).map((b) => toLoc(b.url))),
        toLoc,
      );
      // <loc> finale : une R7 absolue et un repli relatif peuvent coïncider ;
      // la première occurrence (ordre de collecte) est gardée.
      const present = new Set(kept.map((u) => toLoc(u.url)));
      urls = [
        ...kept,
        ...unpublishedBrandUrls.filter((b) => {
          const loc = toLoc(b.url);
          if (present.has(loc)) return false;
          present.add(loc);
          return true;
        }),
      ];
      if (excludedCount > 0) {
        this.logger.log(
          `   🔀 sitemap-vehicules.xml: ${excludedCount} URL(s) marque laissée(s) à sitemap-brands.xml`,
        );
      }
      // Vide sain (lectures sans erreur, marques publiées) : seul cas de
      // retrait. Sinon le fichier existant est gardé (repli).
      if (urls.length === 0 && !(brandsPublished && owned !== null)) {
        this.logger.warn(
          '⚠️ sitemap-vehicules.xml non écrit : aucune URL propre après dédoublonnage',
        );
        return null;
      }
    } catch (error) {
      this.logger.error(`❌ Failed to generate vehicules sitemap: ${error}`);
      return null;
    }

    if (urls.length === 0) {
      // Un sitemap-vehicules.xml antérieur (marques comprises) resterait
      // servi tel quel hors index : retiré, absence déjà constatée tolérée.
      await fs.unlink(filePath).catch((error: NodeJS.ErrnoException) => {
        if (error.code !== 'ENOENT') throw error;
      });
      this.logger.warn(
        '⚠️ sitemap-vehicules.xml retiré : aucune URL restante, marques publiées dans sitemap-brands.xml',
      );
      return null;
    }
    await this.xmlService.writeStaticSitemapFile(filePath, urls);
    this.logger.log(`   ✅ sitemap-vehicules.xml: ${urls.length} URLs`);
    return filePath;
  }

  /**
   * 🚗 Génère sitemaps véhicules par marque
   * Output: vehicules/sitemap-{brand}.xml (~30 marques)
   */
  async generateVehiculesByBrand(): Promise<{
    success: boolean;
    filePaths: string[];
    totalUrls: number;
    brandCount: number;
  }> {
    const startTime = Date.now();
    this.logger.log('🚗 Starting vehicle sitemaps by brand generation...');

    const filePaths: string[] = [];
    let totalUrls = 0;

    try {
      interface VehiculeType {
        niveau: number;
        url: string;
        priority: number;
        changefreq: string;
      }

      const { count, error: countError } = await this.supabase
        .from('__sitemap_vehicules')
        .select('*', { count: 'exact', head: true });

      if (countError) {
        this.logger.error(`❌ Error counting vehicules: ${countError.message}`);
        return { success: false, filePaths: [], totalUrls: 0, brandCount: 0 };
      }

      const totalCount = count || 0;
      if (totalCount === 0) {
        this.logger.warn('⚠️ No vehicules found');
        return { success: false, filePaths: [], totalUrls: 0, brandCount: 0 };
      }

      const vehicules =
        await this.dataService.fetchWithPagination<VehiculeType>(
          '__sitemap_vehicules',
          'niveau, url, priority, changefreq',
          totalCount,
        );

      if (!vehicules || vehicules.length === 0) {
        return { success: false, filePaths: [], totalUrls: 0, brandCount: 0 };
      }

      // Grouper par marque (extraire de l'URL)
      const brandMap = new Map<string, VehiculeType[]>();

      for (const v of vehicules) {
        const match = v.url.match(/\/constructeurs\/([a-z0-9-]+?)-\d+/i);
        const brand = match ? match[1].toLowerCase() : 'autres';

        if (!brandMap.has(brand)) {
          brandMap.set(brand, []);
        }
        brandMap.get(brand)!.push(v);
      }

      // Créer le répertoire vehicules/
      const vehiculesDir = path.join(this.xmlService.OUTPUT_DIR, 'vehicules');
      await fs.mkdir(vehiculesDir, { recursive: true });

      // Générer un sitemap par marque
      const brands = Array.from(brandMap.keys()).sort();
      this.logger.log(`   Found ${brands.length} brands to process...`);

      for (const brand of brands) {
        const brandVehicules = brandMap.get(brand)!;
        const urls: SitemapUrl[] = brandVehicules.map((v) => ({
          url: v.url,
          page_type: 'vehicule',
          changefreq: v.changefreq || 'monthly',
          priority: v.priority.toString(),
          last_modified_at: null,
        }));

        const brandFilePath = path.join(vehiculesDir, `sitemap-${brand}.xml`);
        await this.xmlService.writeStaticSitemapFile(brandFilePath, urls);
        filePaths.push(brandFilePath);
        totalUrls += urls.length;

        this.logger.log(
          `   ✅ vehicules/sitemap-${brand}.xml: ${urls.length} URLs`,
        );
      }

      const duration = Date.now() - startTime;
      this.logger.log(
        `✅ Vehicle by brand generation complete: ${totalUrls} URLs in ${brands.length} files (${duration}ms)`,
      );

      return {
        success: true,
        filePaths,
        totalUrls,
        brandCount: brands.length,
      };
    } catch (error) {
      this.logger.error(`❌ Failed to generate vehicules by brand: ${error}`);
      return { success: false, filePaths: [], totalUrls: 0, brandCount: 0 };
    }
  }

  /**
   * 📝 Génère sitemap-blog.xml
   */
  async generateBlogSitemap(): Promise<string | null> {
    try {
      const { data: articles, error } = await this.supabase
        .from('__sitemap_blog')
        .select('map_alias, map_date')
        .order('map_date', { ascending: false });

      if (error) {
        this.logger.error(`❌ Error fetching blog: ${error.message}`);
        return null;
      }

      if (!articles || articles.length === 0) {
        this.logger.warn('⚠️ No blog articles found');
        return null;
      }

      const allUrls: SitemapUrl[] = articles.map((a) => ({
        url: `/blog-pieces-auto/${a.map_alias}`,
        page_type: 'blog',
        changefreq: 'monthly',
        priority: '0.6',
        last_modified_at: a.map_date || null,
      }));

      // Consolidation R6→R3 : la surface guide-achat (hub + pages) sort de l'index
      let urls = allUrls;
      if (this.featureFlags.seoR6ConsolidationEnabled) {
        const { kept, excludedCount } = excludeR6GuideAchatUrls(allUrls);
        urls = kept;
        this.logger.log(
          `   🔀 R6 consolidation ON: ${excludedCount} URL(s) guide-achat exclue(s) de sitemap-blog.xml`,
        );
      }

      const filePath = path.join(
        this.xmlService.OUTPUT_DIR,
        'sitemap-blog.xml',
      );
      await this.xmlService.writeStaticSitemapFile(filePath, urls);
      this.logger.log(`   ✅ sitemap-blog.xml: ${urls.length} URLs`);
      return filePath;
    } catch (error) {
      this.logger.error(`❌ Failed to generate blog sitemap: ${error}`);
      return null;
    }
  }

  /**
   * 📄 Génère sitemap-pages.xml (pages statiques)
   */
  async generatePagesSitemap(): Promise<string | null> {
    try {
      const today = new Date().toISOString().split('T')[0];
      const urls: SitemapUrl[] = STATIC_PAGES.map((p) => ({
        url: p.loc,
        page_type: 'static',
        changefreq: p.changefreq,
        priority: p.priority,
        last_modified_at: today,
      }));

      const filePath = path.join(
        this.xmlService.OUTPUT_DIR,
        'sitemap-pages.xml',
      );
      await this.xmlService.writeStaticSitemapFile(filePath, urls);
      this.logger.log(`   ✅ sitemap-pages.xml: ${urls.length} URLs`);
      return filePath;
    } catch (error) {
      this.logger.error(`❌ Failed to generate pages sitemap: ${error}`);
      return null;
    }
  }

  /**
   * 🩺 Génère sitemap-diagnostic.xml (pages R5 Observable Pro)
   */
  async generateDiagnosticSitemap(): Promise<string | null> {
    try {
      // 🛡️ RPC Safety Gate
      const { data: diagnostics, error } = await this.callRpc<
        Record<string, unknown>[]
      >('get_all_seo_observables_for_sitemap', {}, { source: 'cron' });

      if (error) {
        this.logger.error(
          `❌ Error fetching diagnostics for sitemap: ${error.message}`,
        );
        return null;
      }

      if (!diagnostics || diagnostics.length === 0) {
        this.logger.warn('⚠️ No diagnostic pages found for sitemap');
        return null;
      }

      // R5 consolidation: only include hub, sub-pages redirect to R3
      const urls: SitemapUrl[] = [
        {
          url: '/diagnostic-auto',
          page_type: 'diagnostic',
          changefreq: 'weekly',
          priority: '0.8',
          last_modified_at: new Date().toISOString(),
        },
      ];

      const filePath = path.join(
        this.xmlService.OUTPUT_DIR,
        'sitemap-diagnostic.xml',
      );
      await this.xmlService.writeStaticSitemapFile(filePath, urls);
      this.logger.log(`   ✅ sitemap-diagnostic.xml: ${urls.length} URLs (R5)`);
      return filePath;
    } catch (error) {
      this.logger.error(`❌ Failed to generate diagnostic sitemap: ${error}`);
      return null;
    }
  }

  /**
   * 📖 Génère sitemap-reference.xml (pages R4 Référence)
   */
  async generateReferenceSitemap(): Promise<string | null> {
    try {
      const { data: references, error } = await this.supabase
        .from('__seo_reference')
        .select('slug, updated_at')
        .eq('is_published', true)
        .order('updated_at', { ascending: false });

      if (error) {
        this.logger.error(
          `❌ Error fetching references for sitemap: ${error.message}`,
        );
        return null;
      }

      if (!references || references.length === 0) {
        this.logger.warn('⚠️ No reference pages found for sitemap');
        return null;
      }

      const urls: SitemapUrl[] = references.map(
        (r: { slug: string; updated_at: string }) => ({
          url: `/reference-auto/${r.slug}`,
          page_type: 'reference',
          changefreq: 'monthly',
          priority: '0.8',
          last_modified_at: r.updated_at,
        }),
      );

      const filePath = path.join(
        this.xmlService.OUTPUT_DIR,
        'sitemap-reference.xml',
      );
      await this.xmlService.writeStaticSitemapFile(filePath, urls);
      this.logger.log(`   ✅ sitemap-reference.xml: ${urls.length} URLs (R4)`);
      return filePath;
    } catch (error) {
      this.logger.error(`❌ Failed to generate reference sitemap: ${error}`);
      return null;
    }
  }

  /**
   * Génère sitemap-brands.xml (R7 Brand pages)
   * Source primaire: __seo_r7_pages (PUBLISH), fallback: auto_marque
   * `brandUrls` : même contrat que generateVehiculesSitemap.
   */
  async generateBrandsSitemap(
    brandUrls?: SitemapUrl[] | null,
  ): Promise<string | null> {
    try {
      const urls =
        brandUrls === undefined ? await this.collectBrandUrls() : brandUrls;
      if (urls === null) return null;

      if (urls.length === 0) {
        this.logger.warn('⚠️ No brand pages found for sitemap');
        return null;
      }

      const filePath = path.join(
        this.xmlService.OUTPUT_DIR,
        'sitemap-brands.xml',
      );
      await this.xmlService.writeStaticSitemapFile(filePath, urls);
      this.logger.log(`   ✅ sitemap-brands.xml: ${urls.length} URLs (R7)`);
      return filePath;
    } catch (error) {
      this.logger.error(`❌ Failed to generate brands sitemap: ${error}`);
      return null;
    }
  }

  /**
   * URLs de pages marque portées par sitemap-brands.xml.
   * Source primaire: __seo_r7_pages (PUBLISH), fallback: auto_marque.
   * `null` = source indisponible (erreur), distinct d'une liste vide.
   */
  async collectBrandUrls(): Promise<SitemapUrl[] | null> {
    try {
      // 1. Fetch enriched brands from R7 pages
      const { data: r7Pages, error: r7Error } = await this.supabase
        .from('__seo_r7_pages')
        .select('canonical_url, updated_at, seo_decision')
        .in('seo_decision', ['PUBLISH', 'REVIEW_REQUIRED']);

      // 2. Fetch all active brands as fallback
      const { data: allBrands, error: brandsError } = await this.supabase
        .from('auto_marque')
        .select('marque_id, marque_alias')
        .eq('marque_display', 1)
        .eq('marque_relfollow', 1);

      if (brandsError) {
        this.logger.error(
          `❌ Error fetching brands for sitemap: ${brandsError.message}`,
        );
        return null;
      }

      const urls: SitemapUrl[] = [];

      // Add R7 enriched pages with priority based on seo_decision
      // Clé = <loc> finale (même règle que sitemap-v10-xml.service) : une
      // canonical_url R7 absolue et le repli relatif de la même marque ne
      // donnent qu'une entrée. Les `url` émises restent inchangées.
      const toLoc = (url: string) =>
        url.startsWith('http') ? url : `${this.xmlService.BASE_URL}${url}`;
      const r7Urls = new Set<string>();
      if (!r7Error && r7Pages) {
        for (const page of r7Pages) {
          const priority = page.seo_decision === 'PUBLISH' ? '0.8' : '0.6';
          urls.push({
            url: page.canonical_url,
            page_type: 'brand',
            changefreq: 'weekly',
            priority,
            last_modified_at: page.updated_at,
          });
          r7Urls.add(toLoc(page.canonical_url));
        }
      }

      // Add non-enriched brands as fallback (lower priority)
      if (allBrands) {
        for (const brand of allBrands) {
          const brandUrl = `/constructeurs/${brand.marque_alias}-${brand.marque_id}.html`;
          if (!r7Urls.has(toLoc(brandUrl))) {
            urls.push({
              url: brandUrl,
              page_type: 'brand',
              changefreq: 'monthly',
              priority: '0.5',
              last_modified_at: null,
            });
          }
        }
      }

      return urls;
    } catch (error) {
      this.logger.error(`❌ Failed to read brand URLs: ${error}`);
      return null;
    }
  }
}
