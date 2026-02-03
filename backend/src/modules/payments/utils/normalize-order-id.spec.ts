import { normalizeOrderId } from './normalize-order-id';

describe('normalizeOrderId', () => {
  describe('format ORD-xxx-yyy', () => {
    it('should extract numeric ID from ORD-1762010061177-879 format', () => {
      expect(normalizeOrderId('ORD-1762010061177-879')).toBe('1762010061177');
    });

    it('should extract numeric ID from ORD-123-456 format', () => {
      expect(normalizeOrderId('ORD-123-456')).toBe('123');
    });

    it('should extract numeric ID from ORD-999999-1 format', () => {
      expect(normalizeOrderId('ORD-999999-1')).toBe('999999');
    });
  });

  describe('already numeric ID', () => {
    it('should keep numeric ID unchanged', () => {
      expect(normalizeOrderId('1762010061177')).toBe('1762010061177');
    });

    it('should keep short numeric ID unchanged', () => {
      expect(normalizeOrderId('123')).toBe('123');
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

    it('should handle mixed format without ORD prefix', () => {
      expect(normalizeOrderId('REF-12345-67')).toBe('REF-12345-67');
    });
  });
});
