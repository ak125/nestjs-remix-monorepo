/**
 * Forme RÉELLE des réponses Search Analytics (SDK installé) — pas un résumé documentaire.
 *
 * Capture lecture seule du 2026-09-11 (fixture) : la sonde `dataState: 'all'` renvoie
 * `metadata.firstIncompleteDate` = J-2 UTC ; la même requête en dataState par défaut ne
 * renvoie AUCUNE clé `metadata`. La fin effective d'une reprise suit donc la finalité
 * démontrée par la sonde (veille de firstIncompleteDate), pas une ancre fixe
 * « veille » ou « J-2 » : la veille UTC n'est que la borne haute de planification.
 */
import type { searchconsole_v1 } from 'googleapis';
import {
  GSCDailyPageTotalsRowSchema,
  GSCDailyPropertyTotalRowSchema,
} from '@repo/seo-types';

import {
  parseFinalityProbe,
  resolveGscDayDecision,
} from '../../../src/modules/seo-monitoring/services/gsc-finality';
import {
  byPageDayFirstRows,
  CAPTURE_DAY,
  CAPTURE_TODAY_UTC,
  probeDataStateAll,
  probeDataStateDefault,
  propertyTotalDay,
} from './gsc-searchanalytics-2026-09-11.fixture';

// Compilation = preuve : ces clés existent dans les types du SDK installé.
const METADATA_KEY: keyof searchconsole_v1.Schema$Metadata =
  'firstIncompleteDate';
const RESPONSE_KEY: keyof searchconsole_v1.Schema$SearchAnalyticsQueryResponse =
  'metadata';

describe('Search Analytics — forme réelle (capture 2026-09-11)', () => {
  const probeEnd = '2026-09-10'; // veille UTC de la capture

  it('sonde dataState all : metadata.firstIncompleteDate présent (J-2 UTC), jours avec impressions', () => {
    expect(Object.keys(probeDataStateAll).sort()).toEqual([
      'metadata',
      'responseAggregationType',
      'rows',
    ]);
    expect(probeDataStateAll[RESPONSE_KEY]?.[METADATA_KEY]).toBe('2026-09-09');
    const probe = parseFinalityProbe(probeDataStateAll, probeEnd);
    expect(probe.firstIncompleteDate).toBe('2026-09-09');
    expect(probe.datesWithData.size).toBe(8);
  });

  it('borne de reprise = finalité démontrée : dernier jour final J-3, J-2 et veille écartés sans écriture', () => {
    const probe = parseFinalityProbe(probeDataStateAll, probeEnd);
    expect(CAPTURE_TODAY_UTC).toBe('2026-09-11');
    expect(resolveGscDayDecision('2026-09-03', probe)).toEqual({
      kind: 'fetch',
      finalityProof: 'metadata',
    });
    expect(resolveGscDayDecision(CAPTURE_DAY, probe)).toEqual({
      kind: 'fetch',
      finalityProof: 'metadata',
    });
    // des lignes existent pour 09-09 / 09-10 en dataState all : présentes ≠ finales
    expect(probe.datesWithData.has('2026-09-09')).toBe(true);
    expect(resolveGscDayDecision('2026-09-09', probe)).toEqual({
      kind: 'skip_not_final',
    });
    expect(resolveGscDayDecision('2026-09-10', probe)).toEqual({
      kind: 'skip_not_final',
    });
  });

  it('sans dataState all : aucune clé metadata → finalité non prouvée (jamais supposée)', () => {
    expect('metadata' in probeDataStateDefault).toBe(false);
    const probe = parseFinalityProbe(probeDataStateDefault, probeEnd);
    expect(probe.firstIncompleteDate).toBeNull();
    expect(resolveGscDayDecision(CAPTURE_DAY, probe)).toEqual({
      kind: 'fetch',
      finalityProof: 'final_rows_required',
    });
    expect(resolveGscDayDecision('2026-09-09', probe)).toEqual({
      kind: 'skip_finality_unknown',
    });
  });

  it('total propriété réel : une seule ligne sans keys, conforme au contrat property_total', () => {
    expect(propertyTotalDay.responseAggregationType).toBe('byProperty');
    expect(propertyTotalDay.rows).toHaveLength(1);
    const row = propertyTotalDay.rows[0];
    expect('keys' in row).toBe(false);
    expect(
      GSCDailyPropertyTotalRowSchema.safeParse({ date: CAPTURE_DAY, ...row })
        .success,
    ).toBe(true);
  });

  it('grain page byPage réel : clé = URL absolue, lignes conformes au contrat page_totals (mapping du fetcher)', () => {
    expect(byPageDayFirstRows.responseAggregationType).toBe('byPage');
    for (const r of byPageDayFirstRows.rows) {
      expect(r.keys).toHaveLength(1);
      expect(r.keys[0]).toMatch(/^https:\/\/www\.automecanik\.com\//);
      const parsed = GSCDailyPageTotalsRowSchema.safeParse({
        date: CAPTURE_DAY,
        page: r.keys[0],
        clicks: r.clicks,
        impressions: r.impressions,
        ctr: r.ctr,
        position: r.position,
      });
      expect(parsed.success).toBe(true);
    }
  });
});
