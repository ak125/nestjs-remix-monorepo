import { UTMBuilderService } from './utm-builder.service';
import { SITE_ORIGIN } from '../../../config/app.config';

describe('marketing UTM destinations', () => {
  const service = new UTMBuilderService();
  const options = {
    week_iso: '2026-W42',
    pillar: 'conseil' as const,
    gamme_alias: 'frein',
    channel: 'facebook' as const,
  };

  it.each(['/pieces/frein', '/pieces/frein?vehicle=42#conseils'])(
    'keeps query and fragment for %s',
    (path) => {
      const result = service.buildUTMLink({ ...options, path });
      const url = new URL(result.full_url);
      expect(url.searchParams.get('utm_source')).toBe('facebook');
      expect(url.searchParams.get('utm_campaign')).toBe(
        result.params.utm_campaign,
      );
      expect(url.hash).toBe(path.includes('#') ? '#conseils' : '');
      if (path.includes('?'))
        expect(url.searchParams.get('vehicle')).toBe('42');
    },
  );

  it('accepts a same-origin absolute destination and replaces old attribution', () => {
    const result = service.buildUTMLink({
      ...options,
      path: `${SITE_ORIGIN}/pieces/frein?utm_source=old#fiche`,
    });
    const url = new URL(result.full_url);
    expect(url.pathname).toBe('/pieces/frein');
    expect(url.searchParams.getAll('utm_source')).toEqual(['facebook']);
    expect(url.hash).toBe('#fiche');
  });

  it.each([
    'https://outside.invalid/x',
    '//outside.invalid/x',
    'javascript:alert(1)',
    Object.assign(new URL(SITE_ORIGIN), {
      username: 'synthetic-user',
      password: 'synthetic-fixture',
    }).toString(),
  ])('rejects destination %s', (path) => {
    expect(() => service.buildUTMLink({ ...options, path })).toThrow();
  });
});
