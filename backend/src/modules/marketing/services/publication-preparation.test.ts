import { parsePublicationPreparation } from '../dto/publication-preparation.dto';
import { PublishQueueService } from './publish-queue.service';
import { MarketingHubDataService } from './marketing-hub-data.service';

const input = {
  request_id: 'a2856df0-3baa-4a65-a87d-c6f83af9de21',
  channel: 'facebook',
  content_revision: 2,
  review_version: 3,
  account: { external_id: 'fixture-account', label: 'Compte test' },
  media: [
    {
      bucket: 'marketing-private',
      path: 'fixtures/final.png',
      sha256: 'a'.repeat(64),
      role: 'image',
    },
  ],
};

describe('publication preparation contract', () => {
  it('normalizes UUID case to the PostgreSQL representation for safe retries', () => {
    expect(
      parsePublicationPreparation({
        ...input,
        request_id: input.request_id.toUpperCase(),
      }).request_id,
    ).toBe(input.request_id);
  });
  it('accepts a declared account and storage reference without publishing', () => {
    expect(parsePublicationPreparation(input)).toEqual(input);
  });
  it.each([
    { ...input, actor: 'forged' },
    { ...input, publication_approved: true },
    { ...input, request_id: 'retry' },
    { ...input, content_revision: 0 },
    { ...input, account: { ...input.account, access_token: 'secret' } },
    { ...input, account: { external_id: ' ', label: 'Test' } },
    { ...input, media: [{ ...input.media[0], path: '../escape.png' }] },
    { ...input, media: [{ ...input.media[0], path: 'https://example.com/a' }] },
    { ...input, media: [{ ...input.media[0], sha256: 'unknown' }] },
    { ...input, media: [input.media[0], input.media[0]] },
  ])('rejects invalid or forged preparation %#', (value) => {
    expect(() => parsePublicationPreparation(value)).toThrow();
  });
  it('persists through existing data service with server actor', async () => {
    const hub = {
      preparePublication: jest
        .fn()
        .mockResolvedValue({ request_id: input.request_id }),
    };
    const queue = new PublishQueueService(
      hub as unknown as MarketingHubDataService,
      {} as never,
    );
    const result = await queue.preparePublication(7, input, 'admin-42');
    expect(hub.preparePublication).toHaveBeenCalledWith(7, input, 'admin-42');
    expect(result.publication.ready).toBe(false);
    expect(result.publication.blockers).toEqual([
      'account_authorization_unverified',
      'media_availability_and_rights_unverified',
      'publication_approval_missing',
    ]);
  });
  it('rejects invalid preparation before data service', async () => {
    const hub = { preparePublication: jest.fn() };
    const queue = new PublishQueueService(
      hub as unknown as MarketingHubDataService,
      {} as never,
    );
    await expect(
      queue.preparePublication(7, { ...input, actor: 'forged' }, 'admin-42'),
    ).rejects.toThrow();
    expect(hub.preparePublication).not.toHaveBeenCalled();
  });
});
