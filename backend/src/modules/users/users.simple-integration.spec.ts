import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { SupabaseRestService } from '../../database/supabase-rest.service';
import { CacheService } from '../../cache/cache.service';
import { ConfigService } from '@nestjs/config';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

describe('UsersService (Simple Integration)', () => {
  let service: UsersService;
  let supabaseService: SupabaseRestService;
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
    supabaseService = module.get<SupabaseRestService>(SupabaseRestService);

    // Générer un email unique pour les tests
    testEmail = `integration-test-${Date.now()}@example.com`;
  });

  afterAll(async () => {
    // Nettoyer les données de test
    if (testUserId) {
      try {
        await service.deleteUser(testUserId);
        console.log(`🧹 Utilisateur de test supprimé: ${testUserId}`);
      } catch (error) {
        console.log('Erreur lors du nettoyage:', error);
      }
    }
  });

  describe('CRUD Operations with Real Database', () => {
    it('should create a new user in real database', async () => {
      console.log(`🔨 Création d'un utilisateur avec l'email: ${testEmail}`);
      
      const createUserDto: CreateUserDto = {
        email: testEmail,
        password: 'TestPassword123!',
        firstName: 'IntegrationTest',
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
      expect(result.firstName).toBe('IntegrationTest');
      expect(result.lastName).toBe('User');
      expect(result.isPro).toBe(false);
      expect(result.isActive).toBe(true);
      expect(result.tel).toBe('+33123456789');
      expect(result.address).toBe('123 Test Street');
      expect(result.city).toBe('Test City');
      expect(result.zipCode).toBe('12345');
      expect(result.country).toBe('France');

      testUserId = result.id;
      console.log(`✅ Utilisateur créé avec succès - ID: ${testUserId}`);
      console.log(`📧 Email: ${result.email}`);
      console.log(`👤 Nom: ${result.firstName} ${result.lastName}`);
      console.log(`📍 Adresse: ${result.address}, ${result.zipCode} ${result.city}`);
    });

    it('should find the created user by ID', async () => {
      expect(testUserId).toBeDefined();
      console.log(`🔍 Recherche utilisateur par ID: ${testUserId}`);

      const result = await service.findById(testUserId);

      expect(result).toBeDefined();
      expect(result!.id).toBe(testUserId);
      expect(result!.email).toBe(testEmail);
      expect(result!.firstName).toBe('IntegrationTest');
      expect(result!.lastName).toBe('User');

      console.log(`✅ Utilisateur trouvé par ID`);
      console.log(`📧 Email: ${result!.email}`);
      console.log(`👤 Nom: ${result!.firstName} ${result!.lastName}`);
    });

    it('should find the created user by email', async () => {
      console.log(`🔍 Recherche utilisateur par email: ${testEmail}`);

      const result = await service.findByEmail(testEmail);

      expect(result).toBeDefined();
      expect(result!.id).toBe(testUserId);
      expect(result!.email).toBe(testEmail);

      console.log(`✅ Utilisateur trouvé par email`);
      console.log(`🆔 ID: ${result!.id}`);
    });

    it('should update the user information', async () => {
      console.log(`🔧 Mise à jour utilisateur: ${testUserId}`);
      
      const updateDto: UpdateUserDto = {
        firstName: 'UpdatedIntegration',
        lastName: 'UpdatedUser',
        tel: '+33987654321',
        isPro: true,
        city: 'Updated City',
      };

      const result = await service.updateUser(testUserId, updateDto);

      expect(result).toBeDefined();
      expect(result.firstName).toBe('UpdatedIntegration');
      expect(result.lastName).toBe('UpdatedUser');
      expect(result.tel).toBe('+33987654321');
      expect(result.isPro).toBe(true);
      expect(result.city).toBe('Updated City');

      console.log(`✅ Utilisateur mis à jour avec succès`);
      console.log(`👤 Nouveau nom: ${result.firstName} ${result.lastName}`);
      console.log(`📞 Nouveau téléphone: ${result.tel}`);
      console.log(`🏢 Statut Pro: ${result.isPro}`);
    });

    it('should change user password', async () => {
      console.log(`🔐 Changement de mot de passe pour: ${testUserId}`);
      
      const changePasswordDto: ChangePasswordDto = {
        currentPassword: 'TestPassword123!',
        newPassword: 'NewSecurePassword123!',
        confirmPassword: 'NewSecurePassword123!',
      };

      const result = await service.changePassword(testUserId, changePasswordDto);

      expect(result).toBe(true);

      console.log('✅ Mot de passe changé avec succès');
    });

    it('should validate credentials with new password', async () => {
      console.log(`🔓 Validation des nouvelles credentials pour: ${testEmail}`);
      
      const result = await service.validateUserCredentials(testEmail, 'NewSecurePassword123!');

      expect(result).toBeDefined();
      expect(result!.email).toBe(testEmail);
      expect(result!.firstName).toBe('UpdatedIntegration');

      console.log('✅ Validation réussie avec le nouveau mot de passe');
    });

    it('should fail validation with old password', async () => {
      console.log(`❌ Test validation avec ancien mot de passe`);
      
      const result = await service.validateUserCredentials(testEmail, 'TestPassword123!');

      expect(result).toBeNull();

      console.log('✅ Validation échouée avec l\'ancien mot de passe (comportement attendu)');
    });

    it('should get all users (pagination test)', async () => {
      console.log(`📄 Test de pagination des utilisateurs`);
      
      const result = await service.getAllUsers(1, 5);

      expect(result).toBeDefined();
      expect(Array.isArray(result.users)).toBe(true);
      expect(typeof result.total).toBe('number');
      expect(result.page).toBe(1);
      expect(result.limit).toBe(5);

      console.log(`✅ Pagination: page ${result.page}, limite ${result.limit}`);
      console.log(`📊 ${result.users.length} utilisateurs retournés sur ${result.total} total`);
    });

    it('should search users', async () => {
      console.log(`🔍 Test de recherche d'utilisateurs`);
      
      const result = await service.searchUsers('UpdatedIntegration');

      expect(Array.isArray(result)).toBe(true);

      console.log(`✅ Recherche terminée: ${result.length} résultats`);
    });
  });

  describe('Error Handling with Real Database', () => {
    it('should reject duplicate email creation', async () => {
      console.log(`❌ Test de création avec email dupliqué: ${testEmail}`);
      
      const createUserDto: CreateUserDto = {
        email: testEmail, // Email déjà utilisé
        password: 'TestPassword123!',
        firstName: 'Duplicate',
        lastName: 'User',
        isPro: false,
        isActive: true,
      };

      await expect(service.createUser(createUserDto))
        .rejects.toThrow('Un utilisateur avec cet email existe déjà');

      console.log('✅ Erreur de duplication d\'email correctement détectée');
    });

    it('should return null for non-existent user', async () => {
      console.log(`❌ Test avec utilisateur inexistant`);
      
      const result = await service.findById('non-existent-id-12345');

      expect(result).toBeNull();

      console.log('✅ Utilisateur inexistant retourne null (comportement attendu)');
    });

    it('should fail password change with wrong current password', async () => {
      console.log(`❌ Test changement mot de passe avec mauvais mot de passe actuel`);
      
      const changePasswordDto: ChangePasswordDto = {
        currentPassword: 'WrongCurrentPassword123!',
        newPassword: 'NewPassword123!',
        confirmPassword: 'NewPassword123!',
      };

      await expect(service.changePassword(testUserId, changePasswordDto))
        .rejects.toThrow('Mot de passe actuel incorrect');

      console.log('✅ Erreur mot de passe incorrect correctement détectée');
    });
  });

  describe('Database Connection Test', () => {
    it('should connect to Supabase successfully', async () => {
      console.log(`🔗 Test de connexion à Supabase`);
      
      const isConnected = await supabaseService.testConnection();

      expect(isConnected).toBe(true);

      console.log('✅ Connexion Supabase fonctionnelle');
    });
  });
});
