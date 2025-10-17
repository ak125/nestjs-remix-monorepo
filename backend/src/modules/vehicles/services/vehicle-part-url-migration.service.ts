/**
 * 🔄 SERVICE DE MIGRATION URLs PIÈCES VÉHICULES
 *
 * Gestion des redirections 301 pour les anciennes URLs de pièces
 * vers la nouvelle architecture de catalogue
 *
 * @version 1.0.0
 * @since 2025-09-14
 * @author SEO Migration Team
 */

import { Injectable, Logger } from '@nestjs/common';

// ====================================
// 🎯 INTERFACES & TYPES
// ====================================

/**
 * Structure des anciennes URLs de pièces
 */
interface LegacyPartUrl {
  category: string; // ex: "filtre-a-huile"
  categoryId: number; // ex: 7
  brand: string; // ex: "audi"
  brandId: number; // ex: 22
  model: string; // ex: "a7-sportback"
  modelId: number; // ex: 22059
  type: string; // ex: "3-0-tfsi-quattro"
  typeId: number; // ex: 34940
}

/**
 * Structure des nouvelles URLs de pièces
 * Note: Cette interface n'est pas utilisée actuellement mais garde la documentation
 *
 * interface ModernPartUrl {
 *   brand: string; // ex: "audi-22"
 *   model: string; // ex: "a7-sportback-22059"
 *   type: string; // ex: "type-34940"
 *   category: string; // ex: "filtres"
 * }
 */

/**
 * Mapping des catégories anciennes vers nouvelles
 */
interface CategoryMapping {
  legacyName: string; // ex: "filtre-a-huile"
  legacyId: number; // ex: 7
  modernName: string; // ex: "filtres"
  seoKeywords: string[]; // ex: ["filtre", "huile", "moteur"]
}

// ====================================
// 🗂️ MAPPINGS STATIQUES
// ====================================

/**
 * Mapping des catégories de pièces : ancien format → nouveau format
 */
const CATEGORY_MAPPINGS: CategoryMapping[] = [
  // Filtres
  {
    legacyName: 'filtre-a-huile',
    legacyId: 7,
    modernName: 'filtres',
    seoKeywords: ['filtre', 'huile', 'moteur', 'entretien'],
  },
  {
    legacyName: 'filtre-a-air',
    legacyId: 8,
    modernName: 'filtres',
    seoKeywords: ['filtre', 'air', 'admission', 'moteur'],
  },
  {
    legacyName: 'filtre-d-habitacle',
    legacyId: 424,
    modernName: 'filtres',
    seoKeywords: ['filtre', 'habitacle', 'pollen', 'climatisation'],
  },
  {
    legacyName: 'filtre-a-gasoil',
    legacyId: 9,
    modernName: 'filtres',
    seoKeywords: ['filtre', 'gasoil', 'carburant', 'diesel'],
  },

  // Freinage
  {
    legacyName: 'plaquettes-de-frein',
    legacyId: 15,
    modernName: 'freinage',
    seoKeywords: ['plaquettes', 'frein', 'freinage', 'sécurité'],
  },
  {
    legacyName: 'disques-de-frein',
    legacyId: 16,
    modernName: 'freinage',
    seoKeywords: ['disques', 'frein', 'freinage', 'sécurité'],
  },
  {
    legacyName: 'etriers-de-frein',
    legacyId: 17,
    modernName: 'freinage',
    seoKeywords: ['étriers', 'frein', 'freinage', 'hydraulique'],
  },

  // Échappement
  {
    legacyName: 'pot-d-echappement',
    legacyId: 25,
    modernName: 'echappement',
    seoKeywords: ['pot', 'échappement', 'silencieux', 'catalyseur'],
  },
  {
    legacyName: 'catalyseur',
    legacyId: 26,
    modernName: 'echappement',
    seoKeywords: ['catalyseur', 'échappement', 'pollution', 'normes'],
  },
  {
    legacyName: 'silencieux',
    legacyId: 27,
    modernName: 'echappement',
    seoKeywords: ['silencieux', 'échappement', 'bruit', 'résonateur'],
  },

  // Suspension
  {
    legacyName: 'amortisseurs',
    legacyId: 35,
    modernName: 'suspension',
    seoKeywords: ['amortisseurs', 'suspension', 'confort', 'tenue'],
  },
  {
    legacyName: 'ressorts',
    legacyId: 36,
    modernName: 'suspension',
    seoKeywords: ['ressorts', 'suspension', 'hauteur', 'rigidité'],
  },
  {
    legacyName: 'silent-blocs',
    legacyId: 37,
    modernName: 'suspension',
    seoKeywords: ['silent-blocs', 'suspension', 'bruit', 'vibrations'],
  },

  // Éclairage
  {
    legacyName: 'ampoules',
    legacyId: 45,
    modernName: 'eclairage',
    seoKeywords: ['ampoules', 'éclairage', 'phares', 'feux'],
  },
  {
    legacyName: 'phares',
    legacyId: 46,
    modernName: 'eclairage',
    seoKeywords: ['phares', 'éclairage', 'optique', 'LED'],
  },
  {
    legacyName: 'feux-arriere',
    legacyId: 47,
    modernName: 'eclairage',
    seoKeywords: ['feux', 'arrière', 'éclairage', 'signalisation'],
  },

  // Carrosserie
  {
    legacyName: 'pare-chocs',
    legacyId: 55,
    modernName: 'carrosserie',
    seoKeywords: ['pare-chocs', 'carrosserie', 'protection', 'esthétique'],
  },
  {
    legacyName: 'retroviseurs',
    legacyId: 56,
    modernName: 'carrosserie',
    seoKeywords: ['rétroviseurs', 'carrosserie', 'vision', 'sécurité'],
  },
  {
    legacyName: 'portières',
    legacyId: 57,
    modernName: 'carrosserie',
    seoKeywords: ['portières', 'carrosserie', 'accès', 'structure'],
  },
];

