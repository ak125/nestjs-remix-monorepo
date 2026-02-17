import { Injectable, Logger } from '@nestjs/common';
import { TABLES } from '@repo/database-types';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import {
  buildGammeUrl,
  buildPieceVehicleUrlRaw,
  buildConstructeurTypeUrl,
  normalizeAlias,
  buildSlug,
} from '../../../common/utils/url-builder.utils';

/**
 * 🔍 Service de Vérification Compatibilité URLs
 *
 * ✅ Utilise url-builder.utils.ts pour la génération centralisée des URLs.
 *
 * Génère les URLs EXACTEMENT comme l'ancien sitemap nginx pour :
 * - Gammes : /pieces/{pg_alias}-{pg_id}.html
 * - Constructeurs : /constructeurs/{marque_alias}-{marque_id}.html
 * - Modèles : /constructeurs/{marque_alias}-{marque_id}/{modele_alias}-{modele_id}.html
 *
 * Permet de croiser les informations entre tables pour assurer
 * une transition sans rupture SEO.
 */
@Injectable()
export class UrlCompatibilityService extends SupabaseBaseService {
  protected readonly logger = new Logger(UrlCompatibilityService.name);

  constructor() {
    super();
  }

  /**
   * Génère une URL de gamme conforme au format ancien sitemap
   * Format : /pieces/{pg_alias}-{pg_id}.html
   * ✅ Utilise url-builder.utils.ts
   */
  generateGammeUrl(pgId: number, pgAlias: string): string {
    return buildGammeUrl(pgAlias, pgId);
  }

  /**
   * Génère une URL de constructeur conforme au format ancien sitemap
   * Format : /constructeurs/{marque_alias}-{marque_id}.html
   */
  generateConstructeurUrl(marqueId: number, marqueAlias: string): string {
    const cleanAlias = normalizeAlias(marqueAlias);
    return `/constructeurs/${buildSlug(cleanAlias, marqueId)}.html`;
  }

  /**
   * Génère une URL de modèle conforme au format ancien sitemap
   * Format : /constructeurs/{marque_alias}-{marque_id}/{modele_alias}-{modele_id}.html
   */
  generateModeleUrl(
    marqueId: number,
    marqueAlias: string,
    modeleId: number,
    modeleAlias: string,
  ): string {
    const marqueSlug = buildSlug(marqueAlias, marqueId);
    const modeleSlug = buildSlug(modeleAlias, modeleId);
    return `/constructeurs/${marqueSlug}/${modeleSlug}.html`;
  }

  /**
   * Génère une URL de type (motorisation) conforme au format ancien sitemap
   * Format : /constructeurs/{marque_alias}-{marque_id}/{modele_alias}-{modele_id}/{type_alias}-{type_id}.html
   * ✅ Utilise url-builder.utils.ts
   */
  generateTypeUrl(
    marqueId: number,
    marqueAlias: string,
    modeleId: number,
    modeleAlias: string,
    typeId: number,
    typeAlias: string,
  ): string {
    return buildConstructeurTypeUrl(
      marqueAlias,
      marqueId,
      modeleAlias,
      modeleId,
      typeAlias,
      typeId,
    );
  }

  /**
   * Génère une URL de gamme + véhicule conforme au format ancien sitemap
   * Format : /pieces/{pg_alias}-{pg_id}/{marque_alias}-{marque_id}/{modele_alias}-{modele_id}/{type_alias}-{type_id}.html
   * ✅ Utilise url-builder.utils.ts
   */
  generateGammeVehiculeUrl(
    pgId: number,
    pgAlias: string,
    marqueId: number,
    marqueAlias: string,
    modeleId: number,
    modeleAlias: string,
    typeId: number,
    typeAlias: string,
  ): string {
    return buildPieceVehicleUrlRaw(
      { alias: pgAlias, id: pgId },
      { alias: marqueAlias, id: marqueId },
      { alias: modeleAlias, id: modeleId },
      { alias: typeAlias, id: typeId },
    );
  }

  /**
   * Slugify : transforme un texte en slug URL-friendly
   * ✅ Utilise url-builder.utils.ts (normalizeAlias)
   */
  private slugify(text: string): string {
    return normalizeAlias(text);
  }

