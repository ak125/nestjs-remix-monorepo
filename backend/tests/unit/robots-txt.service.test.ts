/**
 * RobotsTxtService — caractérisation de la sortie servie sur /api/seo/robots.txt
 * (relayée par la route frontend /robots.txt).
 *
 * Instantané exact, horloge figée : toute modification de politique d'exploration
 * apparaît ligne à ligne dans le diff du snapshot et doit être une décision
 * explicite (politique d'indexation = zone owner).
 */
import { ConfigService } from '@nestjs/config';

import { RobotsTxtService } from '../../src/modules/seo/infrastructure/robots-txt.service';

function makeService(env: Record<string, string | undefined>) {
  const config = {
    get: (key: string, fallback?: unknown) => env[key] ?? fallback,
  } as unknown as ConfigService;
  return new RobotsTxtService(config);
}

describe('RobotsTxtService — caractérisation', () => {
  beforeEach(() => {
    jest.useFakeTimers({
      now: new Date('2026-09-11T08:00:00Z'),
      doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'],
    });
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('production (NODE_ENV=production)', () => {
    const service = makeService({
      NODE_ENV: 'production',
      BASE_URL: 'https://www.automecanik.com',
    });
    expect(service.generate()).toMatchSnapshot();
  });

  it('hors production : tout est bloqué', () => {
    const service = makeService({
      NODE_ENV: 'preprod',
      BASE_URL: 'https://www.automecanik.com',
    });
    expect(service.generate()).toMatchSnapshot();
  });
});
