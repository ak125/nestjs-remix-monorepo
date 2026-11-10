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
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
  rmSync,
} from 'fs';
import { tmpdir } from 'os';
import {
  CommandCenterResponseV2Schema,
  toCommandCenterV1,
  CommandCenterDigestSchema,
} from '@repo/registry';
import { execFileSync } from 'child_process';
import { createHash } from 'crypto';
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
      department: 'product',
      label: 'Produit & Expérience Client',
      priority: null,
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
    // Organisation du 2026-11-04 : le 11 n'a pas de KPI, l'absence reste lisible.
    expect(
      digest.department_reports.find((r) => r.department === 'diagnostic'),
    ).toMatchObject({
      label: 'Expertise technique automobile',
      priority: 'P2',
      kpi: { id: null, measure: 'SANS_PRODUCTEUR', value: null },
      score: 'NON_MESURE',
      gap: 'Aucun KPI primaire déclaré dans la carte opérationnelle.',
      owner_go_required: true,
      next_evidence:
        'Qualifier dans la fiche de « Expertise technique automobile » le résultat attendu, sa procédure et la preuve adaptée.',
    });
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

describe('validation_status — forme du rapport agent-operating-map', () => {
  const originalRegistry = process.env.REGISTRY_DIR;
  const originalMode = process.env.COMMAND_CENTER_MODE;
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'cc-validation-'));
    mkdirSync(join(dir, 'audit', 'registry'), { recursive: true });
    mkdirSync(join(dir, 'audit-reports'));
    copyFileSync(
      join(FIXTURES, 'full', 'command-center-snapshot.json'),
      join(dir, 'audit', 'registry', 'command-center-snapshot.json'),
    );
    process.env.COMMAND_CENTER_MODE = 'full';
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
    if (originalRegistry === undefined) delete process.env.REGISTRY_DIR;
    else process.env.REGISTRY_DIR = originalRegistry;
    if (originalMode === undefined) delete process.env.COMMAND_CENTER_MODE;
    else process.env.COMMAND_CENTER_MODE = originalMode;
  });
  const statusFor = async (report?: string) => {
    if (report !== undefined)
      writeFileSync(
        join(dir, 'audit-reports', 'agent-operating-map-report.json'),
        report,
      );
    const { service } = makeService('full', join(dir, 'audit', 'registry'));
    const r = await service.getCommandCenter();
    expect(r.degraded).toBe(false);
    return r.validation_status;
  };

  // Forme écrite par scripts/governance/validate-agent-operating-map.js.
  it.each([
    ['{"counts":{"errors":0,"warns":0,"total":0}}', 'VALIDATED'],
    ['{"counts":{"errors":2,"warns":0,"total":2}}', 'STRICT_FAIL'],
    ['{"counts":{"errors":0,"warns":1,"total":1}}', 'WARN_ONLY'],
  ])('rapport bien formé %s → %s', async (report, expected) => {
    expect(await statusFor(report)).toBe(expected);
  });

  it('rapport absent → UNKNOWN', async () => {
    expect(await statusFor()).toBe('UNKNOWN');
  });

  // Un rapport mal formé ne prouve rien : il ne doit jamais s'afficher VALIDATED.
  it.each([
    'null',
    '{',
    '{"counts":{}}',
    '{"counts":{"errors":0}}',
    '{"counts":{"errors":"0","warns":null}}',
    '{"counts":{"errors":-1,"warns":0}}',
    '{"counts":{"errors":0.5,"warns":0}}',
  ])('rapport mal formé %s → UNKNOWN', async (report) => {
    expect(await statusFor(report)).toBe('UNKNOWN');
  });
});