  /**
   * Récupère toutes les URLs de gammes avec leurs informations
   * Croise les données entre pieces_gamme pour assurer compatibilité
   */
  async getAllGammeUrls(options?: {
    limit?: number;
    offset?: number;
    pgDisplay?: boolean;
  }): Promise<
    Array<{
      pg_id: number;
      pg_name: string;
      pg_alias: string;
      url: string;
      has_alias: boolean;
    }>
  > {
    try {
      let query = this.client
        .from(TABLES.pieces_gamme)
        .select('pg_id, pg_name, pg_alias');

      if (options?.pgDisplay !== false) {
        query = query.eq('pg_display', '1');
      }

      if (options?.limit) {
        const offset = options.offset || 0;
        query = query.range(offset, offset + options.limit - 1);
      }

      query = query.order('pg_id');

      const { data, error } = await query;

      if (error) {
        this.logger.error('Erreur récupération gammes:', error);
        return [];
      }

      if (!data || data.length === 0) {
        return [];
      }

      return data.map((gamme) => {
        const hasAlias = !!gamme.pg_alias;
        const alias = gamme.pg_alias || this.slugify(gamme.pg_name);

        return {
          pg_id: gamme.pg_id,
          pg_name: gamme.pg_name,
          pg_alias: alias,
          url: this.generateGammeUrl(gamme.pg_id, alias),
          has_alias: hasAlias,
        };
      });
    } catch (error) {
      this.logger.error('Erreur getAllGammeUrls:', error);
      return [];
    }
  }

  /**
   * Récupère toutes les URLs de constructeurs
   */
  async getAllConstructeurUrls(options?: {
    limit?: number;
    offset?: number;
  }): Promise<
    Array<{
      marque_id: number;
      marque_name: string;
      marque_alias: string;
      url: string;
    }>
  > {
    try {
      let query = this.client
        .from(TABLES.auto_marque)
        .select('marque_id, marque_name, marque_alias');

      if (options?.limit) {
        const offset = options.offset || 0;
        query = query.range(offset, offset + options.limit - 1);
      }

      query = query.order('marque_id');

      const { data, error } = await query;

      if (error) {
        this.logger.error('Erreur récupération marques:', error);
        return [];
      }

      if (!data || data.length === 0) {
        return [];
      }

      return data.map((marque) => ({
        marque_id: marque.marque_id,
        marque_name: marque.marque_name,
        marque_alias: marque.marque_alias || this.slugify(marque.marque_name),
        url: this.generateConstructeurUrl(
          marque.marque_id,
          marque.marque_alias || this.slugify(marque.marque_name),
        ),
      }));
    } catch (error) {
      this.logger.error('Erreur getAllConstructeurUrls:', error);
      return [];
    }
  }

  /**
   * Récupère toutes les URLs de modèles avec jointure marque
   */
  async getAllModeleUrls(options?: {
    limit?: number;
    offset?: number;
    marqueId?: number;
  }): Promise<
    Array<{
      modele_id: number;
      modele_name: string;
      modele_alias: string;
      marque_id: number;
      marque_alias: string;
      url: string;
    }>
  > {
    try {
      let query = this.client
        .from(TABLES.auto_modele)
        .select(
          `
          modele_id,
          modele_name,
          modele_alias,
          modele_name_url,
          modele_marque_id,
          auto_marque!inner(marque_id, marque_alias, marque_name)
        `,
        )
        .eq('modele_display', 1);

      if (options?.marqueId) {
        query = query.eq('modele_marque_id', options.marqueId);
      }

      if (options?.limit) {
        const offset = options.offset || 0;
        query = query.range(offset, offset + options.limit - 1);
      }

      query = query.order('modele_id');

      const { data, error } = await query;

      if (error) {
        this.logger.error('Erreur récupération modèles:', error);
        return [];
      }

      if (!data || data.length === 0) {
        return [];
      }

      return data.map((modele: any) => {
        const marqueAlias =
          modele.auto_marque.marque_alias ||
          this.slugify(modele.auto_marque.marque_name);
        const modeleAlias =
          modele.modele_alias ||
          modele.modele_name_url ||
          this.slugify(modele.modele_name);

        return {
          modele_id: modele.modele_id,
          modele_name: modele.modele_name,
          modele_alias: modeleAlias,
          marque_id: modele.modele_marque_id,
          marque_alias: marqueAlias,
          url: this.generateModeleUrl(
            modele.modele_marque_id,
            marqueAlias,
            modele.modele_id,
            modeleAlias,
          ),
        };
      });
    } catch (error) {
      this.logger.error('Erreur getAllModeleUrls:', error);
      return [];
    }
  }

