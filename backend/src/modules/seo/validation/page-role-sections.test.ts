import { PageRoleValidatorService } from './page-role-validator.service';
import { PageRole } from '../types/page-role.types';

const validator = new PageRoleValidatorService();
const url = '/blog-pieces-auto/conseils/disque-de-frein';
const procedure = {
  sectionType: 'S4_DEPOSE',
  title: 'Procedure',
  content: 'Les outils nécessaires pour le démontage.',
};
const diagnostic = {
  sectionType: 'S2_DIAG',
  title: 'Diagnostic rapide',
  content: 'Symptômes : bruit anormal, code DTC. Vérifier le signal.',
};

describe('R3 stored sections — ADR-027 diagnostic integration', () => {
  it('accepts diagnostic vocabulary only within S2_DIAG', () => {
    const result = validator.validateR3Sections(url, [procedure, diagnostic]);
    expect(result.detectedRole).toBe(PageRole.R3_BLOG);
    expect(result.isValid).toBe(true);
    expect(
      result.violations.some((v) => v.details?.flag === 'NO_LINK_TO_R5'),
    ).toBe(false);
  });
  it('does not require a link to retired R5 details on R3 conseils', () => {
    expect(
      validator
        .validateR3Conseils(procedure.content, url)
        .some((v) => v.details?.flag === 'NO_LINK_TO_R5'),
    ).toBe(false);
  });
  it('still requires the existing R4 linkage check', () => {
    expect(
      validator
        .validateR3Conseils(procedure.content, url)
        .some((v) => v.details?.flag === 'NO_LINK_TO_R4'),
    ).toBe(true);
  });
  it.each(['S1', 'S3', 'S2_DIAGNOSTIC'])(
    'rejects diagnostic pollution in %s',
    (sectionType) => {
      expect(
        validator.validateR3Sections(url, [
          procedure,
          { ...diagnostic, sectionType },
        ]).isValid,
      ).toBe(false);
    },
  );
  it('keeps commercial restrictions on the diagnostic section', () => {
    const result = validator.validateR3Sections(url, [
      procedure,
      {
        ...diagnostic,
        content: 'Symptômes : ajouter au panier au meilleur prix.',
      },
    ]);
    expect(result.isValid).toBe(false);
    expect(result.violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          severity: 'error',
          details: expect.objectContaining({ sectionType: 'S2_DIAG' }),
        }),
      ]),
    );
  });
  it('keeps procedural content out of the diagnostic section', () => {
    expect(
      validator.validateR3Sections(url, [
        {
          ...diagnostic,
          content:
            'Symptômes puis étapes de remplacement et couple de serrage.',
        },
      ]).isValid,
    ).toBe(false);
  });
  it('does not hide pollution in ordinary sections when S2_DIAG is present', () => {
    expect(
      validator.validateR3Sections(url, [
        diagnostic,
        { ...procedure, content: 'Symptômes et diagnostic partout.' },
      ]).isValid,
    ).toBe(false);
  });
  it('refuses this scoped validation for a guide achat URL', () => {
    expect(
      validator.validateR3Sections(
        '/blog-pieces-auto/guide-achat/disque-de-frein',
        [diagnostic],
      ).isValid,
    ).toBe(false);
  });
});
