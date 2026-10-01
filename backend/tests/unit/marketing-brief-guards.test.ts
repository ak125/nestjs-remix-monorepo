import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { promises as fs } from 'fs';
import request from 'supertest';
import { MarketingBriefsController } from '../../src/modules/marketing/controllers/marketing-briefs.controller';
import { MarketingBriefsService } from '../../src/modules/marketing/services/marketing-briefs.service';
import { BrandComplianceGateService } from '../../src/modules/marketing/services/brand-compliance-gate.service';
import { MarketingHubDataService } from '../../src/modules/marketing/services/marketing-hub-data.service';
import { RpcGateService } from '../../src/security/rpc-gate/rpc-gate.service';

// Replace only external persistence/configuration. The HTTP route, admin guard,
// workflow and brand gate are real; no shared Supabase or Redis is contacted.
jest.mock('@database/services/supabase-base.service', () => ({
  SupabaseBaseService: class {
    protected supabase = { from: (table: string) => mockQuery(table) };
  },
}));

let row: Record<string, unknown> | null;
let writes: number;
let beforeWrite: (() => void) | undefined;
let databaseError: boolean;
function mockQuery(table: string) {
  if (table !== '__marketing_brief')
    throw new Error(`Unexpected table ${table}`);
  let patch: Record<string, unknown> | undefined;
  const filters: Array<[string, unknown]> = [];
  const finish = async (nullable: boolean) => {
    if (databaseError)
      return { data: null, error: { code: '08006', message: 'offline' } };
    if (patch) beforeWrite?.();
    if (!row || !filters.every(([key, value]) => row?.[key] === value)) {
      return {
        data: null,
        error: nullable ? null : { code: 'PGRST116', message: 'No row' },
      };
    }
    if (patch) {
      row = { ...row, ...patch, updated_at: '2026-10-01T12:01:00.000Z' };
      writes++;
    }
    return { data: structuredClone(row), error: null };
  };
  const query = {
    select: () => query,
    eq: (key: string, value: unknown) => {
      filters.push([key, value]);
      return query;
    },
    update: (value: Record<string, unknown>) => {
      patch = value;
      return query;
    },
    single: () => finish(false),
    maybeSingle: () => finish(true),
  };
  return query;
}

const validCanon = {
  legal_name: 'Entreprise de test',
  trade_name: 'Magasin de test',
  address: {
    street: '1 rue de test',
    postal_code: '93320',
    city: 'Ville de test',
    country: 'FR',
  },
  phone: '+33123456789',
  opening_hours: {
    monday: { opens: '09:00', closes: '18:00' },
    tuesday: 'closed',
    wednesday: 'closed',
    thursday: 'closed',
    friday: 'closed',
    saturday: 'closed',
    sunday: 'closed',
  },
  validated: true,
  validated_by: 'owner-test',
  validated_at: '2026-10-01T10:00:00Z',
};
const canonDocument = (canon: unknown) =>
  '```yaml\n' + JSON.stringify({ local_canon: canon }) + '\n```';

