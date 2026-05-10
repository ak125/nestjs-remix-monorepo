import { Logger } from '@nestjs/common';
import { z } from 'zod';
import {
  _resetRoleNormalizationCounters,
  getRoleNormalizationFailCount,
  getRoleNormalizationKillSwitchCount,
  parseResponseOrSoft,
} from '../parse-response';

describe('parseResponseOrSoft', () => {
  const mockLogger = {
    warn: jest.fn(),
  } as unknown as Logger;

  const fixedSchema = z.object({
    role: z.string().transform((v) => (v === 'R3_BLOG' ? 'R3_CONSEILS' : v)),
    name: z.string(),
  });

  const ctx = {
    controller: 'TestController',
    endpoint: 'testEndpoint',
  };

  beforeEach(() => {
    _resetRoleNormalizationCounters();
    (mockLogger.warn as jest.Mock).mockClear();
    delete process.env.SEO_ROLE_STRICT;
    delete process.env.SEO_ROLE_NORMALIZE_RESPONSE;
  });

  describe('success path', () => {
    it('returns parsed/transformed value', () => {
      const result = parseResponseOrSoft(
        fixedSchema,
        { role: 'R3_BLOG', name: 'test' },
        ctx,
        mockLogger,
      );
      expect(result).toEqual({ role: 'R3_CONSEILS', name: 'test' });
    });

    it('does not call logger.warn on success', () => {
      parseResponseOrSoft(
        fixedSchema,
        { role: 'R3_CONSEILS', name: 'test' },
        ctx,
        mockLogger,
      );
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    it('does not increment fail counter on success', () => {
      parseResponseOrSoft(
        fixedSchema,
        { role: 'R3_CONSEILS', name: 'test' },
        ctx,
        mockLogger,
      );
      expect(getRoleNormalizationFailCount()).toBe(0);
    });

    it('still succeeds when SEO_ROLE_STRICT=true and input is valid', () => {
      process.env.SEO_ROLE_STRICT = 'true';
      const result = parseResponseOrSoft(
        fixedSchema,
        { role: 'R3_CONSEILS', name: 'test' },
        ctx,
        mockLogger,
      );
      expect(result).toEqual({ role: 'R3_CONSEILS', name: 'test' });
    });
  });

  describe('soft fallback path (default, prod-safe)', () => {
    it('returns raw input on parse failure', () => {
      const raw = { role: 42, name: null };
      const result = parseResponseOrSoft(fixedSchema, raw, ctx, mockLogger);
      expect(result).toBe(raw);
    });

    it('logs structured warning with metric name', () => {
      parseResponseOrSoft(fixedSchema, { role: 42 }, ctx, mockLogger);
      expect(mockLogger.warn).toHaveBeenCalledTimes(1);
      const call = (mockLogger.warn as jest.Mock).mock.calls[0];
      expect(call[0]).toMatchObject({
        metric: 'seo_role_normalization_failed',
        controller: 'TestController',
        endpoint: 'testEndpoint',
      });
    });

    it('increments fail counter per controller+endpoint', () => {
      parseResponseOrSoft(fixedSchema, { role: 42 }, ctx, mockLogger);
      parseResponseOrSoft(fixedSchema, { role: 42 }, ctx, mockLogger);
      expect(
        getRoleNormalizationFailCount('TestController', 'testEndpoint'),
      ).toBe(2);
      expect(getRoleNormalizationFailCount()).toBe(2);
    });
  });

  describe('strict mode (SEO_ROLE_STRICT=true)', () => {
    it('throws on parse failure', () => {
      process.env.SEO_ROLE_STRICT = 'true';
      expect(() =>
        parseResponseOrSoft(fixedSchema, { role: 42 }, ctx, mockLogger),
      ).toThrow(/seo_role_normalization_failed_strict/);
    });

    it('error message includes controller + endpoint context', () => {
      process.env.SEO_ROLE_STRICT = 'true';
      expect(() =>
        parseResponseOrSoft(fixedSchema, { role: 42 }, ctx, mockLogger),
      ).toThrow(/TestController\.testEndpoint/);
    });
  });

  describe('kill switch (SEO_ROLE_NORMALIZE_RESPONSE=false)', () => {
    it('returns raw immediately, skipping parse', () => {
      process.env.SEO_ROLE_NORMALIZE_RESPONSE = 'false';
      const raw = { role: 'R3_BLOG', name: 'test' };
      const result = parseResponseOrSoft(fixedSchema, raw, ctx, mockLogger);
      // Kill switch returns raw without transformation
      expect(result).toBe(raw);
      // Counter incremented separately
      expect(getRoleNormalizationKillSwitchCount()).toBe(1);
      // Fail counter NOT touched
      expect(getRoleNormalizationFailCount()).toBe(0);
    });

    it('does not log warn (kill switch is silent)', () => {
      process.env.SEO_ROLE_NORMALIZE_RESPONSE = 'false';
      parseResponseOrSoft(
        fixedSchema,
        { role: 'R3_BLOG', name: 'test' },
        ctx,
        mockLogger,
      );
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    it('takes precedence over strict mode', () => {
      process.env.SEO_ROLE_STRICT = 'true';
      process.env.SEO_ROLE_NORMALIZE_RESPONSE = 'false';
      const raw = { role: 42 }; // would fail parse
      // Should NOT throw — kill switch bypasses parse entirely
      expect(() =>
        parseResponseOrSoft(fixedSchema, raw, ctx, mockLogger),
      ).not.toThrow();
    });
  });
});
