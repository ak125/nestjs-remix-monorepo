import {
  CanActivate,
  ExecutionContext,
  ServiceUnavailableException,
  Type,
} from '@nestjs/common';
import { AuthenticatedGuard } from '@auth/authenticated.guard';
import { IsAdminGuard } from '@auth/is-admin.guard';
import { DiagnosticEngineController } from './diagnostic-engine.controller';
import { DiagnosticEngineDataService } from './diagnostic-engine.data-service';

const id = '12345678-1234-4123-8123-123456789abc';
function session() {
  return {
    id,
    system_scope: 'freinage',
    vehicle_context: {},
    signal_input: {},
    created_at: '2026-09-20T12:30:00+00:00',
    result: {
      evidence_pack: {
        factual_inputs_confirmed: ['Freinage'],
        factual_inputs_missing: [],
        system_suspects: [],
        candidate_hypotheses: [],
        maintenance_links: [],
        risk_flags: ['Arrêt'],
        safety_alert: 'Ne pas rouler',
        risk_level: 'critical',
        catalog_guard: {
          ready_for_catalog: false,
          confidence_before_purchase: 'low',
          allowed_output_mode: 'none',
          reason: 'Sécurité',
        },
        allowed_claims: [],
        ui_block_inputs: {},
        urgency_timeline: { immediate: ['Contrôle'] },
      },
    },
  };
}
function fixture(value: unknown = session()) {
  const service = Object.create(
    DiagnosticEngineDataService.prototype,
  ) as DiagnosticEngineDataService;
  const reply = {
    data: value,
    error: null as null | { code: string; message: string },
  };
  const query = {
    select: jest.fn(() => query),
    eq: jest.fn(() => query),
    single: jest.fn(async () => reply),
  };
  Object.assign(service, {
    supabase: { from: jest.fn(() => query) },
    logger: { warn: jest.fn() },
  });
  const controller = new DiagnosticEngineController(
    {} as never,
    service,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );
  return { service, controller, reply, query };
}
describe('saved diagnostic lookup', () => {
  test('returns the stored result unchanged, including safety and extension metadata', async () => {
    const stored = session();
    const f = fixture(stored);
    const output = await f.controller.getSession(id.toUpperCase());
    expect(output).toMatchObject({ success: true, session: stored });
    expect(output.session?.result).toBe(stored.result);
    expect(f.query.eq).toHaveBeenCalledWith('id', id.toUpperCase());
  });
  test('returns a session saved with the retired forbidden_claims_runtime field', async () => {
    const stored = session();
    Object.assign(stored.result.evidence_pack, {
      forbidden_claims_runtime: ['Remplacement nécessaire.'],
    });
    const output = await fixture(stored).controller.getSession(id);
    expect(output).toMatchObject({ success: true, session: stored });
  });
  test('rejects an invalid UUID before the database', async () => {
    const f = fixture();
    expect(await f.controller.getSession('../invalid')).toMatchObject({
      success: false,
    });
    expect(f.query.single).not.toHaveBeenCalled();
  });
  test('reports a missing session', async () => {
    const f = fixture(null);
    f.reply.error = { code: 'PGRST116', message: 'No rows' };
    expect(await f.controller.getSession(id)).toEqual({
      success: false,
      error: 'Session introuvable.',
    });
  });
  test('distinguishes storage failure from a missing session', async () => {
    const f = fixture(null);
    f.reply.error = { code: '08006', message: 'Storage unavailable' };
    await expect(f.controller.getSession(id)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
  test.each([
    null,
    {},
    { evidence_pack: {} },
    { evidence_pack: { ...session().result.evidence_pack, risk_flags: null } },
    {
      evidence_pack: {
        ...session().result.evidence_pack,
        risk_level: 'unknown',
      },
    },
  ])('rejects unreadable stored result %j', async (result) => {
    const f = fixture({ ...session(), result });
    expect(await f.controller.getSession(id)).toEqual({
      success: false,
      error: 'Résultat sauvegardé illisible. Relancez une analyse.',
    });
  });
  test.each([
    { id: '87654321-1234-4123-8123-123456789abc' },
    { created_at: 'invalid' },
    { created_at: null },
  ])('rejects invalid session metadata %j', async (extra) => {
    expect(
      await fixture({ ...session(), ...extra }).controller.getSession(id),
    ).toMatchObject({ success: false });
  });
});

/**
 * Access boundary of the diagnostic API. The classification is EXHAUSTIVE: a
 * handler added later without being classified here fails the test.
 *   - public : the wizard, the analysis and the resume of ONE session by its
 *              UUID (the link handed to the visitor who ran the analysis);
 *   - admin  : the listing of every visitor's sessions and the dashboard
 *              stats — `AuthenticatedGuard + IsAdminGuard` (level 7+).
 * Same test shape as `backend/tests/unit/support-routes-authz.test.ts`.
 */
describe('diagnostic routes access boundary', () => {
  const Controller = DiagnosticEngineController;
  const handlers = Controller.prototype as unknown as Record<string, object>;
  const PUBLIC_HANDLERS = [
    'getWizardSteps',
    'getSafetyConfig',
    'getVocabClusters',
    'getSigns',
    'getFaq',
    'getControlesMensuels',
    'getMaintenanceOperations',
    'maintenanceSchedule',
    'maintenanceCalendar',
    'maintenanceAlerts',
    'analyze',
    'handoff',
    'breakdown',
    'getSystems',
    'getSymptoms',
    'getSession',
  ];
  const ADMIN_HANDLERS = ['getStats', 'listSessions'];

  const routeHandlers = () =>
    Object.getOwnPropertyNames(handlers).filter(
      (name) =>
        name !== 'constructor' &&
        typeof handlers[name] === 'function' &&
        Reflect.getMetadata('method', handlers[name]) !== undefined,
    );
  const guardsOf = (method: string): Array<Type<CanActivate>> => [
    ...(Reflect.getMetadata('__guards__', Controller) || []),
    ...(Reflect.getMetadata('__guards__', handlers[method]) || []),
  ];
  const isAllowed = (method: string, request: unknown) => {
    const ctx = {
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: () => handlers[method],
      getClass: () => Controller,
    } as unknown as ExecutionContext;
    return guardsOf(method).every((Guard) => {
      try {
        return new Guard().canActivate(ctx) === true;
      } catch {
        return false;
      }
    });
  };
  const principal = (level: number | null) =>
    level === null
      ? { path: '/x', isAuthenticated: () => false, user: undefined }
      : {
          path: '/x',
          isAuthenticated: () => true,
          user: { id: 'u1', level: String(level), isAdmin: level >= 7 },
        };

  test('every route is classified', () => {
    expect(routeHandlers().sort()).toEqual(
      [...PUBLIC_HANDLERS, ...ADMIN_HANDLERS].sort(),
    );
  });

  test.each(ADMIN_HANDLERS)(
    '%s requires an authenticated admin session',
    (method) => {
      expect(guardsOf(method)).toEqual([AuthenticatedGuard, IsAdminGuard]);
      for (const level of [null, 1, 3, 5]) {
        expect(isAllowed(method, principal(level))).toBe(false);
      }
      expect(isAllowed(method, principal(7))).toBe(true);
    },
  );

  test.each(PUBLIC_HANDLERS)('%s stays public', (method) => {
    expect(guardsOf(method)).toEqual([]);
  });
});

describe('admin session listing and stats never hide a storage failure', () => {
  function adminFixture(reply: {
    data?: unknown;
    count?: number | null;
    error: null | { message: string };
  }) {
    const service = Object.create(
      DiagnosticEngineDataService.prototype,
    ) as DiagnosticEngineDataService;
    const builder: Record<string, unknown> = {};
    for (const step of ['select', 'eq', 'order', 'limit']) {
      builder[step] = jest.fn(() => builder);
    }
    builder.then = (
      resolve: (value: unknown) => unknown,
      reject: (reason: unknown) => unknown,
    ) => Promise.resolve(reply).then(resolve, reject);
    Object.assign(service, {
      supabase: { from: jest.fn(() => builder) },
      logger: { warn: jest.fn(), error: jest.fn() },
    });
    return service;
  }
  const failure = { data: null, count: null, error: { message: 'down' } };

  test('listing reports storage failure instead of an empty history', async () => {
    await expect(
      adminFixture(failure).listRecentSessions(10),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  test('stats report storage failure instead of zero counts', async () => {
    await expect(adminFixture(failure).getStats()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  test('stats return the stored counts', async () => {
    const stats = await adminFixture({
      data: [{ system_scope: 'freinage' }, { system_scope: 'freinage' }],
      count: 4,
      error: null,
    }).getStats();
    expect(stats).toEqual({
      total_sessions: 4,
      sessions_by_system: [{ system_scope: 'freinage', count: 2 }],
      systems_count: 4,
      symptoms_count: 4,
      causes_count: 4,
      safety_rules_count: 4,
    });
  });
});
