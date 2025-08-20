import {
  Controller,
  Get,
  Next,
  Post,
  Req,
  Res,
  UseGuards,
  Body,
} from '@nestjs/common';
import { NextFunction, Response } from 'express';
import { LocalAuthGuard } from './local-auth.guard';
import { UsersService } from '../modules/users/users.service';
import { AuthService } from './auth.service';

@Controller()
export class AuthController {
  constructor(
    private readonly usersService: UsersService,
    private readonly authService: AuthService,
  ) {}

  /**
   * POST /auth/register
   * Créer un nouveau compte utilisateur
   */
  @Post('auth/register')
  async register(@Body() userData: any, @Req() request: Express.Request) {
    try {
      // Créer l'utilisateur via UsersService
      await this.usersService.createUser(userData);

      // Authentifier automatiquement l'utilisateur
      const loginResult = await this.authService.login(
        userData.email,
        userData.password,
        (request as any).ip,
      );

      return {
        success: true,
        message: 'Compte créé avec succès',
        user: loginResult.user,
        sessionToken: loginResult.access_token,
      };
    } catch (error: any) {
      if (error.message?.includes('déjà utilisé')) {
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
          process.env.NODE_ENV === 'development' ? error.message : undefined,
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
}
