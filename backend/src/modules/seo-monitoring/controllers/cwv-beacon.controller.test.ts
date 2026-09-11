import { SITE_ORIGIN } from '@config/site.constants';
import type { CwvBeaconService } from '../services/cwv-beacon.service';
import { CwvBeaconController } from './cwv-beacon.controller';

/**
 * Tests du point d'entrée public POST /api/seo/cwv/beacon.
 *
 * Chaque beacon qui n'atteint pas `__seo_cwv_raw` doit être compté avec une
 * raison : corps absent, schéma invalide, page hors origine canonique — ou routé
 * vers l'événement bot existant. Aucune branche ne se tait.
 */

const HUMAN_UA =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0 Mobile Safari/537.36';

function validBeacon(
  url = `${SITE_ORIGIN}/pieces/plaquette-de-frein-402.html`,
) {
  return {
    session_id: 'b2c4e6a8-0000-4000-8000-000000000001',
    surface: 'R2_PRODUCT',
    route_group: 'pieces_product',
    funnel_step: 'view_product',
    previous_funnel_step: null,
    url,
    metric: 'INP',
    value: 512,
    device: 'mobile',
    nav_type: 'navigate',
    attribution: {
      attr_target: 'div.card>img',
      attr_presentation_delay: 387,
      attr_total_style_layout_duration: 96,
      attr_interaction_time: 184_250,
      attr_hydrated_at: 2_310,
      attr_metric_id: 'v5-1757590000000-1234567890123',
      attr_navigation_type: 'back-forward-cache',
      attr_start_url: `${SITE_ORIGIN}/pieces/plaquette-de-frein-402.html`,
    },
  };
}

function makeController() {
  const service = {
    record: jest.fn().mockResolvedValue({ ok: true }),
    countRejection: jest.fn(),
  };
  const controller = new CwvBeaconController(
    service as unknown as CwvBeaconService,
  );
  return { controller, service };
}

describe('CwvBeaconController', () => {
  it('persists a valid canonical-origin beacon with its enriched attribution', async () => {
    const { controller, service } = makeController();

    await expect(controller.beacon(validBeacon(), HUMAN_UA)).resolves.toEqual({
      ok: true,
    });

    expect(service.countRejection).not.toHaveBeenCalled();
    expect(service.record).toHaveBeenCalledWith(
      expect.objectContaining({
        ua_class: 'human',
        priority_tier: 'CWV_P0',
        attribution: validBeacon().attribution,
      }),
    );
  });

  it.each([
    ['undefined', undefined],
    ['null', null],
  ])('counts a %s body as empty_body', async (_label, body) => {
    const { controller, service } = makeController();

    await expect(controller.beacon(body, HUMAN_UA)).resolves.toEqual({
      ok: false,
    });

    expect(service.countRejection).toHaveBeenCalledWith('empty_body');
    expect(service.record).not.toHaveBeenCalled();
  });

  it('counts a schema violation with its Zod issues', async () => {
    const { controller, service } = makeController();
    const body = validBeacon();
    const invalid = {
      ...body,
      attribution: { ...body.attribution, attr_not_declared: 'x' },
    };

    await expect(controller.beacon(invalid, HUMAN_UA)).resolves.toEqual({
      ok: false,
    });

    expect(service.record).not.toHaveBeenCalled();
    expect(service.countRejection).toHaveBeenCalledTimes(1);
    const [reason, issues] = service.countRejection.mock.calls[0];
    expect(reason).toBe('schema_invalid');
    expect(issues).toEqual([
      expect.objectContaining({
        code: 'unrecognized_keys',
        path: ['attribution'],
      }),
    ]);
  });

  it.each([
    'http://localhost:3000/pieces/plaquette-de-frein-402.html',
    'https://automecanik.com/pieces/plaquette-de-frein-402.html',
    'http://www.automecanik.com/pieces/plaquette-de-frein-402.html',
  ])(
    'counts a page outside the canonical origin as foreign_host (%s)',
    async (url) => {
      const { controller, service } = makeController();

      await expect(
        controller.beacon(validBeacon(url), HUMAN_UA),
      ).resolves.toEqual({ ok: false });

      expect(service.countRejection).toHaveBeenCalledWith('foreign_host');
      expect(service.record).not.toHaveBeenCalled();
    },
  );

  it('checks the canonical origin before routing bots, so non-canonical bot beacons are counted too', async () => {
    const { controller, service } = makeController();

    await controller.beacon(
      validBeacon('http://localhost:3200/pieces/x.html'),
      'Mozilla/5.0 (compatible; Googlebot/2.1)',
    );

    expect(service.countRejection).toHaveBeenCalledWith('foreign_host');
    expect(service.record).not.toHaveBeenCalled();
  });

  it('routes a canonical-origin bot beacon to the existing bot event (its own count)', async () => {
    const { controller, service } = makeController();

    await controller.beacon(
      validBeacon(),
      'Mozilla/5.0 (compatible; Googlebot/2.1)',
    );

    expect(service.countRejection).not.toHaveBeenCalled();
    expect(service.record).toHaveBeenCalledWith(
      expect.objectContaining({ ua_class: 'bot_search' }),
    );
  });
});
