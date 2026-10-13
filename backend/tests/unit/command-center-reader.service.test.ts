import { buildCertificationActions } from '../../src/modules/admin/services/command-center-action-rules/certification-action.rules';
import {
  toDiagnosticToProductKpi,
  toPagesGeneratingAtcKpi,
} from '../../src/modules/admin/services/command-center-action-rules/department-kpi.rules';
jest.mock('../../src/cache/cache.service', () => ({ CacheService: class {} }));
jest.mock(
  '../../src/modules/admin/services/command-center-actions.service',
  () => ({ CommandCenterActionsService: class {} }),
);
jest.mock(
  '../../src/modules/admin/services/command-center-kpi.service',
  () => ({ CommandCenterKpiService: class {} }),
);
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import {
  CommandCenterResponseV2Schema,
  toCommandCenterV1,
  CommandCenterDigestSchema,
} from '@repo/registry';
import { join } from 'path';
import {
  CommandCenterReaderService,
  resolveCommandCenterMode,
  toCommandCenterDigest,
  type CommandCenterResponse,
} from '../../src/modules/admin/services/command-center-reader.service';

/**
 * Unit tests for CommandCenterReaderService. Fixture directories via REGISTRY_DIR
 * (no fs mocking), CacheService stubbed. Mirrors registry-reader.service.test.ts.
 *
 * The `full` fixture uses last_verified=2020-01-01 → always STALE, and a
 * data(UNKNOWN)→sales chain so both LIVE caps are exercised deterministically.
 */
const FIXTURES = join(__dirname, 'fixtures', 'command-center');

function makeService(
  scenario: 'full' | 'missing',
  registryDir = join(FIXTURES, scenario),
) {
  process.env.REGISTRY_DIR = registryDir;
  const cache = {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
  };
  // Mock the live action engine — the reader's only job here is to wire it in
  // (full + non-degraded → call it; light/degraded → []), not to run real queries.
  const actions = {
    computeActionQueue: jest.fn().mockResolvedValue([]),
  };
  // Same for the DB-measured KPIs: the reader only appends what the service returns.
  const kpis = {
    computeLiveKpis: jest.fn().mockResolvedValue([]),
  };
  return {
    service: new CommandCenterReaderService(
      cache as never,
      actions as never,
      kpis as never,
    ),
    cache,
    actions,
    kpis,
  };
}

