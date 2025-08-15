/**
 * Contrôleur Users - Version corrigée avec ordre des routes
 */

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { AuthenticatedGuard } from '../../auth/authenticated.guard';
import { IsAdminGuard } from '../../auth/is-admin.guard';
import { Request } from 'express';

// Import des DTOs étendus
import {
  CreateUserSchema,
  type CreateUserDto,
  type Civility,
  CivilityEnum,
} from './dto/create-user.dto';
import { UpdateUserSchema, type UpdateUserDto } from './dto/create-user.dto';
import {
  CreatePasswordResetTokenSchema,
  UsePasswordResetTokenSchema,
  RequestPasswordResetSchema,
  type CreatePasswordResetTokenDto,
  type UsePasswordResetTokenDto,
  type RequestPasswordResetDto,
} from './dto/password-reset.dto';
import {
  CreateUserSessionSchema,
  ValidateSessionSchema,
  type CreateUserSessionDto,
  type ValidateSessionDto,
} from './dto/user-sessions.dto';

interface RequestWithUser extends Request {
  user?: any;
}

@Controller('api/users')
export class UsersController {
  private readonly logger = new Logger(UsersController.name);

  constructor(private readonly usersService: UsersService) {}

  /**
   * GET /api/users/test - Route de test sans authentification
   * IMPORTANT: Cette route DOIT être déclarée AVANT la route /:id
   */
  @Get('test')
  async testUsers() {
    this.logger.log('GET /api/users/test - Test route (no auth)');

    try {
      const result = await this.usersService.findAll({
        limit: 50,
        page: 1,
        search: '',
      });

      this.logger.log(
        `Test route returning ${result.users.length} users of ${result.total} total`,
      );

      return {
        success: true,
        message: 'Test route - No auth required',
        data: result.users,
        total: result.total,
      };
    } catch (error: any) {
      this.logger.error('Erreur testUsers:', error);
      return {
        success: false,
        message: error.message,
        data: [],
        total: 0,
      };
    }
  }

  /**
   * GET /api/users/test-user - Test de l'utilisateur mock
   */
  @Get('test-user')
  async getTestUser() {
    this.logger.log('GET /api/users/test-user');
    
    try {
      const user = await this.usersService.findById('test-user-123');
      return {
        success: true,
        data: user,
        message: user ? 'Utilisateur trouvé' : 'Utilisateur non trouvé',
      };
    } catch (error: any) {
      this.logger.error('Erreur getTestUser:', error);
      return {
        success: false,
        message: error.message,
        data: null,
      };
    }
  }

  /**
   * GET /api/users/test-session-user - Test de l'utilisateur de la session
   */
  @Get('test-session-user')
  async getSessionUser() {
    this.logger.log('GET /api/users/test-session-user');
    
    try {
      const user = await this.usersService.findById('usr_1752842636126_j88bat3bh');
      return {
        success: true,
        data: user,
        message: user ? 'Utilisateur de session trouvé' : 'Utilisateur de session non trouvé',
      };
    } catch (error: any) {
      this.logger.error('Erreur getSessionUser:', error);
      return {
        success: false,
        message: error.message,
        data: null,
      };
    }
  }

