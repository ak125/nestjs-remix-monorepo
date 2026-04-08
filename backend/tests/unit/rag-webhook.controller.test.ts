/**
 * Unit tests for RagProxyController — webhook endpoint
 *
 * Tests: body validation, service delegation, response format.
 * Pattern: Object.create + manual mocks (lightweight, no NestJS bootstrap).
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

// ── Module mocks (must be before imports) ──

jest.mock('@nestjs/common', () => {
  const actual = jest.requireActual('@nestjs/common');
  return {
    ...actual,
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

jest.mock('@nestjs/platform-express', () => ({
  FileInterceptor: () => jest.fn(),
}));

import { RagProxyController } from '../../src/modules/rag-proxy/rag-proxy.controller';
import { WebhookIngestionCompleteSchema } from '../../src/modules/rag-proxy/dto/webhook-ingest.dto';

// ── Zod schema validation tests (replaces manual if-checks) ──

describe('WebhookIngestionCompleteSchema — validation', () => {
  it('should reject when job_id is missing', () => {
    const result = WebhookIngestionCompleteSchema.safeParse({
      source: 'web',
      status: 'done',
    });
    expect(result.success).toBe(false);
  });

  it('should reject when source is missing', () => {
    const result = WebhookIngestionCompleteSchema.safeParse({
      job_id: 'test',
      status: 'done',
    });
    expect(result.success).toBe(false);
  });

  it('should reject when status is missing', () => {
    const result = WebhookIngestionCompleteSchema.safeParse({
      job_id: 'test',
      source: 'web',
    });
    expect(result.success).toBe(false);
  });

  it('should reject when source is invalid', () => {
    const result = WebhookIngestionCompleteSchema.safeParse({
      job_id: 'test',
      source: 'invalid',
      status: 'done',
    });
    expect(result.success).toBe(false);
  });

  it('should reject when status is invalid', () => {
    const result = WebhookIngestionCompleteSchema.safeParse({
      job_id: 'test',
      source: 'web',
      status: 'invalid',
    });
    expect(result.success).toBe(false);
  });

  it('should accept valid payload', () => {
    const result = WebhookIngestionCompleteSchema.safeParse({
      job_id: 'test-001',
      source: 'web',
      status: 'done',
      files_created: ['gammes/disque-de-frein.md'],
    });
    expect(result.success).toBe(true);
  });

  it('should default files_created to empty array', () => {
    const result = WebhookIngestionCompleteSchema.parse({
      job_id: 'test',
      source: 'pdf',
      status: 'done',
    });
    expect(result.files_created).toEqual([]);
  });
});

// ── Controller delegation tests ──

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
