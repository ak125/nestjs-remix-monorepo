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
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { NextFunction, Request, Response } from 'express';
import { LocalAuthGuard } from '../local-auth.guard';
import { UsersService } from '../../modules/users/users.service';
import { AuthService } from '../auth.service';
import { UserDataConsolidatedService } from '../../modules/users/services/user-data-consolidated.service';
import { CartDataService } from '../../database/services/cart-data.service';
import { LoginResponseDto } from '../dto/login-response.dto';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import RegisterSchema, {
  RegisterDto,
  RegisterDtoClass,
} from '../dto/register.dto';
import { extractGuestSessionId } from './auth-controller.utils';
import {
  promisifyLogin,
  promisifyLogout,
  promisifySessionRegenerate,
  promisifySessionDestroy,
} from '../../utils/promise-helpers';

@ApiTags('auth')
@Controller()
export class AuthLoginController {
  private readonly logger = new Logger(AuthLoginController.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly authService: AuthService,
    private readonly userDataService: UserDataConsolidatedService,
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
  ): Promise<Record<string, unknown>> {
    try {
      await this.userDataService.create({
        email: userData.email,
        password: userData.password,
        firstName: userData.firstName,
        lastName: userData.lastName,
      });

      const loginResult = await this.authService.login(
        userData.email,
        userData.password,
        (request as Request).ip,
      );

      await promisifyLogin(request, loginResult.user);
      return {
        success: true,
        message: 'Compte créé avec succès',
        user: loginResult.user,
        sessionToken: loginResult.access_token,
      };
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      if (errMsg.includes('déjà utilisé')) {
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
        debug: process.env.NODE_ENV === 'development' ? errMsg : undefined,
      };
    }
  }

