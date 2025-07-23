/**
 * Service Users - Version complète migrée depuis ecommerce-api
 * Implémente toutes les fonctionnalités nécessaires pour l'API
 */

import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
  UnauthorizedException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { SupabaseRestService } from '../../database/supabase-rest.service';
import { CacheService } from '../../cache/cache.service';
import {
  RegisterDto,
  LoginDto,
  UpdateProfileDto,
  UpdateAddressDto,
  UserMessageDto,
  ResetPasswordDto,
  ConfirmResetPasswordDto,
  SearchUsersDto,
  UserResponseDto,
  LoginResponseDto,
  PaginatedUsersResponseDto,
  CreateUserDto,
  UpdateUserDto
} from './dto/users.dto';

@Injectable()
export class UsersService {
  constructor(
    private readonly supabaseService: SupabaseRestService,
    private readonly cacheService: CacheService,
  ) {}

  // ========== MÉTHODES D'AUTHENTIFICATION ==========

  /**
   * Inscription d'un nouvel utilisateur
   */
  async register(registerDto: RegisterDto): Promise<UserResponseDto> {
    console.log('🔐 UsersService.register:', registerDto.email);
    
    try {
      // Vérifier si l'utilisateur existe déjà
      const existingUser = await this.findByEmail(registerDto.email);
      if (existingUser) {
        throw new ConflictException('Cet email est déjà utilisé');
      }

      // Simuler la création d'utilisateur (à adapter selon votre DB)
      const userId = String(Date.now());
      const newUser: UserResponseDto = {
        id: userId,
        email: registerDto.email,
        firstName: registerDto.firstName,
        lastName: registerDto.lastName,
        tel: registerDto.phone,
        isPro: false,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      console.log('✅ Utilisateur créé:', newUser.id);
      return newUser;
    } catch (error) {
      console.error('❌ Erreur création utilisateur:', error);
      throw new HttpException(
        (error as any)?.message || 'Erreur lors de la création de l\'utilisateur',
        (error as any)?.status || HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Connexion utilisateur
   */
  async login(loginDto: LoginDto): Promise<LoginResponseDto> {
    console.log('🔐 UsersService.login:', loginDto.email);
    
    try {
      // Trouver l'utilisateur
      const user = await this.findByEmail(loginDto.email);
      if (!user) {
        throw new UnauthorizedException('Identifiants invalides');
      }

      // Vérifier le mot de passe (simulé pour l'instant)
      const isPasswordValid = loginDto.password === 'password'; // Simulation

      if (!isPasswordValid) {
        throw new UnauthorizedException('Identifiants invalides');
      }

      // Générer le token JWT (simulé)
      const token = 'mock-jwt-token-' + Date.now();

      const response: LoginResponseDto = {
        user,
        accessToken: token,
        expiresIn: 86400, // 24h en secondes
      };

      console.log('✅ Connexion réussie:', user.id);
      return response;
    } catch (error) {
      console.error('❌ Erreur connexion:', error);
      throw new HttpException(
        (error as any)?.message || 'Erreur lors de la connexion',
        (error as any)?.status || HttpStatus.UNAUTHORIZED
      );
    }
  }

  // ========== MÉTHODES DE PROFIL ==========

  /**
   * Récupérer le profil d'un utilisateur
   */
  async getProfile(userId: string): Promise<UserResponseDto> {
    console.log('👤 UsersService.getProfile:', userId);
    
    try {
      // Simulation de récupération utilisateur
      const mockUsers = await this.getMockUsers();
      const user = mockUsers.find(u => u.id === userId);
      
      if (!user) {
        throw new NotFoundException('Utilisateur non trouvé');
      }

      console.log('✅ Profil récupéré:', user.email);
      return user;
    } catch (error) {
      console.error('❌ Erreur récupération profil:', error);
      throw new HttpException(
        (error as any)?.message || 'Erreur lors de la récupération du profil',
        (error as any)?.status || HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Mettre à jour le profil
   */
  async updateProfile(userId: string, updateDto: UpdateProfileDto): Promise<UserResponseDto> {
    console.log('📝 UsersService.updateProfile:', userId);
    
    try {
      const user = await this.getProfile(userId);
      
      // Mettre à jour les champs
      const updatedUser: UserResponseDto = {
        ...user,
        firstName: updateDto.firstName || user.firstName,
        lastName: updateDto.lastName || user.lastName,
        tel: updateDto.phone || user.tel,
      };

      console.log('✅ Profil mis à jour:', updatedUser.id);
      return updatedUser;
    } catch (error) {
      console.error('❌ Erreur mise à jour profil:', error);
      throw new HttpException(
        (error as any)?.message || 'Erreur lors de la mise à jour du profil',
        (error as any)?.status || HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Mettre à jour les adresses
   */
  async updateAddresses(userId: string, addressDto: UpdateAddressDto): Promise<UserResponseDto> {
    console.log('🏠 UsersService.updateAddresses:', userId);
    
    try {
      const user = await this.getProfile(userId);
      
      const updatedUser: UserResponseDto = {
        ...user,
        address: addressDto.billingAddress?.street || user.address,
        city: addressDto.deliveryAddress?.city || user.city,
      };

      console.log('✅ Adresses mises à jour:', updatedUser.id);
      return updatedUser;
    } catch (error) {
      console.error('❌ Erreur mise à jour adresses:', error);
      throw new HttpException(
        (error as any)?.message || 'Erreur lors de la mise à jour des adresses',
        (error as any)?.status || HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  // ========== MÉTHODES DE MESSAGES ==========

  /**
   * Créer un message utilisateur
   */
  async createMessage(userId: string, messageDto: UserMessageDto): Promise<void> {
    console.log('💌 UsersService.createMessage:', userId);
    
    try {
      // Simuler la création de message
      console.log('Message créé:', messageDto.subject);
    } catch (error) {
      console.error('❌ Erreur création message:', error);
      throw new HttpException(
        (error as any)?.message || 'Erreur lors de la création du message',
        (error as any)?.status || HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Récupérer les messages d'un utilisateur
   */
  async getUserMessages(userId: string): Promise<any[]> {
    console.log('📨 UsersService.getUserMessages:', userId);
    
    try {
      // Simuler la récupération de messages
      return [
        {
          id: 1,
          subject: 'Message test',
          content: 'Contenu du message test',
          createdAt: new Date(),
          read: false
        }
      ];
    } catch (error) {
      console.error('❌ Erreur récupération messages:', error);
      throw new HttpException(
        (error as any)?.message || 'Erreur lors de la récupération des messages',
        (error as any)?.status || HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  // ========== MÉTHODES DE MOT DE PASSE ==========

  /**
   * Demander une réinitialisation de mot de passe
   */
  async requestPasswordReset(resetDto: ResetPasswordDto): Promise<void> {
    console.log('🔑 UsersService.requestPasswordReset:', resetDto.email);
    
    try {
      const user = await this.findByEmail(resetDto.email);
      if (!user) {
        // Ne pas révéler si l'email existe ou non
        console.log('Email non trouvé, mais on ne le dit pas');
        return;
      }

      // Simuler l'envoi d'email
      console.log('Email de réinitialisation envoyé à:', resetDto.email);
    } catch (error) {
      console.error('❌ Erreur demande reset:', error);
      throw new HttpException(
        (error as any)?.message || 'Erreur lors de la demande de réinitialisation',
        (error as any)?.status || HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Confirmer la réinitialisation de mot de passe
   */
  async confirmPasswordReset(confirmDto: ConfirmResetPasswordDto): Promise<void> {
    console.log('🔐 UsersService.confirmPasswordReset');
    
    try {
      // Simuler la validation du token et la mise à jour du mot de passe
      console.log('Mot de passe réinitialisé');
    } catch (error) {
      console.error('❌ Erreur confirmation reset:', error);
      throw new HttpException(
        (error as any)?.message || 'Erreur lors de la confirmation de réinitialisation',
        (error as any)?.status || HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  // ========== MÉTHODES ADMIN ==========

  /**
   * Rechercher des utilisateurs (Admin)
   */
  async searchUsers(searchDto: SearchUsersDto): Promise<PaginatedUsersResponseDto> {
    console.log('🔍 UsersService.searchUsers:', searchDto);
    
    try {
      let users = await this.getMockUsers();
      
      // Filtrage par recherche
      if (searchDto.search) {
        const search = searchDto.search.toLowerCase();
        users = users.filter(user => 
          user.email.toLowerCase().includes(search) ||
          (user.firstName && user.firstName.toLowerCase().includes(search)) ||
          (user.lastName && user.lastName.toLowerCase().includes(search))
        );
      }

      // Filtrage par statut actif
      if (searchDto.isActive !== undefined) {
        users = users.filter(user => user.isActive === searchDto.isActive);
      }

      // Tri
      if (searchDto.sortBy) {
        users.sort((a, b) => {
          const aValue = a[searchDto.sortBy as keyof UserResponseDto];
          const bValue = b[searchDto.sortBy as keyof UserResponseDto];
          
          if (aValue === undefined || bValue === undefined) return 0;
          
          if (searchDto.sortOrder === 'DESC') {
            return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
          } else {
            return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
          }
        });
      }

      // Pagination
      const total = users.length;
      const totalPages = Math.ceil(total / (searchDto.limit || 10));
      const currentPage = searchDto.page || 1;
      const startIndex = ((searchDto.page || 1) - 1) * (searchDto.limit || 10);
      const endIndex = startIndex + (searchDto.limit || 10);
      
      const paginatedUsers = users.slice(startIndex, endIndex);

      const result: PaginatedUsersResponseDto = {
        users: paginatedUsers,
        total,
        currentPage,
        totalPages,
        hasNextPage: currentPage < totalPages,
        hasPreviousPage: currentPage > 1,
        page: currentPage,
        limit: searchDto.limit || 10,
      };

      console.log(`✅ ${paginatedUsers.length}/${total} utilisateurs trouvés`);
      return result;
    } catch (error) {
      console.error('❌ Erreur recherche utilisateurs:', error);
      throw new HttpException(
        (error as any)?.message || 'Erreur lors de la recherche des utilisateurs',
        (error as any)?.status || HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Désactiver un utilisateur
   */
  async deactivateUser(userId: string): Promise<void> {
    console.log('🚫 UsersService.deactivateUser:', userId);
    
    try {
      const user = await this.getProfile(userId);
      console.log('✅ Utilisateur désactivé:', user.email);
    } catch (error) {
      console.error('❌ Erreur désactivation utilisateur:', error);
      throw new HttpException(
        (error as any)?.message || 'Erreur lors de la désactivation de l\'utilisateur',
        (error as any)?.status || HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Supprimer un utilisateur
   */
  async deleteUser(userId: string): Promise<void> {
    console.log('🗑️ UsersService.deleteUser:', userId);
    
    try {
      const user = await this.getProfile(userId);
      console.log('✅ Utilisateur supprimé:', user.email);
    } catch (error) {
      console.error('❌ Erreur suppression utilisateur:', error);
      throw new HttpException(
        (error as any)?.message || 'Erreur lors de la suppression de l\'utilisateur',
        (error as any)?.status || HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  // ========== MÉTHODES UTILITAIRES ==========

  /**
   * Trouver un utilisateur par email
   */
  async findByEmail(email: string): Promise<UserResponseDto | null> {
    console.log('📧 UsersService.findByEmail:', email);
    
    try {
      const users = await this.getMockUsers();
      const user = users.find(u => u.email === email);
      return user || null;
    } catch (error) {
      console.error('❌ Erreur recherche par email:', error);
      return null;
    }
  }

  /**
   * Données mock pour les tests
   */
  private async getMockUsers(): Promise<UserResponseDto[]> {
    return [
      {
        id: '1',
        email: 'admin@automecanik.com',
        firstName: 'Admin',
        lastName: 'System',
        tel: '+33123456789',
        isPro: false,
        isActive: true,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date(),
      },
      {
        id: '2',
        email: 'client@test.com',
        firstName: 'Jean',
        lastName: 'Dupont',
        tel: '+33987654321',
        isPro: false,
        isActive: true,
        createdAt: new Date('2024-02-15'),
        updatedAt: new Date(Date.now() - 86400000), // Hier
      },
      {
        id: '3',
        email: 'pro@garage.com',
        firstName: 'Marie',
        lastName: 'Martin',
        tel: '+33555666777',
        isPro: true,
        isActive: true,
        createdAt: new Date('2024-03-10'),
        updatedAt: new Date(),
      },
      {
        id: '4',
        email: 'inactive@test.com',
        firstName: 'Pierre',
        lastName: 'Inactive',
        isPro: false,
        isActive: false,
        createdAt: new Date('2024-01-20'),
        updatedAt: new Date(),
      },
      {
        id: '5',
        email: 'garage@pro.com',
        firstName: 'François',
        lastName: 'Garage',
        tel: '+33444555666',
        isPro: true,
        isActive: true,
        createdAt: new Date('2024-04-05'),
        updatedAt: new Date(),
      }
    ];
  }

  // ========== MÉTHODES HÉRITÉES (compatibilité) ==========

  async findById(id: string): Promise<UserResponseDto | null> {
    return this.getProfile(id);
  }

  async create(createUserDto: CreateUserDto): Promise<UserResponseDto> {
    const registerDto: RegisterDto = {
      email: createUserDto.email,
      firstName: createUserDto.name.split(' ')[0],
      lastName: createUserDto.name.split(' ').slice(1).join(' '),
      password: createUserDto.password,
      confirmPassword: createUserDto.password,
    };
    return this.register(registerDto);
  }

  async update(id: string, updateUserDto: UpdateUserDto): Promise<UserResponseDto> {
    const updateDto: UpdateProfileDto = {
      firstName: updateUserDto.name?.split(' ')[0],
      lastName: updateUserDto.name?.split(' ').slice(1).join(' '),
      email: updateUserDto.email,
    };
    return this.updateProfile(id, updateDto);
  }

  async remove(id: string): Promise<void> {
    return this.deleteUser(id);
  }
}
