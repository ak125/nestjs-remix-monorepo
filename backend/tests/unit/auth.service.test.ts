/**
 * AuthService Unit Tests
 *
 * Tests the main authentication orchestrator.
 * 10 tests covering: authenticateUser (5 cases), login (2 cases),
 * validateToken (2 cases), isAdmin (1 case).
 *
 * @see backend/src/auth/auth.service.ts
 */
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from '../../src/auth/auth.service';
import { UserService } from '../../src/database/services/user.service';
import { CacheService } from '../../src/cache/cache.service';
import { PasswordCryptoService } from '../../src/shared/crypto/password-crypto.service';

// ─── Shared mock user fixture ─────────────────────────────────────────────────
const mockUser = {
  cst_id: 'user-123',
  cst_mail: 'test@example.com',
  cst_pswd: '$2b$10$hashedPasswordHere',
  cst_fname: 'John',
  cst_name: 'Doe',
  cst_activ: '1',
  cst_level: 1,
  cst_is_pro: '0',
};

describe('AuthService', () => {
  let service: AuthService;

  // ─── Mock implementations ──────────────────────────────────────────────────
  const mockJwtService = {
    sign: jest.fn(),
    verify: jest.fn(),
  };

  const mockUserService = {
    findUserByEmail: jest.fn(),
    findAdminByEmail: jest.fn(),
    getUserById: jest.fn(),
    updateUserPassword: jest.fn(),
    updateUser: jest.fn(),
    createUser: jest.fn(),
  };

  const mockCacheService = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    delete: jest.fn(),
  };

  const mockPasswordCrypto = {
    validatePassword: jest.fn(),
    hashPassword: jest.fn(),
    needsRehash: jest.fn(),
    upgradeHashIfNeeded: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    // Default: no admin found (most tests are for regular customers)
    mockUserService.findAdminByEmail.mockResolvedValue(null);

    // Default: needsRehash returns false (no upgrade needed)
    mockPasswordCrypto.needsRehash.mockReturnValue(false);

    // Default: cache get returns null (no prior attempts)
    mockCacheService.get.mockResolvedValue(null);

    // Default: cache set/del succeed silently
    mockCacheService.set.mockResolvedValue(undefined);
    mockCacheService.del.mockResolvedValue(undefined);
    mockCacheService.delete.mockResolvedValue(undefined);

    // Default: upgradeHashIfNeeded resolves (async no-op)
    mockPasswordCrypto.upgradeHashIfNeeded.mockResolvedValue(false);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: JwtService, useValue: mockJwtService },
        { provide: UserService, useValue: mockUserService },
        { provide: CacheService, useValue: mockCacheService },
        { provide: PasswordCryptoService, useValue: mockPasswordCrypto },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  // ═══════════════════════════════════════════════════════════════
  // TEST 1: authenticateUser — valid email + valid password → returns AuthUser
  // ═══════════════════════════════════════════════════════════════
  it('authenticateUser() should return AuthUser when email and password are valid', async () => {
    mockUserService.findUserByEmail.mockResolvedValue(mockUser);
    mockPasswordCrypto.validatePassword.mockResolvedValue({
      isValid: true,
      format: 'bcrypt',
    });

    const result = await service.authenticateUser(
      'test@example.com',
      'correctPassword',
    );

    expect(result).not.toBeNull();
    expect(result?.id).toBe('user-123');
    expect(result?.email).toBe('test@example.com');
    expect(result?.firstName).toBe('John');
    expect(result?.lastName).toBe('Doe');
    expect(result?.isActive).toBe(true);
    expect(result?.isAdmin).toBe(false);
  });

  // ═══════════════════════════════════════════════════════════════
  // TEST 2: authenticateUser — valid email + wrong password → returns null
  // ═══════════════════════════════════════════════════════════════
  it('authenticateUser() should return null when password is invalid', async () => {
    mockUserService.findUserByEmail.mockResolvedValue(mockUser);
    mockPasswordCrypto.validatePassword.mockResolvedValue({
      isValid: false,
      format: 'bcrypt',
    });

    const result = await service.authenticateUser(
      'test@example.com',
      'wrongPassword',
    );

    expect(result).toBeNull();
  });

  // ═══════════════════════════════════════════════════════════════
  // TEST 3: authenticateUser — user not found in either table → returns null
  // ═══════════════════════════════════════════════════════════════
  it('authenticateUser() should return null when user is not found in any table', async () => {
    mockUserService.findUserByEmail.mockResolvedValue(null);
    mockUserService.findAdminByEmail.mockResolvedValue(null);

    const result = await service.authenticateUser(
      'unknown@example.com',
      'anyPassword',
    );

    expect(result).toBeNull();
    // validatePassword should never be called if user doesn't exist
    expect(mockPasswordCrypto.validatePassword).not.toHaveBeenCalled();
  });

  // ═══════════════════════════════════════════════════════════════
  // TEST 4: authenticateUser — inactive user (cst_activ !== '1') → throws UnauthorizedException
  // ═══════════════════════════════════════════════════════════════
  it('authenticateUser() should throw UnauthorizedException when user account is inactive', async () => {
    const inactiveUser = { ...mockUser, cst_activ: '0' };
    mockUserService.findUserByEmail.mockResolvedValue(inactiveUser);
    mockPasswordCrypto.validatePassword.mockResolvedValue({
      isValid: true,
      format: 'bcrypt',
    });

    await expect(
      service.authenticateUser('test@example.com', 'correctPassword'),
    ).rejects.toThrow(UnauthorizedException);
  });

  // ═══════════════════════════════════════════════════════════════
  // TEST 5: authenticateUser — legacy hash triggers password upgrade
  // ═══════════════════════════════════════════════════════════════
  it('authenticateUser() should trigger password upgrade when legacy hash is detected', async () => {
    const legacyUser = {
      ...mockUser,
      cst_pswd: 'im10tech7legacy', // legacy non-bcrypt hash
    };
    mockUserService.findUserByEmail.mockResolvedValue(legacyUser);
    mockPasswordCrypto.validatePassword.mockResolvedValue({
      isValid: true,
      format: 'md5-crypt',
    });
    // needsRehash returns true → upgrade path is taken
    mockPasswordCrypto.needsRehash.mockReturnValue(true);
    mockPasswordCrypto.upgradeHashIfNeeded.mockResolvedValue(true);

    const result = await service.authenticateUser(
      'test@example.com',
      'legacyPassword',
    );

    // Authentication still succeeds
    expect(result).not.toBeNull();
    expect(result?.id).toBe('user-123');

    // upgradeHashIfNeeded should have been called with the user id and password
    expect(mockPasswordCrypto.upgradeHashIfNeeded).toHaveBeenCalledWith(
      'user-123',
      'legacyPassword',
      'im10tech7legacy',
      expect.any(Function), // the update callback
    );
  });

  // ═══════════════════════════════════════════════════════════════
  // TEST 6: login — successful login → returns { user, access_token, expires_in }
  // ═══════════════════════════════════════════════════════════════
  it('login() should return access_token and user on successful login', async () => {
    mockUserService.findUserByEmail.mockResolvedValue(mockUser);
    mockPasswordCrypto.validatePassword.mockResolvedValue({
      isValid: true,
      format: 'bcrypt',
    });
    // No prior login attempts
    mockCacheService.get.mockResolvedValue(null);
    mockJwtService.sign.mockReturnValue('jwt-token-xyz');

    const result = await service.login(
      'test@example.com',
      'correctPassword',
      '127.0.0.1',
    );

    expect(result.access_token).toBe('jwt-token-xyz');
    expect(result.expires_in).toBe(3600 * 24 * 7); // 7 days
    expect(result.user.id).toBe('user-123');
    expect(result.user.email).toBe('test@example.com');

    // JWT sign should have been called with the correct payload shape
    expect(mockJwtService.sign).toHaveBeenCalledWith(
      expect.objectContaining({
        sub: 'user-123',
        email: 'test@example.com',
      }),
    );

    // Session should have been stored in Redis
    expect(mockCacheService.set).toHaveBeenCalledWith(
      expect.stringMatching(/^session:/),
      expect.any(String),
      604800, // 7 days in seconds
    );
  });

  // ═══════════════════════════════════════════════════════════════
  // TEST 7: login — rate limiting: >= 5 attempts → throws BadRequestException
  // ═══════════════════════════════════════════════════════════════
  it('login() should throw BadRequestException when attempt count reaches the limit of 5', async () => {
    // The rate-limit check uses the key `login_attempts:${email}:${ip}`
    // checkLoginAttempts returns 5 → attempts >= 5 → blocked
    mockCacheService.get.mockResolvedValue(5);

    await expect(
      service.login('test@example.com', 'anyPassword', '10.0.0.1'),
    ).rejects.toThrow(BadRequestException);

    // Authentication should never be attempted when rate-limited
    expect(mockUserService.findUserByEmail).not.toHaveBeenCalled();
  });

  // ═══════════════════════════════════════════════════════════════
  // TEST 8: validateToken — valid JWT → returns AuthUser
  // ═══════════════════════════════════════════════════════════════
  it('validateToken() should return AuthUser when JWT is valid', async () => {
    mockJwtService.verify.mockReturnValue({ sub: 'user-123', email: 'test@example.com' });
    mockUserService.getUserById.mockResolvedValue(mockUser);

    const result = await service.validateToken('valid.jwt.token');

    expect(result).not.toBeNull();
    expect(result?.id).toBe('user-123');
    expect(mockJwtService.verify).toHaveBeenCalledWith('valid.jwt.token');
    expect(mockUserService.getUserById).toHaveBeenCalledWith('user-123');
  });

  // ═══════════════════════════════════════════════════════════════
  // TEST 9: validateToken — expired/invalid JWT → returns null
  // ═══════════════════════════════════════════════════════════════
  it('validateToken() should return null when JWT is invalid or expired', async () => {
    mockJwtService.verify.mockImplementation(() => {
      throw new Error('jwt expired');
    });

    const result = await service.validateToken('expired.or.invalid.token');

    expect(result).toBeNull();
    // getUserById should never be called when token verification fails
    expect(mockUserService.getUserById).not.toHaveBeenCalled();
  });

  // ═══════════════════════════════════════════════════════════════
  // TEST 10: isAdmin — level >= 7 → true, level < 7 → false
  // ═══════════════════════════════════════════════════════════════
  it('isAdmin() should return true for level >= 7 and false for level < 7', async () => {
    const adminUser = { ...mockUser, cst_level: 7 };
    const regularUser = { ...mockUser, cst_level: 1 };

    // Admin check
    mockUserService.getUserById.mockResolvedValueOnce(adminUser);
    const isAdminResult = await service.isAdmin('admin-user-id');
    expect(isAdminResult).toBe(true);

    // Regular user check
    mockUserService.getUserById.mockResolvedValueOnce(regularUser);
    const isNotAdminResult = await service.isAdmin('regular-user-id');
    expect(isNotAdminResult).toBe(false);
  });
});
