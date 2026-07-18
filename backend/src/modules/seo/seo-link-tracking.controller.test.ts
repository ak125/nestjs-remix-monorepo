import { SeoLinkTrackingController } from './seo-link-tracking.controller';
import type { SeoLinkTrackingService } from './infrastructure/seo-link-tracking.service';

/**
 * Regression tests for the PUBLIC, unauthenticated SEO beacon endpoints.
 *
 * Sentry PROD (2026-07-17) : `TypeError: Cannot read properties of undefined
 * (reading 'linkType')` on `POST /api/seo/track-impression`. Root cause: the
 * custom body-parser in `main.ts` (`body-parser.json()`, default
 * `type: 'application/json'`) only populates `req.body` when the request
 * Content-Type is `application/json`. Empty-body / wrong-content-type / bot /
 * aborted POSTs to this public endpoint leave `req.body === undefined`, and the
 * handler dereferenced `dto.linkType` without a guard → 500.
 *
 * Contract: a malformed/absent body is a no-op `{ success: false }` (never a
 * throw), mirroring the governed sibling beacon `LandingAttributionController`.
 */
describe('SeoLinkTrackingController — malformed body resilience', () => {
  let service: jest.Mocked<
    Pick<SeoLinkTrackingService, 'trackImpression' | 'trackClick'>
  >;

  // Boundary view of the controller: these endpoints receive arbitrary request
  // bodies (the framework binds `@Body()` to whatever the body-parser produced,
  // including `undefined`). Typing the calls as `unknown` reflects that reality
  // and stays valid across the handler-signature change.
  let call: {
    trackImpression(body: unknown): Promise<{ success: boolean }>;
    trackClick(
      body: unknown,
      ua?: string,
      referer?: string,
    ): Promise<{ success: boolean }>;
  };

  beforeEach(() => {
    service = {
      trackImpression: jest.fn().mockResolvedValue(true),
      trackClick: jest.fn().mockResolvedValue(true),
    };
    const controller = new SeoLinkTrackingController(
      service as unknown as SeoLinkTrackingService,
    );
    call = controller as unknown as typeof call;
  });

  describe('trackImpression', () => {
    it('returns { success: false } and skips the service when body is undefined', async () => {
      await expect(call.trackImpression(undefined)).resolves.toEqual({
        success: false,
      });
      expect(service.trackImpression).not.toHaveBeenCalled();
    });

    it('returns { success: false } when body is not an object', async () => {
      await expect(call.trackImpression('not-json')).resolves.toEqual({
        success: false,
      });
      expect(service.trackImpression).not.toHaveBeenCalled();
    });

    it('returns { success: false } when linkType is missing', async () => {
      await expect(
        call.trackImpression({ pageUrl: '/x', linkCount: 2 }),
      ).resolves.toEqual({ success: false });
      expect(service.trackImpression).not.toHaveBeenCalled();
    });

    it('forwards a well-formed impression to the service', async () => {
      await expect(
        call.trackImpression({
          linkType: 'CrossSelling',
          pageUrl: '/pieces/x.html',
          linkCount: 4,
          sessionId: 'sess-1',
        }),
      ).resolves.toEqual({ success: true });
      expect(service.trackImpression).toHaveBeenCalledWith(
        expect.objectContaining({
          linkType: 'CrossSelling',
          pageUrl: '/pieces/x.html',
          linkCount: 4,
          sessionId: 'sess-1',
        }),
      );
    });
  });

  describe('trackClick', () => {
    it('returns { success: false } and skips the service when body is undefined', async () => {
      await expect(
        call.trackClick(undefined, undefined, undefined),
      ).resolves.toEqual({ success: false });
      expect(service.trackClick).not.toHaveBeenCalled();
    });

    it('forwards a well-formed click to the service (device inferred from UA)', async () => {
      await expect(
        call.trackClick(
          {
            linkType: 'LinkGammeCar',
            sourceUrl: '/a.html',
            destinationUrl: '/b.html',
          },
          'Mozilla/5.0 (iPhone) Mobile',
          '/a.html',
        ),
      ).resolves.toEqual({ success: true });
      expect(service.trackClick).toHaveBeenCalledWith(
        expect.objectContaining({
          linkType: 'LinkGammeCar',
          sourceUrl: '/a.html',
          destinationUrl: '/b.html',
          deviceType: 'mobile',
        }),
      );
    });
  });
});