  /**
   * GET /api/users/test-staff - Récupérer les données staff depuis ___config_admin (endpoint temporaire)
   */
  @Get('test-staff')
  async getTestStaff(@Query() query: any) {
    this.logger.log('GET /api/users/test-staff - Récupération staff depuis ___config_admin');
    
    try {
      // Utiliser le service de données directement via Supabase
      const page = parseInt(query.page) || 1;
      const limit = parseInt(query.limit) || 100;
      const offset = (page - 1) * limit;
      
      // Configuration Supabase
      const supabaseUrl = 'https://cxpojprgwgubzjyqzmoq.supabase.co';
      const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN4cG9qcHJnd2d1YnpqeXF6bW9xIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjUzNDU5NSwiZXhwIjoyMDY4MTEwNTk1fQ.ta_KmARDalKoBf6pIKNwZM0e6cBGO3F15CEgfw0lkzY';
      
      let apiQuery = `${supabaseUrl}/rest/v1/___config_admin?select=*`;
      apiQuery += `&order=cnfa_fname.asc,cnfa_name.asc&offset=${offset}&limit=${limit}`;

      const headers = {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Prefer': 'return=representation',
      };

      const response = await fetch(apiQuery, {
        method: 'GET',
        headers: headers,
      });

      if (!response.ok) {
        this.logger.error('❌ Erreur Supabase:', response.status, response.statusText);
        return {
          success: false,
          message: 'Erreur lors de la récupération des données staff',
          data: [],
          total: 0,
        };
      }

      const rawStaff = await response.json();
      
      // Mapper les données vers le format attendu par le frontend
      const staffMembers = rawStaff.map((s: any) => ({
        id: s.cnfa_id,
        email: s.cnfa_mail,
        firstName: s.cnfa_fname,
        lastName: s.cnfa_name,
        level: parseInt(s.cnfa_level) || 0,
        isActive: s.cnfa_activ === '1',
        department: this.extractDepartment(s.cnfa_job),
        phone: s.cnfa_tel || '',
        lastLogin: null,
        role: s.cnfa_job || 'Non défini',
      }));

      // Filtrer pour ne garder que le staff (niveau >= 7)
      const staffFiltered = staffMembers.filter((member: any) => member.level >= 7);
      
      this.logger.log(`✅ ${staffFiltered.length} membres du staff trouvés sur ${rawStaff.length} utilisateurs admin`);
      
      return {
        success: true,
        data: staffFiltered,
        total: staffFiltered.length,
        page,
        limit,
        message: 'Staff récupéré depuis ___config_admin',
      };
    } catch (error: any) {
      this.logger.error('Erreur getTestStaff:', error);
      return {
        success: false,
        message: error.message,
        data: [],
        total: 0,
      };
    }
  }

