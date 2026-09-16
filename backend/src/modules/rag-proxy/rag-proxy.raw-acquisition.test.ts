import { GUARDS_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { RagProxyController } from './rag-proxy.controller';
import { AuthenticatedGuard } from '../../auth/authenticated.guard';
import { IsAdminGuard } from '../../auth/is-admin.guard';

describe('legacy cleanup/apply delegates source receipt to RAW', () => {
  const doc = {
    title: 'Filtre',
    content: 'Texte soumis.',
    source: 'manual/filtre',
    domain: 'auto',
    category: 'knowledge',
    truth_level: 'L1' as const,
  };

  it('never applies a browser-supplied RAG publication decision', async () => {
    const receiveDocument = jest
      .fn()
      .mockResolvedValue({ destination: 'raw', status: 'to_verify' });
    const applyIngest = jest.fn(() => {
      throw new Error('RAG write forbidden');
    });
    const controller: RagProxyController = Object.assign(
      Object.create(RagProxyController.prototype),
      {
        rawAcquisitionClient: { receiveDocument },
        ragCleanupService: { applyIngest },
      },
    );
    const result = await controller.cleanupApply({
      doc,
      decision: {
        decision: 'ACCEPT_UPSERT',
        reasons: [],
        fingerprint: 'forged',
        parent_source: 'canonical/forged',
        proposed: { status: 'active', retrievable: true },
      },
    });
    expect(result).toEqual({ destination: 'raw', status: 'to_verify' });
    expect(receiveDocument).toHaveBeenCalledWith(doc);
    expect(applyIngest).not.toHaveBeenCalled();
  });

  it('accepts source material without a client decision and preserves producer failures', async () => {
    const receiveDocument = jest
      .fn()
      .mockRejectedValue(new Error('RAW unavailable'));
    const controller: RagProxyController = Object.assign(
      Object.create(RagProxyController.prototype),
      {
        rawAcquisitionClient: { receiveDocument },
      },
    );
    await expect(controller.cleanupApply({ doc })).rejects.toThrow(
      'RAW unavailable',
    );
    await expect(
      controller.cleanupApply({ doc: undefined as never }),
    ).rejects.toMatchObject({ status: 400 });
    expect(receiveDocument).toHaveBeenCalledTimes(1);
  });

  it('preserves the route and both access guards', () => {
    const method = RagProxyController.prototype.cleanupApply;
    expect(Reflect.getMetadata(PATH_METADATA, method)).toBe(
      'admin/cleanup/apply',
    );
    expect(Reflect.getMetadata(GUARDS_METADATA, method)).toEqual([
      AuthenticatedGuard,
      IsAdminGuard,
    ]);
  });
});

describe('video acquisition delegates to RAW', () => {
  it('never invokes the removed RAG downloader', async () => {
    const receiveVideo = jest
      .fn()
      .mockResolvedValue({ destination: 'raw', status: 'to_verify' });
    const legacyIngest = jest.fn(() => {
      throw new Error('RAG acquisition forbidden');
    });
    const controller: RagProxyController = Object.assign(
      Object.create(RagProxyController.prototype),
      {
        rawAcquisitionClient: { receiveVideo },
        ragVideoManagementService: { ingestVideoUrl: legacyIngest },
      },
    );
    const body = { url: 'https://www.bosch.com/video.mp4', gamme: 'freinage' };
    expect(await controller.ingestVideoUrl(body)).toEqual({
      destination: 'raw',
      status: 'to_verify',
    });
    expect(receiveVideo).toHaveBeenCalledWith(body);
    expect(legacyIngest).not.toHaveBeenCalled();
    await expect(
      controller.ingestVideoUrl(undefined as never),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('preserves the acquisition route and its authentication guards', () => {
    const method = RagProxyController.prototype.ingestVideoUrl;
    expect(Reflect.getMetadata(PATH_METADATA, method)).toBe(
      'admin/ingest/video/single',
    );
    expect(Reflect.getMetadata(GUARDS_METADATA, method)).toEqual([
      AuthenticatedGuard,
      IsAdminGuard,
    ]);
  });
});
