import { Logger } from '@nestjs/common';

import { SeoPlaceholderEventsService } from '../services/seo-placeholder-events.service';

/**
 * A1a-observe — emitter unit tests. Mirror du contrat fire-and-forget de
 * FunnelEventsService / RuntimeEventsService : insert dans __seo_event_log,
 * severity 'info', ne lève JAMAIS (log + {ok:false} sur erreur).
 */
describe('SeoPlaceholderEventsService', () => {
  function build(insertResult: { error: unknown }) {
    const svc = Object.create(
      SeoPlaceholderEventsService.prototype,
    ) as SeoPlaceholderEventsService;
    const insert = jest.fn().mockResolvedValue(insertResult);
    Object.defineProperty(svc, 'supabase', {
      value: { from: () => ({ insert }) },
      configurable: true,
    });
    Object.defineProperty(svc, 'logger', {
      value: { error: jest.fn() } as unknown as Logger,
      configurable: true,
    });
    return { svc, insert };
  }

  it('insère une ligne __seo_event_log (event_type seo_placeholder_unresolved, severity info)', async () => {
    const { svc, insert } = build({ error: null });

    const res = await svc.record({
      trigger: 'residual_marker_detected',
      field: 'title',
      marker_count: 2,
      stripped_count: 1,
      markers: ['#Gamme#', '#LinkGamme_9#'],
      pg_id: 7,
      type_id: 70,
    });

    expect(res).toEqual({ ok: true });
    expect(insert).toHaveBeenCalledTimes(1);
    const row = insert.mock.calls[0][0];
    expect(row.event_type).toBe('seo_placeholder_unresolved');
    expect(row.severity).toBe('info');
    expect(row.entity_url).toBeNull();
    expect(row.payload.trigger).toBe('residual_marker_detected');
    expect(row.payload.field).toBe('title');
    expect(row.payload.marker_count).toBe(2);
    expect(row.payload.stripped_count).toBe(1);
    expect(row.payload.markers).toEqual(['#Gamme#', '#LinkGamme_9#']);
  });

  it('ne lève jamais sur erreur insert — retourne {ok:false} + log', async () => {
    const { svc, insert } = build({ error: { message: 'db down' } });

    const res = await svc.record({ trigger: 'runtime_default_fallback' });

    expect(insert).toHaveBeenCalled();
    expect(res).toEqual({ ok: false });
  });

  it('mappe les champs absents à null dans le payload', async () => {
    const { svc, insert } = build({ error: null });

    await svc.record({ trigger: 'runtime_default_fallback', pg_id: 3 });

    const row = insert.mock.calls[0][0];
    expect(row.payload.trigger).toBe('runtime_default_fallback');
    expect(row.payload.pg_id).toBe(3);
    expect(row.payload.field).toBeNull();
    expect(row.payload.marker_count).toBeNull();
    expect(row.payload.markers).toBeNull();
  });
});
