import { Controller, Post, Req, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { LocalAuthGuard } from './local-auth.guard';
import { AuthService } from './auth.service';
import { UserService } from '../database/services/user.service';

@Controller() // Pas de préfixe = route directe
export class AuthenticateController {
  constructor(
    private readonly authService: AuthService,
    private readonly userService: UserService,
  ) {}
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
    const isAdmin = user.isAdmin || user.role === 'admin' || user.level >= 100;

    if (isAdmin) {
      console.log('Admin authentifié, redirection vers /dashboard');
      return response.redirect('/dashboard');
    } else {
      console.log('Utilisateur standard, redirection vers /');
      return response.redirect('/');
    }
  }

  @Post('register-and-login')
  async registerAndLogin(
    @Req() request: Express.Request,
    @Res() response: Response,
  ) {
    console.log(
      '--- POST /register-and-login - Inscription + Connexion automatique ---',
    );

    try {
      const body = (request as any).body;
      console.log('📝 Données d\'inscription reçues:', {
        email: body.email,
        firstName: body.firstName,
        lastName: body.lastName,
      });

      // 1. Créer l'utilisateur
      await this.userService.createUser({
        email: body.email,
        password: body.password,
        firstName: body.firstName,
        lastName: body.lastName,
      });

      // 2. Connecter automatiquement l'utilisateur
      const loginResult = await this.authService.login(
        body.email,
        body.password,
        (request as any).ip,
      );

      // 3. Créer la session Passport
      return new Promise<void>((resolve, reject) => {
        (request as any).login(loginResult.user, (err: any) => {
          if (err) {
            console.error('❌ Erreur lors de la création de session:', err);
            reject(err);
          } else {
            console.log("✅ Session créée, redirection vers page d'accueil");
            // Les inscriptions publiques créent toujours des utilisateurs normaux
            // Les admins sont créés par d'autres admins via le panel admin
            response.redirect('/?register=success');
            resolve();
          }
        });
      });
    } catch (error: any) {
      console.error('❌ Erreur inscription:', error);
      if (error.message?.includes('déjà utilisé')) {
        return response.redirect('/register?error=Cet email est déjà utilisé');
      }
      return response.redirect(
        '/register?error=Erreur lors de la création du compte',
      );
    }
  }

  @Post('logout')
  @Post('auth/logout')
  async logout(@Req() request: Express.Request, @Res() response: Response) {
    console.log('--- POST /logout ou /auth/logout - Déconnexion ---');

    return new Promise<void>((resolve) => {
      (request as any).logout((err: any) => {
        if (err) {
          console.error('❌ Erreur lors de la déconnexion:', err);
        }
        console.log('✅ Déconnexion réussie, redirection vers /');
        response.redirect('/');
        resolve();
      });
    });
  }
}
