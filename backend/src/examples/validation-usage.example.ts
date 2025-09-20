import { Injectable } from '@nestjs/common';
import { ConfigValidationService } from '../modules/config/services/config-validation.service';
import { z } from 'zod';

@Injectable()
export class ValidationUsageExample {
  constructor(
    private readonly validationService: ConfigValidationService,
  ) {}

  async exempleUtilisationValidation() {
    // ✅ Valider la configuration de l'environnement
    const envValidation = await this.validationService.validateEnvironmentConfig();
    
    if (envValidation.isValid) {
      console.log('✅ Configuration environnement valide');
    } else {
      console.error('❌ Erreurs environnement:', envValidation.errors);
    }

    // 🏷️ Valider les métadonnées d'une page
    const metadataValidation = this.validationService.validatePageMetadata({
      title: 'BMW Série 3 - Voitures Premium',
      description: 'Découvrez la BMW Série 3, voiture premium alliant performance et élégance',
      keywords: ['bmw', 'série 3', 'voiture', 'premium'],
      ogImage: 'https://example.com/bmw-series-3.jpg',
      canonicalUrl: 'https://example.com/products/vehicles/cars/bmw/series-3',
      lang: 'fr',
    });

    if (metadataValidation.isValid) {
      console.log('✅ Métadonnées valides:', metadataValidation.data);
    } else {
      console.error('❌ Erreurs métadonnées:', metadataValidation.errors);
    }

    // 🧭 Valider la configuration d'un breadcrumb
    const breadcrumbValidation = this.validationService.validateBreadcrumbConfig({
      route: '/products/vehicles/cars/bmw',
      label: 'BMW',
      icon: 'brand',
      parent: '/products/vehicles/cars',
      order: 1,
      isVisible: true,
      metadata: {
        brand: 'BMW',
        category: 'vehicles',
        type: 'brand_page',
      },
    });

    if (breadcrumbValidation.isValid) {
      console.log('✅ Configuration breadcrumb valide:', breadcrumbValidation.data);
    } else {
      console.error('❌ Erreurs breadcrumb:', breadcrumbValidation.errors);
    }

    // 🔧 Validation avec schéma personnalisé
    const customSchema = z.object({
      theme: z.enum(['light', 'dark', 'auto']),
      language: z.string().length(2),
      notifications: z.boolean(),
      apiTimeout: z.number().min(1000).max(30000),
    });

    const customValidation = await this.validationService.validateConfigValue(
      {
        theme: 'dark',
        language: 'fr',
        notifications: true,
        apiTimeout: 5000,
      },
      customSchema,
    );

    if (customValidation.isValid) {
      console.log('✅ Configuration personnalisée valide:', customValidation.data);
    } else {
      console.error('❌ Erreurs configuration:', customValidation.errors);
    }

    // 🔑 Valider une clé de configuration
    const keyValidation = this.validationService.validateConfigKey('app.theme.dark_mode');
    if (!keyValidation.isValid) {
      console.error('❌ Clé invalide:', keyValidation.errors);
    }

    // 📂 Valider une catégorie
    const categoryValidation = this.validationService.validateConfigCategory('user_preferences');
    if (!categoryValidation.isValid) {
      console.error('❌ Catégorie invalide:', categoryValidation.errors);
    }
  }

  // 🛡️ Middleware de validation pour les controllers
  async validateRequestData(data: any, schema: z.ZodSchema) {
    const validation = await this.validationService.validateConfigValue(data, schema);
    
    if (!validation.isValid) {
      throw new Error(`Données invalides: ${validation.errors.join(', ')}`);
    }
    
    return validation.data;
  }
}