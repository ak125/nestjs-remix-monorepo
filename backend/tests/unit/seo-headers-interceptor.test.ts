/**
 * SeoHeadersInterceptor — propriété du X-Robots-Tag.
 *
 * Régression (empirique live 2026-05-29, DEV:3000 origin) : le branch fallthrough
 * par défaut posait `X-Robots-Tag: index, follow` sur TOUTE route non-typée — y
 * compris les 404/410 servis par le catch-all Remix (`$.tsx`) et la 404 véhicule —
 * contredisant le `noindex` posé par la Response throw de la route. Comme
 * `@remix-run/express` fait `res.append` (et non `setHeader`), le défaut interceptor
 * survivait au header Remix (ou le doublait).
 *
 * Fix : le fallthrough ne pose plus de X-Robots-Tag (`index, follow` est le défaut
 * implicite de Google quand le header est absent). Les routes `/pieces` et
 * `/constructeurs` délèguent déjà robots à Remix ; `/admin`, `/api` et
 * `!shouldIndex` restent explicitement noindex.
 *
 * @see backend/src/modules/seo/interceptors/seo-headers.interceptor.ts
 */
import { of } from 'rxjs';

import { SeoHeadersService } from '../../src/modules/seo/infrastructure/seo-headers.service';
import { RobotsTxtService } from '../../src/modules/seo/infrastructure/robots-txt.service';
import { SeoHeadersInterceptor } from '../../src/modules/seo/interceptors/seo-headers.interceptor';

function run(path: string): Record<string, string> {
  const captured: Record<string, string> = {};
  const ctx = {
    switchToHttp: () => ({
      getResponse: () => ({
        setHeader: (k: string, v: string) => {
          captured[k] = v;
        },
      }),
      getRequest: () => ({ path, url: path }),
    }),
  };
  const interceptor = new SeoHeadersInterceptor(
    new SeoHeadersService(),
    // shouldIndex() est pur (regex only) ; le constructeur lit juste NODE_ENV/BASE_URL.
    new RobotsTxtService({
      get: (_key: string, defaultValue?: unknown) => defaultValue,
    } as never),
  );
  interceptor.intercept(ctx as never, { handle: () => of(null) } as never);
  return captured;
}

describe('SeoHeadersInterceptor — X-Robots-Tag ownership', () => {
  it('ne force PAS index,follow sur un path générique fallthrough (home)', () => {
    const h = run('/');
    expect(h['X-Robots-Tag']).toBeUndefined();
    // les headers de sécurité par défaut restent appliqués
    expect(h['X-Content-Type-Options']).toBe('nosniff');
  });

  it('ne force PAS index,follow sur un 404/garbage servi par le catch-all', () => {
    expect(run('/Us8wiFwI2rH4caEMb2bfQ==')['X-Robots-Tag']).toBeUndefined();
    expect(run('/this-page-does-not-exist-12345')['X-Robots-Tag']).toBeUndefined();
  });

  it('ne pose PAS de X-Robots-Tag sur /constructeurs/ (Remix possède robots)', () => {
    expect(
      run('/constructeurs/bmw-33/serie-3-e90-33028/328-i-58077.html')[
        'X-Robots-Tag'
      ],
    ).toBeUndefined();
  });

  it('ne pose PAS de X-Robots-Tag sur /pieces/ (Remix possède robots)', () => {
    expect(
      run('/pieces/filtre-a-huile-7/bmw-33/serie-3-e90-33028/328-i-58077.html')[
        'X-Robots-Tag'
      ],
    ).toBeUndefined();
  });

  it('garde noindex,nofollow sur /admin/', () => {
    expect(run('/admin/dashboard')['X-Robots-Tag']).toBe('noindex, nofollow');
  });

  it('garde noindex,nofollow sur /api/', () => {
    expect(run('/api/health')['X-Robots-Tag']).toBe('noindex, nofollow');
  });

  it('garde index,follow (blog) sur /blog/', () => {
    expect(run('/blog/mon-article')['X-Robots-Tag']).toContain('index, follow');
  });
});
