import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { SupabaseRestService } from '../../database/supabase-rest.service';
import { CacheService } from '../../cache/cache.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

describe('UsersService', () => {
  let service: UsersService;
  let supabaseService: jest.Mocked<SupabaseRestService>;
  let cacheService: jest.Mocked<CacheService>;

  beforeEach(async () => {
    const mockSupabaseService = {
      getUserById: jest.fn(),
      findUserByEmail: jest.fn(),
      createUser: jest.fn(),
      updateUserProfile: jest.fn(),
      validatePassword: jest.fn(),
      hashPassword: jest.fn(),
      updateUserPassword: jest.fn(),
      findUserById: jest.fn(),
    };

    const mockCacheService = {
      getCachedUser: jest.fn(),
      cacheUser: jest.fn(),
      invalidateUser: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: SupabaseRestService,
          useValue: mockSupabaseService,
        },
        {
          provide: CacheService,
          useValue: mockCacheService,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    supabaseService = module.get(SupabaseRestService);
    cacheService = module.get(CacheService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createUser', () => {
    it('should create a user successfully', async () => {
      const createUserDto: CreateUserDto = {
        email: 'test@example.com',
        password: 'Test123!',
        firstName: 'Test',
        lastName: 'User',
        isPro: false,
        isActive: true,
      };

      const mockUser = {
        cst_id: '1',
        cst_mail: 'test@example.com',
        cst_fname: 'Test',
        cst_name: 'User',
        cst_pswd: 'hashed_password',
        cst_is_pro: '0',
        cst_activ: '1',
      };

      supabaseService.findUserByEmail.mockResolvedValue(null);
      supabaseService.createUser.mockResolvedValue(mockUser);
      cacheService.cacheUser.mockResolvedValue(undefined);

      const result = await service.createUser(createUserDto);

      expect(result).toMatchObject({
        id: '1',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        isPro: false,
        isActive: true,
      });
      expect(supabaseService.createUser).toHaveBeenCalledWith(createUserDto);
    });

    it('should throw ConflictException if user already exists', async () => {
      const createUserDto: CreateUserDto = {
        email: 'existing@example.com',
        password: 'Test123!',
        firstName: 'Test',
        lastName: 'User',
        isPro: false,
        isActive: true,
      };

      const existingUser = {
        cst_id: '1',
        cst_mail: 'existing@example.com',
        cst_fname: 'Test',
        cst_name: 'User',
        cst_pswd: 'hashed_password',
        cst_is_pro: '0',
        cst_activ: '1',
      };

      supabaseService.findUserByEmail.mockResolvedValue(existingUser);

      await expect(service.createUser(createUserDto)).rejects.toThrow('Un utilisateur avec cet email existe déjà');
    });
  });

  describe('changePassword', () => {
    it('should change password successfully', async () => {
      const changePasswordDto: ChangePasswordDto = {
        currentPassword: 'OldPass123!',
        newPassword: 'NewPass123!',
        confirmPassword: 'NewPass123!',
      };

      const mockUser = {
        cst_id: '1',
        cst_mail: 'test@example.com',
        cst_pswd: 'hashedOldPassword',
        cst_is_pro: '0',
        cst_activ: '1',
      };

      supabaseService.findUserById.mockResolvedValue(mockUser);
      supabaseService.validatePassword.mockResolvedValue(true);
      supabaseService.hashPassword.mockResolvedValue('hashedNewPassword');
      supabaseService.updateUserPassword.mockResolvedValue(true);
      cacheService.invalidateUser.mockResolvedValue(undefined);

      const result = await service.changePassword('1', changePasswordDto);

      expect(result).toBe(true);
      expect(supabaseService.validatePassword).toHaveBeenCalledWith('OldPass123!', 'hashedOldPassword');
      expect(supabaseService.hashPassword).toHaveBeenCalledWith('NewPass123!');
      expect(supabaseService.updateUserPassword).toHaveBeenCalledWith('test@example.com', 'hashedNewPassword');
    });

    it('should throw BadRequestException for incorrect current password', async () => {
      const changePasswordDto: ChangePasswordDto = {
        currentPassword: 'WrongPass123!',
        newPassword: 'NewPass123!',
        confirmPassword: 'NewPass123!',
      };

      const mockUser = {
        cst_id: '1',
        cst_mail: 'test@example.com',
        cst_pswd: 'hashedOldPassword',
        cst_is_pro: '0',
        cst_activ: '1',
      };

      supabaseService.findUserById.mockResolvedValue(mockUser);
      supabaseService.validatePassword.mockResolvedValue(false);

      await expect(service.changePassword('1', changePasswordDto)).rejects.toThrow('Mot de passe actuel incorrect');
    });
  });

  describe('getUserProfile', () => {
    it('should return user profile', async () => {
      const mockUser = {
        cst_id: '1',
        cst_mail: 'test@example.com',
        cst_fname: 'Test',
        cst_name: 'User',
        cst_pswd: 'hashed_password',
        cst_is_pro: '0',
        cst_activ: '1',
        cst_level: 2,
      };

      supabaseService.findUserById.mockResolvedValue(mockUser);

      const result = await service.getUserProfile('1');

      expect(result).toMatchObject({
        id: '1',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        isPro: false,
        isActive: true,
        level: 2,
      });
    });

    it('should throw NotFoundException if user not found', async () => {
      supabaseService.findUserById.mockResolvedValue(null);

      await expect(service.getUserProfile('999')).rejects.toThrow('Utilisateur non trouvé');
    });
  });

  describe('findById', () => {
    it('should return user from cache if available', async () => {
      const cachedUser = {
        id: '1',
        email: 'cached@example.com',
        firstName: 'Cached',
        lastName: 'User',
        isPro: false,
        isActive: true,
      };

      cacheService.getCachedUser.mockResolvedValue(cachedUser);

      const result = await service.findById('1');

      expect(result).toEqual(cachedUser);
      expect(supabaseService.getUserById).not.toHaveBeenCalled();
    });

    it('should fetch from database if not in cache', async () => {
      const mockUser = {
        cst_id: '1',
        cst_mail: 'test@example.com',
        cst_fname: 'Test',
        cst_name: 'User',
        cst_pswd: 'hashed_password',
        cst_is_pro: '0',
        cst_activ: '1',
      };

      cacheService.getCachedUser.mockResolvedValue(null);
      supabaseService.getUserById.mockResolvedValue(mockUser);
      cacheService.cacheUser.mockResolvedValue(undefined);

      const result = await service.findById('1');

      expect(result).toMatchObject({
        id: '1',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        isPro: false,
        isActive: true,
      });
      expect(cacheService.cacheUser).toHaveBeenCalledWith('1', expect.any(Object));
    });

    it('should return null if user not found', async () => {
      cacheService.getCachedUser.mockResolvedValue(null);
      supabaseService.getUserById.mockResolvedValue(null);

      const result = await service.findById('999');

      expect(result).toBeNull();
    });
  });

  describe('findByEmail', () => {
    it('should find user by email', async () => {
      const mockUser = {
        cst_id: '1',
        cst_mail: 'test@example.com',
        cst_fname: 'Test',
        cst_name: 'User',
        cst_pswd: 'hashed_password',
        cst_is_pro: '0',
        cst_activ: '1',
      };

      supabaseService.findUserByEmail.mockResolvedValue(mockUser);

      const result = await service.findByEmail('test@example.com');

      expect(result).toMatchObject({
        id: '1',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        isPro: false,
        isActive: true,
      });
    });

    it('should return null if user not found by email', async () => {
      supabaseService.findUserByEmail.mockResolvedValue(null);

      const result = await service.findByEmail('notfound@example.com');

      expect(result).toBeNull();
    });
  });

  describe('updateUser', () => {
    it('should update user successfully', async () => {
      const updateDto = {
        firstName: 'Updated',
        lastName: 'Name',
      };

      const existingUser = {
        id: '1',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        isPro: false,
        isActive: true,
      };

      const updatedUser = {
        cst_id: '1',
        cst_mail: 'test@example.com',
        cst_fname: 'Updated',
        cst_name: 'Name',
        cst_pswd: 'hashed_password',
        cst_is_pro: '0',
        cst_activ: '1',
      };

      // Mock findById pour vérifier que l'utilisateur existe
      cacheService.getCachedUser.mockResolvedValue(existingUser);
      supabaseService.updateUserProfile.mockResolvedValue(updatedUser);
      cacheService.cacheUser.mockResolvedValue(undefined);

      const result = await service.updateUser('1', updateDto);

      expect(result).toMatchObject({
        id: '1',
        email: 'test@example.com',
        firstName: 'Updated',
        lastName: 'Name',
        isPro: false,
        isActive: true,
      });
      expect(supabaseService.updateUserProfile).toHaveBeenCalledWith('1', updateDto);
    });

    it('should throw NotFoundException if user not found', async () => {
      const updateDto = { firstName: 'Updated' };

      cacheService.getCachedUser.mockResolvedValue(null);
      supabaseService.getUserById.mockResolvedValue(null);

      await expect(service.updateUser('999', updateDto)).rejects.toThrow('Utilisateur non trouvé');
    });

    it('should throw ConflictException if email already exists', async () => {
      const updateDto = { email: 'existing@example.com' };

      const existingUser = {
        id: '1',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        isPro: false,
        isActive: true,
      };

      const emailOwner = {
        cst_id: '2',
        cst_mail: 'existing@example.com',
        cst_fname: 'Other',
        cst_name: 'User',
        cst_pswd: 'hashed_password',
        cst_is_pro: '0',
        cst_activ: '1',
      };

      cacheService.getCachedUser.mockResolvedValue(existingUser);
      supabaseService.findUserByEmail.mockResolvedValue(emailOwner);

      await expect(service.updateUser('1', updateDto)).rejects.toThrow('Cet email est déjà utilisé par un autre utilisateur');
    });
  });

  describe('deleteUser', () => {
    it('should deactivate user (soft delete)', async () => {
      const existingUser = {
        id: '1',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        isPro: false,
        isActive: true,
      };

      const deactivatedUser = {
        cst_id: '1',
        cst_mail: 'test@example.com',
        cst_fname: 'Test',
        cst_name: 'User',
        cst_pswd: 'hashed_password',
        cst_is_pro: '0',
        cst_activ: '0',
      };

      cacheService.getCachedUser.mockResolvedValue(existingUser);
      supabaseService.updateUserProfile.mockResolvedValue(deactivatedUser);
      cacheService.cacheUser.mockResolvedValue(undefined);
      cacheService.invalidateUser.mockResolvedValue(undefined);

      const result = await service.deleteUser('1');

      expect(result).toBe(true);
      expect(cacheService.invalidateUser).toHaveBeenCalledWith('1');
    });

    it('should throw NotFoundException if user not found', async () => {
      cacheService.getCachedUser.mockResolvedValue(null);
      supabaseService.getUserById.mockResolvedValue(null);

      await expect(service.deleteUser('999')).rejects.toThrow('Utilisateur non trouvé');
    });
  });

  describe('validateUserCredentials', () => {
    it('should validate correct credentials', async () => {
      const mockUser = {
        cst_id: '1',
        cst_mail: 'test@example.com',
        cst_fname: 'Test',
        cst_name: 'User',
        cst_pswd: 'hashedPassword',
        cst_is_pro: '0',
        cst_activ: '1',
      };

      supabaseService.findUserByEmail.mockResolvedValue(mockUser);
      supabaseService.validatePassword.mockResolvedValue(true);

      const result = await service.validateUserCredentials('test@example.com', 'correctPassword');

      expect(result).toMatchObject({
        id: '1',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        isPro: false,
        isActive: true,
      });
    });

    it('should return null for incorrect password', async () => {
      const mockUser = {
        cst_id: '1',
        cst_mail: 'test@example.com',
        cst_fname: 'Test',
        cst_name: 'User',
        cst_pswd: 'hashedPassword',
        cst_is_pro: '0',
        cst_activ: '1',
      };

      supabaseService.findUserByEmail.mockResolvedValue(mockUser);
      supabaseService.validatePassword.mockResolvedValue(false);

      const result = await service.validateUserCredentials('test@example.com', 'wrongPassword');

      expect(result).toBeNull();
    });

    it('should return null for non-existent user', async () => {
      supabaseService.findUserByEmail.mockResolvedValue(null);

      const result = await service.validateUserCredentials('notfound@example.com', 'password');

      expect(result).toBeNull();
    });
  });

  describe('getAllUsers', () => {
    it('should return paginated users list', async () => {
      const result = await service.getAllUsers(1, 10);

      expect(result).toMatchObject({
        users: [],
        total: 0,
        page: 1,
        limit: 10,
      });
    });
  });

  describe('searchUsers', () => {
    it('should return empty array for search', async () => {
      const result = await service.searchUsers('test');

      expect(result).toEqual([]);
    });
  });
});
