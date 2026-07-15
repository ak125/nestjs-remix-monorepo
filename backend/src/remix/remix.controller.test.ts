/**
 * Injection gate — the SSR observability reporter MUST be handed to the
 * load-context factory by the controller.
 *
 * Production topology is always NestJS → React Router (embedded). Under
 * `v8_middleware` (A6) the load context is a `RouterContextProvider` built by
 * the SSR-realm factory `createAppLoadContext`, bridged into NestJS (CJS) via
 * `@fafa/frontend`'s `getCreateAppLoadContext` (the keys never cross realms —
 * dual-realm safety, incident #1106). The SSR bridge (entry.server
 * handleError/onError + reportLoaderError) reads the reporter via
 * `context.get(serverObservabilityContext)`, so the controller MUST pass a
 * `serverObservability` reporter INTO that factory. This locks
 * PRODUCTION_EMBEDDED_SERVER_OBSERVABILITY = REQUIRED at the backend boundary.
 *
 * Split of concerns: the provider's key identity / `.get()` round-trip is
 * covered by the frontend `load-context-identity.test.ts`; here we lock the
 * BACKEND contract — getLoadContext invokes the factory with a
 * `serverObservability.captureException`. The factory is mocked as an
 * identity passthrough so the gate can inspect the values it receives.
 *
 * Anti-vacuity: the handler awaits getServerBuild()+getCreateAppLoadContext()
 * (both mocked) BEFORE createRequestHandler, inside a try/catch that swallows
 * failures into a 500 — so without the mocks + the toHaveBeenCalled() check the
 * test could pass without ever reaching getLoadContext. `expect.assertions(2)` guards.
 */
import { getCreateAppLoadContext } from '@fafa/frontend';
import { createRequestHandler } from '@react-router/express';
import { RemixController } from './remix.controller';

jest.mock('@fafa/frontend', () => ({
  getServerBuild: jest.fn().mockResolvedValue({}),
  getCreateAppLoadContext: jest.fn(),
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

    // A6 factory bridge: getCreateAppLoadContext resolves the SSR-realm factory.
    // Mock it as an identity passthrough so the gate inspects the exact values
    // the controller hands in (the real factory wraps them in a
    // RouterContextProvider — its key round-trip is the frontend identity test).
    jest
      .mocked(getCreateAppLoadContext)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .mockResolvedValue(((values: any) => values) as any);

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
      // Real Express requests always carry `.headers`; the `.data` privacy guard
      // (enforceSessionedDataCachePrivacy) reads request.headers.cookie.
      headers: {},
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
