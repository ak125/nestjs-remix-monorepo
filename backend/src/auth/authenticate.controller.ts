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

    // FUSION DE PANIER: Extraire DIRECTEMENT du cookie header
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
          this.logger.log(`🔑 Session après régénération: ${newSessionId}`);

          // Gestion du panier après connexion
          console.log(
            '[CART-FUSION] Verification: guest=',
            guestSessionId,
            'new=',
            newSessionId,
          );

          if (
            guestSessionId &&
            newSessionId &&
            guestSessionId !== newSessionId
          ) {
            try {
              console.log(
                '[CART-FUSION] Merging cart from',
                guestSessionId,
                'to',
                newSessionId,
              );

              // 📊 Obtenir l'état des paniers AVANT fusion
              const guestCart =
                await this.cartDataService.getCartItems(guestSessionId);
              const userCart =
                await this.cartDataService.getCartItems(newSessionId);

              const guestItemCount = guestCart?.length || 0;
              const userItemCount = userCart?.length || 0;

              this.logger.log(
                `📦 État avant fusion: Panier invité=${guestItemCount} articles, Panier utilisateur=${userItemCount} articles`,
              );

              // 🛒 Fusionner le panier invité vers l'utilisateur
              // La méthode mergeCart gère déjà l'addition des quantités et le nettoyage de la source
              const mergedCount = await this.cartDataService.mergeCart(
                guestSessionId,
                newSessionId,
              );

              if (mergedCount > 0) {
                this.logger.log(
                  `✅ Panier fusionné: ${mergedCount} articles transférés depuis le panier invité`,
                );

                // 💡 Stocker l'info de fusion dans la session pour afficher une notification
                if (userItemCount > 0) {
                  (request as any).session.cartMergeInfo = {
                    guestItems: guestItemCount,
                    existingItems: userItemCount,
                    merged: true,
                    timestamp: new Date().toISOString(),
                  };
                  this.logger.log(
                    `💬 Info fusion stockée: ${guestItemCount} nouveaux + ${userItemCount} existants`,
                  );
                }
              } else {
                this.logger.warn(`⚠️ Aucun article à fusionner`);
              }
            } catch (mergeError) {
              this.logger.error('⚠️ Erreur transfert panier:', mergeError);
              // Ne pas bloquer le login si le transfert échoue
            }
          } else {
            this.logger.warn(
              `⚠️ Pas de fusion (sessions identiques ou manquantes)`,
            );
          }

          // ✅ Redirection finale - Utiliser redirectTo si présent
          const redirectTo =
            (request as any).body?.redirectTo ||
            (request as any).query?.redirectTo;

          this.logger.log('🔍 Paramètres de redirection:');
          this.logger.log(`  - redirectTo: ${redirectTo}`);
          this.logger.log(`  - isAdmin: ${isAdmin}`);

          if (redirectTo && typeof redirectTo === 'string') {
            // Sécurité: vérifier que le redirectTo ne pointe pas vers un site externe
            if (redirectTo.startsWith('/') && !redirectTo.startsWith('//')) {
              this.logger.log(`✅ Redirection vers: ${redirectTo}`);
              // Sauvegarder la session avant redirection
              (request as any).session.save((saveErr: any) => {
                if (saveErr) {
                  this.logger.error('⚠️ Erreur sauvegarde session:', saveErr);
                }
                response.redirect(redirectTo);
                resolve();
              });
              return;
            } else {
              this.logger.warn(
                `⚠️ redirectTo invalide (externe?): ${redirectTo}`,
              );
            }
          }

          // Redirection par défaut
          this.logger.log('Pas de redirectTo valide, redirection par défaut');
          (request as any).session.save((saveErr: any) => {
            if (saveErr) {
              this.logger.error('⚠️ Erreur sauvegarde session:', saveErr);
            }
            if (isAdmin) {
              this.logger.log('Admin authentifié, redirection vers /dashboard');
              response.redirect('/dashboard');
            } else {
              this.logger.log('Utilisateur standard, redirection vers /');
              response.redirect('/');
            }
            resolve();
          });
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
