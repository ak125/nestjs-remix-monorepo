import { classifyLandingSource } from './landing-source.classifier';

const SELF = 'www.automecanik.com';

describe('classifyLandingSource', () => {
  it('classifies a Google search referer as organic', () => {
    expect(
      classifyLandingSource({
        referer: 'https://www.google.com/search?q=plaquettes',
        selfHost: SELF,
      }),
    ).toBe('organic');
  });

  it('classifies gclid as paid (precedence over referer)', () => {
    expect(
      classifyLandingSource({
        referer: 'https://www.google.com/',
        query: { gclid: 'abc123' },
        selfHost: SELF,
      }),
    ).toBe('paid');
  });

  it('classifies utm_medium=cpc as paid', () => {
    expect(
      classifyLandingSource({ query: { utm_medium: 'cpc' }, selfHost: SELF }),
    ).toBe('paid');
  });

  it('classifies utm_medium=email as email', () => {
    expect(
      classifyLandingSource({ query: { utm_medium: 'email' }, selfHost: SELF }),
    ).toBe('email');
  });

  it('classifies a Facebook referer as social', () => {
    expect(
      classifyLandingSource({ referer: 'https://m.facebook.com/', selfHost: SELF }),
    ).toBe('social');
  });

  it('classifies a non-search external referer as referral', () => {
    expect(
      classifyLandingSource({
        referer: 'https://blog.partenaire.fr/article',
        selfHost: SELF,
      }),
    ).toBe('referral');
  });

  it('classifies a same-host referer as direct (internal nav is not a new landing source)', () => {
    expect(
      classifyLandingSource({
        referer: 'https://www.automecanik.com/pieces',
        selfHost: SELF,
      }),
    ).toBe('direct');
  });

  it('classifies no referer and no utm as direct', () => {
    expect(classifyLandingSource({ selfHost: SELF })).toBe('direct');
  });

  it('classifies an unknown utm_source as campaign', () => {
    expect(
      classifyLandingSource({ query: { utm_source: 'partner-x' }, selfHost: SELF }),
    ).toBe('campaign');
  });

  it('is robust to a malformed referer (treats as direct)', () => {
    expect(classifyLandingSource({ referer: 'not a url', selfHost: SELF })).toBe(
      'direct',
    );
  });
});
