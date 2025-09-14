import { Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';

@Injectable()
export class ConfigValidationService {
  private readonly logger = new Logger(ConfigValidationService.name);

  // Schéma Zod pour la validation de l'environnement
  private readonly environmentSchema = z.object({
    NODE_ENV: z.enum(['development', 'production', 'test']),
    PORT: z.coerce.number().min(1).max(65535).default(3000),
    DATABASE_URL: z.string().url(),
    JWT_SECRET: z.string().min(32),
    REDIS_URL: z.string().url().optional(),
    SUPABASE_URL: z.string().url().optional(),
    SUPABASE_ANON_KEY: z.string().optional(),
  });

  async validateEnvironmentConfig(): Promise<{
    isValid: boolean;
    errors: string[];
  }> {
    try {
      this.environmentSchema.parse(process.env);
      this.logger.log('Validation de la configuration environnement réussie');
      return { isValid: true, errors: [] };
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors = error.issues.map(
          (err) => `${err.path.join('.')}: ${err.message}`,
        );
        this.logger.error('Erreurs de validation environnement:', errors);
        return { isValid: false, errors };
      }
      this.logger.error('Erreur de validation inconnue:', error);
      return { isValid: false, errors: ['Erreur de validation inconnue'] };
    }
  }

  async validateConfigValue(
    value: any,
    schema: z.ZodSchema,
  ): Promise<{ isValid: boolean; errors: string[]; data?: any }> {
    try {
      const validatedData = schema.parse(value);
      return { isValid: true, errors: [], data: validatedData };
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors = error.issues.map(
          (err) => `${err.path.join('.')}: ${err.message}`,
        );
        return { isValid: false, errors };
      }
      return { isValid: false, errors: ['Erreur de validation inconnue'] };
    }
  }

  /**
   * Valide les métadonnées d'une page
   */
  validatePageMetadata(metadata: any): {
    isValid: boolean;
    errors: string[];
    data?: any;
  } {
    const metadataSchema = z.object({
      title: z.string().min(1).max(60),
      description: z.string().min(1).max(160),
      keywords: z.array(z.string()).optional(),
      ogImage: z.string().url().optional(),
      canonicalUrl: z.string().url().optional(),
      lang: z.string().length(2).default('fr'),
    });

    try {
      const validatedData = metadataSchema.parse(metadata);
      return { isValid: true, errors: [], data: validatedData };
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors = error.issues.map(
          (err) => `${err.path.join('.')}: ${err.message}`,
        );
        return { isValid: false, errors };
      }
      return {
        isValid: false,
        errors: ['Erreur de validation des métadonnées'],
      };
    }
  }

  /**
   * Valide la configuration d'un breadcrumb
   */
  validateBreadcrumbConfig(config: any): {
    isValid: boolean;
    errors: string[];
    data?: any;
  } {
    const breadcrumbSchema = z.object({
      route: z.string().min(1),
      label: z.string().min(1),
      icon: z.string().optional(),
      parent: z.string().optional(),
      order: z.number().int().min(0).optional(),
      isVisible: z.boolean().default(true),
      metadata: z.record(z.string(), z.any()).optional(),
    });

    try {
      const validatedData = breadcrumbSchema.parse(config);
      return { isValid: true, errors: [], data: validatedData };
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors = error.issues.map(
          (err) => `${err.path.join('.')}: ${err.message}`,
        );
        return { isValid: false, errors };
      }
      return { isValid: false, errors: ['Erreur de validation du breadcrumb'] };
    }
  }
}
