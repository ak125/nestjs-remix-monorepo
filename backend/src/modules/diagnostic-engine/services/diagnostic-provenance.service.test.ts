import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { FeatureFlagsService } from '../../../config/feature-flags.service';
import type {
  DiagLinkProvenance,
  DiagMergedCauseLink,
  DiagnosticEngineDataService,
} from '../diagnostic-engine.data-service';
import { HypothesisScoringEngine } from '../engines/hypothesis-scoring.engine';
import {
  DIAGNOSTIC_PROVENANCE_EVALUATED,
  DiagnosticProvenanceService,
} from './diagnostic-provenance.service';

const EXPOSE = 'DIAGNOSTIC_PROVENANCE_EXPOSE_ENABLED';
const PRIMARY = 'DIAGNOSTIC_PROVENANCE_PRIMARY_ENABLED';

/** A merged cause as getScoredCausesForSymptoms returns it. */
function cause(
  slug: string,
  causeId: number,
  contributions: Array<[linkId: number, symptomSlug: string, score: number]>,
  symptomCount = contributions.length,
): DiagMergedCauseLink {
  const scores = contributions.map(([, , score]) => score);
  return {
    id: contributions[0][0],
    symptom_id: 1,
    cause_id: causeId,
    relative_score: Math.round(
      scores.reduce((a, b) => a + b, 0) / symptomCount,
    ),
    evidence_for: ['Symptôme déclaré'],
    evidence_against: [],
    requires_verification: true,
    active: true,
    cause: {
      id: causeId,
      slug,
      system_id: 1,
      label: slug,
      cause_type: 'component_fault',
      description: null,
      verification_method: null,
      urgency: 'moyenne',
      active: true,
    },
    contributions: contributions.map(
      ([link_id, symptom_slug, relative_score]) => ({
        link_id,
        symptom_slug,
        relative_score,
      }),
    ),
    symptom_count: symptomCount,
  };
}

const row = (
  linkId: number,
  wikiPath: string,
  diagnosticSafe: boolean,
): DiagLinkProvenance => ({
  link_id: linkId,
  wiki_path: wikiPath,
  gamme_slug: wikiPath.replace(/^gammes\/|\.md$/g, ''),
  relation_to_part: 'direct_cause',
  diagnostic_safe: diagnosticSafe,
});

// 2 symptoms selected. alternateur: both, one documented but not safe, one
// undocumented. batterie: only one of the 2, documented and safe — the missing
// symptom counts 0 in the mean. The reference ranking puts the alternateur
// first (80 > 30); diagnostic_safe alone would put the batterie first (50 > 0).
const LINKS = [
  cause('alternateur-hs', 1, [
    [11, 'batterie-temoin-allume', 80],
    [12, 'demarrage-difficile', 80],
  ]),
  cause('batterie-dechargee', 2, [[21, 'demarrage-difficile', 60]], 2),
];
const ROWS = [
  row(11, 'gammes/alternateur.md', false),
  row(21, 'gammes/batterie.md', true),
  row(21, 'gammes/demarreur.md', false),
];

function setup(
  env: Record<string, string>,
  read?: (ids: number[]) => Promise<DiagLinkProvenance[]>,
) {
  const flags = new FeatureFlagsService({
    get: (key: string) => env[key],
  } as unknown as ConfigService);
  const getLiveLinkProvenance = jest.fn(
    read ??
      (async (ids: number[]) => ROWS.filter((r) => ids.includes(r.link_id))),
  );
  const events = new EventEmitter2();
  const emitted: unknown[] = [];
  events.on(DIAGNOSTIC_PROVENANCE_EVALUATED, (payload) =>
    emitted.push(payload),
  );
  const service = new DiagnosticProvenanceService(
    { getLiveLinkProvenance } as unknown as DiagnosticEngineDataService,
    flags,
    events,
  );
  const logger = { warn: jest.fn(), error: jest.fn(), log: jest.fn() };
  Object.assign(service, { logger });
  const engine = new HypothesisScoringEngine();
  const rank = (links = LINKS) =>
    service.rank(links, (l) => engine.score(l, undefined));
  const reference = (links = LINKS) => engine.score(links, undefined);
  return {
    service,
    flags,
    rank,
    reference,
    getLiveLinkProvenance,
    emitted,
    logger,
  };
}

