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

    it('rejects an unknown template instead of producing a TestCard', () => {
      expect(() => resolveTemplate('unknown-template-xyz')).toThrow();
    });

    it('rejects null instead of producing a TestCard', () => {
      expect(() => resolveTemplate(null)).toThrow();
    });

    it('rejects undefined instead of producing a TestCard', () => {
      expect(() => resolveTemplate(undefined)).toThrow();
    });

    it.each(['', 'constructor', '__proto__', 'toString'])(
      'rejects invalid registry key %s',
      (templateId) => {
        expect(() => resolveTemplate(templateId)).toThrow();
      },
    );
  });

  describe('defaultTemplateForVideoType', () => {
    it('should return short-product-highlight for short', () => {
      expect(defaultTemplateForVideoType('short')).toBe(
        'short-product-highlight',
      );
    });

    it('requires an explicit template for film_gamme', () => {
      expect(() => defaultTemplateForVideoType('film_gamme')).toThrow();
    });

    it('requires an explicit template for film_socle', () => {
      expect(() => defaultTemplateForVideoType('film_socle')).toThrow();
    });
  });

  describe('listRegisteredTemplates', () => {
    it('should return 6 registered templates including the existing Fafa formats', () => {
      const templates = listRegisteredTemplates();
      expect(templates).toHaveLength(6);
      expect(templates.map((t) => t.templateId).sort()).toEqual([
        'ne-change-pas-trop-vite',
        'piece-expliquee',
        'short-braking-fact',
        'short-product-highlight',
        'symptome-3-causes',
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