// ====================================
// 🔧 SERVICE PRINCIPAL
// ====================================

@Injectable()
export class VehiclePartUrlMigrationService {
  private readonly logger = new Logger(VehiclePartUrlMigrationService.name);

  /**
   * Parse une ancienne URL de pièce pour extraire ses composants
   */
  parseLegacyPartUrl(url: string): LegacyPartUrl | null {
    // Pattern: /pieces/{category-name-id}/{brand-brandId}/{model-modelId}/{type-typeId}.html
    // Exemple: /pieces/filtre-a-huile-7/audi-22/a7-sportback-22059/3-0-tfsi-quattro-34940.html

    const cleanUrl = url.replace(/^\/+/, '').replace(/\.html$/, '');
    const segments = cleanUrl.split('/');

    if (segments.length !== 5 || segments[0] !== 'pieces') {
      this.logger.warn(`URL format non reconnu: ${url}`);
      return null;
    }

    try {
      // Extraction category-id
      const categoryPart = segments[1];
      const categoryMatch = categoryPart.match(/^(.+)-(\d+)$/);
      if (!categoryMatch) return null;

      // Extraction brand-id
      const brandPart = segments[2];
      const brandMatch = brandPart.match(/^(.+)-(\d+)$/);
      if (!brandMatch) return null;

      // Extraction model-id
      const modelPart = segments[3];
      const modelMatch = modelPart.match(/^(.+)-(\d+)$/);
      if (!modelMatch) return null;

      // Extraction type-id
      const typePart = segments[4];
      const typeMatch = typePart.match(/^(.+)-(\d+)$/);
      if (!typeMatch) return null;

      return {
        category: categoryMatch[1],
        categoryId: parseInt(categoryMatch[2]),
        brand: brandMatch[1],
        brandId: parseInt(brandMatch[2]),
        model: modelMatch[1],
        modelId: parseInt(modelMatch[2]),
        type: typeMatch[1],
        typeId: parseInt(typeMatch[2]),
      };
    } catch (error) {
      this.logger.error(`Erreur parsing URL ${url}:`, error);
      return null;
    }
  }

