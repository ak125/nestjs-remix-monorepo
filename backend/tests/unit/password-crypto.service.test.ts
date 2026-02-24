/**
 * PasswordCryptoService Unit Tests
 *
 * Tests the centralized password cryptography service.
 * 12 tests covering: hashPassword, validatePassword (5 formats),
 * needsRehash (3 cases), secureCompare (2 cases), validatePasswordStrength (2 cases).
 *
 * @see backend/src/shared/crypto/password-crypto.service.ts
 */
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { PasswordCryptoService } from '../../src/shared/crypto/password-crypto.service';

describe('PasswordCryptoService', () => {
  let service: PasswordCryptoService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PasswordCryptoService],
    }).compile();

    service = module.get<PasswordCryptoService>(PasswordCryptoService);
  });

  // ═══════════════════════════════════════════════════════════════
  // TEST 1: hashPassword — returns valid bcrypt hash
  // ═══════════════════════════════════════════════════════════════
  it('hashPassword() should return a valid bcrypt hash starting with $2b$10$', async () => {
    const hash = await service.hashPassword('MyPassword1!');

    expect(typeof hash).toBe('string');
    expect(hash.startsWith('$2b$10$')).toBe(true);
    // Verify the hash is actually usable (bcrypt can round-trip it)
    const isValid = await bcrypt.compare('MyPassword1!', hash);
    expect(isValid).toBe(true);
  });

  // ═══════════════════════════════════════════════════════════════
  // TEST 2: validatePassword — bcrypt format
  // ═══════════════════════════════════════════════════════════════
  it('validatePassword() should validate a bcrypt hash correctly', async () => {
    const password = 'Test1234!';
    const hash = await bcrypt.hash(password, 10);

    const result = await service.validatePassword(password, hash);

    expect(result.isValid).toBe(true);
    expect(result.format).toBe('bcrypt');
  });

  // ═══════════════════════════════════════════════════════════════
  // TEST 3: validatePassword — MD5 format (32 hex chars)
  // ═══════════════════════════════════════════════════════════════
  it('validatePassword() should validate an MD5 hash correctly', async () => {
    const password = 'test123';
    const md5Hash = crypto.createHash('md5').update(password).digest('hex');

    expect(md5Hash.length).toBe(32);

    const result = await service.validatePassword(password, md5Hash);

    expect(result.isValid).toBe(true);
    expect(result.format).toBe('md5');
  });

  // ═══════════════════════════════════════════════════════════════
  // TEST 4: validatePassword — SHA1 format (40 hex chars)
  // ═══════════════════════════════════════════════════════════════
  it('validatePassword() should validate a SHA1 hash correctly', async () => {
    const password = 'test123';
    const sha1Hash = crypto.createHash('sha1').update(password).digest('hex');

    expect(sha1Hash.length).toBe(40);

    const result = await service.validatePassword(password, sha1Hash);

    expect(result.isValid).toBe(true);
    expect(result.format).toBe('sha1');
  });

  // ═══════════════════════════════════════════════════════════════
  // TEST 5: validatePassword — MD5+crypt legacy (13 chars, salt "im10tech7")
  // Precomputed: crypt(md5('test123'), 'im10tech7') = 'imx71Hl.5FQJA'
  // ═══════════════════════════════════════════════════════════════
  it('validatePassword() should validate a legacy MD5+crypt hash (13 chars)', async () => {
    const password = 'test123';
    // Precomputed via: crypt(md5('test123'), 'im10tech7')
    // md5('test123') = 'cc03e747a6afbbcbf8be7668acfebee5'
    // crypt(above, 'im10tech7') = 'imx71Hl.5FQJA' (13 chars)
    const legacyCryptHash = 'imx71Hl.5FQJA';

    expect(legacyCryptHash.length).toBe(13);

    const result = await service.validatePassword(password, legacyCryptHash);

    expect(result.isValid).toBe(true);
    expect(result.format).toBe('md5-crypt');
  });

  // ═══════════════════════════════════════════════════════════════
  // TEST 6: validatePassword — plain text match
  // ═══════════════════════════════════════════════════════════════
  it('validatePassword() should recognize plain text password equality', async () => {
    const password = 'plainTextPassword';

    const result = await service.validatePassword(password, password);

    expect(result.isValid).toBe(true);
    expect(result.format).toBe('plain');
  });

  // ═══════════════════════════════════════════════════════════════
  // TEST 7: validatePassword — wrong password returns isValid: false
  // ═══════════════════════════════════════════════════════════════
  it('validatePassword() should return isValid: false for incorrect password', async () => {
    const correctPassword = 'CorrectPass1!';
    const wrongPassword = 'WrongPass99!';
    const hash = await bcrypt.hash(correctPassword, 10);

    const result = await service.validatePassword(wrongPassword, hash);

    expect(result.isValid).toBe(false);
    expect(result.format).toBe('bcrypt');
  });

  // ═══════════════════════════════════════════════════════════════
  // TEST 8: needsRehash — bcrypt with rounds < 10 returns true
  // ═══════════════════════════════════════════════════════════════
  it('needsRehash() should return true for bcrypt hash with rounds < 10', async () => {
    // Hash with 8 rounds (below the service threshold of 10)
    const weakHash = await bcrypt.hash('SomePass1!', 8);

    expect(weakHash.startsWith('$2b$08$')).toBe(true);

    const result = service.needsRehash(weakHash);

    expect(result).toBe(true);
  });

  // ═══════════════════════════════════════════════════════════════
  // TEST 9: needsRehash — bcrypt with rounds = 10 returns false
  // ═══════════════════════════════════════════════════════════════
  it('needsRehash() should return false for bcrypt hash with rounds = 10', async () => {
    const strongHash = await bcrypt.hash('SomePass1!', 10);

    expect(strongHash.startsWith('$2b$10$')).toBe(true);

    const result = service.needsRehash(strongHash);

    expect(result).toBe(false);
  });

  // ═══════════════════════════════════════════════════════════════
  // TEST 10: needsRehash — MD5 hash (legacy) always returns true
  // ═══════════════════════════════════════════════════════════════
  it('needsRehash() should return true for a legacy MD5 hash (32 hex chars)', () => {
    const md5Hash = crypto.createHash('md5').update('somepass').digest('hex');

    expect(md5Hash.length).toBe(32);

    const result = service.needsRehash(md5Hash);

    expect(result).toBe(true);
  });

  // ═══════════════════════════════════════════════════════════════
  // TEST 11: secureCompare — equal strings → true, different → false
  // ═══════════════════════════════════════════════════════════════
  it('secureCompare() should return true for equal strings and false for different strings', () => {
    const tokenA = 'abc123def456';
    const tokenB = 'abc123def456';
    const tokenC = 'xyz999ghi000';

    expect(service.secureCompare(tokenA, tokenB)).toBe(true);
    expect(service.secureCompare(tokenA, tokenC)).toBe(false);
  });

  // ═══════════════════════════════════════════════════════════════
  // TEST 12: validatePasswordStrength — weak throws, strong passes
  // ═══════════════════════════════════════════════════════════════
  it('validatePasswordStrength() should throw on weak password and pass on strong password', () => {
    // Weak password: too short, no uppercase, no digits
    expect(() => service.validatePasswordStrength('abc')).toThrow(
      BadRequestException,
    );

    // Strong password: 8+ chars, uppercase, lowercase, digit
    expect(() => service.validatePasswordStrength('Test1234!')).not.toThrow();
  });
});
