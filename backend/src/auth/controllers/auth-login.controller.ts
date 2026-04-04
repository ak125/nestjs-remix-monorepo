import {
  Controller,
  Get,
  Next,
  Post,
  Query,
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
import { UsersFinalService } from '../../modules/users/users-final.service';
import { AuthService, LoginResult } from '../auth.service';
import { UserDataConsolidatedService } from '../../modules/users/services/user-data-consolidated.service';
import { CartDataService } from '../../database/services/cart-data.service';
import { MailService } from '../../services/mail.service';
import { LoginResponseDto } from '../dto/login-response.dto';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import RegisterSchema, {
  RegisterDto,
  RegisterDtoClass,
} from '../dto/register.dto';
import { extractGuestSessionId } from './auth-controller.utils';
import {
  promisifyLoginNoRegenerate,
  promisifyLogout,
  promisifySessionRegenerate,
  promisifySessionSave,
  promisifySessionDestroy,
} from '../../utils/promise-helpers';
import { RateLimitStrict } from '../../common/decorators/rate-limit.decorator';

@ApiTags('auth')
@Controller()
export class AuthLoginController {
  private readonly logger = new Logger(AuthLoginController.name);

  constructor(
    private readonly usersFinalService: UsersFinalService,
    private readonly authService: AuthService,
    private readonly userDataService: UserDataConsolidatedService,
    private readonly cartDataService: CartDataService,
    private readonly mailService: MailService,
  ) {}

  /**
   * POST /auth/register
   * Créer un nouveau compte utilisateur
   */
  @Post('auth/register')
  @RateLimitStrict()
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

      // Passport 0.7 + connect-redis 5.x compat
      await promisifySessionRegenerate(request.session);
      await promisifyLoginNoRegenerate(request, loginResult.user);
      await promisifySessionSave(request.session);

      // Welcome email (non-bloquant)
      try {
        await this.mailService.sendWelcomeEmail(
          userData.email,
          userData.firstName,
        );
      } catch (welcomeErr: unknown) {
        this.logger.warn(
          `Welcome email failed (non-blocking): ${welcomeErr instanceof Error ? welcomeErr.message : String(welcomeErr)}`,
        );
      }

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
   * POST /register-and-login
   * Inscription + auto-login + cart merge + redirect (form-urlencoded)
   * Pattern identique à POST /authenticate mais avec création de compte
   */
  @Post('register-and-login')
  async registerAndLogin(
    @Req() request: Express.Request,
    @Res() response: Response,
  ) {
    const body = (request as Request).body || {};
    const email = String(body.email || '')
      .toLowerCase()
      .trim();
    const password = String(body.password || '');
    const confirmPassword = String(body.confirmPassword || '');
    const firstName = String(body.firstName || '').trim();
    const lastName = String(body.lastName || '').trim();
    const civility = body.civility || undefined;
    const phone = String(body.phone || '').trim() || undefined;

    // Billing → mapped to CreateUserDto fields
    const address1 = String(body['billing.address1'] || '').trim();
    const address2 = String(body['billing.address2'] || '').trim();
    const address = address2 ? `${address1}, ${address2}` : address1;
    const zipCode =
      String(body['billing.postalCode'] || '').trim() || undefined;
    const city = String(body['billing.city'] || '').trim() || undefined;
    const country = String(body['billing.country'] || 'FR').trim();

    // Honeypot anti-spam : champ invisible rempli = bot
    if (body.website) {
      return response.redirect('/register');
    }

    // Validation basique
    if (!email) {
      return response.redirect(
        '/register?error=' + encodeURIComponent('Email requis'),
      );
    }
    if (password.length < 6) {
      return response.redirect(
        '/register?error=' +
          encodeURIComponent(
            'Le mot de passe doit contenir au moins 6 caractères',
          ),
      );
    }
    if (password !== confirmPassword) {
      return response.redirect(
        '/register?error=' +
          encodeURIComponent('Les mots de passe ne correspondent pas'),
      );
    }

    // Création du compte
    try {
      await this.userDataService.create({
        email,
        password,
        firstName: firstName || undefined,
        lastName: lastName || undefined,
        civility,
        phone,
        address: address || undefined,
        zipCode,
        city,
        country,
      });
    } catch (error: unknown) {
      const errMsg =
        error instanceof Error
          ? error.message
          : typeof error === 'object' && error !== null
            ? JSON.stringify(error)
            : String(error);
      this.logger.error(`[REGISTER] Erreur création compte: ${errMsg}`);

      if (errMsg.includes('déjà utilisé') || errMsg.includes('duplicate')) {
        return response.redirect(
          '/register?error=' + encodeURIComponent('Cet email est déjà utilisé'),
        );
      }
      return response.redirect(
        '/register?error=' +
          encodeURIComponent('Erreur lors de la création du compte'),
      );
    }

    // Auto-login (même pattern que POST /authenticate)
    let loginResult: LoginResult;
    try {
      loginResult = await this.authService.login(
        email,
        password,
        (request as Request).ip,
      );
    } catch (loginErr: unknown) {
      this.logger.error(
        `[REGISTER] Login après inscription échoué: ${loginErr instanceof Error ? loginErr.message : String(loginErr)}`,
      );
      // Compte créé mais login échoué → rediriger vers login
      return response.redirect(
        '/login?register=success&message=' +
          encodeURIComponent('Compte créé, veuillez vous connecter'),
      );
    }

    // Welcome email (non-bloquant)
    try {
      await this.mailService.sendWelcomeEmail(email, firstName);
    } catch (welcomeErr: unknown) {
      this.logger.warn(
        `[REGISTER] Welcome email failed (non-blocking): ${welcomeErr instanceof Error ? welcomeErr.message : String(welcomeErr)}`,
      );
    }

    // Cart merge: extraire guest session AVANT regeneration
    const cookieHeader = (request as Request).headers?.cookie || '';
    const guestSessionId = extractGuestSessionId(cookieHeader);

    // Session: regenerate → login → save
    try {
      await promisifySessionRegenerate(request.session);
      await promisifyLoginNoRegenerate(request, loginResult.user);
      await promisifySessionSave(request.session);
    } catch (sessionErr: unknown) {
      this.logger.error(
        `[REGISTER] Session error: ${sessionErr instanceof Error ? sessionErr.message : String(sessionErr)}`,
      );
      return response.redirect('/');
    }

    // Cart merge
    const userId = loginResult.user?.id;
    if (guestSessionId && userId && guestSessionId !== String(userId)) {
      try {
        const mergedCount = await this.cartDataService.mergeCart(
          guestSessionId,
          String(userId),
        );
        if (mergedCount > 0) {
          this.logger.log(
            `[REGISTER] Panier fusionné: ${mergedCount} articles`,
          );
        }
      } catch (mergeError: unknown) {
        this.logger.error(
          `[REGISTER] Erreur fusion panier: ${mergeError instanceof Error ? mergeError.message : String(mergeError)}`,
        );
      }
    }

    // Redirect
    const expressReq = request as Request;
    const redirectTo =
      expressReq.body?.redirectTo || expressReq.query?.redirectTo;

    if (
      redirectTo &&
      typeof redirectTo === 'string' &&
      redirectTo.startsWith('/') &&
      !redirectTo.startsWith('//')
    ) {
      return response.redirect(redirectTo);
    }

    const user = loginResult.user;
    const userLevel = parseInt(String(user?.level), 10) || 0;

    if (user?.isAdmin && userLevel >= 7) {
      return response.redirect('/admin');
    } else if (user?.isPro) {
      return response.redirect('/pro/dashboard');
    }

    return response.redirect('/');
  }

  /**
   * POST /auth/google
   * Authentification via Google Identity Services (ID token)
   */
  @Post('auth/google')
  @ApiOperation({
    summary: 'Login or register with Google',
    description:
      'Authenticate using a Google ID token from Google Identity Services. Creates account if needed.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['credential'],
      properties: {
        credential: {
          type: 'string',
          description: 'Google ID token from GIS callback',
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Google auth successful' })
  @ApiResponse({ status: 401, description: 'Invalid Google token' })
  async googleAuth(
    @Body() body: { credential: string; redirectTo?: string },
    @Req() request: Express.Request,
  ): Promise<Record<string, unknown>> {
    if (!body.credential) {
      throw new HttpException(
        { success: false, message: 'Token Google manquant' },
        HttpStatus.BAD_REQUEST,
      );
    }

    // Extraire le guest session ID AVANT modification de session
    const cookieHeader = (request as Request).headers?.cookie || '';
    const guestSessionId = extractGuestSessionId(cookieHeader);

    // Authentifier avec Google (vérifie token, crée/lie compte)
    const authUser = await this.authService.authenticateWithGoogle(
      body.credential,
    );

    // Créer la session directement (pas de login() car pas de password)
    try {
      await promisifySessionRegenerate(request.session);
      await promisifyLoginNoRegenerate(request, authUser);
      await promisifySessionSave(request.session);
    } catch (sessionErr: unknown) {
      this.logger.error(
        `[GOOGLE-AUTH] Session error: ${sessionErr instanceof Error ? sessionErr.message : String(sessionErr)}`,
      );
      throw new HttpException(
        { success: false, message: 'Erreur de session' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    // Cart merge
    const userId = authUser.id;
    if (guestSessionId && userId && guestSessionId !== String(userId)) {
      try {
        const mergedCount = await this.cartDataService.mergeCart(
          guestSessionId,
          String(userId),
        );
        if (mergedCount > 0) {
          this.logger.log(
            `[GOOGLE-AUTH] Panier fusionné: ${mergedCount} articles`,
          );
        }
      } catch (mergeErr: unknown) {
        this.logger.error(
          `[GOOGLE-AUTH] Erreur fusion panier: ${mergeErr instanceof Error ? mergeErr.message : String(mergeErr)}`,
        );
      }
    }

    // Déterminer l'URL de redirection
    // Si redirectTo est fourni et est un chemin relatif sûr, l'utiliser
    const safeRedirectTo =
      body.redirectTo &&
      body.redirectTo.startsWith('/') &&
      !body.redirectTo.startsWith('//')
        ? body.redirectTo
        : null;

    const userLevel = parseInt(String(authUser.level), 10) || 0;
    let redirectUrl = safeRedirectTo || '/';
    if (!safeRedirectTo) {
      if (authUser.isAdmin && userLevel >= 7) {
        redirectUrl = '/admin';
      } else if (authUser.isPro) {
        redirectUrl = '/pro/dashboard';
      }
    }

    return {
      success: true,
      message: 'Connexion Google réussie',
      user: authUser,
      redirectUrl,
    };
  }

  /**
   * GET /auth/google
   * Redirige vers l'écran de consentement Google OAuth2
   */
  @Get('auth/google')
  @ApiOperation({
    summary: 'Redirect to Google OAuth2 consent screen',
    description:
      'Initiates Google OAuth2 redirect flow. Redirects user to Google for authentication.',
  })
  googleRedirect(
    @Query('redirectTo') redirectTo: string | undefined,
    @Req() request: Express.Request,
    @Res() response: Response,
  ) {
    const expressReq = request as Request;
    const protocol =
      expressReq.headers['x-forwarded-proto'] || expressReq.protocol || 'http';
    const host =
      expressReq.headers['x-forwarded-host'] || expressReq.headers.host;
    const redirectUri = `${protocol}://${host}/auth/callback`;

    const { url: authUrl, nonce } = this.authService.getGoogleAuthUrl(
      redirectUri,
      redirectTo,
    );

    // Stocker le nonce en session pour vérification CSRF au callback
    (request as Request).session.googleNonce = nonce;
    await new Promise<void>((resolve, reject) =>
      (request as Request).session.save((err) =>
        err ? reject(err) : resolve(),
      ),
    );

    this.logger.log(
      `[GOOGLE-OAUTH] Redirecting to Google, callback: ${redirectUri}`,
    );
    return response.redirect(authUrl);
  }

  /**
   * GET /auth/callback
   * Callback Google OAuth2 — échange code, crée session, redirige
   */
  @Get('auth/callback')
  @ApiOperation({
    summary: 'Google OAuth2 callback',
    description:
      'Handles the Google OAuth2 callback. Exchanges code for tokens, creates or links user account, and establishes session.',
  })
  async googleCallback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') googleError: string | undefined,
    @Req() request: Express.Request,
    @Res() response: Response,
  ) {
    // Google returned an error
    if (googleError) {
      this.logger.warn(`[GOOGLE-OAUTH] Google returned error: ${googleError}`);
      return response.redirect(
        '/login?error=' + encodeURIComponent('Connexion Google annulée'),
      );
    }

    if (!code) {
      return response.redirect(
        '/login?error=' + encodeURIComponent('Code Google manquant'),
      );
    }

    // Decode state to get redirectTo + verify CSRF nonce
    let redirectTo = '/';
    if (state) {
      try {
        const decoded = JSON.parse(Buffer.from(state, 'base64url').toString());
        // Vérification nonce CSRF : doit correspondre à la session
        const sessionNonce = (request as Request).session?.googleNonce;
        if (!sessionNonce || !decoded.nonce || decoded.nonce !== sessionNonce) {
          this.logger.warn(
            '[GOOGLE-OAUTH] CSRF nonce mismatch — rejecting callback',
          );
          return response.redirect(
            '/login?error=' +
              encodeURIComponent('Erreur de sécurité, veuillez réessayer'),
          );
        }
        // Nonce valide : supprimer de la session (usage unique)
        delete (request as Request).session.googleNonce;
        if (
          decoded.redirectTo &&
          typeof decoded.redirectTo === 'string' &&
          decoded.redirectTo.startsWith('/') &&
          !decoded.redirectTo.startsWith('//')
        ) {
          redirectTo = decoded.redirectTo;
        }
      } catch {
        this.logger.warn('[GOOGLE-OAUTH] Failed to decode state param');
      }
    }

    // Build redirect URI (same as the one used in /auth/google)
    const expressReq = request as Request;
    const protocol =
      expressReq.headers['x-forwarded-proto'] || expressReq.protocol || 'http';
    const host =
      expressReq.headers['x-forwarded-host'] || expressReq.headers.host;
    const redirectUri = `${protocol}://${host}/auth/callback`;

    try {
      // 1. Exchange code for ID token
      const idToken = await this.authService.exchangeCodeForTokens(
        code,
        redirectUri,
      );

      // 2. Authenticate with Google (verify token, create/link account)
      const authUser = await this.authService.authenticateWithGoogle(idToken);

      // 3. Extract guest session BEFORE session modification
      const cookieHeader = expressReq.headers?.cookie || '';
      const guestSessionId = extractGuestSessionId(cookieHeader);

      // 4. Create session
      await promisifySessionRegenerate(request.session);
      await promisifyLoginNoRegenerate(request, authUser);
      await promisifySessionSave(request.session);

      // 5. Cart merge
      const userId = authUser.id;
      if (guestSessionId && userId && guestSessionId !== String(userId)) {
        try {
          const mergedCount = await this.cartDataService.mergeCart(
            guestSessionId,
            String(userId),
          );
          if (mergedCount > 0) {
            this.logger.log(
              `[GOOGLE-OAUTH] Panier fusionné: ${mergedCount} articles`,
            );
          }
        } catch (mergeErr: unknown) {
          this.logger.error(
            `[GOOGLE-OAUTH] Erreur fusion panier: ${mergeErr instanceof Error ? mergeErr.message : String(mergeErr)}`,
          );
        }
      }

      // 6. Redirect based on role (if no explicit redirectTo)
      if (redirectTo === '/') {
        const userLevel = parseInt(String(authUser.level), 10) || 0;
        if (authUser.isAdmin && userLevel >= 7) {
          redirectTo = '/admin';
        } else if (authUser.isPro) {
          redirectTo = '/pro/dashboard';
        }
      }

      this.logger.log(
        `[GOOGLE-OAUTH] Auth successful for ${authUser.email}, redirecting to ${redirectTo}`,
      );
      return response.redirect(redirectTo);
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(`[GOOGLE-OAUTH] Auth failed: ${errMsg}`);
      return response.redirect(
        '/login?error=' + encodeURIComponent('Erreur de connexion Google'),
      );
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
      const user = await this.usersFinalService.getUserByEmail(email);
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
    @Body()
    credentials: { email: string; password: string; rememberMe?: boolean },
    @Req() request: Express.Request,
  ): Promise<Record<string, unknown>> {
    // Extraire le guest session ID AVANT toute modification de session (même pattern que /authenticate)
    const cookieHeader = (request as Request).headers?.cookie || '';
    const guestSessionId = extractGuestSessionId(cookieHeader);

    let loginResult: LoginResult;
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

    // Passport 0.7 + connect-redis 5.x: regenerate explicite, login patché, save explicite
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

    await promisifyLoginNoRegenerate(request, loginResult.user);

    // Remember me: extend session to 90 days, default 7 days
    const sessionMaxAge = credentials.rememberMe
      ? 1000 * 60 * 60 * 24 * 90 // 90 days
      : 1000 * 60 * 60 * 24 * 7; // 7 days
    if (request.session?.cookie) {
      request.session.cookie.maxAge = sessionMaxAge;
    }

    await promisifySessionSave(request.session);

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
    const userLevel = parseInt(String(user?.level), 10) || 0;

    // Passport 0.7 + connect-redis 5.x: regenerate explicite, login patché, save explicite
    try {
      await promisifySessionRegenerate(request.session);
    } catch (regenerateErr) {
      this.logger.error(
        'Session regenerate failed during login:',
        regenerateErr,
      );
      return response.redirect('/');
    }

    try {
      await promisifyLoginNoRegenerate(request, user);
      await promisifySessionSave(request.session);
    } catch (loginErr: unknown) {
      this.logger.error(
        `Login session error: ${loginErr instanceof Error ? loginErr.message : String(loginErr)}`,
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
    const email = (request.user as Record<string, string>)?.email || 'none';

    try {
      await promisifyLogout(request);
    } catch (err: unknown) {
      this.logger.error(
        `Logout error for ${email}: ${err instanceof Error ? err.message : String(err)}`,
      );
      return next(err);
    }

    await promisifySessionDestroy(request.session);
    response.clearCookie('connect.sid');
    this.logger.log(`Logout: ${email}`);
    response.redirect('/');
  }
}
