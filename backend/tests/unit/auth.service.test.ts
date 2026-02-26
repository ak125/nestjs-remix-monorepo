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
import { UserDataConsolidatedService } from '../../src/modules/users/services/user-data-consolidated.service';
import { CacheService } from '../../src/cache/cache.service';
import { PasswordCryptoService } from '../../src/shared/crypto/password-crypto.service';

// ─── Shared mock fixtures (User shape, not raw DB columns) ──────────────────
const mockUserData = {
  id: 'user-123',
  email: 'test@example.com',
  firstName: 'John',
  lastName: 'Doe',
  isActive: true,
  isPro: false,
  level: 1,
};

// findByEmailForAuth returns { user, passwordHash }
const mockAuthResult = {
  user: mockUserData,
  passwordHash: '$2b$10$hashedPasswordHere',
};

describe('AuthService', () => {
  let service: AuthService;

  // ─── Mock implementations ──────────────────────────────────────────────────
  const mockJwtService = {
    sign: jest.fn(),
    verify: jest.fn(),
  };

  const mockUserService = {
    findByEmailForAuth: jest.fn(),
    findAdminByEmailForAuth: jest.fn(),
    findById: jest.fn(),
    findByIdForAuth: jest.fn(),
    setPasswordHash: jest.fn(),
    update: jest.fn(),
    create: jest.fn(),
    findByEmail: jest.fn(),
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
    mockUserService.findAdminByEmailForAuth.mockResolvedValue(null);

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
        { provide: UserDataConsolidatedService, useValue: mockUserService },
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
    mockUserService.findByEmailForAuth.mockResolvedValue(mockAuthResult);
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
    mockUserService.findByEmailForAuth.mockResolvedValue(mockAuthResult);
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
    mockUserService.findByEmailForAuth.mockResolvedValue(null);
    mockUserService.findAdminByEmailForAuth.mockResolvedValue(null);

    const result = await service.authenticateUser(
      'unknown@example.com',
      'anyPassword',
    );

    expect(result).toBeNull();
    // validatePassword should never be called if user doesn't exist
    expect(mockPasswordCrypto.validatePassword).not.toHaveBeenCalled();
  });

  // ═══════════════════════════════════════════════════════════════
  // TEST 4: authenticateUser — inactive user → throws UnauthorizedException
  // ═══════════════════════════════════════════════════════════════
  it('authenticateUser() should throw UnauthorizedException when user account is inactive', async () => {
    const inactiveAuthResult = {
      user: { ...mockUserData, isActive: false },
      passwordHash: '$2b$10$hashedPasswordHere',
    };
    mockUserService.findByEmailForAuth.mockResolvedValue(inactiveAuthResult);
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
    const legacyAuthResult = {
      user: mockUserData,
      passwordHash: 'im10tech7legacy', // legacy non-bcrypt hash
    };
    mockUserService.findByEmailForAuth.mockResolvedValue(legacyAuthResult);
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
    mockUserService.findByEmailForAuth.mockResolvedValue(mockAuthResult);
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
    expect(mockUserService.findByEmailForAuth).not.toHaveBeenCalled();
  });

  // ═══════════════════════════════════════════════════════════════
  // TEST 8: validateToken — valid JWT → returns AuthUser
  // ═══════════════════════════════════════════════════════════════
  it('validateToken() should return AuthUser when JWT is valid', async () => {
    mockJwtService.verify.mockReturnValue({ sub: 'user-123', email: 'test@example.com' });
    // findById returns User directly (not wrapped)
    mockUserService.findById.mockResolvedValue(mockUserData);

    const result = await service.validateToken('valid.jwt.token');

    expect(result).not.toBeNull();
    expect(result?.id).toBe('user-123');
    expect(mockJwtService.verify).toHaveBeenCalledWith('valid.jwt.token');
    expect(mockUserService.findById).toHaveBeenCalledWith('user-123');
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
    // findById should never be called when token verification fails
    expect(mockUserService.findById).not.toHaveBeenCalled();
  });

  // ═══════════════════════════════════════════════════════════════
  // TEST 10: isAdmin — level >= 7 → true, level < 7 → false
  // ═══════════════════════════════════════════════════════════════
  it('isAdmin() should return true for level >= 7 and false for level < 7', async () => {
    const adminUser = { ...mockUserData, level: 7 };
    const regularUser = { ...mockUserData, level: 1 };

    // Admin check — findById returns User, getUserById calls mapUserToAuthUser
    mockUserService.findById.mockResolvedValueOnce(adminUser);
    const isAdminResult = await service.isAdmin('admin-user-id');
    expect(isAdminResult).toBe(true);

    // Regular user check
    mockUserService.findById.mockResolvedValueOnce(regularUser);
    const isNotAdminResult = await service.isAdmin('regular-user-id');
    expect(isNotAdminResult).toBe(false);
  });
});
