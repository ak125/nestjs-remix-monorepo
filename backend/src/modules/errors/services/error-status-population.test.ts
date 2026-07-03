import { ErrorService } from './error.service';

/**
 * Régression observabilité (2026-06-25) — `err_status` NULL sur les erreurs
 * journalisées via `ErrorService.logError`.
 *
 * `GlobalErrorFilter` appelle `logError(error, request, { status, handled_by })`.
 * `ErrorLogService.build()` mappe `err_status` depuis `errorMetadata.response_status`
 * (branche Partial<ErrorLog>). Or `ErrorService.logError` ne posait PAS
 * `response_status` dans son `errorMetadata` → `err_status` toujours NULL pour
 * TOUTES les erreurs de ce chemin (429 ThrottlerException, 5xx…), donc non
 * requêtables par statut (`WHERE err_status = 429` retournait 0 alors que
 * `WHERE err_code = 'ThrottlerException'` en comptait ~100k).
 *
 * Le correctif : surfacer `context.status` vers `errorMetadata.response_status`.
 * Sûr (verdict blast-radius) : la signature de dédup = `subject|url|ip` n'inclut
 * pas le statut ; la RPC d'alerte 5xx garde sa branche `err_code IN (...)` en OR
 * (un 5xx matche alors les deux jambes mais reste compté une seule fois).
 */
describe('ErrorService.logError — peuple errorMetadata.response_status (régression err_status NULL)', () => {
  type CapturedErrorData = { errorMetadata?: { response_status?: number } };

  function makeService() {
    const captured: CapturedErrorData[] = [];
    const errorLogService = {
      logError: jest.fn((errorData: CapturedErrorData) => {
        captured.push(errorData);
        return Promise.resolve(null);
      }),
    } as unknown as ConstructorParameters<typeof ErrorService>[0];
    const redirectService = {} as unknown as ConstructorParameters<
      typeof ErrorService
    >[1];
    const service = new ErrorService(errorLogService, redirectService);
    return { service, captured };
  }

  it('surface un 429 (ThrottlerException) depuis context.status', async () => {
    const { service, captured } = makeService();
    await service.logError(new Error('Too Many Requests'), undefined, {
      status: 429,
      handled_by: 'GlobalErrorFilter',
    });
    expect(captured).toHaveLength(1);
    expect(captured[0].errorMetadata?.response_status).toBe(429);
  });

  it('surface aussi un 5xx', async () => {
    const { service, captured } = makeService();
    await service.logError(new Error('boom'), undefined, { status: 500 });
    expect(captured[0].errorMetadata?.response_status).toBe(500);
  });

  it('reste undefined sans status (aucune régression, pas de 0 fantôme)', async () => {
    const { service, captured } = makeService();
    await service.logError(new Error('no-status'));
    expect(captured[0].errorMetadata?.response_status).toBeUndefined();
  });

  it('ignore un status non-numérique (garde de type)', async () => {
    const { service, captured } = makeService();
    await service.logError(new Error('weird'), undefined, {
      status: 'oops' as unknown as number,
    });
    expect(captured[0].errorMetadata?.response_status).toBeUndefined();
  });
});