  /**
   * Trouve le mapping de catégorie moderne pour une ancienne catégorie
   */
  findCategoryMapping(
    legacyCategory: string,
    legacyCategoryId?: number,
  ): CategoryMapping | null {
    return (
      CATEGORY_MAPPINGS.find(
        (mapping) =>
          mapping.legacyName === legacyCategory ||
          (legacyCategoryId && mapping.legacyId === legacyCategoryId),
      ) || null
    );
  }

  /**
   * Génère la nouvelle URL moderne pour une pièce
   */
  generateModernPartUrl(legacy: LegacyPartUrl): string | null {
    const categoryMapping = this.findCategoryMapping(
      legacy.category,
      legacy.categoryId,
    );

    if (!categoryMapping) {
      this.logger.warn(
        `Pas de mapping trouvé pour catégorie: ${legacy.category} (${legacy.categoryId})`,
      );
      return null;
    }

    // Format moderne: /pieces/{brand-id}/{model-id}/type-{typeId}/{category}
    const modernUrl = `/pieces/${legacy.brand}-${legacy.brandId}/${legacy.model}-${legacy.modelId}/type-${legacy.typeId}/${categoryMapping.modernName}`;

    this.logger.debug(
      `URL migrée: ${legacy.category} → ${categoryMapping.modernName}`,
    );
    return modernUrl;
  }

  /**
   * Migre une ancienne URL vers la nouvelle structure
   */
  migratePartUrl(legacyUrl: string): { newUrl: string; metadata: any } | null {
    const parsed = this.parseLegacyPartUrl(legacyUrl);
    if (!parsed) return null;

    const newUrl = this.generateModernPartUrl(parsed);
    if (!newUrl) return null;

    const categoryMapping = this.findCategoryMapping(
      parsed.category,
      parsed.categoryId,
    );

    return {
      newUrl,
      metadata: {
        migration_type: 'part_category',
        legacy_category: parsed.category,
        legacy_category_id: parsed.categoryId,
        modern_category: categoryMapping?.modernName,
        vehicle_brand: parsed.brand,
        vehicle_model: parsed.model,
        vehicle_type: parsed.type,
        seo_keywords: categoryMapping?.seoKeywords || [],
        migrated_at: new Date().toISOString(),
      },
    };
  }

  /**
   * Génère toutes les redirections nécessaires pour un véhicule donné
   */
  generateVehicleRedirections(
    brandSlug: string,
    brandId: number,
    modelSlug: string,
    modelId: number,
    typeSlug: string,
    typeId: number,
  ) {
    const redirections: Array<{
      source: string;
      destination: string;
      metadata: any;
    }> = [];

    CATEGORY_MAPPINGS.forEach((mapping) => {
      const legacyUrl = `/pieces/${mapping.legacyName}-${mapping.legacyId}/${brandSlug}-${brandId}/${modelSlug}-${modelId}/${typeSlug}-${typeId}.html`;
      const modernUrl = `/pieces/${brandSlug}-${brandId}/${modelSlug}-${modelId}/type-${typeId}/${mapping.modernName}`;

      redirections.push({
        source: legacyUrl,
        destination: modernUrl,
        metadata: {
          migration_type: 'bulk_vehicle_parts',
          vehicle_info: {
            brand: brandSlug,
            brand_id: brandId,
            model: modelSlug,
            model_id: modelId,
            type: typeSlug,
            type_id: typeId,
          },
          category_info: {
            legacy_name: mapping.legacyName,
            legacy_id: mapping.legacyId,
            modern_name: mapping.modernName,
            seo_keywords: mapping.seoKeywords,
          },
          generated_at: new Date().toISOString(),
        },
      });
    });

    return redirections;
  }

