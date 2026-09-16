import { PageRoleValidatorService } from './page-role-validator.service';
import { PageRole } from '../types/page-role.types';

const validator = new PageRoleValidatorService();
const url = '/blog-pieces-auto/conseils/disque-de-frein';
const table =
  '<table><thead><tr><th>Symptome</th><th>Cause</th><th>Action</th></tr></thead><tbody><tr><td>Bruit anormal</td><td>Usure possible</td><td>Verifier le signal</td></tr></tbody></table>';
const diag = `<div id="diagnostic-rapide" data-r3-section="S2_DIAG"><div><h2>Diagnostic rapide</h2></div>${table}</div>`;
const html = (body: string, canonical = true) =>
  `<!doctype html><html><head>${canonical ? `<link rel="canonical" href="${url}">` : ''}</head><body>${body}</body></html>`;
const audit = (body: string) =>
  validator.validatePageWithHtml(url, 'Texte fourni incomplet', html(body));

describe('R3 composed HTML — diagnostic section boundary', () => {
  it('validates nested diagnostic DOM while keeping the page R3', () => {
    const result = audit(
      `<article><p>Les outils necessaires au demontage.</p>${diag}</article>`,
    );
    expect(result.isValid).toBe(true);
    expect(result.detectedRole).toBe(PageRole.R3_BLOG);
  });
  it('reads actual HTML and does not trust a clean text argument', () => {
    expect(
      audit(
        `<article><p>Diagnostic et bruit anormal ailleurs.</p>${diag}</article>`,
      ).isValid,
    ).toBe(false);
  });
  it('rejects commercial diagnostic content, including decoded entities', () => {
    expect(
      audit(
        `<article>${diag.replace('Verifier le signal', 'Ajouter au panier : 20 &#8364;')}</article>`,
      ).isValid,
    ).toBe(false);
  });
  it('rejects procedural content inside diagnostic', () => {
    expect(
      audit(
        `<article>${diag.replace('Verifier le signal', 'Etapes de remplacement et couple de serrage')}</article>`,
      ).isValid,
    ).toBe(false);
  });
  it('ignores inert scripts/styles/comments and page chrome outside article', () => {
    expect(
      audit(
        `<nav>Ajouter au panier</nav><article><script>prix = 5</script><style>.prix {}</style><!-- diagnostic -->${diag}</article>`,
      ).isValid,
    ).toBe(true);
  });
  it.each([
    diag.replace(
      'data-r3-section="S2_DIAG"',
      'data-r3-section="S2_DIAGNOSTIC"',
    ),
    diag.replace('id="diagnostic-rapide"', 'id="autre-ancre"'),
    diag + '<div id="diagnostic-rapide"></div>',
    diag + diag,
    diag.replace(table, ''),
    diag.replace('<td>Verifier le signal</td>', ''),
    diag.replace('<td>Verifier le signal</td>', '<td> </td>'),
    diag.replace('<h2>Diagnostic rapide</h2>', ''),
  ])(
    'rejects ambiguous, missing or incomplete diagnostic structure (%#)',
    (content) => {
      const result = audit(`<article>${content}</article>`);
      expect(result.isValid).toBe(false);
      expect(result.violations).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'missing_element',
            severity: 'error',
          }),
        ]),
      );
    },
  );
  it('does not grant a diagnostic exemption outside the article', () => {
    expect(
      audit(`${diag}<article>Les outils necessaires.</article>`).isValid,
    ).toBe(false);
  });
  it.each([
    `<div>${diag}</div>`,
    `<article>${diag}</article><article>Second article</article>`,
  ])('requires an unambiguous article root (%#)', (content) => {
    expect(audit(content).isValid).toBe(false);
  });
  it('keeps missing canonical invalid even with a valid diagnostic', () => {
    const result = validator.validatePageWithHtml(
      url,
      '',
      html(`<article>${diag}</article>`, false),
    );
    expect(result.violations.some((v) => v.type === 'missing_canonical')).toBe(
      true,
    );
    expect(result.isValid).toBe(false);
  });
  it('refuses a declared role that disagrees with the R3 conseils route', () => {
    const result = validator.validatePageWithHtml(
      url,
      '',
      html(`<article>${diag}</article>`),
      PageRole.R5_DIAGNOSTIC,
    );
    expect(result.violations.some((v) => v.type === 'role_mismatch')).toBe(
      true,
    );
    expect(result.isValid).toBe(false);
  });
  it('allows a full-width DTC footer after a complete diagnostic row', () => {
    expect(
      audit(
        `<article>${diag.replace('</tbody>', '<tr><td colspan="3">Code DTC : consulter les limites du signal.</td></tr></tbody>')}</article>`,
      ).isValid,
    ).toBe(true);
  });
});
