import { Test } from '@nestjs/testing';
import { MarketingHubDataService } from './marketing-hub-data.service';
import { PublishQueueService } from './publish-queue.service';

// Loading the full application can activate workers and scheduled tasks.
jest.mock('../../../app.module', () => {
  throw new Error('Full application bootstrap forbidden for read-only export');
});

describe('standalone editorial export bootstrap', () => {
  it('loads without AppModule, DB access or automatic CLI execution', async () => {
    const cli =
      await import('../../../../../scripts/marketing/export-publish-queue');
    const read = jest.fn().mockResolvedValue([]);
    const context = await Test.createTestingModule({
      imports: [cli.MarketingExportModule],
    })
      .overrideProvider(MarketingHubDataService)
      .useValue({ getApprovedPostsByChannel: read })
      .compile();
    await context.init();
    try {
      expect(read).not.toHaveBeenCalled();
      const result = await context
        .get(PublishQueueService)
        .exportManifest('2026-W42', 'instagram');
      expect(result).toMatchObject({
        purpose: 'editorial_preparation',
        posts: [],
      });
      expect(read).toHaveBeenCalledTimes(1);
    } finally {
      await context.close();
    }
  });
});
