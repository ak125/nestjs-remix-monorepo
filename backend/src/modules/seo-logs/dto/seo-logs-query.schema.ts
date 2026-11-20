import { z } from 'zod';

/**
 * Contrat de validation des paramètres de requête des contrôleurs
 * `seo-logs/kpi` et `seo-logs/audit`, appliqué par
 * `StrictZodQueryValidationPipe` avant l'entrée dans la route.
 *
 * Règles :
 *   - une fenêtre ou une période appartient à une liste fermée ;
 *   - une limite est un entier décimal canonique, borné ;
 *   - un paramètre absent prend le défaut documenté de la route ;
 *   - toute autre valeur (vide, répétée, hors liste, hors borne, autre forme)
 *     est refusée en 400 : aucun repli silencieux sur le défaut.
 */

/** Fenêtres d'analyse acceptées par les routes `seo-logs/kpi`. */
export const SEO_KPI_TIME_WINDOWS = ['24h', '72h', '7d', '30d'] as const;
export type SeoKpiTimeWindow = (typeof SEO_KPI_TIME_WINDOWS)[number];

/** Périodes (en jours) acceptées par `seo-logs/audit/trends`. */
export const SEO_AUDIT_TREND_PERIODS_DAYS = [7, 14, 30, 60, 90] as const;

/** Bornes hautes des limites, par route. */
export const SEO_KPI_TOP_CRAWLERS_MAX_LIMIT = 50;
export const SEO_KPI_MOST_CRAWLED_URLS_MAX_LIMIT = 100;
export const SEO_AUDIT_LIST_MAX_LIMIT = 100;

const timeWindow = z.enum(SEO_KPI_TIME_WINDOWS).default('72h');

/**
 * Entier décimal canonique (`'1'`..`'999'`, sans signe, espace ni zéro de
 * tête), puis borne numérique `1..max`. Une valeur n'a qu'une écriture.
 */
const boundedLimit = (defaultValue: number, max: number) =>
  z
    .string()
    .regex(/^[1-9]\d{0,2}$/, {
      message: 'Must be a positive integer without leading zero',
    })
    .transform(Number)
    .pipe(
      z
        .number()
        .int()
        .min(1)
        .max(max, { message: `Must be at most ${max}` }),
    )
    .default(defaultValue);

const trendPeriodDays = z
  .enum(SEO_AUDIT_TREND_PERIODS_DAYS.map(String) as [string, ...string[]])
  .transform(Number)
  .default(30);

export const SeoKpiCrawlRateQuerySchema = z.object({ timeWindow });

export const SeoKpiTopCrawlersQuerySchema = z.object({
  timeWindow,
  limit: boundedLimit(10, SEO_KPI_TOP_CRAWLERS_MAX_LIMIT),
});

export const SeoKpiMostCrawledUrlsQuerySchema = z.object({
  timeWindow,
  limit: boundedLimit(20, SEO_KPI_MOST_CRAWLED_URLS_MAX_LIMIT),
});

/** `seo-logs/audit/history` et `seo-logs/audit/queue/jobs`. */
export const SeoAuditListQuerySchema = z.object({
  limit: boundedLimit(10, SEO_AUDIT_LIST_MAX_LIMIT),
});

export const SeoAuditTrendsQuerySchema = z.object({ period: trendPeriodDays });

export type SeoKpiCrawlRateQueryDto = z.infer<
  typeof SeoKpiCrawlRateQuerySchema
>;
export type SeoKpiTopCrawlersQueryDto = z.infer<
  typeof SeoKpiTopCrawlersQuerySchema
>;
export type SeoKpiMostCrawledUrlsQueryDto = z.infer<
  typeof SeoKpiMostCrawledUrlsQuerySchema
>;
export type SeoAuditListQueryDto = z.infer<typeof SeoAuditListQuerySchema>;
export type SeoAuditTrendsQueryDto = z.infer<typeof SeoAuditTrendsQuerySchema>;
