import { Controller, Post, Req, Res, UseGuards, Logger } from '@nestjs/common';
import { Response } from 'express';
import { LocalAuthGuard } from './local-auth.guard';
import { AuthService } from './auth.service';
import { UserService } from '../database/services/user.service';
import { CartDataService } from '../database/services/cart-data.service';

@Controller() // Pas de préfixe = route directe
export class AuthenticateController {
  private readonly logger = new Logger(AuthenticateController.name);

  constructor(
    private readonly authService: AuthService,
    private readonly userService: UserService,
    private readonly cartDataService: CartDataService,
  ) {}
  @UseGuards(LocalAuthGuard)
  @Post('authenticate')
  async login(@Req() request: Express.Request, @Res() response: Response) {
    console.log('--- POST /authenticate - Redirection conditionnelle ---');
    console.log('User connecté:', request.user);

    if (!request.user) {
      console.log('Aucun utilisateur, redirection vers /');
      return response.redirect('/');
    }

    // 🔄 FUSION DE PANIER: Récupérer l'ancienne session avant qu'elle change
    const oldSessionId = (request as any).session?.id;
    this.logger.log(`🔑 Ancienne session (anonyme): ${oldSessionId}`);

    // L'utilisateur est maintenant authentifié, Passport va regénérer la session
    // On doit attendre que la nouvelle session soit créée pour la fusion
    const user = request.user as any;
    const isAdmin = user.isAdmin || user.role === 'admin' || user.level >= 100;

    // Regénérer la session pour sécurité (évite session fixation attacks)
    return new Promise<void>((resolve) => {
      (request as any).session.regenerate(async (err: any) => {
        if (err) {
          this.logger.error('❌ Erreur régénération session:', err);
          return response.redirect('/');
        }

        // Réassigner l'utilisateur à la nouvelle session
        (request as any).login(user, async (loginErr: any) => {
          if (loginErr) {
            this.logger.error('❌ Erreur login après régénération:', loginErr);
            return response.redirect('/');
          }

          // 🔄 FUSION DE PANIER: Nouvelle session créée
          const newSessionId = (request as any).session?.id;
          this.logger.log(
            `🔑 Nouvelle session (authentifiée): ${newSessionId}`,
          );

          // Si on a les deux sessions et qu'elles sont différentes, fusionner
          if (oldSessionId && newSessionId && oldSessionId !== newSessionId) {
            try {
              const mergedCount = await this.cartDataService.mergeCart(
                oldSessionId,
                newSessionId,
              );
              if (mergedCount > 0) {
                this.logger.log(
                  `✅ Panier fusionné: ${mergedCount} articles transférés`,
                );
              }
            } catch (mergeError) {
              this.logger.error('⚠️ Erreur fusion panier:', mergeError);
              // Ne pas bloquer le login si la fusion échoue
            }
          }

          // Redirection finale
          if (isAdmin) {
            console.log('Admin authentifié, redirection vers /dashboard');
            response.redirect('/dashboard');
          } else {
            console.log('Utilisateur standard, redirection vers /');
            response.redirect('/');
          }
          resolve();
        });
      });
    });
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
      console.log("📝 Données d'inscription reçues:", {
        email: body.email,
        firstName: body.firstName,
        lastName: body.lastName,
      });

      // 🔄 FUSION DE PANIER: Sauvegarder l'ancienne session
      const oldSessionId = (request as any).session?.id;
      this.logger.log(`🔑 Session avant inscription: ${oldSessionId}`);

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

      // 3. Créer la session Passport avec fusion de panier
      return new Promise<void>((resolve, reject) => {
        (request as any).session.regenerate(async (regenerateErr: any) => {
          if (regenerateErr) {
            this.logger.error('❌ Erreur régénération session:', regenerateErr);
            return response.redirect(
              '/register?error=Erreur lors de la création de session',
            );
          }

          (request as any).login(loginResult.user, async (err: any) => {
            if (err) {
              console.error('❌ Erreur lors de la création de session:', err);
              reject(err);
            } else {
              // 🔄 FUSION DE PANIER: Nouvelle session créée
              const newSessionId = (request as any).session?.id;
              this.logger.log(
                `🔑 Nouvelle session après inscription: ${newSessionId}`,
              );

              // Fusionner le panier anonyme si disponible
              if (
                oldSessionId &&
                newSessionId &&
                oldSessionId !== newSessionId
              ) {
                try {
                  const mergedCount = await this.cartDataService.mergeCart(
                    oldSessionId,
                    newSessionId,
                  );
                  if (mergedCount > 0) {
                    this.logger.log(
                      `✅ Panier fusionné après inscription: ${mergedCount} articles`,
                    );
                  }
                } catch (mergeError) {
                  this.logger.error(
                    '⚠️ Erreur fusion panier inscription:',
                    mergeError,
                  );
                }
              }

              console.log("✅ Session créée, redirection vers page d'accueil");
              // Les inscriptions publiques créent toujours des utilisateurs normaux
              // Les admins sont créés par d'autres admins via le panel admin
              response.redirect('/?register=success');
              resolve();
            }
          });
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
