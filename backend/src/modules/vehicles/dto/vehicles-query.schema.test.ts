import { ZodError } from 'zod';

import { VehiclesQuerySchema } from './vehicles-query.schema';

/**
 * Tests du contrat de validation des query params du module `vehicles`.
 *
 * Garantit que toute valeur non-conforme (NaN, format invalide, hors borne,
 * champ inconnu) lève une `ZodError` — qui sera convertie en 400 Bad Request
 * par `StrictZodQueryValidationPipe`. Empêche la régression du bug Sentry
 * 2026-05-23 (`invalid input syntax for type smallint: "NaN"` PROD).
 */
describe('VehiclesQuerySchema', () => {
  describe('year — racine du bug Sentry 2026-05-23', () => {
    it.each([
      ['NaN'],
      ['abc'],
      ['-1'],
      ['0'],
      ['1.5'],
      ['99'], // pas 4 chiffres
      ['99999'], // 5 chiffres
      ['1899'], // sous min
      ['2101'], // au-dessus max
      [' 2024'], // espace
      ['2024 '],
      ['+2024'],
      ['0x7E8'],
      ['2e3'],
    ])('rejette year=%s', (year) => {
      expect(() => VehiclesQuerySchema.parse({ year })).toThrow(ZodError);
    });

    it.each([
      ['1900', 1900],
      ['2024', 2024],
      ['2100', 2100],
    ])('accepte year=%s et transforme en %i', (year, expected) => {
      const result = VehiclesQuerySchema.parse({ year });
      expect(result.year).toBe(expected);
    });

    it('traite year="" comme absent (undefined)', () => {
      const result = VehiclesQuerySchema.parse({ year: '' });
      expect(result.year).toBeUndefined();
    });

    it('accepte query vide → year undefined', () => {
      const result = VehiclesQuerySchema.parse({});
      expect(result.year).toBeUndefined();
    });
  });

  describe('limit / page — borne int4', () => {
    it.each([
      // limit : ≥ 1 strict (limit=0 = page de résultats vide, jamais voulu)
      ['limit', 'NaN'],
      ['limit', 'abc'],
      ['limit', '-1'],
      ['limit', '0'],
      ['limit', '01'], // leading zero
      // page : ≥ 0 (offset 0-indexed canon), mais anti-bricolage gardé
      ['page', 'NaN'],
      ['page', 'abc'],
      ['page', '-1'], // négatif rejeté
      ['page', '01'], // leading zero rejeté
      ['page', '+0'], // signe rejeté
      ['page', ' 0'], // espace rejeté
      ['page', '0x1E'], // hex rejeté
      ['page', '2e3'], // scientifique rejeté
      ['page', '2147483648'], // > int4 max
    ])('rejette %s=%s', (field, value) => {
      expect(() => VehiclesQuerySchema.parse({ [field]: value })).toThrow(
        ZodError,
      );
    });

    it.each([
      ['limit', '20', 20],
      ['page', '0', 0], // ANTI-RÉGRESSION : contrat frontend 0-indexed
      ['page', '1', 1],
      ['page', '2147483647', 2147483647], // page int4 max
      ['limit', '2147483647', 2147483647], // limit int4 max
    ])('accepte %s=%s → %i', (field, value, expected) => {
      const result = VehiclesQuerySchema.parse({ [field]: value });
      expect((result as Record<string, unknown>)[field]).toBe(expected);
    });
  });

  describe('includeAll — enum strict', () => {
    it('accepte "true" → true', () => {
      expect(VehiclesQuerySchema.parse({ includeAll: 'true' }).includeAll).toBe(
        true,
      );
    });

    it('accepte "false" → false', () => {
      expect(
        VehiclesQuerySchema.parse({ includeAll: 'false' }).includeAll,
      ).toBe(false);
    });

    it('rejette "True" / "1" / "yes"', () => {
      expect(() => VehiclesQuerySchema.parse({ includeAll: 'True' })).toThrow(
        ZodError,
      );
      expect(() => VehiclesQuerySchema.parse({ includeAll: '1' })).toThrow(
        ZodError,
      );
      expect(() => VehiclesQuerySchema.parse({ includeAll: 'yes' })).toThrow(
        ZodError,
      );
    });

    it('absent → false (default applied via transform)', () => {
      expect(VehiclesQuerySchema.parse({}).includeAll).toBe(false);
    });
  });

  describe('strict object — champs inconnus rejetés', () => {
    it('rejette un champ inconnu', () => {
      expect(() => VehiclesQuerySchema.parse({ unknownField: 'foo' })).toThrow(
        ZodError,
      );
    });

    it('rejette un typo de champ connu', () => {
      expect(() => VehiclesQuerySchema.parse({ yeaR: '2024' })).toThrow(
        ZodError,
      );
    });
  });

  describe('search / brandId / modelId / typeId — strings', () => {
    it('accepte search="moteur"', () => {
      expect(VehiclesQuerySchema.parse({ search: 'moteur' }).search).toBe(
        'moteur',
      );
    });

    it('traite search="" comme undefined', () => {
      expect(VehiclesQuerySchema.parse({ search: '' }).search).toBeUndefined();
    });

    it('rejette search dépassant 200 caractères', () => {
      expect(() =>
        VehiclesQuerySchema.parse({ search: 'a'.repeat(201) }),
      ).toThrow(ZodError);
    });

    it('accepte brandId/modelId/typeId comme strings (pas de coercition)', () => {
      const result = VehiclesQuerySchema.parse({
        brandId: '35',
        modelId: '12345',
        typeId: '99999',
      });
      expect(result.brandId).toBe('35');
      expect(result.modelId).toBe('12345');
      expect(result.typeId).toBe('99999');
    });
  });

  describe('reproduction exacte de l’incident Sentry 2026-05-23', () => {
    it('GET /api/vehicles/brands/:brandId/models?year=NaN → ZodError (404 → 400)', () => {
      // Cas reproduit : un client (bug frontend, fuzz, scrap) envoie ?year=NaN.
      // Avant ce fix : parseInt("NaN", 10) → NaN, propagé jusqu'au cast SQL
      // marque_id::SMALLINT → Postgres répond "invalid input syntax for type
      // smallint: NaN" → 500 → utilisateur final.
      // Après ce fix : rejet 400 immédiat, jamais le SQL.
      expect(() => VehiclesQuerySchema.parse({ year: 'NaN' })).toThrow(
        ZodError,
      );
    });
  });

  describe('reproduction exacte de la régression PR #712 (2026-05-23 → 05-27)', () => {
    it('VehicleSelector contract — getModels(brandId, { year, page: 0, limit: 100 }) doit passer', () => {
      // Régression PR #712 : `PositiveIntParamSchema` (regex /^[1-9]\d*$/) a
      // été appliqué à `page` (offset pagination). Or `vehicle-models.service`
      // est 0-indexed (`offset = page * limit`), et le frontend
      // `enhanced-vehicle.api.ts::getModels()` envoie `page: 0`. Résultat :
      // 100% des chargements de modèles VehicleSelector → 400 silencieux
      // depuis 2026-05-23. Aucun test ne couvrait page='0' (seul page='1' était
      // testé), donc CI vert + bug atterrit sur PROD.
      const result = VehiclesQuerySchema.parse({
        brandId: '140',
        year: '2012',
        page: '0',
        limit: '100',
      });
      expect(result.page).toBe(0);
      expect(result.limit).toBe(100);
      expect(result.year).toBe(2012);
      expect(result.brandId).toBe('140');
    });
  });
});
