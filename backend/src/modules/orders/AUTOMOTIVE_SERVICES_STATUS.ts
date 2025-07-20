/**
 * SERVICES AUTOMOBILES - DÉSACTIVÉS TEMPORAIREMENT
 * 
 * Ces services ont été désactivés suite à l'audit du 20 juillet 2025
 * car ils contiennent des références Prisma incompatibles avec l'architecture Supabase.
 * 
 * ERREURS IDENTIFIÉES :
 * - 15 erreurs TypeScript de compilation
 * - Mélange Prisma/Supabase dans les services
 * - Dépendances circulaires entre services
 * 
 * PLAN DE REFACTORISATION :
 * 1. OrdersAutomotiveIntegrationService : Remplacer Prisma par SupabaseRestService
 * 2. AutomotiveOrdersService : Supprimer dépendance vers OrdersAutomotiveIntegrationService
 * 3. Tests complets après refactorisation
 * 
 * ESTIMÉ : 4-6 heures de refactorisation
 * 
 * SERVICES CONCERNÉS :
 * - OrdersAutomotiveIntegrationService (11 erreurs Prisma)
 * - AutomotiveOrdersService (4 erreurs dépendance)
 */

// Ces imports sont commentés dans orders.module.ts :
// import { OrdersAutomotiveIntegrationService } from './services/orders-automotive-integration.service';
// import { AutomotiveOrdersService } from './services/automotive-orders.service';

// Ces services sont commentés dans les providers :
// OrdersAutomotiveIntegrationService,
// AutomotiveOrdersService,

export const DISABLED_AUTOMOTIVE_SERVICES = [
  'OrdersAutomotiveIntegrationService',
  'AutomotiveOrdersService'
] as const;

export const AUTOMOTIVE_REFACTORING_STATUS = {
  status: 'DISABLED',
  reason: 'PRISMA_SUPABASE_CONFLICT',
  errorCount: 15,
  estimatedRefactoringTime: '4-6 hours',
  priority: 'HIGH'
} as const;