describe('CommandCenterReaderService', () => {
  it('sans session : rapport et digest conservent le zéro et la cause sans faux rouge', async () => {
    const { service, kpis } = makeService(
      'full',
      join(__dirname, '../../../audit/registry'),
    );
    kpis.computeLiveKpis.mockResolvedValue([
      {
        kpi: toDiagnosticToProductKpi({ sessions: 0, reachedProduct: 0 }, 30),
        sample_size: 0,
        window_days: 30,
        previous_value: 2,
        better: 'higher',
      },
    ]);
    const response = CommandCenterResponseV2Schema.parse(
      await service.getCommandCenter(),
    );
    expect(
      response.executive_kpis.find((k) => k.id === 'diagnostic_to_product'),
    ).toMatchObject({
      value: 0,
      unit: '/0',
      status: 'UNKNOWN',
      certified: true,
    });
    const digest = CommandCenterDigestSchema.parse(
      toCommandCenterDigest(response),
    );
    const report = digest.department_reports.find(
      (r) => r.kpi.id === 'diagnostic_to_product',
    );
    expect(report).toMatchObject({
      kpi: { value: 0, unit: '/0', measure: 'MESURE' },
      score: 'NON_MESURE',
      evolution: 'INCONNUE',
      owner_go_required: false,
    });
    expect(report?.gap).toMatch(/aucune session exploitable/i);
    expect(report?.next_evidence).toMatch(/collecte/);
    expect(
      toCommandCenterV1(response).department_reports.find(
        (r) => r.kpi.id === 'diagnostic_to_product',
      ),
    ).toEqual(report);
  });

  const ORIGINAL_ENV = process.env.REGISTRY_DIR;
  afterAll(() => {
    process.env.REGISTRY_DIR = ORIGINAL_ENV;
  });

  it.each([
    { kpi: toPagesGeneratingAtcKpi(48, 30), value: 48, unit: null },
    {
      kpi: toDiagnosticToProductKpi({ sessions: 5000, reachedProduct: 1 }, 30),
      value: 1,
      unit: '/5000',
    },
  ])(
    '$kpi.id : le producteur réel ne transmet aucun faux vert au digest',
    async ({ kpi, value, unit }) => {
      const { service, kpis } = makeService(
        'full',
        join(__dirname, '../../../audit/registry'),
      );
      kpis.computeLiveKpis.mockResolvedValue([
        {
          kpi,
          window_days: 30,
          previous_value: null,
          better: 'higher',
        },
      ]);
      const response = CommandCenterResponseV2Schema.parse(
        await service.getCommandCenter(),
      );
      expect(
        response.executive_kpis.find((k) => k.id === kpi.id),
      ).toMatchObject({
        value,
        status: 'UNKNOWN',
        certified: true,
      });
      const digest = CommandCenterDigestSchema.parse(
        toCommandCenterDigest(response),
      );
      const report = digest.department_reports.find((r) => r.kpi.id === kpi.id);
      expect(report).toMatchObject({
        kpi: { value, unit, measure: 'MESURE' },
        score: 'NON_MESURE',
        decision: 'IMPROVE',
        owner_go_required: true,
      });
      expect(report?.next_evidence).toMatch(/cible|critère/);
      expect(
        toCommandCenterV1(response).department_reports.find(
          (r) => r.kpi.id === kpi.id,
        ),
      ).toEqual(report);
    },
  );

  describe('full snapshot', () => {
    let res: CommandCenterResponse;
    beforeAll(async () => {
      const { service } = makeService('full');
      res = await service.getCommandCenter();
    });

    it('is not degraded and passes the snapshot through', () => {
      expect(res.degraded).toBe(false);
      expect(res.departments).toHaveLength(3);
      expect(res.schema_version).toBe('command-center.v2');
    });

    it('computes a live stale_status from last_verified (2020 → STALE)', () => {
      expect(res.stale_status).toBe('STALE');
    });

    it('applies the stale LIVE cap (≤79) to an otherwise-90 department', () => {
      const ops = res.departments.find((d) => d.id === 'ops')!;
      expect(ops.health_score_current).toBe(79);
      expect(ops.live_caps_applied).toContain('source_stale_max_79');
    });

    it('applies the cross-module cap (≤69) to sales (downstream of UNKNOWN data)', () => {
      const sales = res.departments.find((d) => d.id === 'sales')!;
      expect(sales.health_score_current).toBe(69);
      expect(sales.live_caps_applied).toContain('upstream_unreliable_max_69');
    });

    it('global_status is WARNING / PARTIAL_READY (stale + incomplete handoff + no-evidence)', () => {
      expect(res.global_status.level).toBe('WARNING');
      expect(res.global_status.verdict).toBe('PARTIAL_READY');
      expect(res.global_status.reasons.length).toBeGreaterThan(0);
    });

    it('caches with the OK ttl (60s)', () => {
      const { service, cache } = makeService('full');
      return service.getCommandCenter().then(() => {
        expect(cache.set).toHaveBeenCalledWith(
          expect.any(String),
          expect.any(Object),
          60,
        );
      });
    });
  });

  describe('missing snapshot', () => {
    let res: CommandCenterResponse;
    let cacheRef: { set: jest.Mock };
    beforeAll(async () => {
      const { service, cache } = makeService('missing');
      cacheRef = cache;
      res = await service.getCommandCenter();
    });

    it('fully degrades WITHOUT throwing', () => {
      expect(res.degraded).toBe(true);
      expect(res.departments).toEqual([]);
      expect(res.global_status.verdict).toBe('BLOCKED');
      expect(res.global_status.reasons[0]).toMatch(/snapshot_unavailable/);
    });

    it('caches the degraded result with the short ttl (15s)', () => {
      expect(cacheRef.set).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        15,
      );
    });
  });

  describe('cache hit short-circuits', () => {
    it('returns the cached response without rebuilding', async () => {
      process.env.REGISTRY_DIR = join(FIXTURES, 'full');
      const cached = await makeService('full').service.getCommandCenter();
      const cache = {
        get: jest.fn().mockResolvedValue(cached),
        set: jest.fn(),
      };
      const actions = { computeActionQueue: jest.fn().mockResolvedValue([]) };
      const kpis = { computeLiveKpis: jest.fn().mockResolvedValue([]) };
      const service = new CommandCenterReaderService(
        cache as never,
        actions as never,
        kpis as never,
      );
      const result = await service.getCommandCenter();
      expect(result).toEqual(cached);
      expect(cache.set).not.toHaveBeenCalled();
      expect(actions.computeActionQueue).not.toHaveBeenCalled();
      expect(kpis.computeLiveKpis).not.toHaveBeenCalled();
    });
  });

  describe('action_queue wiring (live engine)', () => {
    const SAMPLE = [
      {
        id: 'seo:opportunity:R2',
        title: 't',
        department: 'seo',
        source: 'seo',
        action_type: 'business',
        impact: 8,
        urgency: 7,
        data_confidence: 90,
        effort: 4,
        risk: 1,
        score: 19,
        reason: 'r',
        evidence: [],
        next_step: 'n',
        owner_go_required: true,
        details: null,
      },
    ];

    it('full + non-degraded: action_queue is populated from computeActionQueue', async () => {
      const { service, actions } = makeService('full');
      (actions.computeActionQueue as jest.Mock).mockResolvedValue(SAMPLE);
      const res = await service.getCommandCenter();
      expect(actions.computeActionQueue).toHaveBeenCalledWith(
        expect.any(Array),
        expect.any(Array),
        'full',
      );
      expect(res.action_queue).toEqual(SAMPLE);
    });

    it('degraded: action_queue is [] and the engine is NEVER called', async () => {
      const { service, actions } = makeService('missing');
      const res = await service.getCommandCenter();
      expect(res.action_queue).toEqual([]);
      expect(actions.computeActionQueue).not.toHaveBeenCalled();
    });
  });

  describe('executive_kpis wiring (measured in DB)', () => {
    const LIVE = {
      id: 'payments_kept',
      label: 'Ventes — paiements gardés / payés (30 j)',
      value: 0,
      unit: '/2',
      status: 'CRITICAL',
      source: 'db',
      certified: true,
    };
    const MEASURES = [
      { kpi: LIVE, window_days: 30, previous_value: 1, better: 'higher' },
    ];

    it('full + non-degraded: measured KPIs are appended to the snapshot ones', async () => {
      const { service, kpis } = makeService('full');
      (kpis.computeLiveKpis as jest.Mock).mockResolvedValue(MEASURES);
      const res = await service.getCommandCenter();
      expect(kpis.computeLiveKpis).toHaveBeenCalledWith('full');
      expect(res.executive_kpis).toEqual([LIVE]);
    });

    it('degraded: no DB read, executive_kpis stays []', async () => {
      const { service, kpis } = makeService('missing');
      const res = await service.getCommandCenter();
      expect(kpis.computeLiveKpis).not.toHaveBeenCalled();
      expect(res.executive_kpis).toEqual([]);
    });

    it('light: no DB read, executive_kpis stays []', async () => {
      const previous = process.env.COMMAND_CENTER_MODE;
      process.env.COMMAND_CENTER_MODE = 'light';
      try {
        const { service, kpis } = makeService('full');
        const res = await service.getCommandCenter();
        expect(kpis.computeLiveKpis).not.toHaveBeenCalled();
        expect(res.executive_kpis).toEqual([]);
      } finally {
        process.env.COMMAND_CENTER_MODE = previous;
      }
    });
  });

  describe('department_reports wiring (Vue 5)', () => {
    it('full: one report per department, fed by the queue and the measures', async () => {
      const { service, actions, kpis } = makeService('full');
      (actions.computeActionQueue as jest.Mock).mockResolvedValue([
        {
          id: 'repair:data',
          title: 'Fiabiliser « Data »',
          department: 'data',
          source: 'data',
          action_type: 'certification',
          impact: 8,
          urgency: 7,
          data_confidence: 90,
          effort: 4,
          risk: 2,
          score: 13,
          reason: 'r',
          evidence: ['dept:data'],
          next_step: 'n',
          owner_go_required: false,
          details: null,
        },
      ]);
      (kpis.computeLiveKpis as jest.Mock).mockResolvedValue([
        {
          kpi: {
            id: 'payments_kept',
            label: 'Ventes',
            value: 0,
            unit: '/2',
            status: 'CRITICAL',
            source: 'db',
            certified: true,
          },
          window_days: 30,
          previous_value: 1,
          better: 'higher',
        },
      ]);
      const res = await service.getCommandCenter();
      expect(res.department_reports.map((r) => r.department)).toEqual([
        'sales', // P0, CRITIQUE
        'ops', // P0, non mesuré
        'data', // P1
      ]);
      const sales = res.department_reports[0];
      expect(sales).toMatchObject({
        score: 'CRITIQUE',
        evolution: 'PIRE',
        kpi: { measure: 'MESURE', value: 0, previous_value: 1 },
        period: { as_of: res.generated_at, window_days: 30 },
      });
      expect(res.department_reports[2].open_action_ids).toEqual([
        'repair:data',
      ]);
    });

    it('degraded: department_reports is []', async () => {
      const { service } = makeService('missing');
      expect((await service.getCommandCenter()).department_reports).toEqual([]);
    });

    it('light: department_reports is [] (no detail exposed)', async () => {
      const previous = process.env.COMMAND_CENTER_MODE;
      process.env.COMMAND_CENTER_MODE = 'light';
      try {
        const { service } = makeService('full');
        expect((await service.getCommandCenter()).department_reports).toEqual(
          [],
        );
      } finally {
        process.env.COMMAND_CENTER_MODE = previous;
      }
    });
  });

  describe('exposure mode (COMMAND_CENTER_MODE)', () => {
    const ENV = {
      mode: process.env.COMMAND_CENTER_MODE,
      node: process.env.NODE_ENV,
    };
    afterEach(() => {
      process.env.COMMAND_CENTER_MODE = ENV.mode;
      process.env.NODE_ENV = ENV.node;
    });

    it('explicit COMMAND_CENTER_MODE wins (full/light/disabled)', () => {
      for (const m of ['full', 'light', 'disabled'] as const) {
        process.env.COMMAND_CENTER_MODE = m;
        expect(resolveCommandCenterMode()).toBe(m);
      }
    });

    it('safe default: disabled in production, full elsewhere', () => {
      // NODE_ENV is type-narrowed in the backend; widen for the 'preprod' literal.
      const env = process.env as Record<string, string | undefined>;
      delete env.COMMAND_CENTER_MODE;
      env.NODE_ENV = 'production';
      expect(resolveCommandCenterMode()).toBe('disabled');
      env.NODE_ENV = 'preprod';
      expect(resolveCommandCenterMode()).toBe('full');
      env.NODE_ENV = 'development';
      expect(resolveCommandCenterMode()).toBe('full');
    });

    it('light mode strips internal detail but keeps top-line health', async () => {
      process.env.COMMAND_CENTER_MODE = 'light';
      const { service } = makeService('full');
      const res = await service.getCommandCenter();
      expect(res.mode).toBe('light');
      expect(res.departments).toEqual([]);
      expect(res.capabilities).toEqual([]);
      expect(res.chains).toEqual([]);
      expect(res.owner_actions).toEqual([]);
      expect(res.global_status.reasons).toEqual([]);
      expect(res.source_truth.canon_path).toBe('');
      expect(res.stale_status).toBe('STALE');
    });

    it('getMode() reflects the resolver', () => {
      process.env.COMMAND_CENTER_MODE = 'disabled';
      const { service } = makeService('full');
      expect(service.getMode()).toBe('disabled');
    });
  });
});

