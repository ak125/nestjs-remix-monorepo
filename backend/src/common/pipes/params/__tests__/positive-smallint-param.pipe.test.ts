import { ArgumentMetadata, BadRequestException } from '@nestjs/common';
import { PositiveSmallIntParamPipe } from '../positive-smallint-param.pipe';

const meta: ArgumentMetadata = {
  type: 'param',
  data: 'brandId',
  metatype: String,
};

describe('PositiveSmallIntParamPipe', () => {
  let pipe: PositiveSmallIntParamPipe;

  beforeEach(() => {
    pipe = new PositiveSmallIntParamPipe();
  });

  describe('REJECT cases (HTTP 400 BadRequestException)', () => {
    // Cas canon 8 + leading-zero anti-pattern (9e cas)
    it.each([
      ['letters', 'abc'],
      ['partial-numeric', '30abc'],
      ['whitespace-prefix', ' 30'],
      ['signed-positive', '+30'],
      ['hex-notation', '0x1E'],
      ['empty', ''],
      ['zero', '0'],
      ['signed-negative', '-1'],
      ['leading-zero', '00042'],
    ])('rejects %s (%s)', (_label, value) => {
      expect(() => pipe.transform(value, meta)).toThrow(BadRequestException);
    });

    it('rejects boundary above smallint (32768)', () => {
      expect(() => pipe.transform('32768', meta)).toThrow(BadRequestException);
    });
  });

  describe('ACCEPT cases (transform string -> number)', () => {
    it.each([
      ['1', 1],
      ['42', 42],
      ['32767', 32767], // boundary max smallint
    ])('accepts %s -> %d typed as number', (input, expected) => {
      const result = pipe.transform(input, meta);
      expect(result).toBe(expected);
      expect(typeof result).toBe('number');
    });
  });

  describe('SCALAR PARAM ONLY guard', () => {
    it('rejects non-string scalar (object)', () => {
      // Si quelqu'un fait @Param(pipe), Nest passerait l'objet `params` entier.
      // Le schéma z.string() refuse — défense correcte.
      expect(() =>
        pipe.transform({ brandId: '42' } as unknown as string, meta),
      ).toThrow(BadRequestException);
    });

    it('rejects undefined / null', () => {
      expect(() =>
        pipe.transform(undefined as unknown as string, meta),
      ).toThrow(BadRequestException);
      expect(() => pipe.transform(null as unknown as string, meta)).toThrow(
        BadRequestException,
      );
    });
  });
});
