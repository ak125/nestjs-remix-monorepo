import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException, ConflictException } from '@nestjs/common';
import { AuthService } from '../auth.service';
import { PrismaService } from '../../prisma/prisma.service';
import * as bcrypt from 'bcryptjs';

// Mock bcrypt
jest.mock('bcryptjs');
const mockedBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

describe('AuthService', () => {
  let service: AuthService;
  let prismaService: PrismaService;
  let jwtService: JwtService;

  const mockUser = {
    id: 1,
    email: 'test@example.com',
    password: 'hashedPassword',
    firstName: 'John',
    lastName: 'Doe',
    civility: 'M',
    phone: '+33123456789',
    isActive: true,
    role: 'USER',
    verificationToken: null,
    resetPasswordToken: null,
    resetPasswordExpiry: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockPrismaService = {
    customer: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockJwtService = {
    sign: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prismaService = module.get<PrismaService>(PrismaService);
    jwtService = module.get<JwtService>(JwtService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('validateUser', () => {
    it('should return user data when credentials are valid', async () => {
      mockPrismaService.customer.findUnique.mockResolvedValue(mockUser);
      mockedBcrypt.compare.mockResolvedValue(true as never);

      const result = await service.validateUser('test@example.com', 'password123');

      expect(result).toEqual({
        id: 1,
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        civility: 'M',
        phone: '+33123456789',
        isActive: true,
        role: 'USER',
        verificationToken: null,
        resetPasswordToken: null,
        resetPasswordExpiry: null,
        createdAt: mockUser.createdAt,
        updatedAt: mockUser.updatedAt,
      });
    });

    it('should return null when user does not exist', async () => {
      mockPrismaService.customer.findUnique.mockResolvedValue(null);

      const result = await service.validateUser('nonexistent@example.com', 'password123');

      expect(result).toBeNull();
    });

    it('should return null when password is invalid', async () => {
      mockPrismaService.customer.findUnique.mockResolvedValue(mockUser);
      mockedBcrypt.compare.mockResolvedValue(false as never);

      const result = await service.validateUser('test@example.com', 'wrongpassword');

      expect(result).toBeNull();
    });

    it('should throw UnauthorizedException when account is inactive', async () => {
      const inactiveUser = { ...mockUser, isActive: false };
      mockPrismaService.customer.findUnique.mockResolvedValue(inactiveUser);
      mockedBcrypt.compare.mockResolvedValue(true as never);

      await expect(
        service.validateUser('test@example.com', 'password123')
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('login', () => {
    it('should return access token and user data', async () => {
      const mockToken = 'jwt-token';
      mockJwtService.sign.mockReturnValue(mockToken);

      const result = await service.login(mockUser);

      expect(result).toEqual({
        access_token: mockToken,
        user: {
          id: 1,
          email: 'test@example.com',
          firstName: 'John',
          lastName: 'Doe',
          civility: 'M',
          isActive: true,
          role: 'USER',
        },
      });

      expect(mockJwtService.sign).toHaveBeenCalledWith({
        sub: 1,
        email: 'test@example.com',
        role: 'USER',
      });
    });
  });

  describe('register', () => {
    const registerDto = {
      email: 'newuser@example.com',
      password: 'Password123!',
      firstName: 'Jane',
      lastName: 'Doe',
      civility: 'MME' as const,
      phone: '+33123456789',
    };

    it('should create a new user successfully', async () => {
      mockPrismaService.customer.findUnique.mockResolvedValue(null);
      mockedBcrypt.hash.mockResolvedValue('hashedPassword123' as never);
      
      const newUser = {
        id: 2,
        ...registerDto,
        password: 'hashedPassword123',
        isActive: false,
        role: 'USER',
        verificationToken: 'verification-token',
        resetPasswordToken: null,
        resetPasswordExpiry: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.customer.create.mockResolvedValue(newUser);

      const result = await service.register(registerDto);

      expect(result.message).toBe('User registered successfully. Please check your email to verify your account.');
      expect(result.user).toEqual({
        id: 2,
        email: 'newuser@example.com',
        firstName: 'Jane',
        lastName: 'Doe',
        civility: 'MME',
        phone: '+33123456789',
        isActive: false,
        role: 'USER',
        resetPasswordToken: null,
        resetPasswordExpiry: null,
        createdAt: newUser.createdAt,
        updatedAt: newUser.updatedAt,
      });
    });

    it('should throw ConflictException when user already exists', async () => {
      mockPrismaService.customer.findUnique.mockResolvedValue(mockUser);

      await expect(service.register(registerDto)).rejects.toThrow(ConflictException);
    });
  });

  describe('getProfile', () => {
    it('should return user profile', async () => {
      const profileData = {
        id: 1,
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        civility: 'M',
        phone: '+33123456789',
        isActive: true,
        role: 'USER',
        createdAt: mockUser.createdAt,
        updatedAt: mockUser.updatedAt,
      };

      mockPrismaService.customer.findUnique.mockResolvedValue(profileData);

      const result = await service.getProfile(1);

      expect(result).toEqual(profileData);
      expect(mockPrismaService.customer.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          civility: true,
          phone: true,
          isActive: true,
          role: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    });
  });
});
