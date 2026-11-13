import {
  escapeLikePattern,
  ilikeContains,
  quoteFilterValue,
} from './postgrest-filter.util';

/**
 * Lecture d'une valeur citée par PostgREST (`pQuotedValue`, QueryParams.hs) :
 * entre les guillemets, `\x` vaut `x` et la valeur s'arrête au premier `"`
 * non échappé. Sert à vérifier ce que la base reçoit réellement.
 */
function readQuotedValue(filter: string): { value: string; rest: string } {
  expect(filter.startsWith('"')).toBe(true);
  let value = '';
  let i = 1;
  while (i < filter.length && filter[i] !== '"') {
    if (filter[i] === '\\') i += 1;
    value += filter[i];
    i += 1;
  }
  expect(filter[i]).toBe('"');
  return { value, rest: filter.slice(i + 1) };
}

describe('escapeLikePattern', () => {
  it('laisse un texte ordinaire inchangé', () => {
    expect(escapeLikePattern('plaquette de frein')).toBe('plaquette de frein');
  });

  it('échappe %, _ et \\', () => {
    expect(escapeLikePattern('50%_a\\b')).toBe('50\\%\\_a\\\\b');
  });
});

describe('quoteFilterValue', () => {
  it.each([
    'frein,plaquette',
    'frein)',
    'a),id.gt.0,(b',
    'guillemet " dedans',
    'fin \\',
    'x"),id.neq.0,msg_id.eq.("',
  ])('la valeur %p est relue entière, sans rien après', (input) => {
    const { value, rest } = readQuotedValue(quoteFilterValue(input));
    expect(value).toBe(input);
    expect(rest).toBe('');
  });

  it('accepte un nombre', () => {
    expect(quoteFilterValue(42)).toBe('"42"');
  });
});

describe('ilikeContains', () => {
  it('produit le motif « contient » cité', () => {
    expect(ilikeContains('frein')).toBe('"%frein%"');
  });

  it.each([
    ['frein,plaquette', '%frein,plaquette%'],
    ['frein)', '%frein)%'],
    ['50%', '%50\\%%'],
    ['a_b', '%a\\_b%'],
    ['c:\\d', '%c:\\\\d%'],
    ['dit "x"', '%dit "x"%'],
  ])('%p arrive à la base comme le motif LIKE %p', (input, likePattern) => {
    const { value, rest } = readQuotedValue(ilikeContains(input));
    expect(value).toBe(likePattern);
    expect(rest).toBe('');
  });
});
