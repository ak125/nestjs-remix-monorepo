import { Reflector } from '@nestjs/core';
import { CloudflareThrottlerGuard } from './cloudflare-throttler.guard';

type TrackerAccess = { getTracker(req: Record<string, any>): Promise<string> };

function makeGuard(): TrackerAccess {
  const guard = new CloudflareThrottlerGuard(
    [] as any, // options — non utilisées par getTracker
    {} as any, // storageService
    new Reflector(),
  );
  return guard as unknown as TrackerAccess;
}

describe('CloudflareThrottlerGuard.getTracker', () => {
  const guard = makeGuard();

  it('priorise Cf-Connecting-Ip (IP client réelle posée par Cloudflare)', async () => {
    const req = {
      headers: { 'cf-connecting-ip': '203.0.113.7', 'x-real-ip': '198.51.100.9' },
      ips: ['162.158.1.1'],
      ip: '162.158.1.1',
    };
    await expect(guard.getTracker(req)).resolves.toBe('203.0.113.7');
  });

  it('replie sur X-Real-IP quand Cf-Connecting-Ip est absent', async () => {
    const req = { headers: { 'x-real-ip': '198.51.100.9' }, ip: '162.158.1.1' };
    await expect(guard.getTracker(req)).resolves.toBe('198.51.100.9');
  });

  it('replie sur req.ips[0] quand aucun en-tête CF/Caddy (DEV/PREPROD)', async () => {
    const req = { headers: {}, ips: ['192.0.2.55'], ip: '127.0.0.1' };
    await expect(guard.getTracker(req)).resolves.toBe('192.0.2.55');
  });

  it('replie sur req.ip quand req.ips est vide', async () => {
    const req = { headers: {}, ips: [], ip: '127.0.0.1' };
    await expect(guard.getTracker(req)).resolves.toBe('127.0.0.1');
  });

  it('ne prend que la première IP si la valeur est une liste', async () => {
    const req = { headers: { 'cf-connecting-ip': '203.0.113.7, 70.41.3.18' }, ip: 'x' };
    await expect(guard.getTracker(req)).resolves.toBe('203.0.113.7');
  });

  it('ignore un en-tête vide/espaces et passe au repli suivant', async () => {
    const req = { headers: { 'cf-connecting-ip': '   ', 'x-real-ip': '198.51.100.9' }, ip: 'x' };
    await expect(guard.getTracker(req)).resolves.toBe('198.51.100.9');
  });

  it('retourne "unknown" de façon déterministe si aucune IP n\'est disponible', async () => {
    const req = { headers: {} };
    await expect(guard.getTracker(req)).resolves.toBe('unknown');
  });
});