describe('strict v2 boundaries', () => {
  const originalRegistry = process.env.REGISTRY_DIR;
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'cc-l1-'));
    process.env.COMMAND_CENTER_MODE = 'full';
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
    if (originalRegistry === undefined) delete process.env.REGISTRY_DIR;
    else process.env.REGISTRY_DIR = originalRegistry;
  });
  it.each(['{', '{}', 'null', '{"schema_version":"command-center.v1"}'])(
    'rejects disk payload %s before producers',
    async (raw) => {
      const { service, actions, kpis } = makeService('full');
      writeFileSync(join(dir, 'command-center-snapshot.json'), raw);
      (service as any).registryDir = dir;
      const r = await service.getCommandCenter();
      expect(r.degraded).toBe(true);
      expect(r.departments).toEqual([]);
      expect(CommandCenterResponseV2Schema.safeParse(r).success).toBe(true);
      expect(actions.computeActionQueue).not.toHaveBeenCalled();
      expect(kpis.computeLiveKpis).not.toHaveBeenCalled();
    },
  );
  it('invalid cached shapes are misses, warm v1/v2/digest projections reuse producers', async () => {
    const { service, cache, actions, kpis } = makeService('full');
    cache.get.mockResolvedValue({ schema_version: 'command-center.v1' });
    const v2 = await service.getCommandCenter();
    expect(v2.schema_version).toBe('command-center.v2');
    expect(cache.set).toHaveBeenCalledWith(
      'admin:command-center:summary:v2:full',
      v2,
      60,
    );
    cache.get.mockResolvedValue(v2);
    const v1 = toCommandCenterV1(await service.getCommandCenter());
    const digest = toCommandCenterDigest(await service.getCommandCenter());
    expect(v1.departments).toHaveLength(v2.departments.length);
    expect(CommandCenterDigestSchema.safeParse(digest).success).toBe(true);
    expect(actions.computeActionQueue).toHaveBeenCalledTimes(1);
    expect(kpis.computeLiveKpis).toHaveBeenCalledTimes(1);
  });
  it('24 full reports keep digest v1, global verdict and existing certification actions', async () => {
    jest.useFakeTimers({ now: new Date('2026-10-10T12:00:00Z') });
    try {
      const current = JSON.parse(
        readFileSync(
          join(
            __dirname,
            '../../../audit/registry/command-center-snapshot.json',
          ),
          'utf8',
        ),
      );
      const base = JSON.parse(
        readFileSync(
          join(
            __dirname,
            '../../../tests/registry/fixtures/command-center-l1-baseline.json',
          ),
          'utf8',
        ),
      ).data.snapshot;
      expect(
        buildCertificationActions(current.departments, current.chains),
      ).toEqual(buildCertificationActions(base.departments, base.chains));
      const before = structuredClone(base);
      before.schema_version = 'command-center.v2';
      before.departments = before.departments.map((d: any) => {
        const n = current.departments.find((n: any) => n.id === d.id);
        return {
          ...d,
          business_number: n.business_number,
          accountable_owner: n.accountable_owner,
          operating_mode: n.operating_mode,
          profile_ref: n.profile_ref,
          repo_domains: n.repo_domains,
        };
      });
      const { service } = makeService('full');
      (service as any).registryDir = dir;
      writeFileSync(
        join(dir, 'command-center-snapshot.json'),
        JSON.stringify(before),
      );
      const old = await service.getCommandCenter();
      writeFileSync(
        join(dir, 'command-center-snapshot.json'),
        JSON.stringify(current),
      );
      const next = await service.getCommandCenter();
      expect(next.global_status).toEqual(old.global_status);
      expect(next.department_reports).toHaveLength(24);
      const digest = CommandCenterDigestSchema.parse(
        toCommandCenterDigest(next),
      );
      expect(digest.schema_version).toBe('command-center-digest.v1');
      expect(digest.department_reports).toHaveLength(24);
      const v1 = toCommandCenterV1(next);
      expect(v1.departments).toHaveLength(24);
      expect('business_number' in v1.departments[0]).toBe(false);
    } finally {
      jest.useRealTimers();
    }
  });
  it.each(['light', 'disabled'])('%s calls no live producers', async (mode) => {
    process.env.COMMAND_CENTER_MODE = mode;
    const { service, actions, kpis } = makeService('full');
    const r = await service.getCommandCenter();
    expect(r.mode).toBe(mode);
    expect(CommandCenterResponseV2Schema.safeParse(r).success).toBe(true);
    expect(actions.computeActionQueue).not.toHaveBeenCalled();
    expect(kpis.computeLiveKpis).not.toHaveBeenCalled();
  });
});

