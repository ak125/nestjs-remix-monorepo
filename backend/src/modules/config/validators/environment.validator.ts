import { Injectable } from '@nestjs/common';

export interface EnvironmentValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

@Injectable()
export class EnvironmentValidator {
  validate(): EnvironmentValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Variables obligatoires
    const required = ['NODE_ENV', 'DATABASE_URL', 'JWT_SECRET'];
    for (const varName of required) {
      if (!process.env[varName]) {
        errors.push(`Variable d'environnement obligatoire manquante: ${varName}`);
      }
    }

    // Variables recommandées
    const recommended = ['REDIS_URL', 'PORT'];
    for (const varName of recommended) {
      if (!process.env[varName]) {
        warnings.push(`Variable d'environnement recommandée manquante: ${varName}`);
      }
    }

    // Validation du NODE_ENV
    const nodeEnv = process.env.NODE_ENV;
    if (nodeEnv && !['development', 'production', 'test'].includes(nodeEnv)) {
      errors.push(`NODE_ENV invalide: ${nodeEnv}. Valeurs autorisées: development, production, test`);
    }

    // Validation du PORT
    const port = process.env.PORT;
    if (port && (isNaN(Number(port)) || Number(port) < 1 || Number(port) > 65535)) {
      errors.push(`PORT invalide: ${port}. Doit être un nombre entre 1 et 65535`);
    }

    // Validation du JWT_SECRET
    const jwtSecret = process.env.JWT_SECRET;
    if (jwtSecret && jwtSecret.length < 32) {
      warnings.push('JWT_SECRET devrait contenir au moins 32 caractères pour une sécurité optimale');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }
}
