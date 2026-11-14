import { Logger } from '@nestjs/common';

import { SeoControlService } from './seo-control.service';

/**
 * Trace de consultation du cockpit SEO (`dashboard_view` dans `__seo_event_log`).
 *
 * supabase-js ne lève pas quand la base refuse un insert : il renvoie
 * `{ error }`. Sans lecture de ce retour, un refus ne laissait ni ligne ni
 * journal. Ces tests fixent le contrat : un refus est journalisé, la
 * consultation ne casse jamais.
 *
 * Montage sans constructeur, comme seo-placeholder-events.service.test.ts.
 */
describe('SeoControlService — trace dashboard_view', () => {
  function build(opts: { wasSet: boolean; insertResult?: { error: unknown } }) {
    const svc = Object.create(SeoControlService.prototype) as SeoControlService;
    const insert = jest
      .fn()
      .mockResolvedValue(opts.insertResult ?? { error: null });
    const from = jest.fn().mockReturnValue({ insert });
    const setNx = jest.fn().mockResolvedValue(opts.wasSet);
    const error = jest.fn();
    Object.defineProperty(svc, 'supabase', {
      value: { from },
      configurable: true,
    });
    Object.defineProperty(svc, 'cache', {
      value: { setNx },
      configurable: true,
    });
    Object.defineProperty(svc, 'logger', {
      value: { error } as unknown as Logger,
      configurable: true,
    });
    const log = (adminUserId: string | null, range: '7d' | '28d') =>
      (
        svc as unknown as {
          logAccessDeduped(a: string | null, r: string): Promise<void>;
        }
      ).logAccessDeduped(adminUserId, range);
    return { log, insert, from, setNx, error };
  }

  it('écrit une ligne dashboard_view à la première consultation de la fenêtre', async () => {
    const { log, insert, from, setNx, error } = build({ wasSet: true });

    await log('admin-1', '7d');

    expect(setNx).toHaveBeenCalledWith(
      'dashboard-view-dedupe:admin-1:7d',
      '1',
      expect.any(Number),
    );
    expect(from).toHaveBeenCalledWith('__seo_event_log');
    const row = insert.mock.calls[0][0];
    expect(row.event_type).toBe('dashboard_view');
    expect(row.severity).toBe('info');
    expect(row.payload.dashboard).toBe('seo-control');
    expect(row.payload.range).toBe('7d');
    expect(row.payload.admin_user_id).toBe('admin-1');
    expect(error).not.toHaveBeenCalled();
  });

  it("n'écrit rien quand la consultation est déjà tracée dans la fenêtre", async () => {
    const { log, insert, error } = build({ wasSet: false });

    await log('admin-1', '7d');

    expect(insert).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });

  it('journalise le refus de la base au lieu de le taire', async () => {
    const { log, error } = build({
      wasSet: true,
      insertResult: { error: { message: 'permission denied' } },
    });

    await expect(log('admin-1', '28d')).resolves.toBeUndefined();

    expect(error).toHaveBeenCalledTimes(1);
    expect(error.mock.calls[0][0]).toContain('dashboard_view');
    expect(error.mock.calls[0][0]).toContain('permission denied');
  });

  it('ne lève pas quand le client lui-même échoue', async () => {
    const { log, insert, error } = build({ wasSet: true });
    insert.mockRejectedValue(new Error('network down'));

    await expect(log(null, '7d')).resolves.toBeUndefined();

    expect(error).toHaveBeenCalledTimes(1);
  });
});