const ids = (hypotheses: Array<{ hypothesis_id: string }>) =>
  hypotheses.map((h) => h.hypothesis_id);

describe('DiagnosticProvenanceService', () => {
  it('flags OFF: the reference ranking, no read, no event', async () => {
    const t = setup({});
    const result = await t.rank();
    expect(result).toEqual({ hypotheses: t.reference(), provenance: null });
    expect(t.getLiveLinkProvenance).not.toHaveBeenCalled();
    expect(t.emitted).toEqual([]);
  });

  it('PRIMARY without EXPOSE is ignored, with one warning per process', async () => {
    const t = setup({ [PRIMARY]: 'true' });
    t.service.onModuleInit();
    const first = await t.rank();
    await t.rank();
    expect(first).toEqual({ hypotheses: t.reference(), provenance: null });
    expect(t.getLiveLinkProvenance).not.toHaveBeenCalled();
    expect(t.logger.warn).toHaveBeenCalledTimes(1);
    expect(t.logger.warn.mock.calls[0][0]).toMatch(
      new RegExp(`${PRIMARY}.*${EXPOSE}`),
    );
  });

  it('EXPOSE: shows the provenance without moving the ranking, and measures what PRIMARY would move', async () => {
    const t = setup({ [EXPOSE]: 'true' });
    const { hypotheses, provenance } = await t.rank();

    expect(hypotheses).toEqual(t.reference());
    expect(ids(hypotheses)).toEqual(['alternateur-hs', 'batterie-dechargee']);
    expect(t.getLiveLinkProvenance).toHaveBeenCalledTimes(1);
    expect([...t.getLiveLinkProvenance.mock.calls[0][0]].sort()).toEqual([
      11, 12, 21,
    ]);

    expect(provenance?.summary).toEqual({
      status: 'available',
      counts: { sourced: 1, partial: 1, unsourced: 0 },
    });
    expect(provenance?.byHypothesis.get('alternateur-hs')).toEqual({
      state: 'partial',
      links: [
        {
          link_id: 11,
          symptom_slug: 'batterie-temoin-allume',
          documented: true,
          wiki_refs: [
            {
              wiki_path: 'gammes/alternateur.md',
              gamme_slug: 'alternateur',
              relation_to_part: 'direct_cause',
              diagnostic_safe: false,
            },
          ],
        },
        {
          link_id: 12,
          symptom_slug: 'demarrage-difficile',
          documented: false,
          wiki_refs: [],
        },
      ],
    });
    expect(provenance?.byHypothesis.get('batterie-dechargee')?.state).toBe(
      'sourced',
    );
    expect(
      provenance?.byHypothesis.get('batterie-dechargee')?.links[0].wiki_refs,
    ).toHaveLength(2);

    expect(t.emitted).toEqual([
      {
        mode: 'expose',
        status: 'available',
        top_state: 'partial',
        rank_changed: true,
      },
    ]);
  });

  it('EXPOSE + PRIMARY: each contribution weighs 100 when its link is diagnostic_safe, else 0', async () => {
    const t = setup({ [EXPOSE]: 'true', [PRIMARY]: 'true' });
    const { hypotheses, provenance } = await t.rank();

    expect(ids(hypotheses)).toEqual(['batterie-dechargee', 'alternateur-hs']);
    // batterie: 1 safe contribution over 2 selected symptoms = 50 → 15.
    expect(hypotheses.map((h) => h.signal_match_score)).toEqual([15, 0]);
    expect(provenance?.summary).toEqual({
      status: 'available',
      counts: { sourced: 1, partial: 1, unsourced: 0 },
    });
    expect(t.emitted).toEqual([
      {
        mode: 'primary',
        status: 'available',
        top_state: 'sourced',
        rank_changed: true,
      },
    ]);
    expect(t.logger.warn).not.toHaveBeenCalled();
  });

  it('PRIMARY: 2 symptoms with 1 safe link weigh 50, rounded once (signal_match 15)', async () => {
    const t = setup({ [EXPOSE]: 'true', [PRIMARY]: 'true' }, async () => [
      row(31, 'gammes/pompe-a-eau.md', true),
    ]);
    const links = [
      cause('pompe-a-eau', 3, [
        [31, 'surchauffe', 10],
        [32, 'fuite-liquide', 10],
      ]),
    ];
    const { hypotheses, provenance } = await t.rank(links);
    expect(hypotheses[0].signal_match_score).toBe(15);
    expect(t.reference(links)[0].signal_match_score).toBe(3);
    expect(provenance?.byHypothesis.get('pompe-a-eau')?.state).toBe('partial');
  });

  it('a documented link that is not diagnostic_safe weighs 0 under PRIMARY but is still sourced', async () => {
    const t = setup({ [EXPOSE]: 'true', [PRIMARY]: 'true' }, async () => [
      row(41, 'gammes/courroie.md', false),
    ]);
    const links = [cause('courroie-usee', 4, [[41, 'bruit-moteur', 90]])];
    const { hypotheses, provenance } = await t.rank(links);
    expect(hypotheses[0].signal_match_score).toBe(0);
    expect(provenance?.byHypothesis.get('courroie-usee')?.state).toBe(
      'sourced',
    );
    expect(provenance?.summary).toEqual({
      status: 'available',
      counts: { sourced: 1, partial: 0, unsourced: 0 },
    });
  });

  it('a link nobody documented is unsourced, and the ranking is unchanged under EXPOSE', async () => {
    const t = setup({ [EXPOSE]: 'true' }, async () => []);
    const { hypotheses, provenance } = await t.rank();
    expect(hypotheses).toEqual(t.reference());
    expect(provenance?.summary).toEqual({
      status: 'available',
      counts: { sourced: 0, partial: 0, unsourced: 2 },
    });
    expect(t.emitted).toEqual([
      {
        mode: 'expose',
        status: 'available',
        top_state: 'unsourced',
        rank_changed: false,
      },
    ]);
  });

  it('an unreadable provenance is unavailable — never unsourced — and the reference ranking is kept', async () => {
    const t = setup({ [EXPOSE]: 'true', [PRIMARY]: 'true' }, async () => {
      throw new Error('__diag_link_provenance unavailable: permission denied');
    });
    const { hypotheses, provenance } = await t.rank();

    expect(hypotheses).toEqual(t.reference());
    expect(provenance?.summary).toEqual({ status: 'unavailable' });
    expect(provenance?.byHypothesis.size).toBe(0);
    expect(t.logger.error).toHaveBeenCalledTimes(1);
    expect(t.emitted).toEqual([{ mode: 'primary', status: 'unavailable' }]);
  });

  it('reads the flags on every call: a runtime override applies without restart', async () => {
    const t = setup({});
    expect((await t.rank()).provenance).toBeNull();
    t.flags.setOverride(EXPOSE, 'true');
    expect((await t.rank()).provenance?.summary.status).toBe('available');
    t.flags.setOverride(PRIMARY, 'true');
    expect(ids((await t.rank()).hypotheses)).toEqual([
      'batterie-dechargee',
      'alternateur-hs',
    ]);
    t.flags.setOverride(EXPOSE, 'false');
    const off = await t.rank();
    expect(off).toEqual({ hypotheses: t.reference(), provenance: null });
    expect(t.logger.warn).toHaveBeenCalledTimes(1);
  });
});