describe('R8 — causes dans le digest sans extension de contrat', () => {
  let originalRegistry: string | undefined;
  let originalMode: string | undefined;
  beforeEach(() => {
    originalRegistry = process.env.REGISTRY_DIR;
    originalMode = process.env.COMMAND_CENTER_MODE;
    process.env.COMMAND_CENTER_MODE = 'full';
  });
  afterEach(() => {
    if (originalRegistry === undefined) delete process.env.REGISTRY_DIR;
    else process.env.REGISTRY_DIR = originalRegistry;
    if (originalMode === undefined) delete process.env.COMMAND_CENTER_MODE;
    else process.env.COMMAND_CENTER_MODE = originalMode;
  });
  it.each([
    ['incomplete', /lecture incomplète/i],
    ['completeness_unverified', /complétude.*non vérifiable/i],
    ['access_denied', /accès refusé/i],
    ['read_failed', /lecture.*échec/i],
  ] as const)(
    '%s reste explicite dans v1, v2 et digest',
    async (failure, text) => {
      const { service, kpis } = makeService(
        'full',
        join(__dirname, '../../../audit/registry'),
      );
      kpis.computeLiveKpis.mockResolvedValue([
        {
          kpi: toPagesGeneratingAtcKpi(null, 30),
          read_failure: failure,
          window_days: 30,
          previous_value: null,
          better: 'higher',
        },
        {
          kpi: toDiagnosticToProductKpi({ sessions: 2, reachedProduct: 1 }, 30),
          previous_read_failure: failure,
          window_days: 30,
          previous_value: null,
          better: 'higher',
        },
      ]);
      const response = CommandCenterResponseV2Schema.parse(
        await service.getCommandCenter(),
      );
      const digest = CommandCenterDigestSchema.parse(
        toCommandCenterDigest(response),
      );
      const legacy = toCommandCenterV1(response);
      for (const id of ['pages_generating_atc', 'diagnostic_to_product']) {
        const r = digest.department_reports.find((r) => r.kpi.id === id)!;
        expect(r.evidence.join(' ')).toMatch(text);
        expect(r.evolution).toBe('INCONNUE');
        expect(legacy.department_reports.find((r) => r.kpi.id === id)).toEqual(
          r,
        );
      }
      const pages = digest.department_reports.find(
        (r) => r.kpi.id === 'pages_generating_atc',
      )!;
      expect(pages).toMatchObject({
        kpi: { value: null, measure: 'ILLISIBLE' },
        score: 'NON_MESURE',
      });
      expect(pages.gap).toMatch(text);
      expect(JSON.stringify(response)).not.toMatch(
        /read_failure|previous_read_failure/,
      );
    },
  );
});