  /**
   * Teste le service avec les exemples fournis
   */
  async testMigrationExamples() {
    const testUrls = [
      '/pieces/filtre-a-huile-7/audi-22/a7-sportback-22059/3-0-tfsi-quattro-34940.html',
      '/pieces/filtre-a-air-8/audi-22/a7-sportback-22059/3-0-tfsi-quattro-34940.html',
      '/pieces/filtre-d-habitacle-424/audi-22/a7-sportback-22059/3-0-tfsi-quattro-34940.html',
    ];

    this.logger.log("🧪 Test des migrations d'URLs...");

    testUrls.forEach((url, index) => {
      const result = this.migratePartUrl(url);
      if (result) {
        this.logger.log(`✅ Test ${index + 1}: ${url} → ${result.newUrl}`);
        this.logger.debug(`   Metadata:`, result.metadata);
      } else {
        this.logger.error(`❌ Test ${index + 1}: Échec migration ${url}`);
      }
    });
  }

  /**
   * Obtient des statistiques sur les mappings disponibles
   */
  getMappingStats() {
    const stats = {
      total_mappings: CATEGORY_MAPPINGS.length,
      categories_count: new Set(CATEGORY_MAPPINGS.map((m) => m.modernName))
        .size,
      legacy_categories: CATEGORY_MAPPINGS.map((m) => ({
        name: m.legacyName,
        id: m.legacyId,
        modern_equivalent: m.modernName,
      })),
    };

    this.logger.log('📊 Statistiques mappings:', stats);
    return stats;
  }

  /**
   * 🔧 Génère les règles de redirection pour Caddy
   */
  async generateCaddyRedirectRules(categoryFilter?: string): Promise<string[]> {
    this.logger.log(
      `🔧 Génération règles Caddy - Filtre: ${categoryFilter || 'toutes'}`,
    );

    let mappingsToUse = CATEGORY_MAPPINGS;

    // Filtrer par catégorie si spécifié
    if (categoryFilter) {
      mappingsToUse = CATEGORY_MAPPINGS.filter(
        (m) => m.modernName.toLowerCase() === categoryFilter.toLowerCase(),
      );
    }

    const rules: string[] = [];

    for (const mapping of mappingsToUse) {
      // Format Caddy: redir /ancien/chemin /nouveau/chemin 301
      const rule = `    redir /pieces/${mapping.legacyName}-${mapping.legacyId}/{brand}/{model}/{type}.html /pieces/{brand}/{model}/type-{type}/${mapping.modernName} 301`;
      rules.push(rule);
    }

    this.logger.log(`✅ ${rules.length} règles Caddy générées`);
    return rules;
  }

  /**
   * 🔧 Génère un script de déploiement complet pour Caddy
   */
  async generateCaddyDeploymentScript(): Promise<string> {
    const allRules = await this.generateCaddyRedirectRules();

    const script = `#!/bin/bash
# 🔄 Script de déploiement Caddy - Généré le ${new Date().toISOString()}
# Redirections 301 pour migration URLs pièces auto

echo "🔄 Déploiement des redirections Caddy..."

# Backup configuration actuelle
sudo cp /etc/caddy/Caddyfile /etc/caddy/Caddyfile.backup.$(date +%Y%m%d_%H%M%S)

# Créer le nouveau Caddyfile
cat > /tmp/new_caddyfile << 'EOF'
your-domain.com {
    # ===== REDIRECTIONS 301 PIÈCES AUTO =====
    # Générées automatiquement le ${new Date().toISOString()}
${allRules.join('\n')}

    # ===== REVERSE PROXY VERS REMIX =====
    reverse_proxy localhost:3000 {
        header_up Host {host}
        header_up X-Real-IP {remote_host}
        header_up X-Forwarded-For {remote_host}
        header_up X-Forwarded-Proto {scheme}
    }

    # ===== LOGGING =====
    log {
        output file /var/log/caddy/pieces-redirects.log
        format console
    }
}
EOF

# Valider la configuration
echo "🧪 Validation de la configuration..."
caddy validate --config /tmp/new_caddyfile

if [ $? -eq 0 ]; then
    echo "✅ Configuration valide"
    sudo cp /tmp/new_caddyfile /etc/caddy/Caddyfile
    sudo systemctl reload caddy
    echo "🚀 Déploiement terminé avec succès!"
    echo "📊 ${allRules.length} redirections configurées"
else
    echo "❌ Configuration invalide - déploiement annulé"
    exit 1
fi
`;

    return script;
  }
}
