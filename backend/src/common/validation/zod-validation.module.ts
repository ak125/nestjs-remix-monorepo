/**
 * 🛡️ MODULE DE VALIDATION ZOD GLOBAL
 * 
 * Module centralisé pour la gestion de toutes les validations Zod
 * Fournit pipes, filtres et utilitaires de validation
 */

import { Module, Global } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';

// Importation des composants de validation
import { ZodValidationExceptionFilter, ValidationUtilsService } from './zod-global-middleware';
import {
  ZodValidationPipe,
  AddToCartValidationPipe,
  UpdateQuantityValidationPipe,
  PromoCodeValidationPipe,
  RemoveCartItemValidationPipe,
  ClearCartValidationPipe,
  CartItemIdValidationPipe,
  CartQueryValidationPipe,
} from './cart-validation-fixed';

/**
 * Tous les pipes de validation Zod disponibles
 */
const VALIDATION_PIPES = [
  ZodValidationPipe,
  AddToCartValidationPipe,
  UpdateQuantityValidationPipe,
  PromoCodeValidationPipe,
  RemoveCartItemValidationPipe,
  ClearCartValidationPipe,
  CartItemIdValidationPipe,
  CartQueryValidationPipe,
];

/**
 * Module global de validation Zod
 * Enregistre automatiquement le filtre d'exception global
 */
@Global()
@Module({
  providers: [
    // Enregistrement du filtre d'exception global
    {
      provide: APP_FILTER,
      useClass: ZodValidationExceptionFilter,
    },
    // Service d'utilitaires de validation
    ValidationUtilsService,
    // Tous les pipes de validation
    ...VALIDATION_PIPES,
  ],
  exports: [
    // Exporter le service d'utilitaires
    ValidationUtilsService,
    // Exporter tous les pipes pour utilisation dans d'autres modules
    ...VALIDATION_PIPES,
  ],
})
export class ZodValidationModule {
  /**
   * Configuration par défaut du module
   */
  static forRoot() {
    return {
      module: ZodValidationModule,
      global: true,
    };
  }
}

// Réexportation pour faciliter les imports
export * from './cart-validation-fixed';
export * from './zod-global-middleware';
export { ZodValidationModule as default };