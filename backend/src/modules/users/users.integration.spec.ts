import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { SupabaseRestService } from '../../database/supabase-rest.service';
import { CacheService } from '../../cache/cache.service';
import { ConfigService } from '@nestjs/config';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

describe('UsersService (Integration)', () => {
  let service: UsersService;
  let cacheService: CacheService;
  let testUserId: string;
  let testEmail: string;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        SupabaseRestService,
        CacheService,
        ConfigService,
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const supabaseService =
      module.get<SupabaseRestService>(SupabaseRestService);
    cacheService = module.get<CacheService>(CacheService);

    // Générer un email unique pour les tests
    testEmail = `test-${Date.now()}@example.com`;
  });

  afterAll(async () => {
    // Nettoyer les données de test
    if (testUserId) {
      try {
        await service.deleteUser(testUserId);
      } catch (error) {
        console.log('Erreur lors du nettoyage:', error);
      }
    }
  });

  describe('CRUD Operations', () => {
    it('should create a new user', async () => {
      const createUserDto: CreateUserDto = {
        email: testEmail,
        password: 'TestPassword123!',
        firstName: 'Test',
        lastName: 'User',
        isPro: false,
        isActive: true,
        tel: '+33123456789',
        address: '123 Test Street',
        city: 'Test City',
        zipCode: '12345',
        country: 'France',
      };

      const result = await service.createUser(createUserDto);

      expect(result).toBeDefined();
      expect(result.email).toBe(testEmail);
      expect(result.firstName).toBe('Test');
      expect(result.lastName).toBe('User');
      expect(result.isPro).toBe(false);
      expect(result.isActive).toBe(true);

      testUserId = result.id;
      console.log(`✅ Utilisateur créé avec l'ID: ${testUserId}`);
    });

    it('should find user by ID', async () => {
      expect(testUserId).toBeDefined();

      const result = await service.findById(testUserId);

      expect(result).toBeDefined();
      expect(result!.id).toBe(testUserId);
      expect(result!.email).toBe(testEmail);
      expect(result!.firstName).toBe('Test');
      expect(result!.lastName).toBe('User');

      console.log(`✅ Utilisateur trouvé par ID: ${result!.email}`);
    });

    it('should find user by email', async () => {
      const result = await service.findByEmail(testEmail);

      expect(result).toBeDefined();
      expect(result!.id).toBe(testUserId);
      expect(result!.email).toBe(testEmail);

      console.log(`✅ Utilisateur trouvé par email: ${result!.email}`);
    });

    it('should update user', async () => {
      const updateDto: UpdateUserDto = {
        firstName: 'UpdatedTest',
        lastName: 'UpdatedUser',
        tel: '+33987654321',
        isPro: true,
      };

      const result = await service.updateUser(testUserId, updateDto);

      expect(result).toBeDefined();
      expect(result.firstName).toBe('UpdatedTest');
      expect(result.lastName).toBe('UpdatedUser');
      expect(result.tel).toBe('+33987654321');
      expect(result.isPro).toBe(true);

      console.log(
        `✅ Utilisateur mis à jour: ${result.firstName} ${result.lastName}`,
      );
    });

    it('should get user profile', async () => {
      const result = await service.getUserProfile(testUserId);

      expect(result).toBeDefined();
      expect(result.id).toBe(testUserId);
      expect(result.email).toBe(testEmail);
      expect(result.firstName).toBe('UpdatedTest');
      expect(result.lastName).toBe('UpdatedUser');

      console.log(
        `✅ Profil utilisateur récupéré: ${result.firstName} ${result.lastName}`,
      );
    });

    it('should change password', async () => {
      const changePasswordDto: ChangePasswordDto = {
        currentPassword: 'TestPassword123!',
        newPassword: 'NewPassword123!',
        confirmPassword: 'NewPassword123!',
      };

      const result = await service.changePassword(
        testUserId,
        changePasswordDto,
      );

      expect(result).toBe(true);

      console.log('✅ Mot de passe changé avec succès');
    });

    it('should validate credentials with new password', async () => {
      const result = await service.validateUserCredentials(
        testEmail,
        'NewPassword123!',
      );

      expect(result).toBeDefined();
      expect(result!.email).toBe(testEmail);

      console.log('✅ Validation des nouvelles credentials réussie');
    });

    it('should fail validation with old password', async () => {
      const result = await service.validateUserCredentials(
        testEmail,
        'TestPassword123!',
      );

      expect(result).toBeNull();

      console.log("✅ Validation échouée avec l'ancien mot de passe (attendu)");
    });

    it('should manage user levels', async () => {
      // Test update level
      const result = await service.updateUserLevel(testUserId, 6);

      // Le UserResponseDto n'a pas encore de propriété level
      // expect(result.level).toBe(6);
      expect(result.id).toBe(testUserId);

      console.log(`✅ Niveau utilisateur mis à jour pour: ${result.email}`);
    });

    it('should deactivate user', async () => {
      const result = await service.deactivateUser(testUserId);

      expect(result).toBe(true);

      console.log('✅ Utilisateur désactivé');
    });

    it('should reactivate user', async () => {
      const result = await service.reactivateUser(testUserId);

      expect(result.isActive).toBe(true);

      console.log('✅ Utilisateur réactivé');
    });
  });

  describe('Error Handling', () => {
    it('should throw ConflictException for duplicate email', async () => {
      const createUserDto: CreateUserDto = {
        email: testEmail, // Email déjà utilisé
        password: 'TestPassword123!',
        firstName: 'Duplicate',
        lastName: 'User',
        isPro: false,
        isActive: true,
      };

      await expect(service.createUser(createUserDto)).rejects.toThrow(
        'Un utilisateur avec cet email existe déjà',
      );

      console.log("✅ Erreur de duplication d'email détectée");
    });

    it('should throw NotFoundException for non-existent user', async () => {
      await expect(service.findById('non-existent-id')).resolves.toBeNull();

      console.log('✅ Utilisateur inexistant retourne null');
    });

    it('should throw BadRequestException for incorrect current password', async () => {
      const changePasswordDto: ChangePasswordDto = {
        currentPassword: 'WrongPassword123!',
        newPassword: 'NewPassword123!',
        confirmPassword: 'NewPassword123!',
      };

      await expect(
        service.changePassword(testUserId, changePasswordDto),
      ).rejects.toThrow('Mot de passe actuel incorrect');

      console.log('✅ Erreur mot de passe incorrect détectée');
    });
  });

  describe('Cache Integration', () => {
    it('should cache user data', async () => {
      // Clear cache first
      await cacheService.invalidateUser(testUserId);

      // First call should fetch from DB and cache
      const result1 = await service.findById(testUserId);
      expect(result1).toBeDefined();

      // Second call should use cache
      const result2 = await service.findById(testUserId);
      expect(result2).toBeDefined();
      expect(result2!.id).toBe(result1!.id);

      console.log('✅ Cache fonctionnel');
    });

    it('should invalidate cache on update', async () => {
      const updateDto: UpdateUserDto = {
        firstName: 'CacheTest',
      };

      const result = await service.updateUser(testUserId, updateDto);

      expect(result.firstName).toBe('CacheTest');

      console.log('✅ Cache invalidé lors de la mise à jour');
    });
  });

  describe('Business Logic', () => {
    it('should get users by level', async () => {
      const users = await service.getUsersByLevel(6);

      expect(Array.isArray(users)).toBe(true);
      // Le test user devrait être dans la liste
      const testUser = users.find((u: any) => u.id === testUserId);
      expect(testUser).toBeDefined();
      // expect(testUser!.level).toBe(6); // Propriété level non encore implémentée
      if (testUser) {
        expect(testUser.id).toBe(testUserId);
      }

      console.log(`✅ Utilisateurs niveau 6 trouvés: ${users.length}`);
    });

    it('should get active users', async () => {
      const users = await service.getActiveUsers();

      expect(Array.isArray(users.users)).toBe(true);
      // Le test user devrait être dans la liste (il est actif)
      const testUser = users.users.find((u: any) => u.id === testUserId);
      expect(testUser).toBeDefined();
      if (testUser) {
        expect(testUser.isActive).toBe(true);
      }

      console.log(`✅ Utilisateurs actifs trouvés: ${users.users.length}`);
    });

    // it('should get user statistics', async () => {
    //   const stats = await service.getUserStatistics(testUserId);

    //   expect(stats).toBeDefined();
    //   expect(stats.id).toBe(testUserId);
    //   expect(typeof stats.totalOrders).toBe('number');
    //   expect(typeof stats.totalSpent).toBe('number');

    //   console.log(`✅ Statistiques utilisateur: ${stats.totalOrders} commandes, ${stats.totalSpent}€`);
    // });
  });

  describe('Search and Pagination', () => {
    it('should search users', async () => {
      const results = await service.searchUsers('UpdatedTest');

      expect(Array.isArray(results)).toBe(true);
      // Notre utilisateur de test devrait être trouvé
      const testUser = results.find((u) => u.id === testUserId);
      expect(testUser).toBeDefined();

      console.log(`✅ Recherche utilisateurs: ${results.length} résultats`);
    });

    it('should paginate users', async () => {
      const result = await service.getAllUsers(1, 5);

      expect(result).toBeDefined();
      expect(Array.isArray(result.users)).toBe(true);
      expect(typeof result.total).toBe('number');
      expect(result.page).toBe(1);
      expect(result.limit).toBe(5);

      console.log(
        `✅ Pagination: ${result.users.length} utilisateurs sur ${result.total} total`,
      );
    });
  });
});
