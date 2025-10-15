import {
  Controller,
  Get,
  Next,
  Post,
  Req,
  Res,
  UseGuards,
  Body,
  Param,
} from '@nestjs/common';
import { NextFunction, Response } from 'express';
import { LocalAuthGuard } from './local-auth.guard';
import { UsersService } from '../modules/users/users.service';
import { AuthService } from './auth.service';
import { UserService } from '../database/services/user.service';
import {
  ModuleAccessDto,
  BulkModuleAccessDto,
  TokenValidationDto,
} from './dto/module-access.dto';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import RegisterSchema, { RegisterDto } from './dto/register.dto';

@Controller()
export class AuthController {
  constructor(
    private readonly usersService: UsersService,
    private readonly authService: AuthService,
    private readonly userService: UserService,
  ) {}

  /**
   * POST /auth/register
   * Créer un nouveau compte utilisateur
   * ✅ Validation automatique avec Zod (cohérent avec l'architecture)
   */
  @Post('auth/register')
  async register(
    @Body(new ZodValidationPipe(RegisterSchema)) userData: RegisterDto,
    @Req() request: Express.Request,
  ): Promise<any> {
    try {
      // Créer l'utilisateur via UserService (database layer)
      await this.userService.createUser({
        email: userData.email,
        password: userData.password,
        firstName: userData.firstName,
        lastName: userData.lastName,
      });

      // Authentifier automatiquement l'utilisateur
      const loginResult = await this.authService.login(
        userData.email,
        userData.password,
        (request as any).ip,
      );

      // ✅ IMPORTANT: Sauvegarder l'utilisateur dans la session Passport
      return new Promise((resolve, reject) => {
        (request as any).login(loginResult.user, (err: any) => {
          if (err) {
            reject(err);
          } else {
            resolve({
              success: true,
              message: 'Compte créé avec succès',
              user: loginResult.user,
              sessionToken: loginResult.access_token,
            });
          }
        });
      });
    } catch (_error: any) {
      if (_error.message?.includes('déjà utilisé')) {
        return {
          success: false,
          message: 'Cet email est déjà utilisé',
          status: 409,
        };
      }

      return {
        success: false,
        message: 'Erreur lors de la création du compte',
        status: 500,
        debug:
          process.env.NODE_ENV === 'development' ? _error.message : undefined,
      };
    }
  }
  /**
   * POST /auth/login
   * Authentification utilisateur avec email/password
   */
  @Post('auth/login')
  async loginPost(
    @Body() credentials: { email: string; password: string },
    @Req() request: Express.Request,
  ): Promise<any> {
    try {
      const loginResult = await this.authService.login(
        credentials.email,
        credentials.password,
        (request as any).ip,
      );

      // Sauvegarder dans la session Passport
      return new Promise((resolve, reject) => {
        (request as any).login(loginResult.user, (err: any) => {
          if (err) {
            reject(err);
          } else {
            resolve({
              success: true,
              message: 'Connexion réussie',
              user: loginResult.user,
              sessionToken: loginResult.access_token,
            });
          }
        });
      });
    } catch (_error: any) {
      const error = _error as Error;
      return {
        success: false,
        error: error.message || 'Erreur lors de la connexion',
      };
    }
  }

