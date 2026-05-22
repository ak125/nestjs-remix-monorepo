import { ArgumentMetadata, BadRequestException } from '@nestjs/common';
import { PositiveIntParamPipe } from '../positive-int-param.pipe';

const meta: ArgumentMetadata = {
  type: 'param',
  data: 'typeId',
  metatype: String,
};

describe('PositiveIntParamPipe (int4 range)', () => {
  let pipe: PositiveIntParamPipe;

  beforeEach(() => {
    pipe = new PositiveIntParamPipe();
  });

  it.each([
    ['letters', 'abc'],
    ['empty', ''],
    ['zero', '0'],
    ['signed-negative', '-5'],
    ['leading-zero', '0042'],
    ['above-int4', '2147483648'],
  ])('rejects %s (%s)', (_label, value) => {
    expect(() => pipe.transform(value, meta)).toThrow(BadRequestException);
  });

  it.each([
    ['1', 1],
    ['32768', 32768], // 1er id au-dessus du smallint — régression #686
    ['83456', 83456], // typique type vehicle hors smallint
    ['667022', 667022], // max réel auto_modele.modele_id (int4) — régression #686
    ['2147483647', 2147483647], // boundary max int4
  ])('accepts %s -> %d as number', (input, expected) => {
    const result = pipe.transform(input, meta);
    expect(result).toBe(expected);
    expect(typeof result).toBe('number');
  });
});
