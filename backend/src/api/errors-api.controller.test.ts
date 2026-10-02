import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { ErrorsApiController } from './errors-api.controller';
import { ErrorService } from '../modules/errors/services/error.service';
import { RedirectService } from '../modules/errors/services/redirect.service';
import { ErrorLogService } from '../modules/errors/services/error-log.service';

/**
 * `POST /api/errors/log` is public. The client address stored in `err_ip`
 * (and used in the dedup signature) must come from the transport, resolved by
 * Express `trust proxy` exactly as in `main.ts` — never from the request body.
 */
describe('ErrorsApiController — POST /api/errors/log client address', () => {
  let app: INestApplication;
  const logError = jest.fn();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ErrorsApiController],
      providers: [
        { provide: ErrorService, useValue: {} },
        { provide: RedirectService, useValue: {} },
        { provide: ErrorLogService, useValue: { logError } },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    app.getHttpAdapter().getInstance().set('trust proxy', 1);
    await app.init();
  });

  beforeEach(() => {
    logError.mockReset().mockResolvedValue(undefined);
  });

  afterAll(async () => {
    await app?.close();
  });

  const forgedBody = {
    code: 404,
    url: '/page-inexistante',
    ipAddress: '198.51.100.7',
  };

  it('uses the relayed client address, not the one in the body', async () => {
    await request(app.getHttpServer())
      .post('/api/errors/log')
      .set('X-Forwarded-For', '203.0.113.42')
      .send(forgedBody)
      .expect(201, { success: true });

    expect(logError).toHaveBeenCalledTimes(1);
    expect(logError.mock.calls[0][0].ipAddress).toBe('203.0.113.42');
  });

  it('falls back to the TCP peer, not the body, when nothing is relayed', async () => {
    await request(app.getHttpServer())
      .post('/api/errors/log')
      .send(forgedBody)
      .expect(201);

    expect(logError.mock.calls[0][0].ipAddress).toMatch(
      /^(::ffff:)?127\.0\.0\.1$|^::1$/,
    );
  });
});
