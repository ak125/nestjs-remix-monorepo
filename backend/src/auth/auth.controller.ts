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
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiCookieAuth,
} from '@nestjs/swagger';
import { NextFunction, Response } from 'express';
import * as crypto from 'crypto';
import { LocalAuthGuard } from './local-auth.guard';
import { UsersService } from '../modules/users/users.service';
import { AuthService } from './auth.service';
import { UserService } from '../database/services/user.service';
import { CartDataService } from '../database/services/cart-data.service';
import { RedisCacheService } from '../database/services/redis-cache.service';
import { PasswordCryptoService } from '../shared/crypto/password-crypto.service';
import { LoginResponseDto } from './dto/login-response.dto';
import { UserResponseDto } from './dto/user-response.dto';
import {
  ModuleAccessDto,
  BulkModuleAccessDto,
  TokenValidationDto,
} from './dto/module-access.dto';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import RegisterSchema, {
  RegisterDto,
  RegisterDtoClass,
} from './dto/register.dto';

@ApiTags('auth')
@Controller()
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly authService: AuthService,
    private readonly userService: UserService,
    private readonly cartDataService: CartDataService,
    private readonly redisCacheService: RedisCacheService,
    private readonly passwordCrypto: PasswordCryptoService,
  ) {}

  /**
   * POST /auth/register
   * Créer un nouveau compte utilisateur
   * ✅ Validation automatique avec Zod (cohérent avec l'architecture)
   */
  @Post('auth/register')
  @ApiOperation({
    summary: 'Register new user account',
    description:
      'Create a new user account with email/password. Automatically logs in the user after registration.',
  })
  @ApiBody({ type: RegisterDtoClass })
  @ApiResponse({
    status: 201,
    description: 'User registered and logged in successfully',
    type: LoginResponseDto,
  })
  @ApiResponse({
    status: 409,
    description: 'Email already in use',
    schema: {
      example: {
        success: false,
        message: 'Cet email est déjà utilisé',
        status: 409,
      },
    },
  })
  @ApiResponse({
    status: 500,
    description: 'Server error during registration',
  })
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
  @ApiOperation({
    summary: 'Login with email and password',
    description:
      'Authenticate user with email/password and create session. Returns user info and session token.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['email', 'password'],
      properties: {
        email: {
          type: 'string',
          format: 'email',
          example: 'client@fafa-auto.fr',
          description: 'User email',
        },
        password: {
          type: 'string',
          format: 'password',
          example: 'Password123!',
          description: 'User password',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Login successful',
    type: LoginResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid credentials',
    schema: {
      example: {
        success: false,
        message: 'Email ou mot de passe incorrect',
      },
    },
  })
  @ApiResponse({
    status: 500,
    description: 'Server error during login',
  })
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
  @ApiOperation({
    summary: 'Get current authenticated user',
    description:
      'Returns the currently logged in user information from session.',
  })
  @ApiCookieAuth('connect.sid')
  @ApiResponse({
    status: 200,
    description: 'User information retrieved',
    type: UserResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'User not authenticated',
    schema: {
      example: {
        success: false,
        error: 'Utilisateur non connecté',
        timestamp: '2024-01-15T10:30:00.000Z',
      },
    },
  })
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
  async login(@Req() request: Express.Request, @Res() response: Response) {
    this.logger.debug('POST /authenticate - Redirection conditionnelle');
    this.logger.debug({ user: request.user ? 'authenticated' : 'none' });

    if (!request.user) {
      this.logger.debug('Aucun utilisateur, redirection vers /');
      return response.redirect('/');
    }

    // FUSION DE PANIER: Extraire la session du cookie AVANT toute modification
    let guestSessionId: string | undefined;

    const cookieHeader = (request as any).headers?.cookie || '';
    console.log('[CART-FUSION] Cookie header:', cookieHeader.substring(0, 150));

    const sessionCookie = cookieHeader
      .split(';')
      .find((c: string) => c.trim().startsWith('connect.sid='));

    if (sessionCookie) {
      try {
        const cookieValue = sessionCookie.split('=')[1];
        const decoded = decodeURIComponent(cookieValue);
        console.log('[CART-FUSION] Cookie decoded:', decoded);
        const match = decoded.match(/^s:([^.]+)\./);
        if (match) {
          guestSessionId = match[1];
          console.log(
            '[CART-FUSION] Guest session ID extracted:',
            guestSessionId,
          );
        } else {
          console.log('[CART-FUSION] Regex failed on:', decoded);
        }
      } catch (err) {
        console.log('[CART-FUSION] Error extracting session:', err);
      }
    } else {
      console.log('[CART-FUSION] No connect.sid cookie found');
    }

    const user = request.user as any;

    // Convertir le niveau en nombre pour la comparaison
    const userLevel = parseInt(user.level) || 0;

    // 🔄 Régénérer la session de manière sécurisée
    return new Promise<void>((resolve) => {
      (request as any).session.regenerate(async (regenerateErr: any) => {
        if (regenerateErr) {
          this.logger.error(
            { err: regenerateErr },
            'Erreur régénération session',
          );
          response.redirect('/');
          return resolve();
        }

        // Réattacher l'utilisateur à la nouvelle session
        (request as any).login(user, async (loginErr: any) => {
          if (loginErr) {
            console.error('❌ Erreur réattachement utilisateur:', loginErr);
            response.redirect('/');
            return resolve();
          }

          // FUSION DE PANIER: Fusionner vers userId (pas sessionId)
          const userId = user.id;
          const newSessionId = (request as any).session?.id;
          console.log(`🔑 Session APRÈS login: ${newSessionId}`);
          console.log(`👤 User ID: ${userId}`);

          console.log(
            '[CART-FUSION] Verification: guest=',
            guestSessionId,
            'userId=',
            userId,
          );

          if (guestSessionId && userId && guestSessionId !== userId) {
            try {
              console.log(
                '[CART-FUSION] Merging cart from',
                guestSessionId,
                'to userId',
                userId,
              );
              const mergedCount = await this.cartDataService.mergeCart(
                guestSessionId,
                userId,
              );
              if (mergedCount > 0) {
                console.log(
                  `✅ Panier fusionné: ${mergedCount} articles transférés vers userId`,
                );
              }
            } catch (mergeError) {
              console.error('⚠️ Erreur fusion panier:', mergeError);
              // Ne pas bloquer le login
            }
          }

          // ✅ Vérifier redirectTo (query ou body) avant la redirection par défaut
          const redirectTo =
            (request as any).body?.redirectTo ||
            (request as any).query?.redirectTo;

          if (
            redirectTo &&
            typeof redirectTo === 'string' &&
            redirectTo.startsWith('/') &&
            !redirectTo.startsWith('//')
          ) {
            console.log(`✅ Redirection vers: ${redirectTo}`);
            response.redirect(redirectTo);
            resolve();
            return;
          }

          // Redirection par défaut selon le type et niveau d'utilisateur
          if (user.isAdmin && userLevel >= 7) {
            console.log(
              `Admin niveau ${userLevel} détecté, redirection vers dashboard admin`,
            );
            response.redirect('/admin');
          } else if (user.isAdmin && userLevel >= 4) {
            console.log(
              `Admin niveau ${userLevel} détecté, redirection vers admin`,
            );
            response.redirect('/admin');
          } else if (user.isPro) {
            console.log(
              'Utilisateur pro détecté, redirection vers dashboard pro',
            );
            response.redirect('/pro/dashboard');
          } else {
            console.log('Utilisateur standard, redirection vers accueil');
            response.redirect('/');
          }

          resolve();
        });
      });
    });
  }

  @Post('auth/logout')
  @ApiOperation({
    summary: 'Logout current user',
    description:
      'Destroy user session, clear cookies, and log out. Redirects to homepage after logout.',
  })
  @ApiCookieAuth('connect.sid')
  @ApiResponse({
    status: 302,
    description: 'Logout successful, redirects to homepage',
  })
  @ApiResponse({
    status: 500,
    description: 'Error during logout',
  })
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

  /**
   * POST /auth/set-password
   * Définir le mot de passe pour un compte guest (via token d'activation)
   */
  @Post('auth/set-password')
  @ApiOperation({
    summary: 'Set password for guest account',
    description:
      'Allows guest users to set their password using the activation token received by email.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['token', 'password'],
      properties: {
        token: { type: 'string', description: 'Activation token from email' },
        password: {
          type: 'string',
          format: 'password',
          minLength: 8,
          description: 'New password (min 8 chars)',
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Password set successfully' })
  @ApiResponse({ status: 400, description: 'Invalid or expired token' })
  async setPassword(
    @Body() body: { token: string; password: string },
  ): Promise<any> {
    try {
      const { token, password } = body;

      if (!token || !password) {
        return { success: false, message: 'Token et mot de passe requis' };
      }

      if (password.length < 8) {
        return {
          success: false,
          message: 'Le mot de passe doit contenir au moins 8 caractères',
        };
      }

      // Hash the token to look up in Redis
      const hashedToken = crypto
        .createHash('sha256')
        .update(token)
        .digest('hex');

      const storedData = await this.redisCacheService.get(
        `guest_activation:${hashedToken}`,
      );

      if (!storedData) {
        return { success: false, message: 'Token invalide ou expiré' };
      }

      const { userId, email } = JSON.parse(storedData);

      // Hash the new password
      const hashedPassword = await this.passwordCrypto.hashPassword(password);

      // Update the user's password (updateUserPassword takes email as first param)
      await this.userService.updateUserPassword(email, hashedPassword);

      // Delete the token (one-time use)
      await this.redisCacheService.delete(`guest_activation:${hashedToken}`);

      this.logger.log(
        `Password set successfully for guest user ${userId} (${email})`,
      );

      return {
        success: true,
        message:
          'Mot de passe défini avec succès. Vous pouvez maintenant vous connecter.',
        email,
      };
    } catch (error: any) {
      this.logger.error('Error in set-password:', error);
      return {
        success: false,
        message: 'Erreur technique lors de la définition du mot de passe',
      };
    }
  }
}
