import { createClient } from '@supabase/supabase-js';
import { MarketingHubDataService } from './marketing-hub-data.service';
import { PublicationPreparationInput } from '../dto/publication-preparation.dto';

const input: PublicationPreparationInput = {
  request_id: 'a2856df0-3baa-4a65-a87d-c6f83af9de21',
  channel: 'facebook',
  content_revision: 2,
  review_version: 3,
  account: { external_id: 'fixture', label: 'Test' },
  media: [],
};
const record = {
  ...input,
  post_id: 7,
  actor: 'admin-42',
  editorial_snapshot: { channels: { facebook: { caption: 'Approved' } } },
  approval_snapshot: {
    state: 'approved',
    content_revision: 2,
    actor: 'reviewer-42',
    decided_at: '2026-10-14T10:00:00Z',
  },
  created_at: '2026-10-14T10:01:00Z',
};

function setup(body: unknown, status = 200) {
  const requests: Array<{ url: URL; init?: RequestInit }> = [];
  const client = createClient(
    'http://127.0.0.1:54321',
    'unit-test-placeholder',
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      global: {
        fetch: async (url, init) => {
          requests.push({ url: new URL(String(url)), init });
          return new Response(JSON.stringify(body), {
            status,
            headers: { 'Content-Type': 'application/json' },
          });
        },
      },
    },
  );
  // No constructor, environment, real credentials or network.
  const service: MarketingHubDataService = Object.create(
    MarketingHubDataService.prototype,
  );
  Object.defineProperty(service, 'supabase', { value: client });
  return { service, requests };
}

describe('durable preparation persistence boundary', () => {
  it('reads one exact preparation independently of the last 50 history entries', async () => {
    const { service, requests } = setup(record);
    expect(
      await service.getPublicationPreparation(7, input.request_id),
    ).toEqual(record);
    expect(requests[0].url.searchParams.get('post_id')).toBe('eq.7');
    expect(requests[0].url.searchParams.get('request_id')).toBe(
      `eq.${input.request_id}`,
    );
    expect(requests[0].url.searchParams.has('limit')).toBe(false);
  });
  it('distinguishes missing selection and storage failure', async () => {
    expect(
      await setup(null).service.getPublicationPreparation(7, input.request_id),
    ).toBeNull();
    await expect(
      setup({ code: '42P01' }, 400).service.getPublicationPreparation(
        7,
        input.request_id,
      ),
    ).rejects.toMatchObject({ code: 'DATABASE.OPERATION_FAILED' });
  });
  it.each([
    { ...record, post_id: 8 },
    { ...record, request_id: 'b2856df0-3baa-4a65-a87d-c6f83af9de21' },
    {
      ...record,
      approval_snapshot: { ...record.approval_snapshot, content_revision: 1 },
    },
  ])('refuses inconsistent selected record %#', async (value) => {
    await expect(
      setup(value).service.getPublicationPreparation(7, input.request_id),
    ).rejects.toMatchObject({ code: 'DATABASE.OPERATION_FAILED' });
  });
  it('calls one atomic RPC with exact target and server actor', async () => {
    const { service, requests } = setup(record);
    expect(await service.preparePublication(7, input, 'admin-42')).toEqual(
      record,
    );
    expect(requests).toHaveLength(1);
    expect(requests[0].url.pathname).toBe(
      '/rest/v1/rpc/prepare_marketing_publication',
    );
    expect(JSON.parse(String(requests[0].init?.body))).toEqual({
      p_post_id: 7,
      p_request_id: input.request_id,
      p_channel: input.channel,
      p_content_revision: 2,
      p_review_version: 3,
      p_account: input.account,
      p_media: [],
      p_actor: 'admin-42',
    });
  });
  it.each([
    ['40001', 'RESOURCE.CONFLICT'],
    ['23505', 'RESOURCE.CONFLICT'],
    ['23514', 'VALIDATION.FAILED'],
    ['P0002', 'RESOURCE.NOT_FOUND'],
    ['42P01', 'DATABASE.OPERATION_FAILED'],
  ])('propagates %s instead of claiming saved', async (code, expected) => {
    const { service } = setup({ code, message: 'fixture error' }, 400);
    await expect(
      service.preparePublication(7, input, 'admin-42'),
    ).rejects.toMatchObject({ code: expected });
  });
  it.each([
    null,
    {},
    { ...record, actor: 'another' },
    { ...record, post_id: 8 },
    { ...record, content_revision: 3 },
    { ...record, review_version: 4 },
    { ...record, account: { external_id: 'other', label: 'Test' } },
    {
      ...record,
      approval_snapshot: { ...record.approval_snapshot, content_revision: 1 },
    },
    {
      ...record,
      approval_snapshot: { ...record.approval_snapshot, state: 'rejected' },
    },
  ])('refuses missing or mismatched persistence evidence %#', async (value) => {
    await expect(
      setup(value).service.preparePublication(7, input, 'admin-42'),
    ).rejects.toMatchObject({ code: 'DATABASE.OPERATION_FAILED' });
  });
  it('reads bounded historical records scoped to post', async () => {
    const { service, requests } = setup([record]);
    expect(await service.getPublicationPreparations(7)).toEqual([record]);
    expect(requests[0].url.searchParams.get('post_id')).toBe('eq.7');
    expect(requests[0].url.searchParams.get('limit')).toBe('50');
    expect(requests[0].url.searchParams.get('order')).toBe(
      'created_at.desc,request_id.desc',
    );
  });
  it('does not translate missing schema to empty history', async () => {
    await expect(
      setup({ code: '42P01' }, 400).service.getPublicationPreparations(7),
    ).rejects.toMatchObject({ code: 'DATABASE.OPERATION_FAILED' });
  });
  it('rejects cross-post history', async () => {
    await expect(
      setup([{ ...record, post_id: 8 }]).service.getPublicationPreparations(7),
    ).rejects.toMatchObject({ code: 'DATABASE.OPERATION_FAILED' });
  });
});
