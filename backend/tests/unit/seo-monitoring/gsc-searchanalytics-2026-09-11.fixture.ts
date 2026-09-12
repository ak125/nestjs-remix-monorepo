/**
 * Réponses Search Analytics RÉELLES, capturées en lecture seule le 2026-09-11T09:49:46.997Z
 * (googleapis@164.1.0, scope webmasters.readonly, requêtes identiques à celles du fetcher).
 * Lignes tronquées pour le grain page ; les sommes complètes du jour sont consignées
 * dans `CAPTURE_EVIDENCE` (preuve documentaire — aucune égalité n'est attendue entre
 * agrégations différentes). `satisfies` : un champ absent des types du SDK installé
 * fait échouer la compilation du test.
 */
import type { searchconsole_v1 } from 'googleapis';

type QueryResponse = searchconsole_v1.Schema$SearchAnalyticsQueryResponse;

export const CAPTURE_TODAY_UTC = '2026-09-11';

/** Sonde du fetcher : dimensions ['date'], dataState 'all', 2026-09-03 → 2026-09-10 (veille UTC). */
export const probeDataStateAll = {
  rows: [
    {
      keys: ['2026-09-03'],
      clicks: 47,
      impressions: 6274,
      ctr: 0.007491233662735098,
      position: 25.131176283073,
    },
    {
      keys: ['2026-09-04'],
      clicks: 67,
      impressions: 5294,
      ctr: 0.012655836796373252,
      position: 22.99678881752928,
    },
    {
      keys: ['2026-09-05'],
      clicks: 65,
      impressions: 4803,
      ctr: 0.013533208411409536,
      position: 19.971892567145535,
    },
    {
      keys: ['2026-09-06'],
      clicks: 68,
      impressions: 4797,
      ctr: 0.014175526370648322,
      position: 19.907025224098394,
    },
    {
      keys: ['2026-09-07'],
      clicks: 73,
      impressions: 5472,
      ctr: 0.0133406432748538,
      position: 17.89967105263158,
    },
    {
      keys: ['2026-09-08'],
      clicks: 72,
      impressions: 5581,
      ctr: 0.012900913814728543,
      position: 19.002150152302455,
    },
    {
      keys: ['2026-09-09'],
      clicks: 67,
      impressions: 5507,
      ctr: 0.012166333757036499,
      position: 19.629017613945887,
    },
    {
      keys: ['2026-09-10'],
      clicks: 68,
      impressions: 4345,
      ctr: 0.015650172612197928,
      position: 16.682623705408517,
    },
  ],
  responseAggregationType: 'byProperty',
  metadata: {
    firstIncompleteDate: '2026-09-09',
  },
} satisfies QueryResponse;

/** Même requête SANS dataState (défaut « final ») : aucune clé metadata, jours finaux seulement. */
export const probeDataStateDefault = {
  rows: [
    {
      keys: ['2026-09-03'],
      clicks: 47,
      impressions: 6274,
      ctr: 0.007491233662735098,
      position: 25.131176283073,
    },
    {
      keys: ['2026-09-04'],
      clicks: 67,
      impressions: 5294,
      ctr: 0.012655836796373252,
      position: 22.99678881752928,
    },
    {
      keys: ['2026-09-05'],
      clicks: 65,
      impressions: 4803,
      ctr: 0.013533208411409536,
      position: 19.971892567145535,
    },
    {
      keys: ['2026-09-06'],
      clicks: 68,
      impressions: 4797,
      ctr: 0.014175526370648322,
      position: 19.907025224098394,
    },
    {
      keys: ['2026-09-07'],
      clicks: 73,
      impressions: 5472,
      ctr: 0.0133406432748538,
      position: 17.89967105263158,
    },
    {
      keys: ['2026-09-08'],
      clicks: 72,
      impressions: 5581,
      ctr: 0.012900913814728543,
      position: 19.002150152302455,
    },
  ],
  responseAggregationType: 'byProperty',
} satisfies QueryResponse;

/** Dernier jour final au moment de la capture (veille de firstIncompleteDate). */
export const CAPTURE_DAY = '2026-09-08';

/** Total propriété du jour : aucune dimension → une ligne sans `keys`. */
export const propertyTotalDay = {
  rows: [
    {
      clicks: 72,
      impressions: 5581,
      ctr: 0.012900913814728543,
      position: 19.002150152302455,
    },
  ],
  responseAggregationType: 'byProperty',
} satisfies QueryResponse;

/** Grain page fidèle : dimensions ['page'], aggregationType 'byPage' — 2 lignes sur 2384. */
export const byPageDayFirstRows = {
  rows: [
    {
      keys: ['https://www.automecanik.com/'],
      clicks: 2,
      impressions: 29,
      ctr: 0.06896551724137931,
      position: 19.24137931034483,
    },
    {
      keys: [
        'https://www.automecanik.com/blog-pieces-auto/conseils/contacteur-de-feu-de-recul',
      ],
      clicks: 2,
      impressions: 26,
      ctr: 0.07692307692307693,
      position: 11.923076923076923,
    },
  ],
  responseAggregationType: 'byPage',
} satisfies QueryResponse;

export const CAPTURE_EVIDENCE = {
  day: '2026-09-08',
  property_total: { clicks: 72, impressions: 5581 },
  by_page: { rows: 2384, clicks: 73, impressions: 5756 },
  page_country_device: {
    rows: 1053,
    clicks: 3,
    impressions: 2248,
  },
} as const;
