import {
  Controller,
  Get,
  Next,
  Post,
  Req,
  Res,
  UseGuards,
  Body,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { NextFunction, Response } from 'express';
import { LocalAuthGuard } from '../local-auth.guard';
import { UsersService } from '../../modules/users/users.service';
import { AuthService } from '../auth.service';
import { UserService } from '../../database/services/user.service';
import { CartDataService } from '../../database/services/cart-data.service';
import { LoginResponseDto } from '../dto/login-response.dto';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import RegisterSchema, {
  RegisterDto,
  RegisterDtoClass,
} from '../dto/register.dto';
import { extractGuestSessionId } from './auth-controller.utils';

@ApiTags('auth')
@Controller()
export class AuthLoginController {
  private readonly logger = new Logger(AuthLoginController.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly authService: AuthService,
    private readonly userService: UserService,
    private readonly cartDataService: CartDataService,
  ) {}

  /**
   * POST /auth/register
   * Créer un nouveau compte utilisateur
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
      await this.userService.createUser({
        email: userData.email,
        password: userData.password,
        firstName: userData.firstName,
        lastName: userData.lastName,
      });

      const loginResult = await this.authService.login(
        userData.email,
        userData.password,
        (request as any).ip,
      );

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
    const originalUrl = (request as any).originalUrl || '/auth/login';
    const queryIndex = originalUrl.indexOf('?');
    const query = queryIndex >= 0 ? originalUrl.slice(queryIndex) : '';
    const target = `/login${query}`;
    return response.redirect(target);
  }

  /**
   * GET /authenticate - Redirige vers la page de login
   */
  @Get('authenticate')
  authenticateGet(@Res() response: Response) {
    return response.redirect('/auth/login');
  }

  /**
   * POST /authenticate
   * Guard-protected login with session regeneration & cart merge
   */
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
    const cookieHeader = (request as any).headers?.cookie || '';
    console.log('[CART-FUSION] Cookie header:', cookieHeader.substring(0, 150));
    const guestSessionId = extractGuestSessionId(cookieHeader);
    if (guestSessionId) {
      console.log('[CART-FUSION] Guest session ID extracted:', guestSessionId);
    } else {
      console.log('[CART-FUSION] No guest session ID found');
    }

    const user = request.user as any;
    const userLevel = parseInt(user.level) || 0;

    // Régénérer la session de manière sécurisée
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

        (request as any).login(user, async (loginErr: any) => {
          if (loginErr) {
            console.error('❌ Erreur réattachement utilisateur:', loginErr);
            response.redirect('/');
            return resolve();
          }

          // FUSION DE PANIER: Fusionner vers userId
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
            }
          }

          // Vérifier redirectTo (query ou body) avant la redirection par défaut
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

  /**
   * POST /auth/logout
   * Destroy session, clear cookies, redirect to homepage
   */
  @Post('auth/logout')
  @ApiOperation({
    summary: 'Logout current user',
    description:
      'Destroy user session, clear cookies, and log out. Redirects to homepage after logout.',
  })
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

    request.logOut(function (err) {
      if (err) {
        console.error('Erreur logout:', err);
        return next(err);
      }
      console.log('LogOut réussi, user après:', request.user);

      request.session.destroy(() => {
        response.clearCookie('connect.sid');
        console.log('Session détruite et cookie effacé');
        console.log('--- POST /auth/logout REDIRECTION vers / ---');
        response.redirect('/');
      });
    });
  }
}
