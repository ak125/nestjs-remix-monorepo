import type { BrowserContext } from 'playwright';
import {
  assertReadOnlyRequest,
  installReadOnlyGuard,
  isForbiddenPortalWrite,
  readOnlyRouteHandler,
  type GuardRoute,
} from './portal-read-only-guard';

/** Route factice : enregistre si la requête a été avortée ou poursuivie. */
function fakeRoute(
  method: string,
  url: string,
  postData: string | null = null,
) {
  const calls: string[] = [];
  const route: GuardRoute = {
    request: () => ({
      method: () => method,
      url: () => url,
      postData: () => postData,
    }),
    abort: jest.fn(async () => {
      calls.push('abort');
    }),
    continue: jest.fn(async () => {
      calls.push('continue');
    }),
  };
  return { route, calls };
}

describe('isForbiddenPortalWrite — écriture panier / commande', () => {
  it.each([
    ['POST', 'https://portail.example/panier/ajout'],
    ['POST', 'https://portail.example/cart/add'],
    ['POST', 'https://portail.example/commande/valider'],
    ['PUT', 'https://portail.example/api/order/123'],
    ['POST', 'https://portail.example/checkout'],
    ['POST', 'https://portail.example/devis/creer'],
    ['DELETE', 'https://portail.example/basket/line/4'],
  ])('%s %s est refusé', (method, url) => {
    expect(isForbiddenPortalWrite(method, url)).toBe(true);
  });

  it('refuse un postback WebForms dont la cible ajoute au panier', () => {
    const body =
      '__EVENTTARGET=ctl00%24ContentPlaceHolder1%24grid%24ctl02%24cmdAjoutPanier&__VIEWSTATE=x';
    expect(
      isForbiddenPortalWrite(
        'POST',
        'https://cal.example/Catalogue.aspx',
        body,
      ),
    ).toBe(true);
  });

  it.each([
    ['GET', 'https://portail.example/img/cart.png'],
    ['GET', 'https://portail.example/js/panier-header.js'],
    ['HEAD', 'https://portail.example/commande/historique'],
    ['POST', 'https://portail.example/search'],
    ['POST', 'https://portail.example/login'],
  ])('%s %s reste permis (lecture)', (method, url) => {
    expect(isForbiddenPortalWrite(method, url)).toBe(false);
  });

  it('laisse passer le postback de lecture des prix CAL', () => {
    const body =
      '__EVENTTARGET=ctl00%24CtrlHeaderSlidingTemplateSelector%24ctl00%24cmbShowPrices';
    expect(
      isForbiddenPortalWrite(
        'POST',
        'https://cal.example/Catalogue.aspx',
        body,
      ),
    ).toBe(false);
  });
});

describe('assertReadOnlyRequest', () => {
  it('lève une erreur sur un appel direct au panier', () => {
    expect(() =>
      assertReadOnlyRequest('POST', 'https://portail.example/panier/ajout?x=1'),
    ).toThrow(/lecture seule.*POST \/panier\/ajout\)/);
  });
  it('ne lève rien sur la recherche', () => {
    expect(() =>
      assertReadOnlyRequest('POST', 'https://portail.example/search'),
    ).not.toThrow();
  });
});

describe('garde installée sur le contexte navigateur', () => {
  it('avorte une mise au panier tentée par la page et la signale', async () => {
    let handler: ((r: unknown) => Promise<void>) | undefined;
    const context = {
      route: jest.fn(async (_p: string, h: (r: unknown) => Promise<void>) => {
        handler = h;
      }),
    } as unknown as BrowserContext;
    const blocked: string[] = [];
    await installReadOnlyGuard(context, (m, p) => blocked.push(`${m} ${p}`));
    expect(handler).toBeDefined();

    const cart = fakeRoute(
      'POST',
      'https://portail.example/panier/ajout?ref=1',
    );
    await handler!(cart.route);
    expect(cart.calls).toEqual(['abort']);
    expect(blocked).toEqual(['POST /panier/ajout']);

    const search = fakeRoute('POST', 'https://portail.example/search');
    await handler!(search.route);
    expect(search.calls).toEqual(['continue']);
  });

  it('readOnlyRouteHandler poursuit une lecture GET de ressource « cart »', async () => {
    const r = fakeRoute('GET', 'https://portail.example/img/cart.png');
    await readOnlyRouteHandler(r.route);
    expect(r.calls).toEqual(['continue']);
  });
});