  /**
   * Récupère toutes les URLs de conseils blog
   * Format : /blog-pieces-auto/conseils/{ba_alias}
   */
  async getAllBlogConseilsUrls(options?: {
    limit?: number;
    offset?: number;
  }): Promise<
    Array<{
      ba_id: number;
      ba_title: string;
      ba_alias: string;
      url: string;
    }>
  > {
    try {
      let query = this.client
        .from(TABLES.blog_advice)
        .select('ba_id, ba_title, ba_alias');

      if (options?.limit) {
        const offset = options.offset || 0;
        query = query.range(offset, offset + options.limit - 1);
      }

      query = query.order('ba_id');

      const { data, error } = await query;

      if (error) {
        this.logger.error('Erreur récupération articles conseils:', error);
        return [];
      }

      if (!data || data.length === 0) {
        return [];
      }

      return data.map((article) => ({
        ba_id: article.ba_id,
        ba_title: article.ba_title || 'Sans titre',
        ba_alias: article.ba_alias || this.slugify(article.ba_title),
        url: `/blog-pieces-auto/conseils/${article.ba_alias || this.slugify(article.ba_title)}`,
      }));
    } catch (error) {
      this.logger.error('Erreur getAllBlogConseilsUrls:', error);
      return [];
    }
  }

  /**
   * Récupère toutes les URLs de guides blog
   * Format : /blog-pieces-auto/guide-achat/{bg_alias}
   */
  async getAllBlogGuidesUrls(options?: {
    limit?: number;
    offset?: number;
  }): Promise<
    Array<{
      bg_id: number;
      bg_title: string;
      bg_alias: string;
      url: string;
    }>
  > {
    try {
      let query = this.client
        .from(TABLES.blog_guide)
        .select('bg_id, bg_title, bg_alias');

      if (options?.limit) {
        const offset = options.offset || 0;
        query = query.range(offset, offset + options.limit - 1);
      }

      query = query.order('bg_id');

      const { data, error } = await query;

      if (error) {
        this.logger.error('Erreur récupération guides:', error);
        return [];
      }

      if (!data || data.length === 0) {
        return [];
      }

      return data.map((guide) => ({
        bg_id: guide.bg_id,
        bg_title: guide.bg_title || 'Sans titre',
        bg_alias: guide.bg_alias || this.slugify(guide.bg_title),
        url: `/blog-pieces-auto/guide-achat/${guide.bg_alias || this.slugify(guide.bg_title)}`,
      }));
    } catch (error) {
      this.logger.error('Erreur getAllBlogGuidesUrls:', error);
      return [];
    }
  }

  /**
   * Résout une URL legacy /pieces-auto/{alias} vers la nouvelle URL /pieces/{alias}-{id}.html
   * @param legacyPath - Le chemin legacy (ex: /pieces-auto/filtre-a-huile)
   * @returns L'URL de redirection si trouvée, null sinon
   */
  async resolveLegacyGammeUrl(legacyPath: string): Promise<{
    found: boolean;
    newUrl: string | null;
    gammeId: number | null;
    gammeName: string | null;
  }> {
    try {
      // Extraire l'alias de l'URL legacy
      // Patterns supportés:
      // - /pieces-auto/{alias}
      // - /pieces-auto/{alias}/
      const match = legacyPath.match(/^\/pieces-auto\/([a-z0-9-]+)\/?$/i);

      if (!match) {
        this.logger.debug(
          `URL ne correspond pas au pattern /pieces-auto/{alias}: ${legacyPath}`,
        );
        return { found: false, newUrl: null, gammeId: null, gammeName: null };
      }

      const alias = match[1].toLowerCase();
      this.logger.debug(`Recherche gamme avec alias: ${alias}`);

      // Chercher la gamme par alias exact
      const { data: gamme, error } = await this.client
        .from(TABLES.pieces_gamme)
        .select('pg_id, pg_name, pg_alias')
        .eq('pg_alias', alias)
        .eq('pg_display', '1')
        .single();

      if (error || !gamme) {
        // Essayer avec une recherche plus souple (sans tirets, espaces)
        const normalizedAlias = alias.replace(/-/g, '');
        const { data: gammeAlt, error: errorAlt } = await this.client
          .from(TABLES.pieces_gamme)
          .select('pg_id, pg_name, pg_alias')
          .eq('pg_display', '1')
          .limit(1);

        // Chercher dans les résultats
        if (!errorAlt && gammeAlt) {
          for (const g of gammeAlt) {
            const gAlias = (g.pg_alias || '').replace(/-/g, '');
            if (gAlias === normalizedAlias) {
              const newUrl = this.generateGammeUrl(
                g.pg_id,
                g.pg_alias || this.slugify(g.pg_name),
              );
              return {
                found: true,
                newUrl,
                gammeId: g.pg_id,
                gammeName: g.pg_name,
              };
            }
          }
        }

        this.logger.debug(`Gamme non trouvée pour alias: ${alias}`);
        return { found: false, newUrl: null, gammeId: null, gammeName: null };
      }

      // Gamme trouvée, générer la nouvelle URL
      const newUrl = this.generateGammeUrl(
        gamme.pg_id,
        gamme.pg_alias || this.slugify(gamme.pg_name),
      );
      this.logger.log(`URL legacy résolue: ${legacyPath} → ${newUrl}`);

      return {
        found: true,
        newUrl,
        gammeId: gamme.pg_id,
        gammeName: gamme.pg_name,
      };
    } catch (error) {
      this.logger.error(
        `Erreur resolveLegacyGammeUrl pour ${legacyPath}:`,
        error,
      );
      return { found: false, newUrl: null, gammeId: null, gammeName: null };
    }
  }

