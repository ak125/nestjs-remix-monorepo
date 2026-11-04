import { GammeRpcService } from '../../src/modules/gamme-rest/services/gamme-rpc.service';

// FH-14 : les vignettes du catalogue famille viennent de get_homepage_families
// (DEFINER, lisible en anon), pas d'une lecture directe de pieces_gamme.
describe('GammeRpcService.getGammeThumbnails', () => {
  const families = {
    success: true,
    catalog: {
      families: [
        {
          gammes: [
            { pg_id: 424, pg_img: 'filtre-d-habitacle.webp' },
            { pg_id: 8, pg_img: 'filtre-a-air.webp' },
          ],
        },
        { gammes: [{ pg_id: 9, pg_img: null }] },
      ],
    },
  };

  const build = (getHomepageFamilies: () => Promise<unknown>) => {
    const svc = Object.create(GammeRpcService.prototype) as GammeRpcService;
    const warn = jest.fn();
    Object.assign(svc, {
      logger: { warn, log() {}, debug() {}, error() {} },
      homepageRpcService: { getHomepageFamilies },
    });
    return { svc, warn };
  };

  it('ne garde que les gammes demandées présentes dans les familles', async () => {
    const { svc } = build(async () => families);
    const map = await svc.getGammeThumbnails([424, 9, 999]);
    expect([...map.entries()]).toEqual([
      [424, 'filtre-d-habitacle.webp'],
      [9, null],
    ]);
  });

  it('RPC en échec : map vide et avertissement (repli pg_pic)', async () => {
    const { svc, warn } = build(async () => {
      throw new Error('Families RPC failed');
    });
    const map = await svc.getGammeThumbnails([424]);
    expect(map.size).toBe(0);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('Families RPC failed'),
    );
  });

  it('aucun pg_id : pas d’appel RPC', async () => {
    const getHomepageFamilies = jest.fn(async () => families);
    const { svc } = build(getHomepageFamilies);
    expect((await svc.getGammeThumbnails([])).size).toBe(0);
    expect(getHomepageFamilies).not.toHaveBeenCalled();
  });
});