describe('Marketing brief HTTP workflow guards', () => {
  let app: INestApplication;
  let canonRead: jest.SpyInstance;
  let user: { isAdmin?: boolean; email?: string } | undefined;
  const url = '/api/admin/marketing/briefs/brief-1/status';
  const transition = (status: string, body = {}) =>
    request(app.getHttpServer())
      .patch(url)
      .send({ status, ...body });

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [MarketingBriefsController],
      providers: [
        MarketingBriefsService,
        BrandComplianceGateService,
        { provide: RpcGateService, useValue: {} },
        { provide: MarketingHubDataService, useValue: {} },
      ],
    }).compile();
    app = module.createNestApplication({ logger: false });
    app.use((req, _res, next) => {
      req.user = user;
      next();
    });
    await app.init();
  });
  afterAll(async () => {
    await app?.close();
  });
  beforeEach(() => {
    row = {
      id: 'brief-1',
      agent_id: 'customer-retention-agent',
      business_unit: 'ECOMMERCE',
      channel: 'email',
      conversion_goal: 'ORDER',
      cta: 'Voir les pieces',
      target_segment: 'test',
      payload: { text: 'Texte de test' },
      coverage_manifest: {
        scope_requested: 'test',
        final_status: 'REVIEW_REQUIRED',
      },
      brand_gate_level: 'PASS',
      compliance_gate_level: 'PASS',
      gate_summary: { can_approve: true, blocking_issues: [] },
      status: 'draft',
      reviewed_by: null,
      reviewed_at: null,
      approved_by: null,
      approved_at: null,
      published_at: null,
      social_post_id: null,
      ai_provider: null,
      ai_model: null,
      generation_prompt_hash: null,
      created_at: '2026-10-01T12:00:00.000Z',
      updated_at: '2026-10-01T12:00:00.000Z',
    };
    writes = 0;
    databaseError = false;
    beforeWrite = undefined;
    user = { isAdmin: true, email: 'real-admin@example.test' };
    canonRead = jest
      .spyOn(fs, 'readFile')
      .mockResolvedValue(canonDocument(validCanon));
  });
  afterEach(() => {
    canonRead.mockRestore();
  });

  it.each([undefined, { isAdmin: false, email: 'reader@example.test' }])(
    'rejects non-admin %j even with a forged approver',
    async (identity) => {
      user = identity;
      await transition('reviewed', { reviewed_by: 'forged' }).expect(403);
      expect(writes).toBe(0);
    },
  );
  it.each(['reviewed', 'approved'])(
    'uses only the authenticated actor for %s',
    async (status) => {
      if (status === 'approved') row.status = 'reviewed';
      const response = await transition(status, {
        reviewed_by: 'forged-reviewer',
        approved_by: 'forged-approver',
      }).expect(200);
      expect(
        response.body.data[
          status === 'reviewed' ? 'reviewed_by' : 'approved_by'
        ],
      ).toBe('real-admin@example.test');
    },
  );
  it.each([undefined, '', '  '])(
    'refuses missing/blank session identity %j',
    async (email) => {
      user = { isAdmin: true, email };
      await transition('reviewed', { reviewed_by: 'forged' }).expect(403);
      expect(writes).toBe(0);
    },
  );
  it.each(['draft', 'nonsense'])(
    'returns 400 for non-requestable status %s',
    async (status) => {
      await transition(status).expect(400);
      expect(writes).toBe(0);
    },
  );
  it.each([
    ['draft', 'approved'],
    ['draft', 'published'],
    ['reviewed', 'published'],
    ['approved', 'reviewed'],
    ['archived', 'approved'],
    ['archived', 'archived'],
  ])('rejects %s -> %s', async (current, next) => {
    row.status = current;
    await transition(next).expect(409);
    expect(writes).toBe(0);
  });
  it('runs the nominal lifecycle and retains review and approval attribution', async () => {
    await transition('reviewed').expect(200);
    user.email = 'second-admin@example.test';
    await transition('approved').expect(200);
    const response = await transition('published').expect(200);
    expect(response.body.data).toMatchObject({
      status: 'published',
      reviewed_by: 'real-admin@example.test',
      approved_by: 'second-admin@example.test',
    });
    expect(response.body.data.published_at).toEqual(expect.any(String));
    expect(writes).toBe(3);
  });
  it.each(['draft', 'reviewed', 'approved', 'published'])(
    'can archive %s even when gates/canon block progression',
    async (status) => {
      Object.assign(row, {
        status,
        business_unit: 'LOCAL',
        brand_gate_level: 'FAIL',
      });
      canonRead.mockRejectedValue(new Error('unavailable'));
      await transition('archived').expect(200);
      expect(row.status).toBe('archived');
    },
  );
  it.each(['brand_gate_level', 'compliance_gate_level'])(
    'blocks missing or failed %s',
    async (field) => {
      for (const level of [null, 'FAIL', 'unexpected']) {
        row[field] = level;
        await transition('reviewed').expect(422);
        expect(writes).toBe(0);
      }
    },
  );
  it('accepts a WARN gate without treating it as FAIL', async () => {
    row.brand_gate_level = 'WARN';
    await transition('reviewed').expect(200);
  });
  it('refuses an explicitly blocking gate summary', async () => {
    row.gate_summary = {
      can_approve: false,
      blocking_issues: ['forbidden claim'],
    };
    await transition('reviewed').expect(422);
    expect(writes).toBe(0);
  });
  it('rejects a LOCAL brief on an ecommerce channel', async () => {
    Object.assign(row, {
      business_unit: 'LOCAL',
      agent_id: 'local-business-agent',
    });
    await transition('reviewed').expect(422);
    expect(writes).toBe(0);
  });
  it.each(['LOCAL', 'HYBRID'])(
    'blocks %s with an unvalidated canon despite passing recorded gates',
    async (unit) => {
      Object.assign(row, {
        business_unit: unit,
        channel: unit === 'LOCAL' ? 'gbp' : 'email',
        agent_id:
          unit === 'LOCAL'
            ? 'local-business-agent'
            : 'customer-retention-agent',
        conversion_goal: 'CALL',
        payload: {
          target_zone: '93',
          hybrid_reason: 'Test',
          cta_ecommerce: 'Commander',
          cta_local: 'Appeler',
          conversion_goal_ecommerce: 'ORDER',
          conversion_goal_local: 'CALL',
        },
      });
      canonRead.mockResolvedValue(
        canonDocument({ ...validCanon, validated: false }),
      );
      const response = await transition('reviewed').expect(422);
      expect(response.body.message).toBe('local_canon_unvalidated');
      expect(writes).toBe(0);
    },
  );
  it.each([
    ['absent', null],
    ['malformed', '```yaml\nlocal_canon: [\n```'],
    ['string boolean', canonDocument({ ...validCanon, validated: 'true' })],
    ['TBD', canonDocument({ ...validCanon, phone: 'TBD' })],
    ['incomplete hours', canonDocument({ ...validCanon, opening_hours: {} })],
    [
      'invalid hours',
      canonDocument({
        ...validCanon,
        opening_hours: {
          ...validCanon.opening_hours,
          monday: { opens: '99:99', closes: '18:00' },
        },
      }),
    ],
    ['missing address', canonDocument({ ...validCanon, address: {} })],
  ])('refuses LOCAL progression with %s canon', async (_name, document) => {
    Object.assign(row, {
      business_unit: 'LOCAL',
      channel: 'gbp',
      agent_id: 'local-business-agent',
      conversion_goal: 'CALL',
    });
    if (document === null) canonRead.mockRejectedValue(new Error('ENOENT'));
    else canonRead.mockResolvedValue(document);
    const response = await transition('reviewed').expect(422);
    expect(response.body.message).toBe('local_canon_unvalidated');
    expect(writes).toBe(0);
  });
  it('allows a valid LOCAL brief and rechecks canon before approval', async () => {
    Object.assign(row, {
      business_unit: 'LOCAL',
      channel: 'gbp',
      agent_id: 'local-business-agent',
      conversion_goal: 'CALL',
    });
    await transition('reviewed').expect(200);
    canonRead.mockResolvedValue(
      canonDocument({ ...validCanon, validated: false }),
    );
    await transition('approved').expect(422);
    expect(row.status).toBe('reviewed');
  });
  it.each(['status', 'updated_at'])(
    'refuses a concurrent change of %s',
    async (field) => {
      beforeWrite = () => {
        row[field] =
          field === 'status' ? 'archived' : '2026-10-01T12:00:01.000Z';
      };
      await transition('reviewed').expect(409);
      expect(writes).toBe(0);
      expect(row.reviewed_by).toBeNull();
    },
  );
  it('returns 404 for an absent brief', async () => {
    row = null;
    await transition('reviewed').expect(404);
  });
  it('does not classify database unavailability as a missing brief', async () => {
    databaseError = true;
    await transition('reviewed').expect(503);
    expect(writes).toBe(0);
  });
  it('reads the actual repository canon and blocks the unvalidated LOCAL pilot', async () => {
    canonRead.mockRestore();
    Object.assign(row, {
      business_unit: 'LOCAL',
      channel: 'gbp',
      conversion_goal: 'CALL',
      agent_id: 'local-business-agent',
    });
    const response = await transition('reviewed').expect(422);
    expect(response.body.message).toBe('local_canon_unvalidated');
    expect(writes).toBe(0);
  });
  it('does not resolve the canon relative to the process cwd', async () => {
    Object.assign(row, {
      business_unit: 'LOCAL',
      channel: 'gbp',
      conversion_goal: 'CALL',
      agent_id: 'local-business-agent',
    });
    const cwd = jest.spyOn(process, 'cwd').mockReturnValue('/unrelated');
    try {
      await transition('reviewed').expect(200);
      const requestedPath = String(canonRead.mock.calls[0][0]);
      expect(requestedPath).toBe(
        require('path').resolve(
          __dirname,
          '../../../.claude/canon-mirrors/marketing-voice.md',
        ),
      );
    } finally {
      cwd.mockRestore();
    }
  });
  it.each(['approved', 'published'])(
    'rechecks gates before %s',
    async (next) => {
      row.status = next === 'approved' ? 'reviewed' : 'approved';
      row.compliance_gate_level = 'FAIL';
      await transition(next).expect(422);
      expect(writes).toBe(0);
    },
  );
});
