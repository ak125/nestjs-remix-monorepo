#!/bin/bash

# 🚀 GÉNÉRATEUR DE MODULES AUTOMATIQUE
# Basé sur la documentation DATABASE_TABLES_DOCUMENTATION.md

echo "🏗️  GÉNÉRATEUR DE MODULES NESTJS"
echo "================================="
echo ""

# Configuration
BASE_DIR="/workspaces/nestjs-remix-monorepo/backend/src/modules"
TEMPLATES_DIR="./templates"

# Modules disponibles à générer
declare -A MODULES=(
    ["customers"]="___xtr_customer,___xtr_customer_billing_address,___xtr_customer_delivery_address"
    ["orders"]="___xtr_order,___xtr_order_line,___xtr_order_status"
    ["suppliers"]="___xtr_supplier,___xtr_supplier_link_pm,am_2022_suppliers"
    ["delivery"]="___xtr_delivery_agent,___xtr_delivery_ape_france,___xtr_delivery_ape_corse"
    ["blog"]="__blog_advice,__blog_guide,__blog_meta_tags_ariane"
    ["seo"]="__seo_gamme,__seo_marque,__sitemap_blog"
    ["cart"]="cart_items,cart_analytics,promo_codes"
    ["config"]="___config,___config_admin,___header_menu,___footer_menu"
)

