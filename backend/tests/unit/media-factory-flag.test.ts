/**
 * isMediaFactoryEnabled — governed feature-flag gate (strict `=== 'true'`, OFF by default).
 *
 * The revived MediaFactory HTTP module and its BullMQ video-execution processor are only
 * registered in the DI graph when this returns true, so the default-OFF and strict-match
 * behaviour is load-bearing: any non-canonical value must keep the module inert (0 prod).
 *
 * @see backend/src/modules/media-factory/media-factory.flag.ts
 */

import { isMediaFactoryEnabled } from '../../src/modules/media-factory/media-factory.flag';

describe('isMediaFactoryEnabled', () => {
  const savedEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...savedEnv };
  });

  it('is OFF by default when MEDIA_FACTORY_ENABLED is unset', () => {
    delete process.env.MEDIA_FACTORY_ENABLED;
    expect(isMediaFactoryEnabled()).toBe(false);
  });

  it('is ON only for the exact string "true"', () => {
    process.env.MEDIA_FACTORY_ENABLED = 'true';
    expect(isMediaFactoryEnabled()).toBe(true);
  });

  it('is OFF for "false"', () => {
    process.env.MEDIA_FACTORY_ENABLED = 'false';
    expect(isMediaFactoryEnabled()).toBe(false);
  });

  it.each(['TRUE', 'True', '1', 'yes', 'on', ' true', ''])(
    'is OFF for non-canonical value %p (strict === match, never truthy coercion)',
    (val) => {
      process.env.MEDIA_FACTORY_ENABLED = val;
      expect(isMediaFactoryEnabled()).toBe(false);
    },
  );
});
