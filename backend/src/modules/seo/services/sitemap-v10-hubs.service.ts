/**
 * 🔗 SERVICE HUBS CRAWL V10 - GÉNÉRATION PAGES DE LIENS
 *
 * Génère des pages HTML de liens internes pour faciliter
 * le crawl par Googlebot (non indexées).
 *
 * Types de hubs:
 * - money: Pages à fort ROI (hot bucket)
 * - new-pages: Pages récentes (new bucket)
 * - gammes: Toutes les catégories produits
 * - vehicules: Toutes les pages véhicules
 * - clusters: Groupes thématiques
 *
 * Ces hubs sont liés depuis le footer ou le sitemap HTML
 * et servent de "portes d'entrée" pour le crawl.
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as fs from 'fs/promises';
import * as path from 'path';
import { getAppConfig } from '../../../config/app.config';

// Types
export type HubType =
  | 'money'
  | 'new-pages'
  | 'stabilize'
  | 'gammes'
  | 'vehicules'
  | 'clusters';

export interface HubConfig {
  title: string;
  description: string;
  bucket?: 'hot' | 'new' | 'stable' | 'cold';
  pageTypes?: string[];
  maxUrls: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTES PAGINATION
// ═══════════════════════════════════════════════════════════════════════════
const MAX_URLS_PER_PART = 5000; // Max URLs par fichier part (idéal pour crawl)

// Configuration des clusters thématiques - Structure avec sous-catégories H2
export interface SubCategory {
  name: string;
  gamme_names: string[];
}

export interface FamilyClusterConfig {
  title: string;
  description: string;
  subcategories: SubCategory[];
}

// Type pour les URLs avec métadonnées de priorité (pour le tri)
interface UrlWithPriority {
  url: string;
  subcategory: string;
  hasItem: number;
}

/**
 * 🔧 19 CLUSTERS FAMILLES - Structure optimisée SEO
 *
 * Stratégie: 1 fichier HTML par famille avec sections H2 par sous-catégorie
 * Avantages:
 * - Link juice concentré (19 fichiers vs 73)
 * - Crawl budget optimal
 * - Autorité thématique forte
 *
 * Source: catalog_family → pieces_gamme
 */
