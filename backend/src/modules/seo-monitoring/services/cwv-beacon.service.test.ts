import type { ConfigService } from '@nestjs/config';
import {
  CwvBeaconClientPayloadSchema,
  type CwvBeaconServerInsert,
} from '@repo/cwv-taxonomy';
import {
  CWV_BEACON_REJECTED_EVENT_TYPE,
  CwvBeaconService,
} from './cwv-beacon.service';

/**
 * Tests de persistance du beacon CWV et du comptage des rejets.
 *
 * Contrat :
 *   - un beacon humain persiste son attribution enrichie telle quelle (jsonb) ;
 *   - un bot garde son événement `seo.runtime.bot_cwv_beacon` ;
 *   - les rejets sont agrégés par raison et écrits à intervalle fixe, une ligne
 *     par raison : le volume écrit ne dépend pas du volume rejeté ;
 *   - ni valeur du payload ni nom de clé inconnue ne sont enregistrés ;
 *   - une écriture refusée (valeur d'enum pas encore migrée) produit un warning
 *     qui porte raison et compte, sans lever.
 */

type InsertCall = { table: string; rows: unknown };
type RejectedRow = {
  event_type: string;
  severity: string;
  entity_url: string | null;
  payload: {
    reason: string;
    count: number;
    issues: Record<string, number>;
    window_start: string;
    window_end: string;
    node_env: string | null;
  };
};

