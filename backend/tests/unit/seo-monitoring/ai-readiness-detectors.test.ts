import { detectExtractableTldr, detectFaqSchema, detectVisibleSources } from '../../../src/modules/seo-monitoring/helpers/ai-readiness-detectors';

describe('detectExtractableTldr', () => {
  it('returns 1 when first <p> has 50-200 chars of substantive text', () => {
    const html = '<html><body><h1>Symptôme</h1><p>La fumée noire au démarrage indique souvent un encrassement de la vanne EGR sur Clio 1.5 dCi.</p></body></html>';
    expect(detectExtractableTldr(html)).toBe(1);
  });
  it('returns 0 when no <p> in first 1000 chars', () => {
    const html = '<html><body><h1>Symptôme</h1><div>Texte sans paragraphe.</div></body></html>';
    expect(detectExtractableTldr(html)).toBe(0);
  });
  it('returns 0 when first <p> is too short (<50 chars)', () => {
    expect(detectExtractableTldr('<html><body><p>Trop court.</p></body></html>')).toBe(0);
  });
  it('returns 0 when first <p> is too long (>200 chars)', () => {
    const long = 'a'.repeat(250);
    expect(detectExtractableTldr(`<p>${long}</p>`)).toBe(0);
  });
});

describe('detectFaqSchema', () => {
  it('returns 1 when JSON-LD FAQPage is present', () => {
    const html = `<script type="application/ld+json">${JSON.stringify({ '@type': 'FAQPage', mainEntity: [{ '@type': 'Question' }] })}</script>`;
    expect(detectFaqSchema(html)).toBe(1);
  });
  it('returns 0 when JSON-LD is present but not FAQPage', () => {
    const html = `<script type="application/ld+json">${JSON.stringify({ '@type': 'Product' })}</script>`;
    expect(detectFaqSchema(html)).toBe(0);
  });
  it('returns 0 when no JSON-LD at all', () => {
    expect(detectFaqSchema('<p>nothing</p>')).toBe(0);
  });
  it('returns 1 when @graph contains FAQPage', () => {
    const html = `<script type="application/ld+json">${JSON.stringify({ '@graph': [{ '@type': 'WebPage' }, { '@type': 'FAQPage' }] })}</script>`;
    expect(detectFaqSchema(html)).toBe(1);
  });
  it('does not throw when JSON-LD is invalid (returns 0)', () => {
    expect(detectFaqSchema('<script type="application/ld+json">{invalid json</script>')).toBe(0);
  });
});

describe('detectVisibleSources', () => {
  it('returns 1 when ≥1 external <a> outside nav/footer', () => {
    const html = '<html><body><a href="https://www.constructeurs.fr/clio">source constructeur</a></body></html>';
    expect(detectVisibleSources(html, 'www.automecanik.com')).toBe(1);
  });
  it('returns 0 when all <a> are internal (same hostname)', () => {
    const html = '<a href="/pieces/freinage">interne</a><a href="https://www.automecanik.com/aide">aussi interne</a>';
    expect(detectVisibleSources(html, 'www.automecanik.com')).toBe(0);
  });
  it('returns 0 when external <a> are in <nav> or <footer>', () => {
    const html = '<nav><a href="https://twitter.com/x">tweet</a></nav><footer><a href="https://facebook.com">fb</a></footer>';
    expect(detectVisibleSources(html, 'www.automecanik.com')).toBe(0);
  });
});