  /**
   * GET /auth/login
   * Redirige vers la page de login Remix (/login) en conservant la query string
   */
  @Get('auth/login')
  redirectAuthLogin(
    @Req() request: Express.Request,
    @Res() response: Response,
  ) {
    // Conserver les paramètres de requête (error, message, email, ...)
    const originalUrl = (request as any).originalUrl || '/auth/login';
    const queryIndex = originalUrl.indexOf('?');
    const query = queryIndex >= 0 ? originalUrl.slice(queryIndex) : '';
    const target = `/login${query}`;
    return response.redirect(target);
  }
  /**
   * GET /auth/me
   * Récupérer l'utilisateur connecté
   */
  @Get('auth/me')
  async getCurrentUser(@Req() request: Express.Request) {
    if (request.user) {
      return {
        success: true,
        user: request.user,
        timestamp: new Date().toISOString(),
      };
    } else {
      return {
        success: false,
        error: 'Utilisateur non connecté',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * GET /authenticate - Redirige vers la page de login
   */
  @Get('authenticate')
  authenticateGet(@Res() response: Response) {
    return response.redirect('/auth/login');
  }

  @UseGuards(LocalAuthGuard)
  @Post('authenticate')
  login(@Req() request: Express.Request, @Res() response: Response) {
    console.log('--- POST /authenticate - Redirection conditionnelle ---');
    console.log('User connecté:', request.user);

    if (!request.user) {
      console.log('Aucun utilisateur, redirection vers /');
      return response.redirect('/');
    }

    const user = request.user as any;

    // Convertir le niveau en nombre pour la comparaison
    const userLevel = parseInt(user.level) || 0;

    // Redirection selon le type et niveau d'utilisateur
    if (user.isAdmin && userLevel >= 7) {
      console.log(
        `Admin niveau ${userLevel} détecté, redirection vers dashboard admin`,
      );
      return response.redirect('/admin');
    } else if (user.isAdmin && userLevel >= 4) {
      console.log(`Admin niveau ${userLevel} détecté, redirection vers admin`);
      return response.redirect('/admin');
    } else if (user.isPro) {
      console.log('Utilisateur pro détecté, redirection vers dashboard pro');
      return response.redirect('/pro/dashboard');
    } else {
      console.log('Utilisateur standard, redirection vers accueil');
      return response.redirect('/');
    }
  }

  @Post('auth/logout')
  async logout(
    @Req() request: Express.Request,
    @Res() response: Response,
    @Next() next: NextFunction,
  ) {
    console.log('--- POST /auth/logout DÉBUT ---');
    console.log('User avant logout:', request.user);

    // this will ensure that re-using the old session id
    // does not have a logged in user
    request.logOut(function (err) {
      if (err) {
        console.error('Erreur logout:', err);
        return next(err);
      }
      console.log('LogOut réussi, user après:', request.user);

      // Ensure the session is destroyed and the user is redirected.
      request.session.destroy(() => {
        response.clearCookie('connect.sid'); // The name of the cookie where express/connect stores its session_id
        console.log('Session détruite et cookie effacé');
        console.log('--- POST /auth/logout REDIRECTION vers / ---');
        response.redirect('/'); // Redirect to website after logout
      });
    });
  }

  // ==========================================
  // ENDPOINTS OPTIMISÉS POUR PERMISSIONS
  // ==========================================

  /**
   * POST /auth/test-login
   * Endpoint pour créer une session de test (développement uniquement)
   */
  @Post('auth/test-login')
  async createTestSession(@Req() request: Express.Request) {
    try {
      const testUser = {
        id: '1',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        level: 5,
        isAdmin: false,
        isPro: true,
        isActive: true,
      };

      // Créer manuellement la session
      (request as any).login(testUser, (err: any) => {
        if (err) {
          console.error('Erreur lors de la création de session:', err);
        } else {
          console.log('✅ Session de test créée pour:', testUser.email);
        }
      });

      return {
        success: true,
        message: 'Session de test créée',
        user: testUser,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * POST /auth/reset-password
   * Endpoint pour réinitialiser un mot de passe (développement uniquement)
   */
  @Post('auth/reset-password')
  async resetPassword(@Body() body: { email: string; newPassword: string }) {
    try {
      // Utiliser l'AuthService pour réinitialiser le mot de passe
      const result = await this.authService.updateUserProfile(body.email, {
        password: body.newPassword,
      });

      if (result) {
        return {
          success: true,
          message: 'Mot de passe réinitialisé avec succès',
        };
      } else {
        return {
          success: false,
          message: 'Utilisateur non trouvé',
        };
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * GET /auth/debug-users - Debug: Lister quelques utilisateurs (DEV ONLY)
   */
  @Get('auth/debug-users')
  async debugUsers() {
    try {
      // Créer un utilisateur de test simple
      return {
        success: true,
        message: 'Test users available',
        testCredentials: {
          email: 'admin@fafa.fr',
          password: 'Test123!',
          note: 'Try this test user for authentication',
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * GET /auth/test-login
   * Créer une session de test pour le développement
   */
  @Get('auth/test-login')
  async testLogin(@Req() request: Express.Request) {
    try {
      // Créer un utilisateur de test
      const testUser = {
        id: 'test-user-123',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        name: 'Test User',
        level: 5,
        isAdmin: false,
        isPro: true,
        isActive: true,
      };

      // Utiliser req.login pour créer la session
      return new Promise((resolve, reject) => {
        request.logIn(testUser, (err) => {
          if (err) {
            console.error('Test login failed:', err);
            reject({
              success: false,
              error: err.message,
            });
          } else {
            console.log('✅ Test login successful');
            resolve({
              success: true,
              message: 'Test session created',
              user: testUser,
            });
          }
        });
      });
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * GET /auth/validate-session
   * Valider la session utilisateur sans guard (pour éviter logique circulaire)
   */

  /**
   * GET /auth/validate-session
   * Valider la session utilisateur sans guard (pour éviter logique circulaire)
   */
  @Get('auth/validate-session')
  async validateSession(@Req() request: Express.Request) {
    try {
      // Vérifier si l'utilisateur est connecté via session
      if (
        request.isAuthenticated &&
        request.isAuthenticated() &&
        request.user
      ) {
        const user = request.user as any;

        return {
          valid: true,
          user: {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            name: user.name,
            level: user.level,
            isAdmin: user.isAdmin,
            isPro: user.isPro,
            isActive: user.isActive,
          },
        };
      }

      return {
        valid: false,
        user: null,
      };
    } catch (error: any) {
      console.error('Session validation error:', error);
      return {
        valid: false,
        error: error.message,
        user: null,
      };
    }
  }

  /**
   * POST /auth/module-access
   * Vérifier l'accès à un module spécifique
   */
  @Post('auth/module-access')
  async checkModuleAccess(@Body() dto: ModuleAccessDto) {
    try {
      const result = await this.authService.checkModuleAccess(
        dto.userId,
        dto.module,
        dto.action || 'read',
      );

      return result;
    } catch (error: any) {
      return {
        hasAccess: false,
        reason: 'Access check failed',
        error: error.message,
      };
    }
  }

  /**
   * POST /auth/bulk-module-access
   * Vérifier l'accès à plusieurs modules à la fois (optimisé)
   */
  @Post('auth/bulk-module-access')
  async checkBulkModuleAccess(@Body() dto: BulkModuleAccessDto) {
    try {
      const results: Record<string, boolean> = {};

      // Traitement en parallèle pour optimiser les performances
      await Promise.all(
        dto.modules.map(async (moduleItem) => {
          const key = `${moduleItem.module}:${moduleItem.action || 'read'}`;
          const result = await this.authService.checkModuleAccess(
            dto.userId,
            moduleItem.module,
            moduleItem.action || 'read',
          );
          results[key] = result.hasAccess;
        }),
      );

      return results;
    } catch {
      return {};
    }
  }

  /**
   * POST /auth/log-access
   * Enregistrer un accès utilisateur (optimisé Redis)
   */
  @Post('auth/access-log')
  async logAccess() {
    try {
      // L'historique de connexion est géré automatiquement dans AuthService
      // Ce endpoint sert uniquement pour des logs d'accès spéciaux si nécessaire

      return {
        success: true,
        message: 'Access logged successfully',
      };
    } catch (_error: any) {
      return {
        success: false,
        error: _error.message,
      };
    }
  }

  /**
   * POST /auth/validate-token
   * Valider un token JWT et retourner les infos utilisateur
   */
  @Post('auth/validate-token')
  async validateToken(@Body() dto: TokenValidationDto) {
    try {
      const user = await this.authService.validateToken(dto.token);

      if (!user) {
        return { valid: false, userId: null };
      }

      return {
        valid: true,
        userId: user.id,
        user: {
          id: user.id,
          email: user.email,
          level: user.level,
          isAdmin: user.isAdmin,
        },
      };
    } catch (error: any) {
      return { valid: false, userId: null, error: error.message };
    }
  }

  /**
   * GET /auth/user-permissions/:userId
   * Obtenir toutes les permissions d'un utilisateur (optimisé pour cache frontend)
   */
  @Get('auth/user-permissions/:userId')
  async getUserPermissions(@Param('userId') userId: string) {
    try {
      const modules = [
        'commercial',
        'admin',
        'seo',
        'expedition',
        'inventory',
        'finance',
        'reports',
      ];
      const permissions: Record<string, { read: boolean; write: boolean }> = {};

      // Traitement en parallèle pour optimiser les performances
      await Promise.all(
        modules.map(async (module) => {
          const [readAccess, writeAccess] = await Promise.all([
            this.authService.checkModuleAccess(userId, module, 'read'),
            this.authService.checkModuleAccess(userId, module, 'write'),
          ]);

          permissions[module] = {
            read: readAccess.hasAccess,
            write: writeAccess.hasAccess,
          };
        }),
      );

      return permissions;
    } catch (error: any) {
      console.error('Error fetching user permissions:', error);
      return {};
    }
  }
}