# Fonction pour créer un module
create_module() {
    local module_name=$1
    local tables=$2
    
    echo "🔨 Création du module: $module_name"
    
    # Créer le répertoire
    mkdir -p "$BASE_DIR/$module_name"
    
    # Générer le service
    cat > "$BASE_DIR/$module_name/${module_name}.service.ts" << EOF
/**
 * 🔧 ${module_name^^} SERVICE - Auto-généré
 * 
 * Tables utilisées: $tables
 * Pattern: ManufacturersModule + InvoicesModule  
 * Cache: 5min TTL
 */

import { Injectable, Inject, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { SupabaseBaseService } from '../../database/services/supabase-base.service';

@Injectable()
export class ${module_name^}Service extends SupabaseBaseService {
  protected readonly logger = new Logger(${module_name^}Service.name);
  private readonly CACHE_TTL = 300; // 5 minutes

  constructor(
    configService: ConfigService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {
    super(configService);
  }

  /**
   * 📋 Récupérer tous les éléments avec pagination
   */
  async getAll(page: number = 1, limit: number = 20) {
    const cacheKey = \`${module_name}:all:page_\${page}:limit_\${limit}\`;
    
    try {
      const cached = await this.cacheManager.get(cacheKey);
      if (cached) {
        this.logger.debug(\`Cache hit for \${cacheKey}\`);
        return cached;
      }

      const offset = (page - 1) * limit;
      
      // TODO: Adapter la table principale selon les besoins
      const { data, error } = await this.supabase
        .from('${tables.split(',')[0]}') // Table principale
        .select('*')
        .range(offset, offset + limit - 1);

      if (error) {
        this.logger.error('Erreur récupération:', error);
        throw new Error('Impossible de récupérer les données');
      }

      const { count } = await this.supabase
        .from('${tables.split(',')[0]}')
        .select('*', { count: 'exact', head: true });

      const result = {
        data: data || [],
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limit),
        },
      };

      await this.cacheManager.set(cacheKey, result, this.CACHE_TTL);
      this.logger.log(\`\${data?.length || 0} éléments récupérés\`);

      return result;
    } catch (error) {
      this.logger.error('Erreur getAll:', error);
      throw error;
    }
  }

  /**
   * 🔍 Récupérer par ID
   */
  async getById(id: string) {
    const cacheKey = \`${module_name}:\${id}\`;

    try {
      const cached = await this.cacheManager.get(cacheKey);
      if (cached) {
        return cached;
      }

      // TODO: Adapter selon la clé primaire de votre table
      const { data, error } = await this.supabase
        .from('${tables.split(',')[0]}')
        .select('*')
        .eq('id', id) // Adapter le nom de la colonne ID
        .single();

      if (error || !data) {
        return null;
      }

      await this.cacheManager.set(cacheKey, data, this.CACHE_TTL);
      return data;
    } catch (error) {
      this.logger.error('Erreur getById:', error);
      throw error;
    }
  }

  /**
   * 📊 Statistiques
   */
  async getStats() {
    const cacheKey = '${module_name}:stats';

    try {
      const cached = await this.cacheManager.get(cacheKey);
      if (cached) {
        return cached;
      }

      const { count } = await this.supabase
        .from('${tables.split(',')[0]}')
        .select('*', { count: 'exact', head: true });

      const result = {
        total: count || 0,
        lastUpdated: new Date().toISOString(),
      };

      await this.cacheManager.set(cacheKey, result, this.CACHE_TTL * 2);
      return result;
    } catch (error) {
      this.logger.error('Erreur getStats:', error);
      throw error;
    }
  }
}
EOF

    # Générer le controller
    cat > "$BASE_DIR/$module_name/${module_name}.controller.ts" << EOF
/**
 * 🎛️ ${module_name^^} CONTROLLER - Auto-généré
 */

import {
  Controller,
  Get,
  Param,
  Query,
  Logger,
  ParseIntPipe,
} from '@nestjs/common';
import { ${module_name^}Service } from './${module_name}.service';

@Controller('api/${module_name}')
export class ${module_name^}Controller {
  private readonly logger = new Logger(${module_name^}Controller.name);

  constructor(private readonly ${module_name}Service: ${module_name^}Service) {}

  /**
   * GET /api/${module_name}
   */
  @Get()
  async getAll(
    @Query('page', new ParseIntPipe({ optional: true })) page: number = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit: number = 20,
  ) {
    this.logger.log(\`GET /api/${module_name} - page:\${page}, limit:\${limit}\`);
    return this.${module_name}Service.getAll(page, limit);
  }

  /**
   * GET /api/${module_name}/stats
   */
  @Get('stats')
  async getStats() {
    this.logger.log('GET /api/${module_name}/stats');
    return this.${module_name}Service.getStats();
  }

  /**
   * GET /api/${module_name}/:id
   */
  @Get(':id')
  async getById(@Param('id') id: string) {
    this.logger.log(\`GET /api/${module_name}/\${id}\`);
    return this.${module_name}Service.getById(id);
  }
}
EOF

    # Générer le module
    cat > "$BASE_DIR/$module_name/${module_name}.module.ts" << EOF
/**
 * 📦 ${module_name^^} MODULE - Auto-généré
 */

import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { ${module_name^}Controller } from './${module_name}.controller';
import { ${module_name^}Service } from './${module_name}.service';

@Module({
  imports: [
    CacheModule.register({
      ttl: 300, // 5 minutes
      max: 1000, // Maximum 1000 items en cache
    }),
  ],
  controllers: [${module_name^}Controller],
  providers: [${module_name^}Service],
  exports: [${module_name^}Service],
})
export class ${module_name^}Module {}
EOF

    echo "   ✅ Service créé: $BASE_DIR/$module_name/${module_name}.service.ts"
    echo "   ✅ Controller créé: $BASE_DIR/$module_name/${module_name}.controller.ts"
    echo "   ✅ Module créé: $BASE_DIR/$module_name/${module_name}.module.ts"
    echo ""
}

# Menu interactif
echo "📋 Modules disponibles à générer:"
echo ""
i=1
for module in "${!MODULES[@]}"; do
    echo "$i. $module (${MODULES[$module]})"
    i=$((i+1))
done
echo "0. Générer tous les modules"
echo ""

read -p "Choisissez un module à générer (0-${#MODULES[@]}): " choice

if [ "$choice" = "0" ]; then
    echo "🚀 Génération de tous les modules..."
    for module in "${!MODULES[@]}"; do
        create_module "$module" "${MODULES[$module]}"
    done
    echo "🎉 Tous les modules ont été générés avec succès!"
else
    # Convertir le choix en nom de module
    i=1
    for module in "${!MODULES[@]}"; do
        if [ "$choice" = "$i" ]; then
            create_module "$module" "${MODULES[$module]}"
            echo "🎉 Module $module généré avec succès!"
            break
        fi
        i=$((i+1))
    done
fi

echo ""
echo "📝 PROCHAINES ÉTAPES:"
echo "1. Adapter les noms de colonnes dans les services générés"
echo "2. Ajouter les modules dans app.module.ts"
echo "3. Tester les APIs: http://localhost:3000/api/[module-name]"
echo "4. Personnaliser selon vos besoins business"
