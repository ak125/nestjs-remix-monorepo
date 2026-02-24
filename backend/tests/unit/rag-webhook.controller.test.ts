/**
 * Unit tests for RagProxyController — webhook endpoint
 *
 * Tests: body validation, service delegation, response format.
 * Pattern: Object.create + manual mocks (lightweight, no NestJS bootstrap).
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

// ── Module mocks (must be before imports) ──

jest.mock('@nestjs/common', () => {
  class HttpException extends Error {
    statusCode: number;
    constructor(msg: string, status: number) {
      super(msg);
      this.statusCode = status;
    }
  }
  class BadRequestException extends HttpException {
    constructor(msg: string) {
      super(msg, 400);
    }
  }
  class NotFoundException extends HttpException {
    constructor(msg: string) {
      super(msg, 404);
    }
  }
  class ConflictException extends HttpException {
    constructor(msg: string) {
      super(msg, 409);
    }
  }
  return {
    Controller: () => () => undefined,
    Get: () => () => undefined,
    Post: () => () => undefined,
    Body: () => () => undefined,
    Param: () => () => undefined,
    Query: () => () => undefined,
    Res: () => () => undefined,
    Req: () => () => undefined,
    HttpCode: () => () => undefined,
    UseGuards: () => () => undefined,
    UsePipes: () => () => undefined,
    Injectable: () => () => undefined,
    OnModuleDestroy: () => () => undefined,
    HttpStatus: { OK: 200 },
    HttpException,
    BadRequestException,
    NotFoundException,
    ConflictException,
    Logger: jest.fn().mockImplementation(() => ({
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    })),
  };
});

jest.mock('@nestjs/swagger', () => ({
  ApiOperation: () => () => undefined,
  ApiResponse: () => () => undefined,
  ApiTags: () => () => undefined,
  ApiQuery: () => () => undefined,
  ApiParam: () => () => undefined,
  ApiBody: () => () => undefined,
}));

jest.mock('@nestjs/config', () => ({
  ConfigService: jest.fn(),
}));

jest.mock('@nestjs/event-emitter', () => ({
  EventEmitter2: jest.fn(),
}));

jest.mock(
  '../../src/modules/rag-proxy/services/frontmatter-validator.service',
  () => ({
    FrontmatterValidatorService: jest.fn(),
  }),
);

jest.mock(
  '../../src/modules/rag-proxy/services/rag-cleanup.service',
  () => ({
    RagCleanupService: jest.fn(),
  }),
);

jest.mock(
  '../../src/modules/rag-proxy/services/webhook-audit.service',
  () => ({
    WebhookAuditService: jest.fn(),
  }),
);

jest.mock('../../src/auth/internal-api-key.guard', () => ({
  InternalApiKeyGuard: class {
    canActivate() {
      return true;
    }
  },
}));

jest.mock('../../src/auth/authenticated.guard', () => ({
  AuthenticatedGuard: class {
    canActivate() {
      return true;
    }
  },
}));

jest.mock('../../src/auth/is-admin.guard', () => ({
  IsAdminGuard: class {
    canActivate() {
      return true;
    }
  },
}));

jest.mock('@anthropic-ai/sdk', () => ({
  default: jest.fn(),
}));

import { RagProxyController } from '../../src/modules/rag-proxy/rag-proxy.controller';
const { BadRequestException } = jest.requireActual('@nestjs/common');

describe('RagProxyController — webhook endpoint', () => {
  let controller: any;
  const mockHandleWebhookCompletion = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    controller = Object.create(RagProxyController.prototype);
    controller.ragProxyService = {
      handleWebhookCompletion: mockHandleWebhookCompletion,
    };
    controller.ragCleanupService = {};

    mockHandleWebhookCompletion.mockResolvedValue({
      gammes_detected: ['disque-de-frein'],
      diagnostics_detected: [],
      event_emitted: true,
    });
  });

  const validPayload = {
    job_id: 'test-001',
    source: 'web' as const,
    status: 'done' as const,
    files_created: ['gammes/disque-de-frein.md'],
  };

  it('should reject when job_id is missing (BadRequestException)', async () => {
    await expect(
      controller.webhookIngestionComplete({
        source: 'web',
        status: 'done',
      }),
    ).rejects.toThrow(/Missing required fields/);
  });

  it('should reject when source is missing (BadRequestException)', async () => {
    await expect(
      controller.webhookIngestionComplete({
        job_id: 'test',
        status: 'done',
      }),
    ).rejects.toThrow(/Missing required fields/);
  });

  it('should reject when status is missing (BadRequestException)', async () => {
    await expect(
      controller.webhookIngestionComplete({
        job_id: 'test',
        source: 'web',
      }),
    ).rejects.toThrow(/Missing required fields/);
  });

  it('should reject when source is invalid (BadRequestException)', async () => {
    await expect(
      controller.webhookIngestionComplete({
        job_id: 'test',
        source: 'invalid',
        status: 'done',
      }),
    ).rejects.toThrow(/source must be/);
  });

  it('should reject when status is invalid (BadRequestException)', async () => {
    await expect(
      controller.webhookIngestionComplete({
        job_id: 'test',
        source: 'web',
        status: 'invalid',
      }),
    ).rejects.toThrow(/status must be/);
  });

  it('should accept valid payload and call handleWebhookCompletion', async () => {
    await controller.webhookIngestionComplete(validPayload);

    expect(mockHandleWebhookCompletion).toHaveBeenCalledTimes(1);
    expect(mockHandleWebhookCompletion).toHaveBeenCalledWith(validPayload);
  });

  it('should pass through status "failed" to service', async () => {
    mockHandleWebhookCompletion.mockResolvedValue({
      gammes_detected: [],
      diagnostics_detected: [],
      event_emitted: false,
    });

    const result = await controller.webhookIngestionComplete({
      ...validPayload,
      status: 'failed',
    });

    expect(result.event_emitted).toBe(false);
  });

  it('should return gammes_detected and event_emitted from service', async () => {
    const result = await controller.webhookIngestionComplete(validPayload);

    expect(result).toEqual({
      gammes_detected: ['disque-de-frein'],
      diagnostics_detected: [],
      event_emitted: true,
    });
  });
});
