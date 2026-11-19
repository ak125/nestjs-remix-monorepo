import { ZodError } from 'zod';

import {
  SEO_AUDIT_LIST_MAX_LIMIT,
  SEO_AUDIT_TREND_PERIODS_DAYS,
  SEO_KPI_MOST_CRAWLED_URLS_MAX_LIMIT,
  SEO_KPI_TIME_WINDOWS,
  SEO_KPI_TOP_CRAWLERS_MAX_LIMIT,
  SeoAuditListQuerySchema,
  SeoAuditTrendsQuerySchema,
  SeoKpiCrawlRateQuerySchema,
  SeoKpiMostCrawledUrlsQuerySchema,
  SeoKpiTopCrawlersQuerySchema,
} from './seo-logs-query.schema';

// Caractères qu'un interpréteur de commandes traite à part. Chacun est accolé
// à une valeur valide : la valeur entière doit être refusée.
const SHELL_SPECIAL_CHARACTERS = [...' \t\n;&|$`\\\'"<>(){}[]*?!#~=%'] as const;

/**
 * Contrat de validation des paramètres de requête `seo-logs/kpi` et
 * `seo-logs/audit` : liste fermée pour une fenêtre ou une période, entier
 * borné pour une limite, défaut seulement si le paramètre est absent.
 * Une `ZodError` devient un 400 dans `StrictZodQueryValidationPipe`.
 */
describe('seo-logs — schémas des paramètres de requête', () => {
  describe('timeWindow (liste fermée)', () => {
    it.each(SEO_KPI_TIME_WINDOWS.map((value) => [value]))(
      'accepte timeWindow=%s',
      (value) => {
        expect(SeoKpiCrawlRateQuerySchema.parse({ timeWindow: value })).toEqual(
          { timeWindow: value },
        );
      },
    );

    it('applique le défaut 72h quand le paramètre est absent', () => {
      expect(SeoKpiCrawlRateQuerySchema.parse({})).toEqual({
        timeWindow: '72h',
      });
    });

    it.each([
      [''],
      ['1h'],
      ['3d'],
      ['72'],
      ['72H'],
      [' 72h'],
      ['72h '],
      ['720h'],
      ['7j'],
    ])('refuse timeWindow=%j (hors liste)', (value) => {
      expect(() =>
        SeoKpiCrawlRateQuerySchema.parse({ timeWindow: value }),
      ).toThrow(ZodError);
    });

    it('refuse un paramètre répété ou structuré', () => {
      expect(() =>
        SeoKpiCrawlRateQuerySchema.parse({ timeWindow: ['72h', '7d'] }),
      ).toThrow(ZodError);
      expect(() =>
        SeoKpiCrawlRateQuerySchema.parse({ timeWindow: { a: '72h' } }),
      ).toThrow(ZodError);
    });

    it.each(SHELL_SPECIAL_CHARACTERS.map((char) => [char]))(
      'refuse une fenêtre valide accompagnée du caractère %j',
      (char) => {
        for (const value of [`72h${char}`, `${char}72h`, `7${char}d`]) {
          expect(() =>
            SeoKpiCrawlRateQuerySchema.parse({ timeWindow: value }),
          ).toThrow(ZodError);
        }
      },
    );
  });

  describe('limit (entier borné)', () => {
    const cases = [
      ['top-crawlers', SeoKpiTopCrawlersQuerySchema, 10, 50],
      ['most-crawled-urls', SeoKpiMostCrawledUrlsQuerySchema, 20, 100],
      ['audit (history, queue/jobs)', SeoAuditListQuerySchema, 10, 100],
    ] as const;

    it('porte les bornes hautes déclarées', () => {
      expect(SEO_KPI_TOP_CRAWLERS_MAX_LIMIT).toBe(50);
      expect(SEO_KPI_MOST_CRAWLED_URLS_MAX_LIMIT).toBe(100);
      expect(SEO_AUDIT_LIST_MAX_LIMIT).toBe(100);
    });

    describe.each(cases)('%s', (_route, schema, defaultValue, max) => {
      it('applique le défaut quand le paramètre est absent', () => {
        expect(schema.parse({}).limit).toBe(defaultValue);
      });

      it.each([
        ['1', 1],
        ['7', 7],
        [String(max), max],
      ])('accepte limit=%s et rend le nombre %i', (value, expected) => {
        expect(schema.parse({ limit: value }).limit).toBe(expected);
      });

      it.each([
        [''],
        ['0'],
        ['-1'],
        ['+5'],
        ['05'],
        ['1.5'],
        ['1e2'],
        ['0x10'],
        [' 5'],
        ['5 '],
        ['abc'],
        ['NaN'],
        [String(max + 1)],
        ['1000'],
        ['99999999999999999999'],
      ])('refuse limit=%j', (value) => {
        expect(() => schema.parse({ limit: value })).toThrow(ZodError);
      });

      it('refuse un nombre déjà typé, un paramètre répété ou structuré', () => {
        expect(() => schema.parse({ limit: 5 })).toThrow(ZodError);
        expect(() => schema.parse({ limit: ['5', '6'] })).toThrow(ZodError);
        expect(() => schema.parse({ limit: { a: '5' } })).toThrow(ZodError);
      });

      it.each(SHELL_SPECIAL_CHARACTERS.map((char) => [char]))(
        'refuse une limite valide accompagnée du caractère %j',
        (char) => {
          for (const value of [`5${char}`, `${char}5`, `1${char}0`]) {
            expect(() => schema.parse({ limit: value })).toThrow(ZodError);
          }
        },
      );
    });
  });

  describe('period (liste fermée, en jours)', () => {
    it.each(SEO_AUDIT_TREND_PERIODS_DAYS.map((days) => [String(days), days]))(
      'accepte period=%s et rend le nombre %i',
      (value, expected) => {
        expect(SeoAuditTrendsQuerySchema.parse({ period: value })).toEqual({
          period: expected,
        });
      },
    );

    it('applique le défaut 30 quand le paramètre est absent', () => {
      expect(SeoAuditTrendsQuerySchema.parse({})).toEqual({ period: 30 });
    });

    it.each([
      [''],
      ['0'],
      ['1'],
      ['31'],
      ['365'],
      ['030'],
      ['30d'],
      ['-30'],
      ['+30'],
      ['30.0'],
      [' 30'],
    ])('refuse period=%j (hors liste)', (value) => {
      expect(() => SeoAuditTrendsQuerySchema.parse({ period: value })).toThrow(
        ZodError,
      );
    });

    it('refuse un nombre déjà typé ou un paramètre répété', () => {
      expect(() => SeoAuditTrendsQuerySchema.parse({ period: 30 })).toThrow(
        ZodError,
      );
      expect(() =>
        SeoAuditTrendsQuerySchema.parse({ period: ['30', '7'] }),
      ).toThrow(ZodError);
    });

    it.each(SHELL_SPECIAL_CHARACTERS.map((char) => [char]))(
      'refuse une période valide accompagnée du caractère %j',
      (char) => {
        for (const value of [`30${char}`, `${char}30`, `3${char}0`]) {
          expect(() =>
            SeoAuditTrendsQuerySchema.parse({ period: value }),
          ).toThrow(ZodError);
        }
      },
    );
  });
});
