import { z } from 'zod';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🎯 Enums
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export enum ExperimentAction {
  EXCLUDE = 'exclude',
  INCLUDE = 'include',
  REDUCE = 'reduce',
}

export enum ExperimentStatus {
  DRAFT = 'draft',
  RUNNING = 'running',
  PAUSED = 'paused',
  COMPLETED = 'completed',
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 📋 Zod Schemas
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const CreateCrawlBudgetExperimentSchema = z.object({
  name: z.string().min(3).max(200),
  description: z.string().max(1000).optional(),
  action: z.nativeEnum(ExperimentAction),
  targetFamilies: z.array(z.string()).min(1),
  reductionPercent: z.number().min(0).max(100).optional(),
  durationDays: z.number().min(1).max(365).default(30),
});

export const UpdateExperimentStatusSchema = z.object({
  status: z.nativeEnum(ExperimentStatus),
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 📦 TypeScript Types (inferred from Zod)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export type CreateCrawlBudgetExperimentDto = z.infer<
  typeof CreateCrawlBudgetExperimentSchema
>;

export type UpdateExperimentStatusDto = z.infer<
  typeof UpdateExperimentStatusSchema
>;

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 📊 Interfaces
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface CrawlBudgetMetrics {
  experimentId: string;
  date: string;

  // Métriques de crawl (Google Search Console API)
  totalCrawledUrls: number;
  crawlRequestsCount: number;
  avgCrawlRate: number;

  // Métriques d'indexation (site:search ou API)
  indexedUrls: number;
  indexationRate: number;

  // Métriques par famille
  familyMetrics: {
    familyCode: string;
    crawledUrls: number;
    indexedUrls: number;
    avgPosition?: number; // Si GSC API disponible
  }[];

  // Trafic organique (Google Analytics)
  organicSessions?: number;
  organicConversions?: number;
}