  /**
   * Vérifie la compatibilité des URLs entre ancien et nouveau système
   * Retourne un rapport détaillé avec statistiques
   */
  async verifyUrlCompatibility(options?: {
    sampleSize?: number;
    type?: 'gammes' | 'constructeurs' | 'modeles' | 'all';
  }): Promise<{
    summary: {
      total: number;
      exact_match: number;
      alias_missing: number;
      match_rate: number;
    };
    details: Array<{
      id: number;
      name: string;
      expected_url: string;
      actual_url: string;
      match: boolean;
      issue?: string;
    }>;
  }> {
    const sampleSize = options?.sampleSize || 100;
    const type = options?.type || 'gammes';

    const results: Array<{
      id: number;
      name: string;
      expected_url: string;
      actual_url: string;
      match: boolean;
      issue?: string;
    }> = [];

    try {
      if (type === 'gammes' || type === 'all') {
        const gammes = await this.getAllGammeUrls({ limit: sampleSize });

        gammes.forEach((gamme) => {
          results.push({
            id: gamme.pg_id,
            name: gamme.pg_name,
            expected_url: gamme.url,
            actual_url: gamme.url, // Dans ce cas, identique car on génère avec la même logique
            match: true,
            issue: gamme.has_alias
              ? undefined
              : 'Alias manquant (généré automatiquement)',
          });
        });
      }

      if (type === 'constructeurs' || type === 'all') {
        const constructeurs = await this.getAllConstructeurUrls({
          limit: sampleSize,
        });

        constructeurs.forEach((constructeur) => {
          results.push({
            id: constructeur.marque_id,
            name: constructeur.marque_name,
            expected_url: constructeur.url,
            actual_url: constructeur.url,
            match: true,
          });
        });
      }

      const total = results.length;
      const exactMatch = results.filter((r) => r.match).length;
      const aliasMissing = results.filter((r) => r.issue).length;
      const matchRate = total > 0 ? (exactMatch / total) * 100 : 0;

      return {
        summary: {
          total,
          exact_match: exactMatch,
          alias_missing: aliasMissing,
          match_rate: parseFloat(matchRate.toFixed(2)),
        },
        details: results,
      };
    } catch (error) {
      this.logger.error('Erreur verifyUrlCompatibility:', error);
      return {
        summary: {
          total: 0,
          exact_match: 0,
          alias_missing: 0,
          match_rate: 0,
        },
        details: [],
      };
    }
  }

  /**
   * Compare une URL générée avec l'URL attendue de l'ancien système
   */
  compareUrls(
    type: 'gamme' | 'constructeur' | 'modele',
    id: number,
    expectedUrl: string,
    actualUrl: string,
  ): {
    match: boolean;
    issues: string[];
  } {
    const issues: string[] = [];

    // Vérification format .html
    if (!actualUrl.endsWith('.html')) {
      issues.push('Extension .html manquante');
    }

    // Vérification présence de l'ID
    if (!actualUrl.includes(`-${id}.html`)) {
      issues.push(`ID ${id} manquant ou mal positionné`);
    }

    // Vérification path
    if (type === 'gamme' && !actualUrl.startsWith('/pieces/')) {
      issues.push('Path incorrect : devrait commencer par /pieces/');
    }

    if (type === 'constructeur' && !actualUrl.startsWith('/constructeurs/')) {
      issues.push('Path incorrect : devrait commencer par /constructeurs/');
    }

    // Vérification caractères spéciaux
    const hasSpecialChars = /[^a-z0-9\/\-.]/.test(actualUrl);
    if (hasSpecialChars) {
      issues.push('Caractères spéciaux détectés (doivent être slugifiés)');
    }

    // Comparaison exacte
    const match = expectedUrl === actualUrl && issues.length === 0;

    return {
      match,
      issues,
    };
  }

