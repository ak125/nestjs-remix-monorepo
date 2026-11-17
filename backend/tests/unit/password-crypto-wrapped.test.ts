/**
 * Empreintes enveloppées (mandat AP, décisions 88 et 89).
 *
 * Une ancienne empreinte (md5, sha1, md5-crypt à sel fixe) est remplacée en base
 * par bcrypt(ancienne_empreinte), préfixée par `$akwrap$v1$<format>$`. La
 * connexion recalcule l'ancienne empreinte à partir du mot de passe saisi et la
 * compare à l'enveloppe ; elle est ensuite convertie en bcrypt simple.
 *
 * @see backend/src/shared/crypto/password-crypto.service.ts
 */
import * as bcrypt from 'bcrypt';
import {
  LegacyHashFormat,
  PasswordCryptoService,
  WRAPPED_HASH_PREFIX,
} from '../../src/shared/crypto/password-crypto.service';

const PASSWORD = 'test123';
const WRONG = 'test124';

// Vecteurs fixes de l'ancien système pour 'test123' (indépendants du code
// testé ; mêmes valeurs que password-crypto.service.test.ts).
const LEGACY: Record<LegacyHashFormat, string> = {
  md5: 'cc03e747a6afbbcbf8be7668acfebee5', // md5('test123')
  sha1: '7288edd0fc3ffcbe93a0cf06e3568e28521687bc', // sha1('test123')
  // crypt(md5('test123'), 'im10tech7'), vecteur de password-crypto.service.test.ts
  'md5-crypt': 'imx71Hl.5FQJA',
};
const FORMATS = Object.keys(LEGACY) as LegacyHashFormat[];