const FAMILY_CLUSTERS: Record<string, FamilyClusterConfig> = {
  // ═══════════════════════════════════════════════════════════════════
  // FAMILLE 1: FILTRES
  // ═══════════════════════════════════════════════════════════════════
  filtres: {
    title: 'Filtres - Automecanik',
    description:
      'Tous les filtres automobile: huile, air, habitacle, carburant',
    subcategories: [
      { name: 'Filtre à huile', gamme_names: ['Filtre à huile'] },
      { name: 'Filtre à air', gamme_names: ['Filtre à air'] },
      { name: 'Filtre à carburant', gamme_names: ['Filtre à carburant'] },
      { name: "Filtre d'habitacle", gamme_names: ["Filtre d'habitacle"] },
      { name: 'Filtre de boîte auto', gamme_names: ['Filtre de boîte auto'] },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════
  // FAMILLE 2: FREINAGE
  // ═══════════════════════════════════════════════════════════════════
  freinage: {
    title: 'Freinage - Automecanik',
    description:
      'Système de freinage complet: plaquettes, disques, étriers, flexibles',
    subcategories: [
      { name: 'Plaquettes de frein', gamme_names: ['Plaquette de frein'] },
      { name: 'Disques de frein', gamme_names: ['Disque de frein'] },
      { name: 'Étriers de frein', gamme_names: ['Étrier de frein'] },
      {
        name: 'Mâchoires et kits arrière',
        gamme_names: ['Mâchoires de frein', 'Kit de freins arrière'],
      },
      { name: 'Capteurs ABS', gamme_names: ['Capteur ABS'] },
      {
        name: 'Flexibles et câbles',
        gamme_names: ['Flexible de frein', 'Câble de frein à main'],
      },
      {
        name: 'Maître cylindre et servo',
        gamme_names: [
          'Maître cylindre de frein',
          'Servo frein',
          'Cylindre de roue',
        ],
      },
      {
        name: 'Tambours et témoins',
        gamme_names: ['Tambour de frein', "Témoin d'usure"],
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════
  // FAMILLE 3: DISTRIBUTION
  // ═══════════════════════════════════════════════════════════════════
  distribution: {
    title: 'Distribution - Automecanik',
    description: 'Kits distribution, courroies, chaînes et pompes à eau',
    subcategories: [
      { name: 'Kit de distribution', gamme_names: ['Kit de distribution'] },
      {
        name: 'Courroie de distribution',
        gamme_names: ['Courroie de distribution'],
      },
      {
        name: 'Chaîne de distribution',
        gamme_names: [
          'Chaîne de distribution',
          'Kit de chaîne de distribution',
        ],
      },
      { name: "Courroie d'accessoire", gamme_names: ["Courroie d'accessoire"] },
      { name: 'Galet tendeur', gamme_names: ['Galet tendeur'] },
      { name: 'Pompe à eau', gamme_names: ['Pompe à eau'] },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════
  // FAMILLE 4: ALLUMAGE ET PRÉCHAUFFAGE
  // ═══════════════════════════════════════════════════════════════════
  allumage: {
    title: 'Allumage et Préchauffage - Automecanik',
    description: 'Bougies, bobines, faisceaux et préchauffage diesel',
    subcategories: [
      { name: "Bougies d'allumage", gamme_names: ["Bougie d'allumage"] },
      {
        name: 'Bougies de préchauffage',
        gamme_names: ['Bougie de préchauffage', 'Boîtier de préchauffage'],
      },
      { name: "Bobines d'allumage", gamme_names: ["Bobine d'allumage"] },
      { name: "Faisceaux d'allumage", gamme_names: ["Faisceau d'allumage"] },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════
  // FAMILLE 5: DIRECTION ET LIAISON AU SOL
  // ═══════════════════════════════════════════════════════════════════
  direction: {
    title: 'Direction et Liaison au sol - Automecanik',
    description: 'Rotules, bras, biellettes, roulements et crémaillères',
    subcategories: [
      {
        name: 'Rotules',
        gamme_names: ['Rotule de direction', 'Rotule de suspension'],
      },
      { name: 'Bras de suspension', gamme_names: ['Bras de suspension'] },
      {
        name: 'Biellettes stabilisatrices',
        gamme_names: [
          'Biellette de barre stabilisatrice',
          'Barre stabilisatrice',
        ],
      },
      {
        name: 'Roulements de roue',
        gamme_names: ['Roulement de roue', 'Moyeu de roue'],
      },
      {
        name: 'Crémaillère de direction',
        gamme_names: ['Crémaillière de direction'],
      },
      { name: 'Barres de direction', gamme_names: ['Barre de direction'] },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════
  // FAMILLE 6: SUSPENSION
  // ═══════════════════════════════════════════════════════════════════
  suspension: {
    title: 'Amortisseurs et Suspension - Automecanik',
    description: 'Amortisseurs, butées et ressorts de suspension',
    subcategories: [
      { name: 'Amortisseurs', gamme_names: ['Amortisseur'] },
      {
        name: 'Ressorts de suspension',
        gamme_names: ['Ressort de suspension'],
      },
      {
        name: 'Butées de suspension',
        gamme_names: [
          'Kit de butée de suspension',
          "Butée élastique d'amortisseur",
        ],
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════
  // FAMILLE 7: SUPPORT MOTEUR
  // ═══════════════════════════════════════════════════════════════════
  'support-moteur': {
    title: 'Support moteur - Automecanik',
    description: 'Supports moteur et boîte de vitesses',
    subcategories: [
      { name: 'Supports moteur', gamme_names: ['Support moteur'] },
      {
        name: 'Supports boîte de vitesse',
        gamme_names: ['Support de boîte vitesse'],
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════
  // FAMILLE 8: EMBRAYAGE
  // ═══════════════════════════════════════════════════════════════════
  embrayage: {
    title: 'Embrayage - Automecanik',
    description: 'Kits embrayage, butées, volants moteur et commandes',
    subcategories: [
      { name: "Kit d'embrayage", gamme_names: ["Kit d'embrayage"] },
      { name: 'Volant moteur', gamme_names: ['Volant moteur'] },
      { name: "Butée d'embrayage", gamme_names: ["Butée d'embrayage"] },
      {
        name: 'Commande embrayage',
        gamme_names: [
          "Emetteur d'embrayage",
          "Récepteur d'embrayage",
          "Câble d'embrayage",
        ],
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════
  // FAMILLE 9: TRANSMISSION
  // ═══════════════════════════════════════════════════════════════════
  transmission: {
    title: 'Transmission - Automecanik',
    description: 'Cardans, soufflets et transmissions',
    subcategories: [
      { name: 'Cardans', gamme_names: ['Cardan'] },
      {
        name: 'Soufflets de cardan',
        gamme_names: ['Soufflet de Cardan', "Bague d'étanchéité cardan"],
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════
  // FAMILLE 10: SYSTÈME ÉLECTRIQUE
  // ═══════════════════════════════════════════════════════════════════
  electrique: {
    title: 'Système électrique - Automecanik',
    description: 'Alternateurs, démarreurs et neimans',
    subcategories: [
      { name: 'Alternateurs', gamme_names: ['Alternateur'] },
      { name: 'Démarreurs', gamme_names: ['Démarreur'] },
      { name: 'Neimans', gamme_names: ['Neiman'] },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════
  // FAMILLE 11: CAPTEURS
  // ═══════════════════════════════════════════════════════════════════
  capteurs: {
    title: 'Capteurs - Automecanik',
    description: 'Tous les capteurs: ABS, vitesse, température, pression',
    subcategories: [
      { name: 'Capteurs vilebrequin', gamme_names: ['Capteur de vilebrequin'] },
      {
        name: 'Capteurs arbre à cames',
        gamme_names: ["Capteur d'arbre à cames"],
      },
      { name: 'Capteurs ABS', gamme_names: ['Capteur ABS'] },
      {
        name: 'Capteurs température',
        gamme_names: [
          "Capteur température d'eau",
          "Capteur température d'air admission",
          'Capteur température huile',
        ],
      },
      {
        name: 'Capteurs pression',
        gamme_names: [
          'Capteur de pression de suralimentation',
          'Capteur de pression Common Rail',
          "Capteur pression du tuyau d'admission",
        ],
      },
      {
        name: 'Autres capteurs',
        gamme_names: [
          'Capteur de cognement',
          "Capteur de pédale d'accélérateur",
          'Capteur position papillon',
          'Capteur de vitesse',
        ],
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════
  // FAMILLE 12: ALIMENTATION
  // ═══════════════════════════════════════════════════════════════════
  alimentation: {
    title: "Système d'alimentation - Automecanik",
    description: 'Débitmètres, vannes EGR, pompes et injecteurs',
    subcategories: [
      { name: 'Injecteurs', gamme_names: ['Injecteur'] },
      { name: 'Vannes EGR', gamme_names: ['Vanne EGR'] },
      {
        name: 'Pompes à carburant',
        gamme_names: ['Pompe à carburant', 'Pompe à injection'],
      },
      { name: "Débitmètres d'air", gamme_names: ["Débitmètre d'air"] },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════
  // FAMILLE 13: MOTEUR
  // ═══════════════════════════════════════════════════════════════════
  moteur: {
    title: 'Moteur - Automecanik',
    description: 'Joints, culasses, carters et pièces moteur',
    subcategories: [
      { name: 'Joints de culasse', gamme_names: ['Joint de culasse'] },
      { name: "Carters d'huile", gamme_names: ["Carter d'huile"] },
      {
        name: 'Joints et couvercles',
        gamme_names: [
          'Joint de cache culbuteurs',
          'Couvre culasse',
          'Joint cache culbuteur',
        ],
      },
      {
        name: 'Pièces moteur',
        gamme_names: [
          'Arbre à came',
          'Culasse',
          'Chemise de cylindre',
          'Poussoir',
        ],
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════
  // FAMILLE 14: REFROIDISSEMENT
  // ═══════════════════════════════════════════════════════════════════
  refroidissement: {
    title: 'Refroidissement - Automecanik',
    description: 'Pompes à eau, radiateurs, thermostats et durits',
    subcategories: [
      { name: 'Pompes à eau', gamme_names: ['Pompe à eau'] },
      { name: 'Radiateurs', gamme_names: ['Radiateur de refroidissement'] },
      { name: 'Thermostats', gamme_names: ['Thermostat'] },
      {
        name: 'Durits et vases',
        gamme_names: [
          'Durite de refroidissement',
          "Vase d'expansion",
          'Bouchon de radiateur',
        ],
      },
      { name: 'Motoventilateurs', gamme_names: ['Motoventilateur'] },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════
  // FAMILLE 15: CLIMATISATION
  // ═══════════════════════════════════════════════════════════════════
  climatisation: {
    title: 'Climatisation - Automecanik',
    description: 'Compresseurs, condenseurs, évaporateurs et détendeurs',
    subcategories: [
      {
        name: 'Compresseurs de clim',
        gamme_names: ['Compresseur de climatisation'],
      },
      { name: 'Condenseurs', gamme_names: ['Condenseur de climatisation'] },
      { name: 'Évaporateurs', gamme_names: ['Evaporateur de climatisation'] },
      {
        name: 'Détendeurs et bouteilles',
        gamme_names: ['Détendeur de climatisation', 'Bouteille déshydratante'],
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════
  // FAMILLE 16: ÉCHAPPEMENT
  // ═══════════════════════════════════════════════════════════════════
  echappement: {
    title: 'Échappement - Automecanik',
    description: 'Silencieux, catalyseurs, FAP et sondes lambda',
    subcategories: [
      { name: 'Catalyseurs', gamme_names: ['Catalyseur'] },
      { name: 'FAP', gamme_names: ['FAP'] },
      { name: 'Sondes lambda', gamme_names: ['Sonde lambda'] },
      {
        name: 'Silencieux et tubes',
        gamme_names: ['Silencieux', "Tube d'échappement"],
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════
  // FAMILLE 17: ÉCLAIRAGE
  // ═══════════════════════════════════════════════════════════════════
  eclairage: {
    title: 'Éclairage - Automecanik',
    description: 'Feux avant, arrière, clignotants et commandes',
    subcategories: [
      { name: 'Phares et feux avant', gamme_names: ['Feu avant'] },
      { name: 'Feux arrière', gamme_names: ['Feu arrière'] },
      { name: 'Clignotants', gamme_names: ['Feu clignotant'] },
      { name: "Commandes d'éclairage", gamme_names: ["Commande d'éclairage"] },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════
  // FAMILLE 18: ACCESSOIRES
  // ═══════════════════════════════════════════════════════════════════
  accessoires: {
    title: 'Accessoires - Automecanik',
    description: 'Balais essuie-glace, rétroviseurs, lève-vitres et attelages',
    subcategories: [
      { name: 'Essuie-glaces', gamme_names: ["Balais d'essuie-glace"] },
      { name: 'Rétroviseurs', gamme_names: ['Rétroviseur extérieur'] },
      { name: 'Lève-vitres', gamme_names: ['Lève-vitre'] },
      { name: 'Attelages', gamme_names: ['Attelage'] },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════
  // FAMILLE 19: TURBO
  // ═══════════════════════════════════════════════════════════════════
  turbo: {
    title: 'Turbo - Automecanik',
    description: 'Turbos et intercoolers',
    subcategories: [
      { name: 'Turbos', gamme_names: ['Turbo'] },
      { name: 'Intercoolers', gamme_names: ['Intercooler'] },
    ],
  },
};

// Legacy: Garder pour compatibilité (sera supprimé)
export interface ClusterConfig {
  title: string;
  description: string;
  gamme_slugs: string[];
}

// Convertir FAMILY_CLUSTERS en ancien format pour compatibilité temporaire
const CLUSTER_CONFIGS: Record<string, ClusterConfig> = Object.fromEntries(
  Object.entries(FAMILY_CLUSTERS).map(([slug, config]) => [
    slug,
    {
      title: config.title,
      description: config.description,
      gamme_slugs: config.subcategories.flatMap((sub) => sub.gamme_names),
    },
  ]),
);

// Les anciens sub-clusters ont été supprimés - tout est maintenant dans les 19 familles FAMILY_CLUSTERS

export interface HubGenerationResult {
  success: boolean;
  hubType: HubType;
  urlCount: number;
  filePath: string;
  error?: string;
}

// Configuration des hubs
const HUB_CONFIGS: Record<HubType, HubConfig> = {
  money: {
    title: 'Pages prioritaires - Automecanik',
    description: 'Pages produits à fort trafic et conversion',
    bucket: 'hot',
    maxUrls: 5000,
  },
  'new-pages': {
    title: 'Nouvelles pages - Automecanik',
    description: 'Pages récemment publiées ou mises à jour',
    bucket: 'new',
    maxUrls: 1000,
  },
  stabilize: {
    title: 'Pages à stabiliser (J7) - Automecanik',
    description: 'Pages indexées depuis 7 jours nécessitant stabilisation',
    maxUrls: 2000,
  },
  gammes: {
    title: 'Catégories pièces auto - Automecanik',
    description: 'Toutes les catégories de pièces automobiles',
    pageTypes: ['category', 'canonical'],
    maxUrls: 500,
  },
  vehicules: {
    title: 'Véhicules compatibles - Automecanik',
    description: 'Toutes les marques et modèles de véhicules',
    pageTypes: ['listing', 'hub'],
    maxUrls: 2000,
  },
  clusters: {
    title: 'Groupes thématiques - Automecanik',
    description: 'Pages regroupées par thème',
    bucket: 'stable',
    maxUrls: 3000,
  },
};

@Injectable()
export class SitemapV10HubsService {
  private readonly logger = new Logger(SitemapV10HubsService.name);
  private readonly supabase: SupabaseClient;
  private readonly BASE_URL: string;
  private readonly OUTPUT_DIR: string;

  constructor(private configService: ConfigService) {
    const appConfig = getAppConfig();

    const supabaseUrl =
      this.configService.get<string>('SUPABASE_URL') || appConfig.supabase.url;
    const supabaseKey =
      this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY') ||
      appConfig.supabase.serviceKey;

    this.supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    this.BASE_URL =
      this.configService.get<string>('BASE_URL') ||
      'https://www.automecanik.com';
    this.OUTPUT_DIR =
      this.configService.get<string>('CRAWL_HUBS_DIR') || '/var/www/crawl-hubs';

    this.logger.log('🔗 SitemapV10HubsService initialized');
    this.logger.log(`   Output: ${this.OUTPUT_DIR}`);
  }

  /**
   * Génère tous les hubs de crawl
   */
  async generateAllHubs(): Promise<HubGenerationResult[]> {
    this.logger.log('🚀 Generating all crawl hubs...');

    const results: HubGenerationResult[] = [];
    const hubTypes: HubType[] = ['money', 'new-pages', 'gammes', 'vehicules'];

    // Générer les hubs principaux
    for (const hubType of hubTypes) {
      try {
        const result = await this.generateHub(hubType);
        results.push(result);
      } catch (error) {
        this.logger.error(`Failed to generate ${hubType} hub:`, error);
        results.push({
          success: false,
          hubType,
          urlCount: 0,
          filePath: '',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // Générer les clusters thématiques (arme SEO la plus puissante!)
    const clusterResults = await this.generateClusterHubs();
    results.push(...clusterResults);

    // Générer l'index des hubs (inclut les clusters)
    await this.generateHubIndex(results);

    return results;
  }

  /**
   * Génère un hub spécifique
   */
  async generateHub(hubType: HubType): Promise<HubGenerationResult> {
    const config = HUB_CONFIGS[hubType];
    this.logger.log(`📝 Generating ${hubType} hub...`);

    try {
      // Récupérer les URLs selon la config
      let urls: string[] = [];

      if (config.bucket) {
        // Récupérer par bucket de température
        const { data, error } = await this.supabase.rpc(
          'get_sitemap_urls_by_temperature',
          {
            p_temperature: config.bucket,
            p_limit: config.maxUrls,
            p_offset: 0,
          },
        );

        if (error) throw new Error(error.message);
        urls = (data || []).map((row: { url: string }) =>
          row.url.startsWith('http') ? row.url : `${this.BASE_URL}${row.url}`,
        );
      } else if (config.pageTypes) {
        // Récupérer par type de page
        const { data, error } = await this.supabase
          .from('__seo_page')
          .select('url')
          .in('page_type', config.pageTypes)
          .eq('is_indexable_hint', true)
          .limit(config.maxUrls);

        if (error) throw new Error(error.message);
        urls = (data || []).map((row) =>
          row.url.startsWith('http') ? row.url : `${this.BASE_URL}${row.url}`,
        );
      }

      if (urls.length === 0) {
        this.logger.warn(`   No URLs found for ${hubType} hub`);
      }

      // Générer le fichier HTML
      const filePath = await this.writeHubFile(hubType, config, urls);

      // Enregistrer dans la table d'audit
      await this.logHubGeneration(
        hubType,
        config.bucket || 'all',
        urls.length,
        filePath,
      );

      this.logger.log(`   ✓ Generated ${hubType}.html (${urls.length} URLs)`);

      return {
        success: true,
        hubType,
        urlCount: urls.length,
        filePath,
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Écrit un fichier hub HTML
   */
  private async writeHubFile(
    hubType: HubType,
    config: HubConfig,
    urls: string[],
  ): Promise<string> {
    const dirPath = path.join(this.OUTPUT_DIR, config.bucket || 'all');
    const filePath = path.join(dirPath, `${hubType}.html`);

    await fs.mkdir(dirPath, { recursive: true });

    const links = urls
      .map(
        (url) =>
          `    <li><a href="${this.htmlEscape(url)}">${this.htmlEscape(url)}</a></li>`,
      )
      .join('\n');

    const signature = this.generateSignature(urls.length, 'v10-hub');
    const html = `<!DOCTYPE html>
${signature}
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="robots" content="noindex, follow">
  <title>${this.htmlEscape(config.title)}</title>
  <meta name="description" content="${this.htmlEscape(config.description)}">
  <style>
    body { font-family: system-ui, sans-serif; max-width: 1200px; margin: 0 auto; padding: 20px; }
    h1 { color: #1a1a1a; border-bottom: 2px solid #e53e3e; padding-bottom: 10px; }
    p.meta { color: #666; font-size: 14px; }
    ul { column-count: 2; column-gap: 40px; list-style: none; padding: 0; }
    li { margin-bottom: 8px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    a { color: #2563eb; text-decoration: none; }
    a:hover { text-decoration: underline; }
    @media (max-width: 768px) { ul { column-count: 1; } }
  </style>
</head>
<body>
  <h1>${this.htmlEscape(config.title)}</h1>
  <p class="meta">${urls.length} liens - Mis à jour le ${new Date().toISOString().split('T')[0]}</p>
  <p>${this.htmlEscape(config.description)}</p>
  <ul>
${links}
  </ul>
  <p><a href="/__crawl__/index.html">← Retour à l'index</a></p>
</body>
</html>`;

    await fs.writeFile(filePath, html, 'utf8');
    return filePath;
  }

  /**
   * Génère l'index des hubs
   */
  private async generateHubIndex(
    results: HubGenerationResult[],
  ): Promise<void> {
    const indexPath = path.join(this.OUTPUT_DIR, 'index.html');

    // Séparer les hubs principaux des clusters
    const mainHubs = results.filter((r) => r.success && HUB_CONFIGS[r.hubType]);
    const clusterHubs = results.filter(
      (r) => r.success && CLUSTER_CONFIGS[r.hubType as string],
    );

    const hubLinks = mainHubs
      .map((r) => {
        const config = HUB_CONFIGS[r.hubType];
        const relativePath = r.filePath.replace(this.OUTPUT_DIR, '');
        return `    <li>
      <a href="/__crawl__${relativePath}"><strong>${this.htmlEscape(config.title)}</strong></a>
      <br><span class="meta">${r.urlCount} liens - ${this.htmlEscape(config.description)}</span>
    </li>`;
      })
      .join('\n');

    const clusterLinks = clusterHubs
      .map((r) => {
        const config = CLUSTER_CONFIGS[r.hubType as string];
        const relativePath = r.filePath.replace(this.OUTPUT_DIR, '');
        return `    <li>
      <a href="/__crawl__${relativePath}"><strong>${this.htmlEscape(config.title)}</strong></a>
      <br><span class="meta">${r.urlCount} liens - ${this.htmlEscape(config.description)}</span>
    </li>`;
      })
      .join('\n');

    const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="robots" content="noindex, follow">
  <title>Index des hubs de crawl - Automecanik</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
    h1 { color: #1a1a1a; }
    h2 { color: #333; margin-top: 30px; border-bottom: 1px solid #e53e3e; padding-bottom: 8px; }
    ul { list-style: none; padding: 0; }
    li { margin-bottom: 20px; padding: 15px; background: #f9f9f9; border-radius: 8px; }
    a { color: #2563eb; text-decoration: none; font-size: 18px; }
    a:hover { text-decoration: underline; }
    .meta { color: #666; font-size: 13px; }
    .clusters { background: #fff3e0; }
  </style>
</head>
<body>
  <h1>Hubs de crawl - Automecanik</h1>
  <p>Pages de liens internes pour faciliter le crawl du site.</p>

  <h2>📂 Hubs principaux</h2>
  <ul>
${hubLinks}
  </ul>

  <h2>🔥 Clusters thématiques (19 familles)</h2>
  <p>Les clusters regroupent les pages par famille de produits - basés sur la hiérarchie officielle catalog_family.</p>
  <ul class="clusters">
${clusterLinks}
  </ul>

  <p><a href="${this.BASE_URL}">← Retour au site</a></p>
</body>
</html>`;

    await fs.mkdir(this.OUTPUT_DIR, { recursive: true });
    await fs.writeFile(indexPath, html, 'utf8');
    this.logger.log(`   ✓ Generated hub index: ${indexPath}`);
  }

  /**
   * Enregistre la génération dans la table d'audit
   */
  private async logHubGeneration(
    hubType: HubType,
    bucket: string,
    urlCount: number,
    filePath: string,
  ): Promise<void> {
    try {
      // Use filePath if it looks like a relative path, otherwise build from bucket/hubType
      const normalizedPath = filePath.startsWith('/')
        ? filePath
        : `/__crawl__/${bucket}/${hubType}.html`;

      await this.supabase.from('__seo_crawl_hub').upsert(
        {
          path: normalizedPath,
          bucket,
          hub_type: hubType === 'new-pages' ? 'new' : hubType,
          urls_count: urlCount,
          generated_at: new Date().toISOString(),
        },
        { onConflict: 'path' },
      );
    } catch (error) {
      this.logger.warn(`Failed to log hub generation: ${error}`);
    }
  }

  /**
   * Génère les hubs de clusters thématiques (19 familles avec sections H2)
   *
   * 🔧 Structure: 1 fichier HTML par famille avec sections H2 par sous-catégorie
   *
   * Flow:
   * 1. Pour chaque famille, itère sur ses sous-catégories
   * 2. Récupère pg_id depuis pieces_gamme pour chaque sous-catégorie
   * 3. Filtre __sitemap_p_link par map_pg_id (avec thin content filter)
   * 4. Génère HTML avec H2 pour chaque sous-catégorie
   */
  async generateClusterHubs(): Promise<HubGenerationResult[]> {
    this.logger.log(
      '🔗 Generating cluster hubs (19 familles avec sections H2)...',
    );
    this.logger.log('   📦 Source: __sitemap_p_link (714k URLs)');
    const results: HubGenerationResult[] = [];

    for (const [slug, familyConfig] of Object.entries(FAMILY_CLUSTERS)) {
      try {
        // Collecter les URLs par sous-catégorie
        const subcategoryData: Array<{
          name: string;
          urls: string[];
          pgIds: string[];
        }> = [];

        let totalUrls = 0;

        for (const subcategory of familyConfig.subcategories) {
          // 1. Récupérer les pg_id pour cette sous-catégorie (INDEX uniquement!)
          const { data: gammes, error: gammeError } = await this.supabase
            .from('pieces_gamme')
            .select('pg_id')
            .in('pg_name', subcategory.gamme_names)
            .eq('pg_display', '1')
            .eq('pg_relfollow', '1'); // ⚠️ IMPORTANT: Seulement les gammes INDEX

          if (gammeError) {
            this.logger.warn(
              `   ⚠️ Gamme lookup failed for ${subcategory.name}: ${gammeError.message}`,
            );
            continue;
          }

          const pgIds = (gammes || []).map((g) => String(g.pg_id));

          if (pgIds.length === 0) {
            this.logger.debug(
              `   No gammes found for subcategory ${subcategory.name}`,
            );
            continue;
          }

          // 2. Récupérer TOUTES les pièces depuis __sitemap_p_link (pagination pour dépasser limite 1000)
          const allPieces: Array<{
            map_pg_alias: string;
            map_pg_id: string;
            map_marque_alias: string;
            map_marque_id: string;
            map_modele_alias: string;
            map_modele_id: string;
            map_type_alias: string;
            map_type_id: string;
          }> = [];

          const PAGE_SIZE = 1000;
          let offset = 0;
          let hasMore = true;

          while (hasMore) {
            const { data: pieces, error: piecesError } = await this.supabase
              .from('__sitemap_p_link')
              .select(
                'map_pg_alias, map_pg_id, map_marque_alias, map_marque_id, map_modele_alias, map_modele_id, map_type_alias, map_type_id',
              )
              .in('map_pg_id', pgIds)
              .gt('map_has_item', 5) // Filtre thin content
              .range(offset, offset + PAGE_SIZE - 1);

            if (piecesError) {
              this.logger.warn(
                `   ⚠️ Pieces fetch failed for ${subcategory.name}: ${piecesError.message}`,
              );
              break;
            }

            if (pieces && pieces.length > 0) {
              allPieces.push(...pieces);
              offset += PAGE_SIZE;
              hasMore = pieces.length === PAGE_SIZE;
            } else {
              hasMore = false;
            }
          }

          // 3. Construire les URLs au format V10
          const urls = allPieces.map(
            (p) =>
              `${this.BASE_URL}/pieces/${p.map_pg_alias}-${p.map_pg_id}/${p.map_marque_alias}-${p.map_marque_id}/${p.map_modele_alias}-${p.map_modele_id}/${p.map_type_alias}-${p.map_type_id}.html`,
          );

          if (urls.length > 0) {
            subcategoryData.push({
              name: subcategory.name,
              urls,
              pgIds,
            });
            totalUrls += urls.length;
          }
        }

        // Écrire le fichier hub avec sections H2
        const filePath = await this.writeClusterHubFileWithH2(
          slug,
          familyConfig,
          subcategoryData,
        );

        results.push({
          success: true,
          hubType: slug as HubType,
          urlCount: totalUrls,
          filePath,
        });

        const subcatSummary = subcategoryData
          .map((s) => `${s.name}(${s.urls.length})`)
          .join(', ');
        this.logger.log(
          `   ✓ ${slug}.html: ${totalUrls} URLs (${subcategoryData.length} H2: ${subcatSummary})`,
        );
      } catch (error) {
        this.logger.error(`Failed to generate cluster ${slug}:`, error);
        results.push({
          success: false,
          hubType: slug as HubType,
          urlCount: 0,
          filePath: '',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return results;
  }

  /**
   * Écrit un fichier hub HTML avec sections H2 par sous-catégorie
   */
  private async writeClusterHubFileWithH2(
    slug: string,
    config: FamilyClusterConfig,
    subcategoryData: Array<{ name: string; urls: string[]; pgIds: string[] }>,
  ): Promise<string> {
    const dirPath = path.join(this.OUTPUT_DIR, 'clusters');
    const filePath = path.join(dirPath, `${slug}.html`);

    await fs.mkdir(dirPath, { recursive: true });

    // Générer la navigation interne
    const navLinks = subcategoryData
      .map((sub) => {
        const anchorId = this.slugify(sub.name);
        return `<a href="#${anchorId}">${this.htmlEscape(sub.name)} (${sub.urls.length})</a>`;
      })
      .join(' | ');

    // Générer les sections H2 avec leurs liens
    const sections = subcategoryData
      .map((sub) => {
        const anchorId = this.slugify(sub.name);
        const links = sub.urls
          .map(
            (url) =>
              `      <li><a href="${this.htmlEscape(url)}">${this.htmlEscape(url)}</a></li>`,
          )
          .join('\n');

        return `  <h2 id="${anchorId}">${this.htmlEscape(sub.name)}</h2>
    <p class="subcat-meta">${sub.urls.length} liens</p>
    <ul>
${links}
    </ul>`;
      })
      .join('\n\n');

    const totalUrls = subcategoryData.reduce(
      (sum, s) => sum + s.urls.length,
      0,
    );

    const signature = this.generateSignature(totalUrls, 'v10-cluster-h2');
    const html = `<!DOCTYPE html>
${signature}
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="robots" content="noindex, follow">
  <title>${this.htmlEscape(config.title)}</title>
  <meta name="description" content="${this.htmlEscape(config.description)}">
  <style>
    body { font-family: system-ui, sans-serif; max-width: 1200px; margin: 0 auto; padding: 20px; }
    h1 { color: #1a1a1a; border-bottom: 2px solid #e53e3e; padding-bottom: 10px; }
    h2 { color: #333; margin-top: 40px; padding-bottom: 8px; border-bottom: 1px solid #ddd; }
    p.meta { color: #666; font-size: 14px; }
    p.subcat-meta { color: #888; font-size: 12px; margin-top: -10px; }
    nav { background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0; line-height: 2; }
    nav a { color: #2563eb; text-decoration: none; margin: 0 5px; }
    nav a:hover { text-decoration: underline; }
    ul { column-count: 2; column-gap: 40px; list-style: none; padding: 0; }
    li { margin-bottom: 8px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    a { color: #2563eb; text-decoration: none; }
    a:hover { text-decoration: underline; }
    @media (max-width: 768px) { ul { column-count: 1; } }
  </style>
</head>
<body>
  <h1>${this.htmlEscape(config.title)}</h1>
  <p class="meta">${totalUrls} liens - ${subcategoryData.length} sous-catégories - Mis à jour le ${new Date().toISOString().split('T')[0]}</p>
  <p>${this.htmlEscape(config.description)}</p>

  <nav>
    <strong>Navigation :</strong> ${navLinks}
  </nav>

${sections}

  <p style="margin-top: 40px;"><a href="/__crawl__/index.html">← Retour à l'index</a></p>
</body>
</html>`;

    await fs.writeFile(filePath, html, 'utf8');
    return filePath;
  }

  /**
   * Convertit un nom en slug pour les ancres
   */
  private slugify(str: string): string {
    return str
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Supprime les accents
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  /**
   * Escape HTML entities
   */
  private htmlEscape(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /**
   * Génère une signature de version pour les fichiers hub
   * Permet de tracer la source et le moment de génération
   */
  private generateSignature(
    urlCount: number,
    pipeline: string = 'v10-robust',
  ): string {
    return `
<!-- ═══════════════════════════════════════════════════════════ -->
<!-- Hub generated by SitemapV10HubsService -->
<!-- Pipeline: ${pipeline} -->
<!-- Generated: ${new Date().toISOString()} -->
<!-- URLs: ${urlCount} -->
<!-- ═══════════════════════════════════════════════════════════ -->`;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 📂 PAGINATION DES CLUSTER HUBS (STRATÉGIE ROBUSTE)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * 🚀 Génère tous les hubs de clusters avec pagination
   * Remplace generateClusterHubs() pour les mega-hubs
   *
   * Structure générée:
   * clusters/
   * ├── index.html              (index global)
   * ├── freinage/
   * │   ├── index.html          (index famille)
   * │   ├── part-001.html       (5000 URLs)
   * │   ├── part-002.html       (5000 URLs)
   * │   └── ...
   * └── ...
   */
  async generatePaginatedClusterHubs(): Promise<HubGenerationResult[]> {
    this.logger.log(
      '🚀 Generating PAGINATED cluster hubs (max 5k URLs/file)...',
    );
    const results: HubGenerationResult[] = [];
    const allClusterStats: Array<{
      slug: string;
      title: string;
      totalUrls: number;
      partsCount: number;
      subcategories: Array<{ name: string; count: number }>;
    }> = [];

    for (const [slug, familyConfig] of Object.entries(FAMILY_CLUSTERS)) {
      try {
        // 1. Collecter TOUTES les URLs pour cette famille avec métadonnées
        const { urls, subcategoryStats } =
          await this.collectFamilyUrlsWithMetadata(familyConfig);

        if (urls.length === 0) {
          this.logger.warn(`   ⚠️ No URLs for ${slug}`);
          continue;
        }

        // 2. Trier par priorité (hasItem décroissant = plus de produits = plus important)
        const sortedUrls = this.sortUrlsByPriority(urls);

        // 3. Créer le dossier du cluster
        const clusterDir = path.join(this.OUTPUT_DIR, 'clusters', slug);
        await fs.mkdir(clusterDir, { recursive: true });

        // 4. Paginer en parts de 5000
        const parts = this.chunkArray(sortedUrls, MAX_URLS_PER_PART);
        const partsCount = parts.length;

        // 5. Écrire chaque fichier part
        for (let i = 0; i < parts.length; i++) {
          const partNum = String(i + 1).padStart(3, '0');
          await this.writePartFile(
            slug,
            partNum,
            parts[i],
            familyConfig,
            i,
            partsCount,
            urls.length,
          );
        }

        // 6. Écrire l'index du cluster
        await this.writeClusterIndexFile(
          slug,
          familyConfig,
          subcategoryStats,
          partsCount,
          urls.length,
        );

        // 7. Collecter les stats pour l'index global
        allClusterStats.push({
          slug,
          title: familyConfig.title,
          totalUrls: urls.length,
          partsCount,
          subcategories: subcategoryStats,
        });

        results.push({
          success: true,
          hubType: slug as HubType,
          urlCount: urls.length,
          filePath: `clusters/${slug}/index.html`,
        });

        this.logger.log(
          `   ✓ ${slug}/ : ${urls.length.toLocaleString()} URLs → ${partsCount} parts`,
        );
      } catch (error) {
        this.logger.error(
          `Failed to generate paginated cluster ${slug}:`,
          error,
        );
        results.push({
          success: false,
          hubType: slug as HubType,
          urlCount: 0,
          filePath: '',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // 7. Écrire l'index global des clusters
    await this.writeGlobalClusterIndexFile(allClusterStats);

    const totalUrls = allClusterStats.reduce((sum, c) => sum + c.totalUrls, 0);
    const totalParts = allClusterStats.reduce(
      (sum, c) => sum + c.partsCount,
      0,
    );
    this.logger.log(
      `✅ Paginated hubs complete: ${totalUrls.toLocaleString()} URLs in ${totalParts} files`,
    );

    return results;
  }

  /**
   * Collecte toutes les URLs d'une famille avec métadonnées pour le tri
   */
  private async collectFamilyUrlsWithMetadata(
    familyConfig: FamilyClusterConfig,
  ): Promise<{
    urls: UrlWithPriority[];
    subcategoryStats: Array<{ name: string; count: number }>;
  }> {
    const allUrls: UrlWithPriority[] = [];
    const subcategoryStats: Array<{ name: string; count: number }> = [];

    for (const subcategory of familyConfig.subcategories) {
      // 1. Récupérer les pg_id pour cette sous-catégorie (INDEX uniquement)
      const { data: gammes, error: gammeError } = await this.supabase
        .from('pieces_gamme')
        .select('pg_id')
        .in('pg_name', subcategory.gamme_names)
        .eq('pg_display', '1')
        .eq('pg_relfollow', '1'); // INDEX only

      if (gammeError || !gammes || gammes.length === 0) continue;

      const pgIds = gammes.map((g) => String(g.pg_id));

      // 2. Pagination complète pour récupérer TOUTES les URLs
      const PAGE_SIZE = 1000;
      let offset = 0;
      let hasMore = true;
      let subcatCount = 0;

      while (hasMore) {
        const { data: pieces, error } = await this.supabase
          .from('__sitemap_p_link')
          .select(
            'map_pg_alias, map_pg_id, map_marque_alias, map_marque_id, map_modele_alias, map_modele_id, map_type_alias, map_type_id, map_has_item',
          )
          .in('map_pg_id', pgIds)
          .gt('map_has_item', 5)
          .range(offset, offset + PAGE_SIZE - 1);

        if (error || !pieces || pieces.length === 0) {
          hasMore = false;
          break;
        }

        for (const p of pieces) {
          allUrls.push({
            url: `${this.BASE_URL}/pieces/${p.map_pg_alias}-${p.map_pg_id}/${p.map_marque_alias}-${p.map_marque_id}/${p.map_modele_alias}-${p.map_modele_id}/${p.map_type_alias}-${p.map_type_id}.html`,
            subcategory: subcategory.name,
            hasItem: p.map_has_item || 0,
          });
          subcatCount++;
        }

        offset += PAGE_SIZE;
        hasMore = pieces.length === PAGE_SIZE;
      }

      if (subcatCount > 0) {
        subcategoryStats.push({ name: subcategory.name, count: subcatCount });
      }
    }

    return { urls: allUrls, subcategoryStats };
  }

  /**
   * Trie les URLs par priorité (plus de produits = plus prioritaire)
   */
  private sortUrlsByPriority(urls: UrlWithPriority[]): UrlWithPriority[] {
    return [...urls].sort((a, b) => b.hasItem - a.hasItem);
  }

  /**
   * Découpe un tableau en chunks de taille fixe
   */
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * Écrit un fichier part (ex: part-001.html)
   */
  private async writePartFile(
    slug: string,
    partNum: string,
    urls: UrlWithPriority[],
    config: FamilyClusterConfig,
    partIndex: number,
    totalParts: number,
    totalUrls: number,
  ): Promise<string> {
    const filePath = path.join(
      this.OUTPUT_DIR,
      'clusters',
      slug,
      `part-${partNum}.html`,
    );
    const startIdx = partIndex * MAX_URLS_PER_PART + 1;
    const endIdx = Math.min(startIdx + urls.length - 1, totalUrls);

    // Navigation entre parts
    const prevPart =
      partIndex > 0 ? `part-${String(partIndex).padStart(3, '0')}.html` : null;
    const nextPart =
      partIndex < totalParts - 1
        ? `part-${String(partIndex + 2).padStart(3, '0')}.html`
        : null;

    const navPrev = prevPart
      ? `<a href="${prevPart}">← Part ${partIndex}</a>`
      : '';
    const navNext = nextPart
      ? `<a href="${nextPart}">Part ${partIndex + 2} →</a>`
      : '';
    const navCurrent = `<strong>Part ${partIndex + 1}</strong>`;

    const links = urls
      .map(
        (u) =>
          `    <li><a href="${this.htmlEscape(u.url)}">${this.htmlEscape(u.url)}</a></li>`,
      )
      .join('\n');

    const signature = this.generateSignature(urls.length, 'v10-part');
    const html = `<!DOCTYPE html>
${signature}
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="robots" content="noindex, follow">
  <title>${this.htmlEscape(config.title)} - Part ${partIndex + 1}/${totalParts}</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 1200px; margin: 0 auto; padding: 20px; }
    h1 { color: #1a1a1a; border-bottom: 2px solid #e53e3e; padding-bottom: 10px; }
    .meta { color: #666; font-size: 14px; }
    nav { background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0; display: flex; justify-content: space-between; }
    nav a { color: #2563eb; text-decoration: none; }
    nav a:hover { text-decoration: underline; }
    ul { column-count: 2; column-gap: 40px; list-style: none; padding: 0; }
    li { margin-bottom: 8px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    a { color: #2563eb; text-decoration: none; }
    a:hover { text-decoration: underline; }
    @media (max-width: 768px) { ul { column-count: 1; } }
  </style>
</head>
<body>
  <h1>${this.htmlEscape(config.title)} - Partie ${partIndex + 1}/${totalParts}</h1>
  <p class="meta">${urls.length.toLocaleString()} liens (URLs ${startIdx.toLocaleString()} à ${endIdx.toLocaleString()} sur ${totalUrls.toLocaleString()})</p>

  <nav>
    <span>${navPrev}</span>
    <a href="index.html">Index ${slug}</a>
    <span>${navCurrent}</span>
    <span>${navNext}</span>
  </nav>

  <ul>
${links}
  </ul>

  <nav>
    <span>${navPrev}</span>
    <a href="index.html">Index ${slug}</a>
    <span>${navCurrent}</span>
    <span>${navNext}</span>
  </nav>
</body>
</html>`;

    await fs.writeFile(filePath, html, 'utf8');
    return filePath;
  }

  /**
   * Écrit l'index d'un cluster (ex: clusters/freinage/index.html)
   */
  private async writeClusterIndexFile(
    slug: string,
    config: FamilyClusterConfig,
    subcategoryStats: Array<{ name: string; count: number }>,
    partsCount: number,
    totalUrls: number,
  ): Promise<string> {
    const filePath = path.join(this.OUTPUT_DIR, 'clusters', slug, 'index.html');

    // Liste des sous-catégories
    const subcatLinks = subcategoryStats
      .map(
        (s) =>
          `<li>${this.htmlEscape(s.name)} (${s.count.toLocaleString()} URLs)</li>`,
      )
      .join('\n    ');

    // Liste des parts
    const partLinks: string[] = [];
    for (let i = 0; i < partsCount; i++) {
      const partNum = String(i + 1).padStart(3, '0');
      const startIdx = i * MAX_URLS_PER_PART + 1;
      const endIdx = Math.min((i + 1) * MAX_URLS_PER_PART, totalUrls);
      partLinks.push(
        `<li><a href="part-${partNum}.html">Part ${i + 1}</a> - URLs ${startIdx.toLocaleString()} à ${endIdx.toLocaleString()}</li>`,
      );
    }

    const signature = this.generateSignature(totalUrls, 'v10-cluster-index');
    const html = `<!DOCTYPE html>
${signature}
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="robots" content="noindex, follow">
  <title>Index ${this.htmlEscape(config.title)}</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
    h1 { color: #1a1a1a; border-bottom: 2px solid #e53e3e; padding-bottom: 10px; }
    h2 { color: #333; margin-top: 30px; }
    .meta { color: #666; font-size: 14px; }
    ul { list-style: none; padding: 0; }
    li { margin-bottom: 10px; padding: 10px; background: #f9f9f9; border-radius: 5px; }
    a { color: #2563eb; text-decoration: none; font-weight: 500; }
    a:hover { text-decoration: underline; }
    .parts li { background: #e8f4fd; }
  </style>
</head>
<body>
  <h1>${this.htmlEscape(config.title)} - Index</h1>
  <p class="meta">${totalUrls.toLocaleString()} URLs répartis sur ${partsCount} fichiers</p>
  <p>${this.htmlEscape(config.description)}</p>

  <h2>📂 Sous-catégories</h2>
  <ul>
    ${subcatLinks}
  </ul>

  <h2>📄 Fichiers</h2>
  <ul class="parts">
    ${partLinks.join('\n    ')}
  </ul>

  <p><a href="../index.html">← Index Clusters</a></p>
</body>
</html>`;

    await fs.writeFile(filePath, html, 'utf8');
    return filePath;
  }

  /**
   * Écrit l'index global des clusters (clusters/index.html)
   */
  private async writeGlobalClusterIndexFile(
    clusterStats: Array<{
      slug: string;
      title: string;
      totalUrls: number;
      partsCount: number;
      subcategories: Array<{ name: string; count: number }>;
    }>,
  ): Promise<string> {
    const filePath = path.join(this.OUTPUT_DIR, 'clusters', 'index.html');
    await fs.mkdir(path.join(this.OUTPUT_DIR, 'clusters'), { recursive: true });

    const totalUrls = clusterStats.reduce((sum, c) => sum + c.totalUrls, 0);
    const totalParts = clusterStats.reduce((sum, c) => sum + c.partsCount, 0);

    // Liste des clusters triés par nombre d'URLs décroissant
    const sortedClusters = [...clusterStats].sort(
      (a, b) => b.totalUrls - a.totalUrls,
    );
    const clusterLinks = sortedClusters
      .map(
        (c) => `
    <li>
      <a href="${c.slug}/index.html"><strong>${this.htmlEscape(c.title)}</strong></a>
      <br><span class="meta">${c.totalUrls.toLocaleString()} URLs → ${c.partsCount} fichiers</span>
    </li>`,
      )
      .join('\n');

    const signature = this.generateSignature(
      totalUrls,
      'v10-global-cluster-index',
    );
    const html = `<!DOCTYPE html>
${signature}
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="robots" content="noindex, follow">
  <title>Index des Clusters - Automecanik</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 900px; margin: 0 auto; padding: 20px; }
    h1 { color: #1a1a1a; border-bottom: 2px solid #e53e3e; padding-bottom: 10px; }
    .summary { background: #fff3e0; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .summary strong { font-size: 24px; color: #e65100; }
    ul { list-style: none; padding: 0; }
    li { margin-bottom: 15px; padding: 15px; background: #f9f9f9; border-radius: 8px; }
    a { color: #2563eb; text-decoration: none; }
    a:hover { text-decoration: underline; }
    .meta { color: #666; font-size: 13px; }
  </style>
</head>
<body>
  <h1>🔥 Index des Clusters Thématiques</h1>

  <div class="summary">
    <strong>${totalUrls.toLocaleString()}</strong> URLs répartis sur <strong>${totalParts}</strong> fichiers (${sortedClusters.length} familles)
    <br><span class="meta">Max ${MAX_URLS_PER_PART.toLocaleString()} URLs par fichier • Mis à jour le ${new Date().toISOString().split('T')[0]}</span>
  </div>

  <ul>
${clusterLinks}
  </ul>

  <p><a href="../index.html">← Retour aux hubs</a></p>
</body>
</html>`;

    await fs.writeFile(filePath, html, 'utf8');
    this.logger.log(`   ✓ Generated global cluster index: ${filePath}`);
    return filePath;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 🔥 HUBS TRANSVERSAUX (INTENT-BASED)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Génère le hub "money" avec les top pages ROI
   * Source: Gammes sélectionnées dynamiquement par volume de recherche
   * Fallback: IDs hardcodés si RPC non disponible
   */
  async generateMoneyHub(): Promise<HubGenerationResult> {
    this.logger.log(
      '💰 Generating money hub (dynamic top gammes by volume)...',
    );

    try {
      // 1. Récupérer les top gammes par volume de recherche via RPC
      let topGammeIds: string[];
      const { data: topGammes, error: gammeError } = await this.supabase.rpc(
        'get_top_money_gammes',
        {
          p_limit: 10,
        },
      );

      if (gammeError || !topGammes || topGammes.length === 0) {
        this.logger.warn(
          `   RPC get_top_money_gammes failed or empty, using fallback IDs`,
        );
        if (gammeError) this.logger.warn(`   Error: ${gammeError.message}`);
        // Fallback vers IDs hardcodés si RPC échoue
        topGammeIds = ['402', '82', '7', '8', '400', '401'];
      } else {
        topGammeIds = topGammes.map((g: { gamme_id: number }) =>
          String(g.gamme_id),
        );
        this.logger.log(
          `   Using dynamic top gammes: ${topGammeIds.join(', ')}`,
        );
      }

      // 2. Récupérer les pages avec le plus de produits (= plus populaires)
      const { data: pieces, error } = await this.supabase
        .from('__sitemap_p_link')
        .select(
          'map_pg_alias, map_pg_id, map_marque_alias, map_marque_id, map_modele_alias, map_modele_id, map_type_alias, map_type_id, map_has_item',
        )
        .in('map_pg_id', topGammeIds)
        .gt('map_has_item', 20) // Pages riches en contenu
        .order('map_has_item', { ascending: false })
        .limit(2000);

      if (error) throw new Error(error.message);

      const urls = (pieces || []).map(
        (p) =>
          `${this.BASE_URL}/pieces/${p.map_pg_alias}-${p.map_pg_id}/${p.map_marque_alias}-${p.map_marque_id}/${p.map_modele_alias}-${p.map_modele_id}/${p.map_type_alias}-${p.map_type_id}.html`,
      );

      // Écrire le fichier
      const dirPath = path.join(this.OUTPUT_DIR, 'hot');
      await fs.mkdir(dirPath, { recursive: true });
      const filePath = path.join(dirPath, 'money.html');

      const links = urls
        .map(
          (u) =>
            `    <li><a href="${this.htmlEscape(u)}">${this.htmlEscape(u)}</a></li>`,
        )
        .join('\n');

      const signature = this.generateSignature(urls.length, 'v10-money');
      const html = `<!DOCTYPE html>
${signature}
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="robots" content="noindex, follow">
  <title>Pages Money - Automecanik</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 1200px; margin: 0 auto; padding: 20px; }
    h1 { color: #1a1a1a; border-bottom: 2px solid #f59e0b; padding-bottom: 10px; }
    .meta { color: #666; font-size: 14px; }
    ul { column-count: 2; column-gap: 40px; list-style: none; padding: 0; }
    li { margin-bottom: 8px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    a { color: #2563eb; text-decoration: none; }
    a:hover { text-decoration: underline; }
    @media (max-width: 768px) { ul { column-count: 1; } }
  </style>
</head>
<body>
  <h1>💰 Pages Money - Top ROI</h1>
  <p class="meta">${urls.length} liens - Pages avec le plus de produits (conversion élevée)</p>
  <p>Ces pages sont les plus importantes pour le business. Priorisées pour le crawl.</p>
  <ul>
${links}
  </ul>
  <p><a href="../index.html">← Retour aux hubs</a></p>
</body>
</html>`;

      await fs.writeFile(filePath, html, 'utf8');
      this.logger.log(`   ✓ Generated hot/money.html (${urls.length} URLs)`);

      return {
        success: true,
        hubType: 'money' as HubType,
        urlCount: urls.length,
        filePath,
      };
    } catch (error) {
      this.logger.error('Failed to generate money hub:', error);
      return {
        success: false,
        hubType: 'money' as HubType,
        urlCount: 0,
        filePath: '',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Génère le hub "risk" avec les pages en danger
   * Source: Pages avec risk_flag ORPHAN ou LOW_CRAWL
   */
  async generateRiskHub(): Promise<HubGenerationResult> {
    this.logger.log('⚠️ Generating risk hub (pages at risk)...');

    try {
      // Récupérer les pages à risque depuis __seo_entity_health
      const { data: riskPages, error } = await this.supabase
        .from('__seo_entity_health')
        .select('url')
        .in('risk_flag', ['ORPHAN', 'LOW_CRAWL', 'WEAK_CLUSTER'])
        .order('risk_level', { ascending: false })
        .limit(3000);

      if (error) {
        this.logger.warn(
          `   Risk hub: table __seo_entity_health not available: ${error.message}`,
        );
        // Fallback: pages avec peu de produits (potentiellement à risque)
        const { data: fallback } = await this.supabase
          .from('__sitemap_p_link')
          .select(
            'map_pg_alias, map_pg_id, map_marque_alias, map_marque_id, map_modele_alias, map_modele_id, map_type_alias, map_type_id',
          )
          .gt('map_has_item', 5)
          .lt('map_has_item', 15) // Pages faibles
          .limit(2000);

        const urls = (fallback || []).map(
          (p) =>
            `${this.BASE_URL}/pieces/${p.map_pg_alias}-${p.map_pg_id}/${p.map_marque_alias}-${p.map_marque_id}/${p.map_modele_alias}-${p.map_modele_id}/${p.map_type_alias}-${p.map_type_id}.html`,
        );

        return this.writeRiskHubFile(urls);
      }

      const urls = (riskPages || [])
        .map((p) =>
          p.url.startsWith('http') ? p.url : `${this.BASE_URL}${p.url}`,
        )
        .filter((u) => u);

      return this.writeRiskHubFile(urls);
    } catch (error) {
      this.logger.error('Failed to generate risk hub:', error);
      return {
        success: false,
        hubType: 'clusters' as HubType,
        urlCount: 0,
        filePath: '',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Génère le hub "stabilize" avec les pages indexées depuis ~7 jours
   * qui nécessitent stabilisation (score 30-70)
   * Source: __seo_index_history avec first_indexed_at de J-6 à J-8
   */
  async generateStabilizeHub(): Promise<HubGenerationResult> {
    this.logger.log('📊 Generating STABILIZE hub (J7 pages)...');

    try {
      // Appeler la RPC pour récupérer les pages à stabiliser
      const { data: pages, error } = await this.supabase.rpc(
        'get_stabilize_pages',
        {
          p_days_min: 6,
          p_days_max: 8,
          p_limit: 2000,
        },
      );

      if (error) {
        this.logger.warn(
          `   Stabilize hub: RPC not available: ${error.message}`,
        );
        // Pas de fallback - si la table n'existe pas, on retourne vide
        return {
          success: true,
          hubType: 'stabilize' as HubType,
          urlCount: 0,
          filePath: '',
        };
      }

      if (!pages || pages.length === 0) {
        this.logger.log('   No pages need stabilization (J7)');
        return {
          success: true,
          hubType: 'stabilize' as HubType,
          urlCount: 0,
          filePath: '',
        };
      }

      const urls = pages.map((p: { url: string }) =>
        p.url.startsWith('http') ? p.url : `${this.BASE_URL}${p.url}`,
      );

      // Écrire le fichier HTML
      const dirPath = path.join(this.OUTPUT_DIR, 'stabilize');
      await fs.mkdir(dirPath, { recursive: true });

      const filePath = path.join(dirPath, 'j7.html');
      const links = urls
        .map(
          (u) =>
            `    <li><a href="${this.htmlEscape(u)}">${this.htmlEscape(u)}</a></li>`,
        )
        .join('\n');

      const signature = this.generateSignature(urls.length, 'v10-stabilize');
      const html = `<!DOCTYPE html>
${signature}
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="robots" content="noindex, follow">
  <title>Pages à stabiliser (J7) - Automecanik</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 1200px; margin: 0 auto; padding: 20px; }
    h1 { color: #1a1a1a; border-bottom: 2px solid #8b5cf6; padding-bottom: 10px; }
    .meta { color: #666; font-size: 14px; }
    .info { background: #f3e8ff; border-left: 4px solid #8b5cf6; padding: 15px; margin: 20px 0; }
    ul { column-count: 2; column-gap: 40px; list-style: none; padding: 0; }
    li { margin-bottom: 8px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    a { color: #2563eb; text-decoration: none; }
    a:hover { text-decoration: underline; }
    @media (max-width: 768px) { ul { column-count: 1; } }
  </style>
</head>
<body>
  <h1>📊 Pages à stabiliser - Jour 7</h1>
  <p class="meta">${urls.length.toLocaleString()} pages indexées depuis 6-8 jours</p>
  <div class="info">
    Ces pages sont récemment indexées mais n'ont pas encore atteint leur plein potentiel.
    Le renforcement via liens internes aide à stabiliser leur positionnement.
  </div>
  <ul>
${links}
  </ul>
  <p><a href="../index.html">← Retour aux hubs</a></p>
</body>
</html>`;

      await fs.writeFile(filePath, html, 'utf8');
      this.logger.log(`   ✓ Generated stabilize/j7.html (${urls.length} URLs)`);

      return {
        success: true,
        hubType: 'stabilize' as HubType,
        urlCount: urls.length,
        filePath,
      };
    } catch (error) {
      this.logger.error('Failed to generate stabilize hub:', error);
      return {
        success: false,
        hubType: 'stabilize' as HubType,
        urlCount: 0,
        filePath: '',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 📝 HUBS CONTENT (BLOG, GUIDES, LISTINGS, CONSTRUCTEURS)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Génère le hub "editorial" avec les pages blog et guides
   * Sources: __blog_advice, __blog_guide, __seo_gamme_conseil, __blog_seo_marque
   * Output: content/editorial.html
   */
  async generateEditorialHub(): Promise<HubGenerationResult> {
    this.logger.log('📝 Generating editorial hub (blog + guides)...');

    try {
      const urls: string[] = [];

      // 1. Blog Advice (conseils techniques)
      const { data: advices } = await this.supabase
        .from('__blog_advice')
        .select('ba_alias')
        .eq('ba_display', '1')
        .limit(1000);

      if (advices && advices.length > 0) {
        for (const a of advices) {
          if (a.ba_alias) {
            urls.push(`${this.BASE_URL}/blog-pieces-auto/advice/${a.ba_alias}`);
          }
        }
        this.logger.log(`   Found ${advices.length} blog advice pages`);
      }

      // 2. Blog Guides (guides détaillés)
      const { data: guides } = await this.supabase
        .from('__blog_guide')
        .select('bg_alias')
        .eq('bg_display', '1')
        .limit(1000);

      if (guides && guides.length > 0) {
        for (const g of guides) {
          if (g.bg_alias) {
            urls.push(`${this.BASE_URL}/blog-pieces-auto/guide/${g.bg_alias}`);
          }
        }
        this.logger.log(`   Found ${guides.length} blog guide pages`);
      }

      // 3. SEO Gamme Conseil (conseils par gamme)
      const { data: conseilGammes } = await this.supabase
        .from('__seo_gamme_conseil')
        .select('sgc_pg_alias')
        .limit(500);

      if (conseilGammes && conseilGammes.length > 0) {
        for (const c of conseilGammes) {
          if (c.sgc_pg_alias) {
            urls.push(
              `${this.BASE_URL}/blog-pieces-auto/conseils/${c.sgc_pg_alias}`,
            );
          }
        }
        this.logger.log(`   Found ${conseilGammes.length} conseil gamme pages`);
      }

      // 4. Blog SEO Marque (pages marque du blog)
      const { data: seoMarques } = await this.supabase
        .from('__blog_seo_marque')
        .select('bsm_marque_alias')
        .eq('bsm_display', '1')
        .limit(500);

      if (seoMarques && seoMarques.length > 0) {
        for (const m of seoMarques) {
          if (m.bsm_marque_alias) {
            urls.push(
              `${this.BASE_URL}/blog-pieces-auto/auto/${m.bsm_marque_alias}`,
            );
          }
        }
        this.logger.log(`   Found ${seoMarques.length} blog seo marque pages`);
      }

      // Écrire le fichier
      const dirPath = path.join(this.OUTPUT_DIR, 'content');
      await fs.mkdir(dirPath, { recursive: true });
      const filePath = path.join(dirPath, 'editorial.html');

      const links = urls
        .map(
          (u) =>
            `    <li><a href="${this.htmlEscape(u)}">${this.htmlEscape(u)}</a></li>`,
        )
        .join('\n');

      const signature = this.generateSignature(urls.length, 'v10-editorial');
      const html = `<!DOCTYPE html>
${signature}
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="robots" content="noindex, follow">
  <title>Contenu Éditorial - Automecanik</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 1200px; margin: 0 auto; padding: 20px; }
    h1 { color: #1a1a1a; border-bottom: 2px solid #8b5cf6; padding-bottom: 10px; }
    .meta { color: #666; font-size: 14px; }
    .info { background: #f3e8ff; border-left: 4px solid #8b5cf6; padding: 15px; margin: 20px 0; }
    ul { column-count: 2; column-gap: 40px; list-style: none; padding: 0; }
    li { margin-bottom: 8px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    a { color: #2563eb; text-decoration: none; }
    a:hover { text-decoration: underline; }
    @media (max-width: 768px) { ul { column-count: 1; } }
  </style>
</head>
<body>
  <h1>📝 Contenu Éditorial - Blog & Guides</h1>
  <p class="meta">${urls.length} liens - Mis à jour le ${new Date().toISOString().split('T')[0]}</p>
  <div class="info">
    <strong>Contenu de qualité :</strong> Articles techniques, guides d'achat, conseils d'entretien.
    Ces pages sont essentielles pour le SEO et l'autorité thématique.
  </div>
  <ul>
${links}
  </ul>
  <p><a href="../index.html">← Retour aux hubs</a></p>
</body>
</html>`;

      await fs.writeFile(filePath, html, 'utf8');
      this.logger.log(
        `   ✓ Generated content/editorial.html (${urls.length} URLs)`,
      );

      return {
        success: true,
        hubType: 'gammes' as HubType, // Reuse type for consistency
        urlCount: urls.length,
        filePath,
      };
    } catch (error) {
      this.logger.error('Failed to generate editorial hub:', error);
      return {
        success: false,
        hubType: 'gammes' as HubType,
        urlCount: 0,
        filePath: '',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Génère le hub "listings" avec les pages gamme et gamme+marque
   * Sources: pieces_gamme (pages catégorie) + combinaisons gamme×marque
   * Output: index/listings.html
   * ⚠️ CORRIGÉ: Pagination complète pour récupérer TOUTES les combinaisons uniques
   */
  async generateListingsHub(): Promise<HubGenerationResult> {
    this.logger.log(
      '📂 Generating listings hub (gamme + gamme/marque) with FULL pagination...',
    );

    try {
      const urls: string[] = [];

      // 1. Pages gamme principales (INDEX uniquement)
      const { data: gammes } = await this.supabase
        .from('pieces_gamme')
        .select('pg_id, pg_alias')
        .eq('pg_display', '1')
        .eq('pg_relfollow', '1') // INDEX only
        .order('pg_id');

      if (gammes && gammes.length > 0) {
        for (const g of gammes) {
          if (g.pg_alias) {
            // ✅ FIX: Format .html (pas /) - vérifié 200 OK
            urls.push(`${this.BASE_URL}/pieces/${g.pg_alias}-${g.pg_id}.html`);
          }
        }
        this.logger.log(`   Found ${gammes.length} gamme category pages`);
      }

      // ❌ SUPPRIMÉ: Pages gamme+marque (/pieces/xxx-123/yyy-456/)
      // Ces pages n'existent pas (retournent 404)
      // Seules les pages gamme .html existent
      this.logger.log(`   ℹ️ Gamme+marque pages skipped (don't exist on site)`);

      // Écrire le fichier
      const dirPath = path.join(this.OUTPUT_DIR, 'index');
      await fs.mkdir(dirPath, { recursive: true });
      const filePath = path.join(dirPath, 'listings.html');

      const links = urls
        .map(
          (u) =>
            `    <li><a href="${this.htmlEscape(u)}">${this.htmlEscape(u)}</a></li>`,
        )
        .join('\n');

      const signature = this.generateSignature(urls.length, 'v10-listings');
      const html = `<!DOCTYPE html>
${signature}
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="robots" content="noindex, follow">
  <title>Pages Listing - Automecanik</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 1200px; margin: 0 auto; padding: 20px; }
    h1 { color: #1a1a1a; border-bottom: 2px solid #0ea5e9; padding-bottom: 10px; }
    .meta { color: #666; font-size: 14px; }
    .info { background: #e0f2fe; border-left: 4px solid #0ea5e9; padding: 15px; margin: 20px 0; }
    ul { column-count: 2; column-gap: 40px; list-style: none; padding: 0; }
    li { margin-bottom: 8px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    a { color: #2563eb; text-decoration: none; }
    a:hover { text-decoration: underline; }
    @media (max-width: 768px) { ul { column-count: 1; } }
  </style>
</head>
<body>
  <h1>📂 Pages Listing - Catégories & Index</h1>
  <p class="meta">${urls.length} liens - Mis à jour le ${new Date().toISOString().split('T')[0]}</p>
  <div class="info">
    <strong>Pages d'index :</strong> Catégories de pièces et pages de listing par marque.
    Ces pages servent de portes d'entrée pour les recherches génériques.
  </div>
  <ul>
${links}
  </ul>
  <p><a href="../index.html">← Retour aux hubs</a></p>
</body>
</html>`;

      await fs.writeFile(filePath, html, 'utf8');
      this.logger.log(
        `   ✓ Generated index/listings.html (${urls.length} URLs)`,
      );

      return {
        success: true,
        hubType: 'gammes' as HubType,
        urlCount: urls.length,
        filePath,
      };
    } catch (error) {
      this.logger.error('Failed to generate listings hub:', error);
      return {
        success: false,
        hubType: 'gammes' as HubType,
        urlCount: 0,
        filePath: '',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Génère le hub "vehicles" avec les pages constructeurs
   * Sources: auto_marque, auto_modele
   * Output: constructeurs/vehicles.html
   * ⚠️ CORRIGÉ: Pagination complète pour récupérer TOUS les véhicules uniques
   */
  async generateVehiclesHub(): Promise<HubGenerationResult> {
    this.logger.log(
      '🚗 Generating vehicles hub (constructeurs) with FULL pagination...',
    );

    try {
      const urls: string[] = [];

      // 1. Pages marque (ex: /constructeurs/renault.html)
      const { data: marques } = await this.supabase
        .from('auto_marque')
        .select('marque_id, marque_alias')
        .eq('marque_display', '1')
        .order('marque_alias');

      if (marques && marques.length > 0) {
        for (const m of marques) {
          if (m.marque_alias) {
            // ✅ FIX: Ajouter l'ID à l'URL (vérifié 200 OK avec /constructeurs/audi-22.html)
            urls.push(
              `${this.BASE_URL}/constructeurs/${m.marque_alias}-${m.marque_id}.html`,
            );
          }
        }
        this.logger.log(`   Found ${marques.length} car brand pages`);
      }

      // 2. Pages modèle (via __sitemap_p_link pour avoir les combinaisons actives)
      // Format: /constructeurs/{marque}/{modele}/{type}.html
      // ⚠️ PAGINATION COMPLÈTE - récupérer TOUS les véhicules puis dédupliquer
      const PAGE_SIZE = 1000;
      let offset = 0;
      let hasMore = true;
      const seen = new Set<string>();
      const vehicleUrls: string[] = [];

      this.logger.log(`   Fetching ALL vehicle combinations (pagination)...`);

      while (hasMore) {
        const { data: vehicles, error } = await this.supabase
          .from('__sitemap_p_link')
          .select(
            'map_marque_alias, map_marque_id, map_modele_alias, map_modele_id, map_type_alias, map_type_id',
          )
          .gt('map_has_item', 5)
          .range(offset, offset + PAGE_SIZE - 1);

        if (error) {
          this.logger.warn(`   ⚠️ Error at offset ${offset}: ${error.message}`);
          break;
        }

        if (vehicles && vehicles.length > 0) {
          for (const v of vehicles) {
            const key = `${v.map_marque_id}-${v.map_modele_id}-${v.map_type_id}`;
            if (
              !seen.has(key) &&
              v.map_marque_alias &&
              v.map_modele_alias &&
              v.map_type_alias
            ) {
              seen.add(key);
              // ✅ FIX: Ajouter les IDs à chaque segment (vérifié 200 OK)
              // Format: /constructeurs/{marque}-{id}/{modele}-{id}/{type}-{id}.html
              vehicleUrls.push(
                `${this.BASE_URL}/constructeurs/${v.map_marque_alias}-${v.map_marque_id}/${v.map_modele_alias}-${v.map_modele_id}/${v.map_type_alias}-${v.map_type_id}.html`,
              );
            }
          }
          offset += PAGE_SIZE;
          hasMore = vehicles.length === PAGE_SIZE;

          // Progress log
          if (offset % 50000 < PAGE_SIZE) {
            this.logger.log(
              `   📊 Progress: ${offset.toLocaleString()} rows scanned, ${seen.size} unique vehicles`,
            );
          }
        } else {
          hasMore = false;
        }
      }

      urls.push(...vehicleUrls);
      this.logger.log(
        `   Found ${seen.size} unique vehicle pages (scanned ${offset} rows)`,
      );

      // ═══════════════════════════════════════════════════════════
      // PAGINATION: Écrire plusieurs fichiers (max 5000 URLs/fichier)
      // ═══════════════════════════════════════════════════════════
      const VEHICLES_MAX_PER_PART = 5000;
      const dirPath = path.join(this.OUTPUT_DIR, 'constructeurs');
      await fs.mkdir(dirPath, { recursive: true });

      // Paginer les URLs
      const parts: string[][] = [];
      for (let i = 0; i < urls.length; i += VEHICLES_MAX_PER_PART) {
        parts.push(urls.slice(i, i + VEHICLES_MAX_PER_PART));
      }

      this.logger.log(
        `   📄 Pagination: ${urls.length} URLs → ${parts.length} fichiers`,
      );

      // Écrire chaque part
      for (let i = 0; i < parts.length; i++) {
        const partNum = String(i + 1).padStart(3, '0');
        const partUrls = parts[i];
        const startIdx = i * VEHICLES_MAX_PER_PART + 1;
        const endIdx = startIdx + partUrls.length - 1;

        const prevPart =
          i > 0 ? `part-${String(i).padStart(3, '0')}.html` : null;
        const nextPart =
          i < parts.length - 1
            ? `part-${String(i + 2).padStart(3, '0')}.html`
            : null;

        const links = partUrls
          .map(
            (u) =>
              `    <li><a href="${this.htmlEscape(u)}">${this.htmlEscape(u)}</a></li>`,
          )
          .join('\n');

        const signature = this.generateSignature(
          partUrls.length,
          'v10-vehicles-part',
        );
        const partHtml = `<!DOCTYPE html>
${signature}
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="robots" content="noindex, follow">
  <title>Constructeurs Part ${i + 1}/${parts.length} - Automecanik</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 1200px; margin: 0 auto; padding: 20px; }
    h1 { color: #1a1a1a; }
    nav { background: #f3f4f6; padding: 10px 15px; border-radius: 8px; margin: 15px 0; }
    nav a { color: #2563eb; margin: 0 10px; }
    .meta { color: #666; font-size: 14px; }
    ul { column-count: 2; column-gap: 40px; list-style: none; padding: 0; }
    li { margin-bottom: 8px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    a { color: #2563eb; text-decoration: none; }
    a:hover { text-decoration: underline; }
    @media (max-width: 768px) { ul { column-count: 1; } }
  </style>
</head>
<body>
  <h1>🚗 Constructeurs - Partie ${i + 1}/${parts.length}</h1>
  <p class="meta">${partUrls.length.toLocaleString()} liens - URLs ${startIdx.toLocaleString()} à ${endIdx.toLocaleString()} sur ${urls.length.toLocaleString()}</p>
  <nav>
    <a href="index.html">← Index</a>
    ${prevPart ? `| <a href="${prevPart}">← Préc</a>` : ''}
    | <strong>Part ${i + 1}</strong>
    ${nextPart ? `| <a href="${nextPart}">Suiv →</a>` : ''}
  </nav>
  <ul>
${links}
  </ul>
  <nav>
    <a href="index.html">← Index</a>
    ${prevPart ? `| <a href="${prevPart}">← Préc</a>` : ''}
    | <strong>Part ${i + 1}</strong>
    ${nextPart ? `| <a href="${nextPart}">Suiv →</a>` : ''}
  </nav>
</body>
</html>`;

        await fs.writeFile(
          path.join(dirPath, `part-${partNum}.html`),
          partHtml,
          'utf8',
        );
      }

      // Écrire l'index constructeurs
      const indexLinks = parts
        .map((p, i) => {
          const partNum = String(i + 1).padStart(3, '0');
          const startIdx = i * VEHICLES_MAX_PER_PART + 1;
          const endIdx = startIdx + p.length - 1;
          return `    <li><a href="part-${partNum}.html">Part ${i + 1}</a> - URLs ${startIdx.toLocaleString()}-${endIdx.toLocaleString()} (${p.length.toLocaleString()} liens)</li>`;
        })
        .join('\n');

      const indexSignature = this.generateSignature(
        urls.length,
        'v10-vehicles-index',
      );
      const indexHtml = `<!DOCTYPE html>
${indexSignature}
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="robots" content="noindex, follow">
  <title>Index Constructeurs - Automecanik</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 900px; margin: 0 auto; padding: 20px; }
    h1 { color: #1a1a1a; border-bottom: 2px solid #10b981; padding-bottom: 10px; }
    .summary { background: #d1fae5; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .summary strong { font-size: 24px; color: #10b981; }
    ul { list-style: none; padding: 0; }
    li { margin-bottom: 12px; padding: 12px; background: #f9f9f9; border-radius: 8px; }
    a { color: #2563eb; text-decoration: none; font-weight: 500; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <h1>🚗 Constructeurs - Index</h1>
  <div class="summary">
    <strong>${urls.length.toLocaleString()}</strong> URLs répartis sur <strong>${parts.length}</strong> fichiers
    <br><span style="color:#666;font-size:13px">Max 5,000 URLs par fichier • ${new Date().toISOString().split('T')[0]}</span>
  </div>
  <ul>
${indexLinks}
  </ul>
  <p><a href="../index.html">← Index Principal</a></p>
</body>
</html>`;

      await fs.writeFile(path.join(dirPath, 'index.html'), indexHtml, 'utf8');
      this.logger.log(
        `   ✓ Generated constructeurs/index.html + ${parts.length} part files (${urls.length} URLs)`,
      );

      return {
        success: true,
        hubType: 'vehicules' as HubType,
        urlCount: urls.length,
        filePath: path.join(dirPath, 'index.html'),
      };
    } catch (error) {
      this.logger.error('Failed to generate vehicles hub:', error);
      return {
        success: false,
        hubType: 'vehicules' as HubType,
        urlCount: 0,
        filePath: '',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Helper pour écrire le fichier risk hub
   */
  private async writeRiskHubFile(urls: string[]): Promise<HubGenerationResult> {
    const dirPath = path.join(this.OUTPUT_DIR, 'risk');
    await fs.mkdir(dirPath, { recursive: true });
    const filePath = path.join(dirPath, 'weak-cluster.html');

    const links = urls
      .map(
        (u) =>
          `    <li><a href="${this.htmlEscape(u)}">${this.htmlEscape(u)}</a></li>`,
      )
      .join('\n');

    const signature = this.generateSignature(urls.length, 'v10-risk');
    const html = `<!DOCTYPE html>
${signature}
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="robots" content="noindex, follow">
  <title>Pages à risque - Automecanik</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 1200px; margin: 0 auto; padding: 20px; }
    h1 { color: #1a1a1a; border-bottom: 2px solid #dc2626; padding-bottom: 10px; }
    .meta { color: #666; font-size: 14px; }
    .warning { background: #fef2f2; border-left: 4px solid #dc2626; padding: 15px; margin: 20px 0; }
    ul { column-count: 2; column-gap: 40px; list-style: none; padding: 0; }
    li { margin-bottom: 8px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    a { color: #2563eb; text-decoration: none; }
    a:hover { text-decoration: underline; }
    @media (max-width: 768px) { ul { column-count: 1; } }
  </style>
</head>
<body>
  <h1>⚠️ Pages à Risque - Sauvetage Crawl</h1>
  <p class="meta">${urls.length} liens - Pages avec faible crawl ou cluster faible</p>
  <div class="warning">
    <strong>Attention :</strong> Ces pages risquent d'être désindexées si elles ne reçoivent pas de liens internes.
    Ce hub les expose à Googlebot pour maintenir leur indexation.
  </div>
  <ul>
${links}
  </ul>
  <p><a href="../index.html">← Retour aux hubs</a></p>
</body>
</html>`;

    await fs.writeFile(filePath, html, 'utf8');
    this.logger.log(
      `   ✓ Generated risk/weak-cluster.html (${urls.length} URLs)`,
    );

    return {
      success: true,
      hubType: 'clusters' as HubType,
      urlCount: urls.length,
      filePath,
    };
  }

  /**
   * 🚀 Génère TOUS les hubs (paginated + transversaux + content)
   * Point d'entrée principal pour la génération complète
   */
  async generateAllHubsRobust(): Promise<{
    clusters: HubGenerationResult[];
    transversal: HubGenerationResult[];
    summary: { totalUrls: number; totalFiles: number };
  }> {
    this.logger.log(
      '═══════════════════════════════════════════════════════════',
    );
    this.logger.log('🚀 GENERATING ALL HUBS (ROBUST STRATEGY)');
    this.logger.log(
      '═══════════════════════════════════════════════════════════',
    );

    // 1. Générer les clusters paginés (pièces auto)
    const clusterResults = await this.generatePaginatedClusterHubs();

    // 2. Générer les hubs transversaux (prioritaires)
    const transversalResults: HubGenerationResult[] = [];

    const moneyResult = await this.generateMoneyHub();
    transversalResults.push(moneyResult);

    const riskResult = await this.generateRiskHub();
    transversalResults.push(riskResult);

    const stabilizeResult = await this.generateStabilizeHub();
    transversalResults.push(stabilizeResult);

    // 3. Générer les hubs de contenu (blog, listings, véhicules)
    this.logger.log(
      '═══════════════════════════════════════════════════════════',
    );
    this.logger.log('📝 GENERATING CONTENT HUBS');
    this.logger.log(
      '═══════════════════════════════════════════════════════════',
    );

    const editorialResult = await this.generateEditorialHub();
    transversalResults.push(editorialResult);

    const listingsResult = await this.generateListingsHub();
    transversalResults.push(listingsResult);

    const vehiclesResult = await this.generateVehiclesHub();
    transversalResults.push(vehiclesResult);

    // 4. Mettre à jour l'index global principal
    await this.generateMainHubIndex(clusterResults, transversalResults);

    // 5. Résumé
    const totalUrls =
      clusterResults.reduce((sum, r) => sum + r.urlCount, 0) +
      transversalResults.reduce((sum, r) => sum + r.urlCount, 0);

    const clusterFiles = clusterResults.reduce((sum, r) => {
      const parts = Math.ceil(r.urlCount / MAX_URLS_PER_PART);
      return sum + parts + 1; // +1 for index
    }, 1); // +1 for global index

    const totalFiles = clusterFiles + transversalResults.length + 1; // +1 for main index

    this.logger.log(
      '═══════════════════════════════════════════════════════════',
    );
    this.logger.log(
      `✅ ALL HUBS GENERATED: ${totalUrls.toLocaleString()} URLs in ${totalFiles} files`,
    );
    this.logger.log(
      '═══════════════════════════════════════════════════════════',
    );

    return {
      clusters: clusterResults,
      transversal: transversalResults,
      summary: { totalUrls, totalFiles },
    };
  }

  /**
   * Génère l'index principal des hubs (/__crawl__/index.html)
   */
  private async generateMainHubIndex(
    clusterResults: HubGenerationResult[],
    transversalResults: HubGenerationResult[],
  ): Promise<void> {
    const filePath = path.join(this.OUTPUT_DIR, 'index.html');

    const totalClusterUrls = clusterResults.reduce(
      (sum, r) => sum + r.urlCount,
      0,
    );
    const totalTransversalUrls = transversalResults.reduce(
      (sum, r) => sum + r.urlCount,
      0,
    );
    const totalUrls = totalClusterUrls + totalTransversalUrls;

    // Extraire les stats des hubs de contenu
    const editorialUrls =
      transversalResults.find((r) => r.filePath.includes('editorial'))
        ?.urlCount || 0;
    const listingsUrls =
      transversalResults.find((r) => r.filePath.includes('listings'))
        ?.urlCount || 0;
    const vehiclesUrls =
      transversalResults.find((r) => r.filePath.includes('vehicles'))
        ?.urlCount || 0;

    const signature = this.generateSignature(totalUrls, 'v10-main-index');
    const html = `<!DOCTYPE html>
${signature}
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="robots" content="noindex, follow">
  <title>Hubs de Crawl - Automecanik</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 900px; margin: 0 auto; padding: 20px; }
    h1 { color: #1a1a1a; }
    h2 { color: #333; margin-top: 30px; border-bottom: 1px solid #ddd; padding-bottom: 8px; }
    .summary { background: #f0fdf4; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .summary strong { font-size: 24px; color: #16a34a; }
    ul { list-style: none; padding: 0; }
    li { margin-bottom: 15px; padding: 15px; background: #f9f9f9; border-radius: 8px; }
    li.hot { background: #fef3c7; }
    li.risk { background: #fef2f2; }
    li.content { background: #f3e8ff; }
    li.listings { background: #e0f2fe; }
    li.vehicles { background: #d1fae5; }
    a { color: #2563eb; text-decoration: none; font-weight: 500; }
    a:hover { text-decoration: underline; }
    .meta { color: #666; font-size: 13px; }
  </style>
</head>
<body>
  <h1>🔗 Hubs de Crawl - Automecanik</h1>

  <div class="summary">
    <strong>${totalUrls.toLocaleString()}</strong> URLs pour le crawl Googlebot
    <br><span class="meta">Structure optimisée: max ${MAX_URLS_PER_PART.toLocaleString()} URLs/fichier • ${new Date().toISOString().split('T')[0]}</span>
  </div>

  <h2>🔥 Hubs Prioritaires</h2>
  <ul>
    <li class="hot">
      <a href="hot/money.html">💰 Pages Money</a>
      <br><span class="meta">Top 2,000 pages à fort ROI - Crawl prioritaire</span>
    </li>
    <li class="risk">
      <a href="risk/weak-cluster.html">⚠️ Pages à Risque</a>
      <br><span class="meta">Pages orphelines ou faible crawl - Sauvetage SEO</span>
    </li>
  </ul>

  <h2>📝 Hubs de Contenu</h2>
  <ul>
    <li class="content">
      <a href="content/editorial.html">📝 Contenu Éditorial</a>
      <br><span class="meta">${editorialUrls.toLocaleString()} liens - Blog, guides, conseils techniques</span>
    </li>
    <li class="listings">
      <a href="index/listings.html">📂 Pages Listing</a>
      <br><span class="meta">${listingsUrls.toLocaleString()} liens - Catégories et index gamme/marque</span>
    </li>
    <li class="vehicles">
      <a href="constructeurs/vehicles.html">🚗 Pages Véhicules</a>
      <br><span class="meta">${vehiclesUrls.toLocaleString()} liens - Marques, modèles, motorisations</span>
    </li>
  </ul>

  <h2>📂 Clusters Thématiques</h2>
  <p><strong><a href="clusters/index.html">Voir tous les clusters</a></strong> (${totalClusterUrls.toLocaleString()} URLs)</p>
  <p class="meta">19 familles de produits, chacune paginée en fichiers de ${MAX_URLS_PER_PART.toLocaleString()} URLs max.</p>

  <p style="margin-top: 40px;"><a href="${this.BASE_URL}">← Retour au site</a></p>
</body>
</html>`;

    await fs.writeFile(filePath, html, 'utf8');
    this.logger.log(`   ✓ Generated main hub index: ${filePath}`);
  }
}