describe('fraîcheur de la source et identité du build', () => {
  const SHA_A = 'a'.repeat(40);
  const SHA_B = 'b'.repeat(40);
  const NOW = '2026-11-09T12:00:00Z';
  const ENV_KEYS = [
    'GIT_SHA',
    'SOURCE_COMMIT',
    'REGISTRY_DIR',
    'COMMAND_CENTER_MODE',
  ] as const;
  const saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
  // Même ensemble exact que KEYS dans scripts/ops/hermes-command-center/command_center.py.
  const DIGEST_KEYS = [
    'degraded',
    'department_reports',
    'generated_at',
    'git_sha',
    'global_status',
    'mode',
    'owner_go_actions',
    'owner_go_actions_total',
    'schema_version',
    'stale_status',
  ];
  let dir: string;
  let registryDir: string;
  let snapshotPath: string;
  /** Rapport du validateur, là où le lecteur le cherche : <racine>/audit-reports. */
  const reportPath = () =>
    join(dir, 'audit-reports', 'agent-operating-map-report.json');

  /** Snapshot sans autre motif d'alerte : seul le cas testé peut retirer OPERATIONAL. */
  const serve = async (
    lastVerified: string | null,
    mutate?: (snapshot: any) => void,
  ) => {
    const snapshot = JSON.parse(
      readFileSync(
        join(FIXTURES, 'full', 'command-center-snapshot.json'),
        'utf8',
      ),
    );
    snapshot.source_truth.last_verified = lastVerified;
    snapshot.alerts = [];
    snapshot.summary.handoffs_incomplete = 0;
    snapshot.summary.capabilities_without_evidence = 0;
    snapshot.departments = snapshot.departments.map(
      (d: { certification: string }) => ({
        ...d,
        certification:
          d.certification === 'BROKEN' ? 'PARTIAL' : d.certification,
      }),
    );
    mutate?.(snapshot);
    writeFileSync(snapshotPath, JSON.stringify(snapshot));
    const { service } = makeService('full', registryDir);
    return service;
  };
  const read = async (lastVerified: string | null = '2026-11-08') =>
    (await serve(lastVerified)).getCommandCenter();

  /** Le vrai lecteur strict Hermes, sur la sortie réelle du backend. */
  const hermesAccepts = (digest: unknown) =>
    execFileSync(
      'python3',
      [
        '-B',
        '-c',
        'import json,sys;sys.path.insert(0,sys.argv[1]);import command_center as cc;' +
          'd=json.load(sys.stdin);cc.validate_digest(d);print(sorted(d)==sorted(cc.KEYS))',
        join(__dirname, '../../../scripts/ops/hermes-command-center'),
      ],
      { input: JSON.stringify(digest), encoding: 'utf8' },
    ).trim();

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'cc-identity-'));
    registryDir = join(dir, 'audit', 'registry');
    snapshotPath = join(registryDir, 'command-center-snapshot.json');
    mkdirSync(registryDir, { recursive: true });
    mkdirSync(join(dir, 'audit-reports'));
    // Validation prouvée : seul le cas testé peut retirer OPERATIONAL.
    writeFileSync(reportPath(), '{"counts":{"errors":0,"warns":0,"total":0}}');
    jest.useFakeTimers({ now: new Date(NOW) });
    process.env.COMMAND_CENTER_MODE = 'full';
    delete process.env.SOURCE_COMMIT;
    process.env.GIT_SHA = SHA_A;
  });
  afterEach(() => {
    jest.useRealTimers();
    rmSync(dir, { recursive: true, force: true });
    for (const k of ENV_KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  it.each([
    ['fraîche', '2026-11-05', 'FRESH', 'OPERATIONAL', null],
    ['en alerte', '2026-10-30', 'WARNING', 'OPERATIONAL', null],
    [
      'périmée',
      '2026-06-04',
      'STALE',
      'PARTIAL_READY',
      'snapshot source stale (>14d)',
    ],
    [
      'absente',
      null,
      'UNKNOWN',
      'PARTIAL_READY',
      'snapshot source freshness unknown',
    ],
    [
      'invalide',
      'pas-une-date',
      'UNKNOWN',
      'PARTIAL_READY',
      'snapshot source freshness unknown',
    ],
    [
      "à l'instant du calcul",
      '2026-11-09T12:00:00Z',
      'FRESH',
      'OPERATIONAL',
      null,
    ],
    [
      "future d'une milliseconde",
      '2026-11-09T12:00:00.001Z',
      'UNKNOWN',
      'PARTIAL_READY',
      'snapshot source freshness unknown',
    ],
    [
      "future d'une seconde",
      '2026-11-09T12:00:01Z',
      'UNKNOWN',
      'PARTIAL_READY',
      'snapshot source freshness unknown',
    ],
    [
      "future de plus d'un jour",
      '2026-11-11T12:00:00Z',
      'UNKNOWN',
      'PARTIAL_READY',
      'snapshot source freshness unknown',
    ],
    [
      'date civile du lendemain',
      '2026-11-10',
      'UNKNOWN',
      'PARTIAL_READY',
      'snapshot source freshness unknown',
    ],
    [
      'date civile lointaine',
      '2026-12-25',
      'UNKNOWN',
      'PARTIAL_READY',
      'snapshot source freshness unknown',
    ],
    ['à 7 j pile', '2026-11-02T12:00:00Z', 'FRESH', 'OPERATIONAL', null],
    [
      'à 7 j moins une seconde avant le 8e',
      '2026-11-01T12:00:01Z',
      'FRESH',
      'OPERATIONAL',
      null,
    ],
    ['à 8 j', '2026-11-01T12:00:00Z', 'WARNING', 'OPERATIONAL', null],
    ['à 14 j pile', '2026-10-26T12:00:00Z', 'WARNING', 'OPERATIONAL', null],
    [
      'à 14 j moins une seconde avant le 15e',
      '2026-10-25T12:00:01Z',
      'WARNING',
      'OPERATIONAL',
      null,
    ],
    [
      'à 15 j',
      '2026-10-25T12:00:00Z',
      'STALE',
      'PARTIAL_READY',
      'snapshot source stale (>14d)',
    ],
  ])(
    'source %s : %s %s → %s',
    async (_l, lastVerified, stale, verdict, reason) => {
      const res = await read(lastVerified);
      expect(res.stale_status).toBe(stale);
      expect(res.global_status.verdict).toBe(verdict);
      expect(res.global_status.reasons).toEqual(reason ? [reason] : []);
      // La vérification réelle n'est jamais réécrite, generated_at reste le transport.
      expect(res.source_truth.last_verified).toBe(lastVerified);
      expect(res.generated_at).toBe(new Date(NOW).toISOString());
    },
  );

  it('source future : pas de plafond STALE inventé, et jamais FRESH', async () => {
    const res = await read('2026-12-25');
    expect(
      res.departments.every(
        (d) => !d.live_caps_applied.includes('source_stale_max_79'),
      ),
    ).toBe(true);
    expect(res.stale_status).not.toBe('FRESH');
  });

  it.each([
    ['absente', undefined, undefined, 'build identity absent'],
    ['abrégée', 'abc123', undefined, 'build identity invalid'],
    ['en majuscules', 'A'.repeat(40), undefined, 'build identity invalid'],
    ['SOURCE_COMMIT invalide', SHA_A, 'unknown', 'build identity invalid'],
    ['divergente', SHA_A, SHA_B, 'build identity divergent'],
  ])(
    'identité %s : git_sha null, motif explicite, jamais OPERATIONAL',
    async (_l, gitSha, sourceCommit, reason) => {
      if (gitSha === undefined) delete process.env.GIT_SHA;
      else process.env.GIT_SHA = gitSha;
      if (sourceCommit !== undefined) process.env.SOURCE_COMMIT = sourceCommit;
      const res = await read();
      expect(res.git_sha).toBeNull();
      expect(res.global_status.verdict).toBe('PARTIAL_READY');
      expect(res.global_status.reasons).toEqual([reason]);
      expect(JSON.stringify(res.global_status)).not.toContain('abc123');
    },
  );

  it('identité invalide et département P0 cassé : BLOCKED, motif d’identité conservé', async () => {
    process.env.GIT_SHA = 'abc123';
    const service = await serve('2026-11-08');
    const path = snapshotPath;
    const snapshot = JSON.parse(readFileSync(path, 'utf8'));
    snapshot.departments[0] = {
      ...snapshot.departments[0],
      priority: 'P0',
      certification: 'BROKEN',
    };
    writeFileSync(path, JSON.stringify(snapshot));

    const res = await service.getCommandCenter();

    expect(res.git_sha).toBeNull();
    expect(res.global_status.verdict).toBe('BLOCKED');
    expect(res.global_status.reasons).toEqual([
      `P0 department(s) broken: ${snapshot.departments[0].id}`,
      'build identity invalid',
    ]);
    expect(JSON.stringify(res.global_status)).not.toContain('abc123');
  });

  it.each([
    ['périmée', '2026-06-04', 'STALE', 'snapshot source stale (>14d)'],
    ['future', '2026-12-25', 'UNKNOWN', 'snapshot source freshness unknown'],
  ])(
    'source %s et département P0 cassé : BLOCKED, motif de fraîcheur conservé',
    async (_l, lastVerified, stale, reason) => {
      const service = await serve(lastVerified);
      const path = snapshotPath;
      const snapshot = JSON.parse(readFileSync(path, 'utf8'));
      snapshot.departments[0] = {
        ...snapshot.departments[0],
        priority: 'P0',
        certification: 'BROKEN',
      };
      writeFileSync(path, JSON.stringify(snapshot));

      const res = await service.getCommandCenter();

      expect(res.stale_status).toBe(stale);
      expect(res.global_status.verdict).toBe('BLOCKED');
      expect(res.global_status.reasons).toEqual([
        `P0 department(s) broken: ${snapshot.departments[0].id}`,
        reason,
      ]);
    },
  );

  it.each([
    ['GIT_SHA seul', SHA_A, undefined],
    ['SOURCE_COMMIT seul', undefined, SHA_A],
    ['les deux concordants', SHA_A, SHA_A],
  ])(
    'identité déclarée par %s : valeur valide servie, sans preuve de liaison au build',
    async (_l, gitSha, sourceCommit) => {
      if (gitSha === undefined) delete process.env.GIT_SHA;
      else process.env.GIT_SHA = gitSha;
      if (sourceCommit !== undefined) process.env.SOURCE_COMMIT = sourceCommit;
      const res = await read();
      expect(res.git_sha).toBe(SHA_A);
      expect(res.global_status.verdict).toBe('OPERATIONAL');
    },
  );

  it('le HEAD du checkout ne suffit jamais : sans déclaration, git_sha reste null dans un dépôt Git', async () => {
    delete process.env.GIT_SHA;
    expect(
      execFileSync('git', ['rev-parse', 'HEAD'], {
        cwd: __dirname,
        encoding: 'utf8',
      }).trim(),
    ).toMatch(/^[0-9a-f]{40}$/);
    expect((await read()).git_sha).toBeNull();
  });

  describe('artefacts de build anciens et checkout plus récent', () => {
    const cwd = process.cwd();
    const git = (...args: string[]) =>
      execFileSync(
        'git',
        [
          '-c',
          'user.name=test',
          '-c',
          'user.email=test@example.invalid',
          '-c',
          'commit.gpgsign=false',
          '-c',
          'core.hooksPath=/dev/null',
          ...args,
        ],
        { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
      ).trim();
    afterEach(() => process.chdir(cwd));

    it.each([
      ["le commit de l'ancien dist", 'HEAD~1'],
      ['le HEAD plus récent du checkout', 'HEAD'],
    ])(
      'dist/tsbuildinfo/provenance désignant %s : aucune attribution',
      async (_l, rev) => {
        delete process.env.GIT_SHA;
        git('init', '-q');
        git('commit', '-q', '--allow-empty', '-m', 'build ancien');
        git('commit', '-q', '--allow-empty', '-m', 'checkout plus récent');
        const backend = join(dir, 'backend');
        mkdirSync(join(backend, 'dist'), { recursive: true });
        writeFileSync(join(backend, 'tsconfig.tsbuildinfo'), 'ancien build');
        writeFileSync(
          join(backend, 'dist', 'build-provenance.json'),
          JSON.stringify({
            schema_version: 'build-provenance.v1',
            state: 'attested',
            git_sha: git('rev-parse', rev),
            tsbuildinfo_sha256: createHash('sha256')
              .update('ancien build')
              .digest('hex'),
          }),
        );
        process.chdir(backend);
        // require : le spy doit porter sur l'objet fs réellement utilisé par le service.
        const fs = require('fs');
        const reads = jest.spyOn(fs, 'readFileSync');
        const probes = jest.spyOn(fs, 'existsSync');
        const res = await read();
        const touched = [...reads.mock.calls, ...probes.mock.calls].map((c) =>
          String(c[0]),
        );
        reads.mockRestore();
        probes.mockRestore();

        expect(
          touched.some((f) => f.endsWith('command-center-snapshot.json')),
        ).toBe(true);
        expect(
          touched.filter((f) => /build-provenance|tsbuildinfo/.test(f)),
        ).toEqual([]);
        expect(res.git_sha).toBeNull();
        expect(res.global_status.verdict).toBe('PARTIAL_READY');
        expect(res.global_status.reasons).toEqual(['build identity absent']);
      },
    );
  });

  it('GIT_SHA vide (build sans argument) : identité absente, pas invalide', async () => {
    process.env.GIT_SHA = '';
    const res = await read();
    expect(res.git_sha).toBeNull();
    expect(res.global_status.reasons).toEqual(['build identity absent']);
  });

  describe('validation de la carte non prouvée', () => {
    const UNKNOWN_REASON = 'operating-map validation unknown';
    const p0Broken = (snapshot: any) => {
      snapshot.departments[0] = {
        ...snapshot.departments[0],
        priority: 'P0',
        certification: 'BROKEN',
      };
    };

    it.each([
      ['absent', null],
      ['illisible', '{'],
      ['sans compteurs', '{"counts":{}}'],
      ['à compteur négatif', '{"counts":{"errors":-1,"warns":0}}'],
    ])(
      'rapport %s : UNKNOWN, motif explicite, jamais OPERATIONAL',
      async (_l, report) => {
        if (report === null) rmSync(reportPath());
        else writeFileSync(reportPath(), report);
        const res = await read();
        expect(res.validation_status).toBe('UNKNOWN');
        expect(res.global_status).toEqual({
          level: 'WARNING',
          verdict: 'PARTIAL_READY',
          reasons: [UNKNOWN_REASON],
        });
      },
    );

    // Des avertissements sont un résultat du validateur, pas une preuve absente.
    it('rapport avec avertissements seuls : WARN_ONLY reste OPERATIONAL', async () => {
      writeFileSync(
        reportPath(),
        '{"counts":{"errors":0,"warns":3,"total":3}}',
      );
      const res = await read();
      expect(res.validation_status).toBe('WARN_ONLY');
      expect(res.global_status.verdict).toBe('OPERATIONAL');
      expect(res.global_status.reasons).toEqual([]);
    });

    it('rapport absent et département P0 cassé : BLOCKED, motif de validation conservé', async () => {
      rmSync(reportPath());
      const service = await serve('2026-11-08', p0Broken);
      const res = await service.getCommandCenter();
      expect(res.global_status.verdict).toBe('BLOCKED');
      expect(res.global_status.reasons).toEqual([
        `P0 department(s) broken: ${res.departments[0].id}`,
        UNKNOWN_REASON,
      ]);
    });

    it('STRICT_FAIL et identité invalide : BLOCKED, les deux motifs', async () => {
      writeFileSync(
        reportPath(),
        '{"counts":{"errors":2,"warns":0,"total":2}}',
      );
      process.env.GIT_SHA = 'abc123';
      const res = await read();
      expect(res.validation_status).toBe('STRICT_FAIL');
      expect(res.global_status.verdict).toBe('BLOCKED');
      expect(res.global_status.reasons).toEqual([
        'operating-map validation STRICT_FAIL',
        'build identity invalid',
      ]);
      expect(JSON.stringify(res.global_status)).not.toContain('abc123');
    });

    it('source périmée, identité absente et rapport absent : trois motifs, dans cet ordre', async () => {
      rmSync(reportPath());
      delete process.env.GIT_SHA;
      const res = await read('2026-06-04');
      expect(res.global_status.verdict).toBe('PARTIAL_READY');
      expect(res.global_status.reasons).toEqual([
        'snapshot source stale (>14d)',
        'build identity absent',
        UNKNOWN_REASON,
      ]);
    });

    it('tous les motifs PARTIAL_READY : alertes, source, identité, validation, handoffs, capabilities', async () => {
      rmSync(reportPath());
      process.env.SOURCE_COMMIT = SHA_B;
      const service = await serve(null, (snapshot) => {
        snapshot.alerts = [
          {
            code: 'BROKEN_EVIDENCE',
            severity: 'error',
            target_kind: 'map',
            target_id: 'map',
            message: 'preuve cassée',
          },
          {
            code: 'OVERCLAIM_RISK',
            severity: 'warn',
            target_kind: 'map',
            target_id: 'map',
            message: 'non compté',
          },
        ];
        snapshot.summary.handoffs_incomplete = 2;
        snapshot.summary.capabilities_without_evidence = 3;
      });
      const res = await service.getCommandCenter();
      expect(res.global_status).toEqual({
        level: 'WARNING',
        verdict: 'PARTIAL_READY',
        reasons: [
          '1 error alert(s)',
          'snapshot source freshness unknown',
          'build identity divergent',
          UNKNOWN_REASON,
          '2 incomplete handoff(s)',
          '3 capability(ies) without evidence',
        ],
      });
    });

    it('digest v1 strict : le motif de validation passe le lecteur Hermes', async () => {
      rmSync(reportPath());
      const digest = CommandCenterDigestSchema.parse(
        toCommandCenterDigest(await read()),
      );
      expect(digest.global_status.reasons).toEqual([UNKNOWN_REASON]);
      expect(Object.keys(digest).sort()).toEqual(DIGEST_KEYS);
      expect(hermesAccepts(digest)).toBe('True');
    });
  });

  it.each([
    ['déclarée', SHA_A, undefined, 'full'],
    ['absente', undefined, undefined, 'full'],
    ['invalide', 'abc123', undefined, 'full'],
    ['divergente', SHA_A, SHA_B, 'full'],
    ['déclarée en light', SHA_A, undefined, 'light'],
    ['absente en light', undefined, undefined, 'light'],
  ])(
    'digest v1 strict inchangé, identité %s',
    async (_l, gitSha, sourceCommit, mode) => {
      if (gitSha === undefined) delete process.env.GIT_SHA;
      else process.env.GIT_SHA = gitSha;
      if (sourceCommit !== undefined) process.env.SOURCE_COMMIT = sourceCommit;
      process.env.COMMAND_CENTER_MODE = mode;
      const digest = CommandCenterDigestSchema.parse(
        toCommandCenterDigest(await read('2026-12-25')),
      );
      expect(Object.keys(digest).sort()).toEqual(DIGEST_KEYS);
      expect(digest.schema_version).toBe('command-center-digest.v1');
      expect(hermesAccepts(digest)).toBe('True');
    },
  );
});
