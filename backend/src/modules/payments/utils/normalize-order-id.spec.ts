import { normalizeOrderId, extractNumericPart } from './normalize-order-id';

describe('normalizeOrderId', () => {
  describe('format ORD-xxx-yyy (nouveau système 2025+)', () => {
    it('should preserve full ORD-xxx-yyy format (matches DB ord_id)', () => {
      expect(normalizeOrderId('ORD-1762010061177-879')).toBe(
        'ORD-1762010061177-879',
      );
    });

    it('should preserve ORD-123-456 format', () => {
      expect(normalizeOrderId('ORD-123-456')).toBe('ORD-123-456');
    });

    it('should preserve ORD-999999-1 format', () => {
      expect(normalizeOrderId('ORD-999999-1')).toBe('ORD-999999-1');
    });

    it('should preserve ORD- prefix even without suffix', () => {
      expect(normalizeOrderId('ORD-12345')).toBe('ORD-12345');
    });
  });

  describe('numeric ID (ancien système 2020-2024)', () => {
    it('should keep numeric ID unchanged', () => {
      expect(normalizeOrderId('1762010061177')).toBe('1762010061177');
    });

    it('should keep short numeric ID unchanged', () => {
      expect(normalizeOrderId('278383')).toBe('278383');
    });
  });

  describe('edge cases', () => {
    it('should return empty string for empty input', () => {
      expect(normalizeOrderId('')).toBe('');
    });

    it('should fallback for unknown formats', () => {
      expect(normalizeOrderId('TEST-000')).toBe('TEST-000');
    });

    it('should fallback for text input', () => {
      expect(normalizeOrderId('invalid')).toBe('invalid');
    });

    it('should fallback for mixed format without ORD prefix', () => {
      expect(normalizeOrderId('REF-12345-67')).toBe('REF-12345-67');
    });
  });
});

describe('extractNumericPart', () => {
  it('should extract timestamp from ORD-xxx-yyy', () => {
    expect(extractNumericPart('ORD-1762010061177-879')).toBe('1762010061177');
  });

  it('should extract from ORD-xxx without suffix', () => {
    expect(extractNumericPart('ORD-12345')).toBe('12345');
  });

  it('should return numeric string as-is', () => {
    expect(extractNumericPart('278383')).toBe('278383');
  });

  it('should return null for non-numeric non-ORD input', () => {
    expect(extractNumericPart('TEST-000')).toBeNull();
  });

  it('should return null for empty input', () => {
    expect(extractNumericPart('')).toBeNull();
  });
});