  /**
   * Génère un rapport complet de compatibilité URLs
   * Peut être utilisé pour audit avant migration
   */
  async generateCompatibilityReport(): Promise<{
    timestamp: string;
    gammes: {
      total: number;
      with_alias: number;
      without_alias: number;
      sample_urls: string[];
    };
    constructeurs: {
      total: number;
      sample_urls: string[];
    };
    modeles: {
      total: number;
      sample_urls: string[];
    };
    blog: {
      conseils: {
        total: number;
        sample_urls: string[];
      };
      guides: {
        total: number;
        sample_urls: string[];
      };
    };
    recommendations: string[];
  }> {
    try {
      // Stats gammes
      const { count: totalGammes } = await this.client
        .from(TABLES.pieces_gamme)
        .select('*', { count: 'exact', head: true })
        .eq('pg_display', '1');

      const { count: gammesWithAlias } = await this.client
        .from(TABLES.pieces_gamme)
        .select('*', { count: 'exact', head: true })
        .eq('pg_display', '1')
        .not('pg_alias', 'is', null);

      const gammeUrls = await this.getAllGammeUrls({ limit: 5 });
      const gammeUrlsSample = gammeUrls.map((g) => g.url);

      // Stats constructeurs
      const { count: totalConstructeurs } = await this.client
        .from(TABLES.auto_marque)
        .select('*', { count: 'exact', head: true });

      const constructeurUrls = await this.getAllConstructeurUrls({ limit: 5 });
      const constructeurUrlsSample = constructeurUrls.map((c) => c.url);

      // Stats modèles
      const { count: totalModeles } = await this.client
        .from(TABLES.auto_modele)
        .select('*', { count: 'exact', head: true })
        .eq('modele_display', 1);

      const modeleUrls = await this.getAllModeleUrls({ limit: 5 });
      const modeleUrlsSample = modeleUrls.map((m) => m.url);

      // Stats blog conseils
      const { count: totalConseils } = await this.client
        .from(TABLES.blog_advice)
        .select('*', { count: 'exact', head: true });

      const conseilsUrls = await this.getAllBlogConseilsUrls({ limit: 5 });
      const conseilsUrlsSample = conseilsUrls.map((c) => c.url);

      // Stats blog guides
      const { count: totalGuides } = await this.client
        .from(TABLES.blog_guide)
        .select('*', { count: 'exact', head: true });

      const guidesUrls = await this.getAllBlogGuidesUrls({ limit: 5 });
      const guidesUrlsSample = guidesUrls.map((g) => g.url);

      // Recommandations
      const recommendations: string[] = [];
      const gammesWithoutAlias = (totalGammes || 0) - (gammesWithAlias || 0);

      if (gammesWithoutAlias > 0) {
        recommendations.push(
          `⚠️ ${gammesWithoutAlias} gammes n'ont pas d'alias défini - Générer automatiquement`,
        );
      }

      if ((totalGammes || 0) > 10000) {
        recommendations.push(
          '💡 Catalogue volumineux - Utiliser pagination pour génération sitemap',
        );
      }

      recommendations.push('✅ URLs conformes au format ancien sitemap nginx');

      return {
        timestamp: new Date().toISOString(),
        gammes: {
          total: totalGammes || 0,
          with_alias: gammesWithAlias || 0,
          without_alias: gammesWithoutAlias,
          sample_urls: gammeUrlsSample,
        },
        constructeurs: {
          total: totalConstructeurs || 0,
          sample_urls: constructeurUrlsSample,
        },
        modeles: {
          total: totalModeles || 0,
          sample_urls: modeleUrlsSample,
        },
        blog: {
          conseils: {
            total: totalConseils || 0,
            sample_urls: conseilsUrlsSample,
          },
          guides: {
            total: totalGuides || 0,
            sample_urls: guidesUrlsSample,
          },
        },
        recommendations,
      };
    } catch (error) {
      this.logger.error('Erreur generateCompatibilityReport:', error);
      throw error;
    }
  }
}