describe('PasswordCryptoService — empreintes enveloppées', () => {
  const service = new PasswordCryptoService();

  describe.each(FORMATS)('format %s', (format) => {
    let wrapped: string;

    beforeAll(async () => {
      wrapped = await service.wrapLegacyHash(LEGACY[format]);
    });

    it('a un préfixe distinct et ne contient plus l’ancienne empreinte', () => {
      expect(
        wrapped.startsWith(`${WRAPPED_HASH_PREFIX}${format}$$2b$10$`),
      ).toBe(true);
      expect(wrapped).not.toContain(LEGACY[format]);
      expect(service.isBcryptHash(wrapped)).toBe(false);
      expect(service.detectLegacyFormat(wrapped)).toBeNull();
    });

    it('valide le bon mot de passe', async () => {
      await expect(
        service.validatePassword(PASSWORD, wrapped),
      ).resolves.toEqual({
        isValid: true,
        format: 'wrapped',
        legacyFormat: format,
      });
    });

    it('refuse un mauvais mot de passe', async () => {
      const r = await service.validatePassword(WRONG, wrapped);
      expect(r.isValid).toBe(false);
      expect(r.format).toBe('wrapped');
    });

    it('refuse l’ancienne empreinte saisie comme mot de passe', async () => {
      // Une copie de l'ancienne base ne suffit pas à se connecter.
      const r = await service.validatePassword(LEGACY[format], wrapped);
      expect(r.isValid).toBe(false);
    });

    it('correspond à l’ancienne empreinte et à elle seule', async () => {
      await expect(
        service.wrappedMatchesLegacy(wrapped, LEGACY[format]),
      ).resolves.toBe(true);
      const other = FORMATS.find((f) => f !== format)!;
      await expect(
        service.wrappedMatchesLegacy(wrapped, LEGACY[other]),
      ).resolves.toBe(false);
    });

    it('reste à convertir puis se convertit en bcrypt simple à la connexion', async () => {
      expect(service.needsRehash(wrapped)).toBe(true);
      let stored = wrapped;
      const upgraded = await service.upgradeHashIfNeeded(
        'acct-1',
        PASSWORD,
        wrapped,
        async (_uid, newHash) => {
          stored = newHash;
        },
      );
      expect(upgraded).toBe(true);
      expect(stored.startsWith('$2b$10$')).toBe(true);
      expect(service.needsRehash(stored)).toBe(false);
      await expect(service.validatePassword(PASSWORD, stored)).resolves.toEqual(
        {
          isValid: true,
          format: 'bcrypt',
        },
      );
    });
  });

  it('chaque enveloppe a un sel propre', async () => {
    const a = await service.wrapLegacyHash(LEGACY.sha1);
    const b = await service.wrapLegacyHash(LEGACY.sha1);
    expect(a).not.toBe(b);
  });

  it('refuse une enveloppe mal formée sans retomber sur le texte en clair', async () => {
    const malformed = `${WRAPPED_HASH_PREFIX}sha1$pas-du-bcrypt`;
    await expect(
      service.validatePassword(malformed, malformed),
    ).resolves.toEqual({ isValid: false, format: 'wrapped' });
  });

  it('refuse une enveloppe au format inconnu', async () => {
    const inner = await bcrypt.hash(LEGACY.md5, 10);
    const r = await service.validatePassword(
      PASSWORD,
      `${WRAPPED_HASH_PREFIX}sha256$${inner}`,
    );
    expect(r).toEqual({ isValid: false, format: 'wrapped' });
  });

  it('refuse une enveloppe dont le format déclaré ne correspond pas au contenu', async () => {
    const inner = await bcrypt.hash(LEGACY.sha1, 10);
    const r = await service.validatePassword(
      PASSWORD,
      `${WRAPPED_HASH_PREFIX}md5$${inner}`,
    );
    expect(r.isValid).toBe(false);
  });

  describe('wrapLegacyHash refuse ce qui n’est pas une ancienne empreinte', () => {
    it.each([
      [
        'bcrypt',
        '$2b$10$abcdefghijklmnopqrstuuJ0z3m3Pq7O1c4mN0vYbq3n2tq9QGvW2',
      ],
      ['vide', ''],
      ['longueur inconnue', 'abc'],
    ])('%s', async (_label, value) => {
      await expect(service.wrapLegacyHash(value)).rejects.toThrow(
        'not a recognised legacy hash',
      );
    });

    it('une enveloppe (pas de double enveloppe)', async () => {
      const wrapped = await service.wrapLegacyHash(LEGACY.sha1);
      await expect(service.wrapLegacyHash(wrapped)).rejects.toThrow(
        'not a recognised legacy hash',
      );
    });
  });

  it('detectLegacyFormat suit les règles de validatePassword', () => {
    expect(service.detectLegacyFormat(LEGACY.md5)).toBe('md5');
    expect(service.detectLegacyFormat(LEGACY.sha1)).toBe('sha1');
    expect(service.detectLegacyFormat(LEGACY.sha1.toUpperCase())).toBe('sha1');
    expect(service.detectLegacyFormat(LEGACY['md5-crypt'])).toBe('md5-crypt');
    expect(service.detectLegacyFormat(null)).toBeNull();
    expect(service.detectLegacyFormat('')).toBeNull();
    expect(service.detectLegacyFormat('$2b$10$x')).toBeNull();
  });

  // Connexion inchangée : l'enveloppe rend exactement le verdict de l'ancienne
  // empreinte, y compris pour les valeurs que l'ancien code refuse déjà
  // (hex en majuscules comparé à la casse près, crypt d'un autre sel).
  describe('même verdict avant et après enveloppe', () => {
    const cases: Array<[string, string, string]> = [
      ['md5', LEGACY.md5, PASSWORD],
      ['sha1', LEGACY.sha1, PASSWORD],
      ['md5-crypt', LEGACY['md5-crypt'], PASSWORD],
      ['sha1 en majuscules', LEGACY.sha1.toUpperCase(), PASSWORD],
      ['md5 en majuscules', LEGACY.md5.toUpperCase(), PASSWORD],
      ['crypt d’un autre sel', 'auAbCdEfGhIjK', PASSWORD],
    ];

    it.each(cases)('%s', async (_label, legacy, password) => {
      const wrapped = await service.wrapLegacyHash(legacy);
      for (const attempt of [password, WRONG, legacy]) {
        const before = await service.validatePassword(attempt, legacy);
        const after = await service.validatePassword(attempt, wrapped);
        expect(after.isValid).toBe(before.isValid);
      }
    });
  });
});