function makeService(
  insertResult: () => Promise<{
    error: { code?: string; message: string } | null;
  }> = () => Promise.resolve({ error: null }),
) {
  const config = {
    get: (key: string): string | undefined =>
      ({
        SUPABASE_URL: 'https://example.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
        NODE_ENV: 'production',
      })[key],
  } as unknown as ConfigService;
  const service = new CwvBeaconService(config);
  const inserts: InsertCall[] = [];
  const logger = {
    log: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
  Object.assign(service, {
    logger,
    supabase: {
      from: (table: string) => ({
        insert: (rows: unknown) => {
          inserts.push({ table, rows });
          return insertResult();
        },
      }),
    },
  });
  return { service, inserts, logger };
}

function humanInsert(): CwvBeaconServerInsert {
  return {
    session_id: 'b2c4e6a8-0000-4000-8000-000000000001',
    surface: 'R2_PRODUCT',
    route_group: 'pieces_product',
    funnel_step: 'view_product',
    previous_funnel_step: null,
    url: 'https://www.automecanik.com/pieces/plaquette-de-frein-402.html',
    metric: 'INP',
    value: 512,
    device: 'mobile',
    nav_type: 'unknown',
    priority_tier: 'CWV_P0',
    ua_class: 'human',
    attribution: {
      attr_presentation_delay: 387,
      attr_total_script_duration: 101,
      attr_total_style_layout_duration: 96,
      attr_total_paint_duration: 19,
      attr_total_unattributed_duration: 0,
      attr_longest_script_src:
        'https://www.automecanik.com/assets/app-core-Doz3nLV1.js',
      attr_longest_script_invoker_type: 'event-listener',
      attr_longest_script_subpart: 'processing-duration',
      attr_longest_script_intersecting_duration: 97,
      attr_interaction_time: 184_250,
      attr_hydrated_at: 2_310,
      attr_metric_id: 'v5-1757590000000-1234567890123',
      attr_visibility_state: 'hidden',
      attr_navigation_type: 'back-forward-cache',
      attr_start_url:
        'https://www.automecanik.com/pieces/plaquette-de-frein-402.html',
    },
  };
}

function rejectedRows(inserts: InsertCall[]) {
  return inserts
    .filter((c) => c.table === '__seo_event_log')
    .flatMap((c) => c.rows as RejectedRow[])
    .filter((row) => row.event_type === CWV_BEACON_REJECTED_EVENT_TYPE);
}

describe('CwvBeaconService — persistence', () => {
  it('persists the enriched attribution of a human beacon into __seo_cwv_raw', async () => {
    const { service, inserts } = makeService();
    const input = humanInsert();

    await expect(service.record(input)).resolves.toEqual({ ok: true });

    expect(inserts).toHaveLength(1);
    expect(inserts[0].table).toBe('__seo_cwv_raw');
    expect(inserts[0].rows).toMatchObject({ attribution: input.attribution });
  });

  it('keeps routing bots to the seo.runtime.bot_cwv_beacon event', async () => {
    const { service, inserts } = makeService();

    await service.record({ ...humanInsert(), ua_class: 'bot_search' });

    expect(inserts).toHaveLength(1);
    expect(inserts[0].table).toBe('__seo_event_log');
    expect(inserts[0].rows).toMatchObject({
      event_type: 'seo.runtime.bot_cwv_beacon',
      payload: { ua_class: 'bot_search' },
    });
  });
});

describe('CwvBeaconService — rejection accounting', () => {
  it('writes one row per reason with its count, whatever the rejected volume', async () => {
    const { service, inserts } = makeService();
    const invalid = CwvBeaconClientPayloadSchema.safeParse({ metric: 'INP' });
    expect(invalid.success).toBe(false);

    for (let i = 0; i < 250; i += 1) service.countRejection('foreign_host');
    service.countRejection('empty_body');
    service.countRejection('schema_invalid', invalid.error?.issues);
    service.countRejection('schema_invalid', invalid.error?.issues);
    expect(inserts).toHaveLength(0);

    await service.flushRejections();

    expect(inserts).toHaveLength(1);
    const rows = rejectedRows(inserts);
    expect(rows).toHaveLength(3);
    const byReason = Object.fromEntries(rows.map((r) => [r.payload.reason, r]));
    expect(byReason.foreign_host.payload.count).toBe(250);
    expect(byReason.empty_body.payload.count).toBe(1);
    expect(byReason.schema_invalid.payload.count).toBe(2);
    expect(byReason.schema_invalid.payload.issues).toMatchObject({
      'invalid_type@session_id': 2,
    });
    for (const row of rows) {
      expect(row).toMatchObject({ severity: 'info', entity_url: null });
      expect(row.payload.node_env).toBe('production');
      expect(Date.parse(row.payload.window_start)).toBeLessThanOrEqual(
        Date.parse(row.payload.window_end),
      );
    }
  });

  it('starts a new window after a flush and writes nothing for an empty window', async () => {
    const { service, inserts } = makeService();
    service.countRejection('empty_body');
    await service.flushRejections();
    await service.flushRejections();

    expect(inserts).toHaveLength(1);
  });

  it('never records a client-supplied key name or value', async () => {
    const { service, inserts } = makeService();
    const parsed = CwvBeaconClientPayloadSchema.safeParse({
      session_id: 'b2c4e6a8-0000-4000-8000-000000000001',
      secret_token_value: 'https://www.automecanik.com/compte?token=abc',
    });
    expect(parsed.success).toBe(false);

    service.countRejection('schema_invalid', parsed.error?.issues);
    await service.flushRejections();

    const serialized = JSON.stringify(rejectedRows(inserts));
    expect(serialized).not.toContain('secret_token_value');
    expect(serialized).not.toContain('token=abc');
    expect(rejectedRows(inserts)[0].payload.issues).toHaveProperty(
      'unrecognized_keys@(root)',
    );
  });

  it('logs reason and count when the database refuses the event, without throwing', async () => {
    const { service, logger } = makeService(() =>
      Promise.resolve({
        error: {
          code: '22P02',
          message: 'invalid input value for enum seo_event_type',
        },
      }),
    );
    for (let i = 0; i < 7; i += 1) service.countRejection('schema_invalid');

    await expect(service.flushRejections()).resolves.toBeUndefined();

    expect(logger.warn).toHaveBeenCalledTimes(1);
    const [message] = logger.warn.mock.calls[0];
    expect(message).toContain('reason=schema_invalid');
    expect(message).toContain('count=7');
    expect(message).toContain('22P02');
  });

  it('logs reason and count when the insert throws, without throwing', async () => {
    const { service, logger } = makeService(() =>
      Promise.reject(new Error('fetch failed')),
    );
    service.countRejection('foreign_host');

    await expect(service.flushRejections()).resolves.toBeUndefined();

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('reason=foreign_host count=1'),
    );
  });

  it('flushes on its interval once started, and on shutdown', async () => {
    jest.useFakeTimers();
    try {
      const { service, inserts } = makeService();
      service.onModuleInit();

      service.countRejection('foreign_host');
      await jest.advanceTimersByTimeAsync(
        CwvBeaconService.REJECTION_FLUSH_INTERVAL_MS,
      );
      expect(rejectedRows(inserts)).toHaveLength(1);

      service.countRejection('empty_body');
      await service.onModuleDestroy();
      expect(rejectedRows(inserts)).toHaveLength(2);

      await jest.advanceTimersByTimeAsync(
        CwvBeaconService.REJECTION_FLUSH_INTERVAL_MS * 2,
      );
      expect(inserts).toHaveLength(2);
    } finally {
      jest.useRealTimers();
    }
  });
});
