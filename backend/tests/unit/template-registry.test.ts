/**
 * Template Registry — Unit tests (P15b).
 *
 * Tests 3 pure functions: resolveTemplate, defaultTemplateForVideoType, listRegisteredTemplates.
 * No DI, no mocks — direct import.
 */

import {
  resolveTemplate,
  defaultTemplateForVideoType,
  listRegisteredTemplates,
} from '../../src/modules/media-factory/render/templates/template-registry';

describe('Template Registry', () => {
  describe('resolveTemplate', () => {
    it('should resolve test-card to TestCard composition', () => {
      const entry = resolveTemplate('test-card');
      expect(entry.compositionId).toBe('TestCard');
      expect(entry.displayName).toBe('Test Card (P6)');
      expect(entry.status).toBe('stable');
    });

    it('should resolve short-product-highlight to ShortProductHighlight', () => {
      const entry = resolveTemplate('short-product-highlight');
      expect(entry.compositionId).toBe('ShortProductHighlight');
      expect(entry.defaultResolution).toEqual({ width: 1080, height: 1920 });
      expect(entry.status).toBe('experimental');
    });

    it('should fallback to TestCard for unknown templateId', () => {
      const entry = resolveTemplate('unknown-template-xyz');
      expect(entry.compositionId).toBe('TestCard');
    });

    it('should fallback to TestCard for null', () => {
      const entry = resolveTemplate(null);
      expect(entry.compositionId).toBe('TestCard');
    });

    it('should fallback to TestCard for undefined', () => {
      const entry = resolveTemplate(undefined);
      expect(entry.compositionId).toBe('TestCard');
    });
  });

  describe('defaultTemplateForVideoType', () => {
    it('should return short-product-highlight for short', () => {
      expect(defaultTemplateForVideoType('short')).toBe(
        'short-product-highlight',
      );
    });

    it('should return test-card for film_gamme', () => {
      expect(defaultTemplateForVideoType('film_gamme')).toBe('test-card');
    });

    it('should return test-card for film_socle', () => {
      expect(defaultTemplateForVideoType('film_socle')).toBe('test-card');
    });
  });

  describe('listRegisteredTemplates', () => {
    it('should return 3 registered templates', () => {
      const templates = listRegisteredTemplates();
      expect(templates).toHaveLength(3);
      expect(templates.map((t) => t.templateId).sort()).toEqual([
        'short-braking-fact',
        'short-product-highlight',
        'test-card',
      ]);
    });

    it('should include all required properties on each entry', () => {
      const templates = listRegisteredTemplates();
      for (const t of templates) {
        expect(t).toHaveProperty('templateId');
        expect(t).toHaveProperty('compositionId');
        expect(t).toHaveProperty('displayName');
        expect(t).toHaveProperty('supportedVideoTypes');
        expect(t).toHaveProperty('defaultDurationFrames');
        expect(t).toHaveProperty('defaultResolution');
        expect(t).toHaveProperty('status');
        expect(Array.isArray(t.supportedVideoTypes)).toBe(true);
        expect(t.defaultResolution).toHaveProperty('width');
        expect(t.defaultResolution).toHaveProperty('height');
      }
    });
  });
});
