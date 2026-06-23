/**
 * Injection gate — the SSR observability reporter MUST be present in the
 * AppLoadContext returned by getLoadContext.
 *
 * Production topology is always NestJS → React Router (embedded), so the SSR
 * bridge (entry.server handleError/onError + reportLoaderError) depends on
 * `context.serverObservability` being injected here. Without it the bridge
 * silently no-ops. This locks PRODUCTION_EMBEDDED_SERVER_OBSERVABILITY = REQUIRED.
 *
 * Anti-vacuity: the handler awaits getServerBuild() (mocked) BEFORE
 * createRequestHandler, inside a try/catch that swallows failures into a 500 —
 * so without the @fafa/frontend mock + the toHaveBeenCalled() check the test
 * could pass without ever reaching getLoadContext. `expect.assertions(2)` guards.
 */
import { createRequestHandler } from '@react-router/express';
import { RemixController } from './remix.controller';

jest.mock('@fafa/frontend', () => ({
  getServerBuild: jest.fn().mockResolvedValue({}),
}));
jest.mock('@sentry/nestjs', () => ({
  withScope: jest.fn(),
  captureException: jest.fn(),
}));
jest.mock('@react-router/express', () => ({
  createRequestHandler: jest.fn(),
}));
jest.mock('./remix.service', () => ({ RemixService: class {} }));
jest.mock('./remix-api.service', () => ({ RemixApiService: class {} }));

describe('RemixController — serverObservability injection gate', () => {
  it('injects serverObservability into getLoadContext (embedded prod)', async () => {
    expect.assertions(2);

    jest.mocked(createRequestHandler).mockImplementation(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ({ getLoadContext }: any) =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (async (req: any, res: any) => {
          const context = await getLoadContext?.(req, res);
          expect(context).toEqual(
            expect.objectContaining({
              serverObservability: { captureException: expect.any(Function) },
            }),
          );
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        }) as any,
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const controller = new RemixController({} as any, {} as any);
    // url='/' so the handler does NOT early-return on the /api,/auth… guards.
    const request = {
      url: '/',
      method: 'GET',
      path: '/',
      user: undefined,
      body: undefined,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
    const response = {
      locals: { cspNonce: 'test-nonce' },
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
    const next = jest.fn();

    await controller.handler(request, response, next);

    expect(createRequestHandler).toHaveBeenCalled();
  });
});
