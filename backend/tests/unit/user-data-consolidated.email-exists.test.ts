/**
 * UserDataConsolidatedService.emailExistsAnywhere — vérification fail-closed.
 *
 * Une erreur de la RPC `auth_email_exists` lève une exception : répondre
 * « email libre » laisserait passer ce que l'appelant veut bloquer (checkout
 * invité sur une adresse déjà inscrite). L'adresse n'est jamais écrite dans
 * les logs.
 *
 * @see backend/src/modules/users/services/user-data-consolidated.service.ts
 */

import { Logger } from '@nestjs/common';
import { DatabaseException, ErrorCodes } from '@common/exceptions';
import { UserDataConsolidatedService } from '../../src/modules/users/services/user-data-consolidated.service';

const EMAIL = 'client.test@example.test';

function serviceWithRpc(result: {
  data: unknown;
  error: { message: string } | null;
}) {
  const service = new UserDataConsolidatedService(undefined as never);
  const callRpc = jest.fn().mockResolvedValue(result);
  Object.defineProperty(service, 'callRpc', { value: callRpc });
  return { service, callRpc };
}

describe('UserDataConsolidatedService.emailExistsAnywhere', () => {
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    errorSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it.each([
    [true, true],
    [false, false],
    [null, false],
  ])('RPC → %p : retourne %p', async (data, expected) => {
    const { service, callRpc } = serviceWithRpc({ data, error: null });

    await expect(service.emailExistsAnywhere(EMAIL)).resolves.toBe(expected);
    expect(callRpc).toHaveBeenCalledWith('auth_email_exists', {
      p_email: EMAIL,
    });
  });

  it('RPC en échec → DatabaseException DATABASE.RPC_FAILED, jamais « email libre »', async () => {
    const { service } = serviceWithRpc({
      data: null,
      error: { message: 'permission denied for function auth_email_exists' },
    });

    const error = await service
      .emailExistsAnywhere(EMAIL)
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(DatabaseException);
    expect((error as DatabaseException).code).toBe(
      ErrorCodes.DATABASE.RPC_FAILED,
    );
    expect((error as DatabaseException).message).not.toContain(EMAIL);
  });

  it('le log d’échec ne contient pas l’adresse email', async () => {
    const { service } = serviceWithRpc({
      data: null,
      error: { message: 'timeout' },
    });

    await service.emailExistsAnywhere(EMAIL).catch(() => undefined);

    const logged = errorSpy.mock.calls
      .map((args) => args.map((a: unknown) => String(a)).join(' '))
      .join('\n');
    expect(logged).toContain('auth_email_exists');
    expect(logged).not.toContain(EMAIL);
  });
});
