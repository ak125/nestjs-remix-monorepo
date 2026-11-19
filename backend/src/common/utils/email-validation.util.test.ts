import { performance } from 'node:perf_hooks';
import { EMAIL_MAX_LENGTH, isValidEmail } from './email-validation.util';

/** Adresse bien formée de la longueur demandée. */
function addressOfLength(length: number): string {
  const domain = '@example.test';
  return 'a'.repeat(length - domain.length) + domain;
}

describe('isValidEmail', () => {
  it.each([
    ['client@example.test'],
    ['prenom.nom+commande@sous.domaine.example.test'],
    ['rené@exemple.test'],
  ])('accepte une adresse bien formée (%s)', (email) => {
    expect(isValidEmail(email)).toBe(true);
  });

  it('accepte une adresse de la longueur maximale, refuse un caractère de plus', () => {
    expect(EMAIL_MAX_LENGTH).toBe(254);
    expect(isValidEmail(addressOfLength(EMAIL_MAX_LENGTH))).toBe(true);
    expect(isValidEmail(addressOfLength(EMAIL_MAX_LENGTH + 1))).toBe(false);
  });

  it('refuse une chaîne vide', () => {
    expect(isValidEmail('')).toBe(false);
  });

  it.each([
    [undefined],
    [null],
    [42],
    [true],
    [['client@example.test']],
    [{ email: 'client@example.test' }],
  ])("refuse ce qui n'est pas une chaîne (%p)", (value) => {
    expect(isValidEmail(value)).toBe(false);
  });

  it.each([
    ['pas-un-email'],
    ['client@'],
    ['@example.test'],
    ['client@example'],
    ['client@@example.test'],
    ['client @example.test'],
    [' client@example.test'],
    ['client@example.test\n'],
  ])('refuse une adresse mal formée (%p)', (email) => {
    expect(isValidEmail(email)).toBe(false);
  });

  it('ne normalise rien : la normalisation reste à l’appelant', () => {
    expect(isValidEmail('  client@example.test  ')).toBe(false);
    expect(isValidEmail('Client@Example.Test')).toBe(true);
  });

  it('évalue la longueur avant le format', () => {
    const test = jest.spyOn(RegExp.prototype, 'test');
    try {
      expect(isValidEmail(addressOfLength(EMAIL_MAX_LENGTH + 1))).toBe(false);
      expect(isValidEmail(['client@example.test'])).toBe(false);
      expect(test).not.toHaveBeenCalled();
    } finally {
      test.mockRestore();
    }
  });

  it('refuse une entrée très longue en un temps borné', () => {
    const megabyte = 1024 * 1024;
    const inputs = [
      addressOfLength(megabyte),
      'a'.repeat(megabyte),
      'client@example.test '.repeat(megabyte / 20),
    ];

    const start = performance.now();
    const results = inputs.map((input) => isValidEmail(input));
    const elapsedMs = performance.now() - start;

    expect(results).toEqual([false, false, false]);
    expect(elapsedMs).toBeLessThan(50);
  });
});
