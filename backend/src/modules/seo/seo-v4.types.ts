/**
 * SEO V4 Ultimate - Types, Schemas & Constants
 *
 * Extracted from dynamic-seo-v4-ultimate.service.ts
 * Contains all shared types, Zod schemas, and constant arrays.
 */

import { z } from 'zod';

// ====================================
// 📊 SCHEMAS ZOD
// ====================================

export const SeoVariablesSchema = z.object({
  // Variables de base enrichies
  gamme: z.string().min(1),
  gammeMeta: z.string().min(1),
  marque: z.string().min(1),
  marqueMeta: z.string().min(1),
  marqueMetaTitle: z.string().min(1),
  modele: z.string().min(1),
  modeleMeta: z.string().min(1),
  type: z.string().min(1),
  typeMeta: z.string().min(1),

  // Variables techniques
  annee: z.string(),
  nbCh: z.number().positive(),
  carosserie: z.string(),
  fuel: z.string(),
  codeMoteur: z.string(),

  // Variables pricing
  minPrice: z.number().positive().optional(),

  // Variables famille (nouvelles)
  mfId: z.number().int().positive().optional(),
  familyName: z.string().optional(),

  // Métadonnées contextuelles (nouvelles)
  articlesCount: z.number().int().nonnegative().default(0),
  gammeLevel: z.number().int().min(1).max(3).default(1),
  isTopGamme: z.boolean().default(false),
  seoScore: z.number().int().min(0).max(100).optional(),
});

export type SeoVariables = z.infer<typeof SeoVariablesSchema>;

// ====================================
// 📊 INTERFACES
// ====================================

export interface CompleteSeoResult {
  title: string;
  description: string;
  h1: string;
  preview: string;
  content: string;
  keywords: string;
  metadata: {
    templatesUsed: string[];
    switchesProcessed: number;
    variablesReplaced: number;
    processingTime: number;
    cacheHit: boolean;
    version: string;
  };
}

export interface SeoAuditReport {
  scanDate: Date;
  totalPages: number;
  pagesWithSeo: number;
  pagesWithoutSeo: number;
  coverageRate: number;
  obsoleteContent: Array<{
    pgId: number;
    typeId: number;
    lastUpdated: Date;
    ageInDays: number;
  }>;
  missingVariables: Array<{
    pgId: number;
    typeId: number;
    missingVars: string[];
  }>;
  qualityScore: number;
  recommendations: string[];
}

export interface SeoMetrics {
  timestamp: Date;
  cacheHitRate: {
    overall: number;
    byPageType: Record<string, number>;
  };
  avgProcessingTime: {
    overall: number;
    byContext: Record<string, number>;
  };
  topTemplates: Array<{
    templateId: string;
    usageCount: number;
    avgPerformance: number;
  }>;
  unknownPages: {
    count: number;
    lastDetected: string[];
  };
  abTestResults: Array<{
    variantId: string;
    ctr: number;
    impressions: number;
  }>;
}

export interface SeoAbTestVariant {
  variantId: string;
  pgId: number;
  typeId: number;
  variant: 'conservative' | 'balanced' | 'creative';
  title: string;
  description: string;
  h1: string;
  impressions: number;
  clicks: number;
  ctr: number;
  isWinner: boolean;
  createdAt: Date;
}

export interface InternalLinkMetrics {
  linkType: 'LinkGammeCar' | 'LinkGammeCar_ID' | 'CompSwitch';
  totalGenerated: number;
  totalClicks: number;
  clickThroughRate: number;
  topPerformers: Array<{
    url: string;
    clicks: number;
    conversions: number;
  }>;
  avgPosition: number;
}

export interface SeoMetricsStats {
  cacheHits: number;
  cacheMisses: number;
  processingTimes: number[];
  unknownPagesDetected: Array<{
    pgId: number;
    typeId: number;
    timestamp: Date;
  }>;
}

// ====================================
// 📊 CONSTANTS
// ====================================

export const PRIX_PAS_CHER = [
  'pas cher',
  'à prix discount',
  'au meilleur prix',
  'prix bas',
  'tarif réduit',
  'économique',
  'abordable',
  'promotion',
  'déstockage',
  'soldes',
  'à petit prix',
  'prix cassé',
  'tarif imbattable',
  'offre spéciale',
  'prix attractif',
  'super prix',
] as const;

export const VOUS_PROPOSE = [
  'vous propose',
  'met à votre disposition',
  'vous offre',
  'vous présente',
  'dispose de',
  'commercialise',
  'vous garantit',
  'met en avant',
  'sélectionne pour vous',
  'recommande',
  'vous conseille',
  'présente',
] as const;

// FAMILY_SWITCH_DEFAULTS migré vers FAMILY_REGISTRY.seoSwitch dans @repo/database-types
// Re-export pour compatibilité
import { FAMILY_REGISTRY } from '@repo/database-types';
export const FAMILY_SWITCH_DEFAULTS: Record<number, string> =
  Object.fromEntries(
    Object.entries(FAMILY_REGISTRY).map(([id, meta]) => [
      Number(id),
      meta.seoSwitch,
    ]),
  );