  private extractDepartment(job: string): string {
    if (!job) return 'Non défini';
    
    const jobLower = job.toLowerCase();
    if (jobLower.includes('développeur') || jobLower.includes('webmaster')) return 'IT';
    if (jobLower.includes('rh') || jobLower.includes('manager')) return 'RH';
    if (jobLower.includes('comptable') || jobLower.includes('finance')) return 'Finance';
    if (jobLower.includes('admin')) return 'Administration';
    
    return 'Général';
  }  /**
   * GET /api/users/profile - Profil de l'utilisateur connecté
   */
  @Get('profile')
  @UseGuards(AuthenticatedGuard)
  async getProfile(@Req() req: RequestWithUser) {
    const user = req.user;
    this.logger.log(`GET /api/users/profile - User: ${user?.email}`);

    if (!user?.id) {
      throw new HttpException(
        'User not authenticated',
        HttpStatus.UNAUTHORIZED,
      );
    }

    try {
      const profile = await this.usersService.findById(user.id);
      if (!profile) {
        throw new HttpException('Profile not found', HttpStatus.NOT_FOUND);
      }
      return profile;
    } catch (error: any) {
      this.logger.error('Erreur getProfile:', error);
      throw new HttpException(
        error.message || 'Erreur lors de la récupération du profil',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * POST /api/users/force-session-login - Force une session authentifiée (test uniquement)
   */
  @Post('force-session-login')
  async forceSessionLogin(@Body() body: any, @Req() request: any) {
    this.logger.log('POST /api/users/force-session-login');
    
    const { email } = body;
    
    try {
      // Récupérer l'utilisateur depuis les données mock via la méthode privée
      // On utilise une approche différente pour accéder aux données mock
      const testUser = {
        id: 'usr_1752842636126_j88bat3bh',
        email: 'auto@example.com',
        firstName: 'AutoModified', 
        lastName: 'EquipementModified',
        isPro: false,
        isActive: true
      };
      
      // Vérifier que l'email correspond
      if (email && email !== testUser.email) {
        return {
          success: false,
          message: `Email ${email} non supporté. Utilisez ${testUser.email}`,
          availableEmails: [testUser.email, 'admin@automecanik.com', 'client@test.com']
        };
      }
      
      // Utiliser l'utilisateur par défaut si pas d'email spécifié
      const userToLogin = email ? testUser : testUser;
      
      // Créer l'objet utilisateur pour la session
      const sessionUser = {
        id: userToLogin.id,
        email: userToLogin.email,
        firstName: userToLogin.firstName,
        lastName: userToLogin.lastName,
        isAdmin: false,
        isPro: userToLogin.isPro || false,
        level: 1,
        isActive: userToLogin.isActive,
      };
      
      // Fonction de connexion en promesse pour gérer l'async
      const loginPromise = new Promise((resolve, reject) => {
        request.login(sessionUser, (err: any) => {
          if (err) {
            this.logger.error('Erreur lors de la connexion forcée:', err);
            reject(err);
          } else {
            resolve(sessionUser);
          }
        });
      });
      
      await loginPromise;
      
      // Vérifier l'état après connexion
      const postLoginInfo = {
        isAuthenticated: request.isAuthenticated(),
        hasUser: !!request.user,
        user: request.user,
        sessionPassport: request.session?.passport || null,
        sessionId: request.sessionID
      };
      
      this.logger.log('Session forcée créée:', JSON.stringify(postLoginInfo, null, 2));
      
      return {
        success: true,
        message: `Session authentifiée créée pour ${email}`,
        data: postLoginInfo
      };
      
    } catch (error: any) {
      this.logger.error('Erreur forceSessionLogin:', error);
      return {
        success: false,
        message: error.message,
        data: null
      };
    }
  }

  /**
   * POST /api/users/test-login - Connexion de test avec utilisateur de session
   */
  @Post('test-login')
  async testLogin(@Req() request: any) {
    this.logger.log('POST /api/users/test-login');
    
    try {
      // Simuler une connexion avec l'utilisateur de session
      const sessionUser = {
        id: 'usr_1752842636126_j88bat3bh',
        email: 'auto@example.com',
        firstName: 'AutoModified',
        lastName: 'EquipementModified',
        isAdmin: false,
        isPro: false,
        level: 1,
        isActive: true
      };
      
      // Configurer manuellement la session Passport
      request.login(sessionUser, (err: any) => {
        if (err) {
          this.logger.error('Erreur lors de la connexion test:', err);
          return {
            success: false,
            message: 'Erreur lors de la connexion de test',
            error: err.message
          };
        }
      });
      
      // Vérifier l'état après connexion
      const postLoginInfo = {
        isAuthenticated: request.isAuthenticated(),
        hasUser: !!request.user,
        user: request.user,
        sessionPassport: request.session?.passport || null,
        sessionId: request.sessionID
      };
      
      this.logger.log('État après connexion test:', JSON.stringify(postLoginInfo, null, 2));
      
      return {
        success: true,
        message: 'Connexion de test réussie',
        data: postLoginInfo
      };
      
    } catch (error: any) {
      this.logger.error('Erreur testLogin:', error);
      return {
        success: false,
        message: error.message,
        data: null
      };
    }
  }

  /**
   * GET /api/users/debug-session - Debug de la session pour authentification
   */
  @Get('debug-session')
  async debugSession(@Req() request: any) {
    this.logger.log('GET /api/users/debug-session');
    
    try {
      const sessionInfo = {
        // Session basic info
        sessionExists: !!request.session,
        sessionId: request.session?.id || request.sessionID,
        
        // Authentication status
        isAuthenticated: request.isAuthenticated ? request.isAuthenticated() : false,
        
        // User info
        hasUser: !!request.user,
        user: request.user || null,
        
        // Session data
        sessionData: request.session || {},
        
        // Passport specific
        hasPassport: !!request.session?.passport,
        passportData: request.session?.passport || null,
        
        // Headers
        cookies: request.headers.cookie || 'none',
        userAgent: request.headers['user-agent'] || 'none'
      };
      
      this.logger.log('Session debug info:', JSON.stringify(sessionInfo, null, 2));
      
      return {
        success: true,
        data: sessionInfo,
        message: 'Session debug info récupérée'
      };
    } catch (error: any) {
      this.logger.error('Erreur debugSession:', error);
      return {
        success: false,
        message: error.message,
        data: null
      };
    }
  }

  /**
   * GET /api/users/test-dashboard - Dashboard sans authentification pour test
   */
  @Get('test-dashboard')
  async getTestDashboard() {
    this.logger.log('GET /api/users/test-dashboard');

    try {
      // Simuler un utilisateur connecté
      const mockUser = {
        id: 'usr_1752842636126_j88bat3bh',
        email: 'auto@example.com',
        firstName: 'AutoModified',
        lastName: 'EquipementModified',
      };

      // Récupérer les données du dashboard (simulation)
      const dashboardData = {
        user: mockUser,
        stats: {
          messages: {
            total: 5,
            unread: 2,
            threads: 3,
          },
          orders: {
            total: 12,
            pending: 3,
            completed: 9,
          },
          profile: {
            completeness: 85,
            hasActiveSubscription: false,
            securityScore: 90,
          },
          addresses: {
            billing: 1,
            shipping: 2,
            total: 3,
          },
        },
      };

      return {
        success: true,
        data: dashboardData,
        message: 'Dashboard test récupéré avec succès',
      };
    } catch (error: any) {
      this.logger.error('Erreur getTestDashboard:', error);
      return {
        success: false,
        message: error.message,
        data: null,
      };
    }
  }

  /**
   * GET /api/users/dashboard - Données du dashboard utilisateur
   */
  @Get('dashboard')
  @UseGuards(AuthenticatedGuard)
  async getDashboard(@Req() req: RequestWithUser) {
    const user = req.user;
    this.logger.log(`GET /api/users/dashboard - User: ${user?.email}`);

    if (!user?.id) {
      throw new HttpException(
        'User not authenticated',
        HttpStatus.UNAUTHORIZED,
      );
    }

    try {
      // Récupérer le profil utilisateur
      const profile = await this.usersService.findById(user.id);
      if (!profile) {
        throw new HttpException('Profile not found', HttpStatus.NOT_FOUND);
      }

      // Récupérer les statistiques depuis les autres services
      // Appels parallèles pour optimiser les performances
      const [ordersCount, messagesCount] = await Promise.allSettled([
        // TODO: Intégrer avec OrdersService quand il sera migré
        Promise.resolve({ total: 0, pending: 0, completed: 0 }),
        // TODO: Intégrer avec MessagesService quand il sera migré  
        Promise.resolve({ total: 0, unread: 0, threads: 0 }),
      ]);

      // Calcul dynamique du score de complétude du profil
      let completeness = 0;
      if (profile.email) completeness += 20;
      if (profile.firstName) completeness += 20;
      if (profile.lastName) completeness += 20;
      // TODO: Ajouter +20 si adresse, +20 si téléphone

      // Score de sécurité basé sur les critères réels
      let securityScore = 50; // Base
      if (profile.firstName && profile.lastName) securityScore += 15;
      if (profile.email?.includes('@')) securityScore += 10;
      // TODO: +25 si 2FA activé, +10 si mot de passe récent

      const stats = {
        messages: {
          total:
            messagesCount.status === 'fulfilled'
              ? messagesCount.value.total
              : 0,
          unread:
            messagesCount.status === 'fulfilled'
              ? messagesCount.value.unread
              : 0,
          threads:
            messagesCount.status === 'fulfilled'
              ? messagesCount.value.threads
              : 0,
        },
        orders: {
          total:
            ordersCount.status === 'fulfilled' ? ordersCount.value.total : 0,
          pending:
            ordersCount.status === 'fulfilled'
              ? ordersCount.value.pending
              : 0,
          completed:
            ordersCount.status === 'fulfilled'
              ? ordersCount.value.completed
              : 0,
        },
        profile: {
          completeness,
          hasActiveSubscription: false, // TODO: Vérifier les abonnements
          securityScore: Math.min(securityScore, 100), // Cap à 100
        },
        addresses: {
          billing: 0, // TODO: Intégrer avec AddressService
          shipping: 0, // TODO: Intégrer avec AddressService
          total: 0,
        },
      };

      return {
        user: profile,
        stats,
      };
    } catch (error: any) {
      this.logger.error('Erreur getDashboard:', error);
      throw new HttpException(
        error.message || 'Erreur lors de la récupération du dashboard',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * GET /api/users - Liste des utilisateurs
   * Avec support des headers d'authentification internes
   */
  @Get()
  async getUsers(
    @Query('limit') limit?: string,
    @Query('page') page?: string,
    @Query('search') search?: string,
    @Req() req?: RequestWithUser,
  ) {
    // Log détaillé pour debug
    this.logger.log(`GET /api/users - Request received`);
    
    // Vérifier les headers d'authentification internes en priorité
    const internalUserId = req?.headers?.['x-user-id'] as string;
    const internalUserEmail = req?.headers?.['x-user-email'] as string;
    const internalUserLevel = req?.headers?.['x-user-level'] as string;
    const isInternalCall = req?.headers?.['internal-call'] === 'true';
    
    let currentUser = req?.user;
    
    // Si c'est un appel interne avec headers d'auth, créer un objet user
    if (isInternalCall && internalUserId && internalUserEmail) {
      currentUser = {
        id: internalUserId,
        email: internalUserEmail,
        level: parseInt(internalUserLevel) || 1,
        isAuthenticated: true
      };
      this.logger.log(`Using internal auth - User: ${internalUserEmail} (Level: ${internalUserLevel})`);
    } else {
      this.logger.log(`User: ${currentUser?.email || 'anonymous'}`);
      this.logger.log(`IsAuthenticated: ${req?.isAuthenticated?.() || false}`);
    }

    const options = {
      limit: limit ? parseInt(limit, 10) : 50,
      page: page ? parseInt(page, 10) : 1,
      search: search || '',
    };

    try {
      // Passer les informations d'utilisateur au service si nécessaire
      const result = await this.usersService.findAll(options, currentUser);

      this.logger.log(
        `Returning ${result.users.length} users of ${result.total} total`,
      );

      return {
        success: true,
        data: result.users,
        total: result.total,
        page: options.page,
        limit: options.limit,
      };
    } catch (error: any) {
      this.logger.error('Erreur getUsers:', error);
      throw new HttpException(
        error.message || 'Erreur lors de la récupération des utilisateurs',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * GET /api/users/:id - Détails d'un utilisateur (admin seulement)
   */
  @Get(':id')
  @UseGuards(AuthenticatedGuard, IsAdminGuard)
  async getUser(@Param('id') id: string) {
    this.logger.log(`GET /api/users/${id}`);

    try {
      const user = await this.usersService.findById(id);
      if (!user) {
        throw new HttpException('User not found', HttpStatus.NOT_FOUND);
      }
      return user;
    } catch (error: any) {
      this.logger.error('Erreur getUser:', error);
      if (error.status === HttpStatus.NOT_FOUND) {
        throw error;
      }
      throw new HttpException(
        error.message || "Erreur lors de la récupération de l'utilisateur",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * POST /api/users - Créer un utilisateur (admin seulement)
   */
  @Post()
  @UseGuards(AuthenticatedGuard, IsAdminGuard)
  async createUser(@Body() userData: any) {
    this.logger.log(`POST /api/users - Creating user: ${userData.email}`);

    try {
      const result = await this.usersService.create(userData);
      return {
        success: true,
        data: result,
      };
    } catch (error: any) {
      this.logger.error('Erreur createUser:', error);
      throw new HttpException(
        error.message || "Erreur lors de la création de l'utilisateur",
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * PUT /api/users/:id - Mettre à jour un utilisateur
   */
  @Put(':id')
  @UseGuards(AuthenticatedGuard)
  async updateUser(
    @Param('id') id: string,
    @Body() userData: any,
    @Req() req: RequestWithUser,
  ) {
    const currentUser = req.user;
    this.logger.log(`PUT /api/users/${id} - By: ${currentUser?.email}`);

    // Vérifier si l'utilisateur peut modifier ce profil
    if (!currentUser?.isAdmin && currentUser?.id !== id) {
      throw new HttpException(
        'Vous ne pouvez modifier que votre propre profil',
        HttpStatus.FORBIDDEN,
      );
    }

    try {
      const result = await this.usersService.update(id, userData);
      return {
        success: true,
        data: result,
      };
    } catch (error: any) {
      this.logger.error('Erreur updateUser:', error);
      throw new HttpException(
        error.message || "Erreur lors de la mise à jour de l'utilisateur",
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * DELETE /api/users/:id - Supprimer un utilisateur (admin seulement)
   */
  @Delete(':id')
  @UseGuards(AuthenticatedGuard, IsAdminGuard)
  async deleteUser(@Param('id') id: string) {
    this.logger.log(`DELETE /api/users/${id}`);

    try {
      await this.usersService.delete(id);
      return {
        success: true,
        message: 'Utilisateur supprimé avec succès',
      };
    } catch (error: any) {
      this.logger.error('Erreur deleteUser:', error);
      throw new HttpException(
        error.message || "Erreur lors de la suppression de l'utilisateur",
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  // =====================================
  // 🆕 NOUVEAUX ENDPOINTS AVEC DTOs ÉTENDUS
  // =====================================

  /**
   * 🆕 POST /api/users/create-validated - Créer un utilisateur avec validation Zod
   */
  @Post('create-validated')
  @UseGuards(AuthenticatedGuard, IsAdminGuard)
  async createUserValidated(@Body() userData: any) {
    this.logger.log('POST /api/users/create-validated');

    try {
      // Validation avec Zod
      const validatedData = CreateUserSchema.parse(userData);

      const newUser =
        await this.usersService.createUserWithValidation(validatedData);
      return {
        success: true,
        message: 'Utilisateur créé avec succès (avec civility)',
        data: newUser,
        civility: validatedData.civility,
        newsletter: validatedData.isNewsletterSubscribed,
      };
    } catch (error: any) {
      this.logger.error('Erreur createUserValidated:', error);
      throw new HttpException(
        error.message || "Erreur lors de la création de l'utilisateur",
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * 🆕 PUT /api/users/:id/update-validated - Mettre à jour avec validation Zod
   */
  @Put(':id/update-validated')
  @UseGuards(AuthenticatedGuard)
  async updateUserValidated(
    @Param('id') id: string,
    @Body() updateData: any,
    @Req() req: RequestWithUser,
  ) {
    this.logger.log(`PUT /api/users/${id}/update-validated`);

    try {
      // Validation avec Zod
      const validatedData = UpdateUserSchema.parse(updateData);

      // Vérifier que l'utilisateur peut modifier ce profil
      const user = req.user;
      if (user?.id !== id && !user?.isAdmin) {
        throw new HttpException('Accès non autorisé', HttpStatus.FORBIDDEN);
      }

      const updatedUser = await this.usersService.updateUserWithValidation(
        id,
        validatedData,
      );
      return {
        success: true,
        message: 'Utilisateur mis à jour avec succès',
        data: updatedUser,
        updatedFields: Object.keys(validatedData),
      };
    } catch (error: any) {
      this.logger.error('Erreur updateUserValidated:', error);
      throw new HttpException(
        error.message || "Erreur lors de la mise à jour de l'utilisateur",
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * 🆕 GET /api/users/validate-civility/:civility - Valider une civilité
   */
  @Get('validate-civility/:civility')
  async validateCivility(@Param('civility') civility: string) {
    this.logger.log(`GET /api/users/validate-civility/${civility}`);

    try {
      const isValid = CivilityEnum.safeParse(civility).success;
      return {
        civility,
        valid: isValid,
        allowedValues: ['M', 'Mme', 'Autre'],
      };
    } catch (error: any) {
      return {
        civility,
        valid: false,
        error: error.message,
        allowedValues: ['M', 'Mme', 'Autre'],
      };
    }
  }

  /**
   * 🆕 POST /api/users/request-password-reset - Demander réinitialisation mot de passe
   */
  @Post('request-password-reset')
  async requestPasswordReset(@Body() requestData: any) {
    this.logger.log('POST /api/users/request-password-reset');

    try {
      // Validation avec Zod
      const validatedData = RequestPasswordResetSchema.parse(requestData);

      // Générer un token de réinitialisation
      const resetToken = await this.usersService.createPasswordResetToken(
        validatedData.email,
      );

      return {
        success: true,
        message: 'Email de réinitialisation envoyé',
        tokenGenerated: !!resetToken,
      };
    } catch (error: any) {
      this.logger.error('Erreur requestPasswordReset:', error);
      throw new HttpException(
        error.message || 'Erreur lors de la demande de réinitialisation',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * 🆕 POST /api/users/reset-password - Réinitialiser mot de passe avec token
   */
  @Post('reset-password')
  async resetPassword(@Body() resetData: any) {
    this.logger.log('POST /api/users/reset-password');

    try {
      // Validation avec Zod
      const validatedData = UsePasswordResetTokenSchema.parse(resetData);

      const result = await this.usersService.resetPasswordWithToken(
        validatedData.token,
        validatedData.newPassword,
      );

      return {
        success: true,
        message: 'Mot de passe réinitialisé avec succès',
        passwordChanged: result,
      };
    } catch (error: any) {
      this.logger.error('Erreur resetPassword:', error);
      throw new HttpException(
        error.message || 'Erreur lors de la réinitialisation du mot de passe',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * 🆕 PUT /api/users/:id/update-validated - Mettre à jour avec validation Zod
   */
  /**
   * 🆕 GET /api/users/by-civility/:civility - Rechercher par civilité
   */
  @Get('by-civility/:civility')
  @UseGuards(AuthenticatedGuard, IsAdminGuard)
  async getUsersByCivility(
    @Param('civility') civility: Civility,
    @Query('limit') limit?: string,
    @Query('page') page?: string,
  ) {
    this.logger.log(`GET /api/users/by-civility/${civility}`);

    // Valider la civilité
    if (!this.usersService.validateCivility(civility)) {
      throw new HttpException(
        'Civilité invalide. Valeurs acceptées : M, Mme, Autre',
        HttpStatus.BAD_REQUEST,
      );
    }

    const options = {
      limit: limit ? parseInt(limit, 10) : 50,
      page: page ? parseInt(page, 10) : 1,
    };

    try {
      const result = await this.usersService.findByCivility(civility, options);
      return {
        success: true,
        data: result.users,
        total: result.total,
        civility,
        page: options.page,
        limit: options.limit,
      };
    } catch (error: any) {
      this.logger.error('Erreur getUsersByCivility:', error);
      throw new HttpException(
        error.message || 'Erreur lors de la recherche par civilité',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 🆕 PUT /api/users/:id/last-login - Marquer la dernière connexion
   */
  @Put(':id/last-login')
  @UseGuards(AuthenticatedGuard)
  async updateLastLogin(@Param('id') id: string, @Req() req: RequestWithUser) {
    this.logger.log(`PUT /api/users/${id}/last-login`);

    // Vérifier que l'utilisateur met à jour sa propre dernière connexion
    const user = req.user;
    if (user?.id !== id && !user?.isAdmin) {
      throw new HttpException(
        'Non autorisé à modifier cet utilisateur',
        HttpStatus.FORBIDDEN,
      );
    }

    try {
      await this.usersService.updateLastLogin(parseInt(id));
      return {
        success: true,
        message: 'Dernière connexion mise à jour',
      };
    } catch (error: any) {
      this.logger.error('Erreur updateLastLogin:', error);
      throw new HttpException(
        error.message ||
          'Erreur lors de la mise à jour de la dernière connexion',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 🆕 GET /api/users/email/:email - Rechercher par email
   */
  @Get('email/:email')
  @UseGuards(AuthenticatedGuard, IsAdminGuard)
  async getUserByEmail(@Param('email') email: string) {
    this.logger.log(`GET /api/users/email/${email}`);

    try {
      const user = await this.usersService.findByEmail(email);
      if (!user) {
        throw new HttpException('Utilisateur non trouvé', HttpStatus.NOT_FOUND);
      }

      return {
        success: true,
        data: user,
      };
    } catch (error: any) {
      this.logger.error('Erreur getUserByEmail:', error);
      if (error.status === HttpStatus.NOT_FOUND) {
        throw error;
      }
      throw new HttpException(
        error.message || 'Erreur lors de la recherche par email',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 🆕 GET /api/users/validate-civility/:civility - Valider une civilité
   */
}