  /**
   * POST /auth/check-email
   * Vérifie si un email existe (pour le checkout style Amazon)
   */
  @Post('auth/check-email')
  @ApiOperation({ summary: 'Check if email exists for checkout flow' })
  async checkEmail(@Body() body: { email: string }) {
    const email = body.email?.toLowerCase()?.trim();
    if (!email) {
      return { exists: false };
    }
    try {
      const user = await this.usersService.findByEmail(email);
      return { exists: !!user };
    } catch {
      return { exists: false };
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
  ): Promise<Record<string, unknown>> {
    // Extraire le guest session ID AVANT toute modification de session (même pattern que /authenticate)
    const cookieHeader = (request as Request).headers?.cookie || '';
    const guestSessionId = extractGuestSessionId(cookieHeader);

    let loginResult: { user: any; access_token: string };
    try {
      loginResult = await this.authService.login(
        credentials.email,
        credentials.password,
        (request as Request).ip,
      );
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Email ou mot de passe incorrect';
      throw new HttpException(
        { success: false, error: message, message },
        HttpStatus.UNAUTHORIZED,
      );
    }

    // Régénérer la session (sécurité : prévient les attaques session fixation)
    try {
      await promisifySessionRegenerate(request.session);
    } catch (regenerateErr) {
      this.logger.error(
        'Erreur régénération session lors du login inline:',
        regenerateErr,
      );
      throw new HttpException(
        {
          success: false,
          error: 'Erreur interne de session',
          message: 'Erreur interne de session',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    // Rattacher l'utilisateur à la session régénérée via Passport
    await promisifyLogin(request, loginResult.user);

    // Fusionner le panier guest vers l'utilisateur authentifié
    const userId = loginResult.user?.id;
    if (guestSessionId && userId && guestSessionId !== String(userId)) {
      try {
        const mergedCount = await this.cartDataService.mergeCart(
          guestSessionId,
          String(userId),
        );
        if (mergedCount > 0) {
          this.logger.log(
            `[CART-FUSION] Login inline: ${mergedCount} articles fusionnés de ${guestSessionId} vers userId ${userId}`,
          );
        }
      } catch (mergeErr) {
        this.logger.error(
          `Erreur fusion panier lors du login inline: ${mergeErr instanceof Error ? mergeErr.message : String(mergeErr)}`,
        );
      }
    }

    return {
      success: true,
      message: 'Connexion réussie',
      user: loginResult.user,
      sessionToken: loginResult.access_token,
    };
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
    const originalUrl = (request as Request).originalUrl || '/auth/login';
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
    const cookieHeader = (request as Request).headers?.cookie || '';
    this.logger.log(
      `[CART-FUSION] Cookie header: ${cookieHeader.substring(0, 150)}`,
    );
    const guestSessionId = extractGuestSessionId(cookieHeader);
    if (guestSessionId) {
      this.logger.log(
        `[CART-FUSION] Guest session ID extracted: ${guestSessionId}`,
      );
    } else {
      this.logger.log('[CART-FUSION] No guest session ID found');
    }

    const user = request.user;
    const userLevel = parseInt(String(user?.level)) || 0;

    // Régénérer la session de manière sécurisée
    try {
      await promisifySessionRegenerate(request.session);
    } catch (regenerateErr) {
      this.logger.error({ err: regenerateErr }, 'Erreur régénération session');
      return response.redirect('/');
    }

    try {
      await promisifyLogin(request, user);
    } catch (loginErr: unknown) {
      this.logger.error(
        `Erreur réattachement utilisateur: ${loginErr instanceof Error ? loginErr.message : String(loginErr)}`,
      );
      return response.redirect('/');
    }

    // FUSION DE PANIER: Fusionner vers userId
    const userId = user?.id;
    const newSessionId = request.session?.id;
    this.logger.log(`Session APRES login: ${newSessionId}`);
    this.logger.log(`User ID: ${userId}`);

    this.logger.log(
      `[CART-FUSION] Verification: guest=${guestSessionId} userId=${userId}`,
    );

    if (guestSessionId && userId && guestSessionId !== userId) {
      try {
        this.logger.log(
          `[CART-FUSION] Merging cart from ${guestSessionId} to userId ${userId}`,
        );
        const mergedCount = await this.cartDataService.mergeCart(
          guestSessionId,
          String(userId),
        );
        if (mergedCount > 0) {
          this.logger.log(
            `Panier fusionné: ${mergedCount} articles transférés vers userId`,
          );
        }
      } catch (mergeError: unknown) {
        this.logger.error(
          `Erreur fusion panier: ${mergeError instanceof Error ? mergeError.message : String(mergeError)}`,
        );
      }
    }

    // Vérifier redirectTo (query ou body) avant la redirection par défaut
    const expressReq = request as Request;
    const redirectTo =
      expressReq.body?.redirectTo || expressReq.query?.redirectTo;

    if (
      redirectTo &&
      typeof redirectTo === 'string' &&
      redirectTo.startsWith('/') &&
      !redirectTo.startsWith('//')
    ) {
      this.logger.log(`Redirection vers: ${redirectTo}`);
      return response.redirect(redirectTo);
    }

    // Redirection par défaut selon le type et niveau d'utilisateur
    if (user?.isAdmin && userLevel >= 7) {
      this.logger.log(
        `Admin niveau ${userLevel} détecté, redirection vers dashboard admin`,
      );
      response.redirect('/admin');
    } else if (user?.isAdmin && userLevel >= 4) {
      this.logger.log(
        `Admin niveau ${userLevel} détecté, redirection vers admin`,
      );
      response.redirect('/admin');
    } else if (user?.isPro) {
      this.logger.log(
        'Utilisateur pro détecté, redirection vers dashboard pro',
      );
      response.redirect('/pro/dashboard');
    } else {
      this.logger.log('Utilisateur standard, redirection vers accueil');
      response.redirect('/');
    }
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
    this.logger.log('--- POST /auth/logout DEBUT ---');
    this.logger.log(`User avant logout: ${JSON.stringify(request.user)}`);

    try {
      await promisifyLogout(request);
    } catch (err: unknown) {
      this.logger.error(
        `Erreur logout: ${err instanceof Error ? err.message : String(err)}`,
      );
      return next(err);
    }

    this.logger.log(
      `LogOut réussi, user après: ${JSON.stringify(request.user)}`,
    );
    await promisifySessionDestroy(request.session);
    response.clearCookie('connect.sid');
    this.logger.log('Session détruite et cookie effacé');
    this.logger.log('--- POST /auth/logout REDIRECTION vers / ---');
    response.redirect('/');
  }
}
