import { Injectable, Logger } from '@nestjs/common';
import * as Joi from 'joi';

@Injectable()
export class ConfigValidationService {
  private readonly logger = new Logger(ConfigValidationService.name);

  async validateEnvironmentConfig(): Promise<{ isValid: boolean; errors: string[] }> {
    const schema = Joi.object({
      NODE_ENV: Joi.string().valid('development', 'production', 'test').required(),
      PORT: Joi.number().port().default(3000),
      DATABASE_URL: Joi.string().uri().required(),
      JWT_SECRET: Joi.string().min(32).required(),
      REDIS_URL: Joi.string().uri().optional(),
    });

    try {
      await schema.validateAsync(process.env, { abortEarly: false });
      return { isValid: true, errors: [] };
    } catch (error) {
      if (error.isJoi) {
        const errors = error.details.map((detail: any) => detail.message);
        return { isValid: false, errors };
      }
      return { isValid: false, errors: ['Erreur de validation inconnue'] };
    }
  }

  async validateConfigValue(value: any, schema: Joi.Schema): Promise<{ isValid: boolean; errors: string[] }> {
    try {
      await schema.validateAsync(value, { abortEarly: false });
      return { isValid: true, errors: [] };
    } catch (error) {
      if (error.isJoi) {
        const errors = error.details.map((detail: any) => detail.message);
        return { isValid: false, errors };
      }
      return { isValid: false, errors: ['Erreur de validation inconnue'] };
    }
  }
}
