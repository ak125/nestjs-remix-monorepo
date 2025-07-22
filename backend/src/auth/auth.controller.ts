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
import { Request as ExpressRequest } from 'express';
import { LocalAuthGuard } from './local-auth.guard';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Get('/authenticate')
  authenticateRedirect(@Res() response: Response) {
    console.log('Redirection /authenticate vers /login');
    response.redirect('/login');
  }

  @UseGuards(LocalAuthGuard)
  @Post('login')
  async loginPost(@Req() request: ExpressRequest, @Res() response: Response) {
    console.log('--- POST /auth/login SUCCES ---');
    console.log('User authenticated:', request.user);
    response.redirect('/');
  }

  @Post('login-error')
  async loginError(@Req() request: ExpressRequest, @Res() response: Response) {
    console.log('--- POST /auth/login ERROR ---');
    console.log('Login failed for:', request.body?.email);

    // Déterminer le type d'erreur
    let errorType = 'invalid_credentials';

    // Si c'est une erreur de rate limiting
    if (request.body?.rateLimited) {
      errorType = 'rate_limited';
    }

    // Rediriger vers login avec le message d'erreur approprié
    const email = request.body?.email || '';
    response.redirect(
      `/login?error=${errorType}&email=${encodeURIComponent(email)}`,
    );
  }

  @Post('logout')
  async logout(
    @Req() request: ExpressRequest,
    @Res() response: Response,
    @Next() next: NextFunction,
  ) {
    request.logOut(function (err) {
      if (err) {
        return next(err);
      }
      request.session.destroy(() => {
        response.clearCookie('connect.sid');
        response.redirect('/');
      });
    });
  }

  @Post('register')
  async register(
    @Body() body: any,
    @Res() res: Response,
    @Req() req: ExpressRequest,
  ) {
    try {
      const { email, firstname, lastname, password } = body;
      console.log('Register request:', { email, firstname, lastname });

      // Vérifier si l'utilisateur existe
      const existingUser = await this.authService.checkIfUserExists({
        email,
        withPassword: false,
        password: '',
      });

      if (existingUser && !existingUser.error) {
        return res.redirect('/register?error=user_exists');
      }

      // Créer l'utilisateur
      const newUser = await this.authService.createUser({
        email,
        firstName: firstname,
        lastName: lastname,
        password,
      });

      if (newUser) {
        console.log('User created successfully:', newUser);

        // Authentifier automatiquement l'utilisateur après l'inscription
        const authenticatedUser = await this.authService.authenticateUser(
          email,
          password,
        );

        if (authenticatedUser) {
          // Connecter l'utilisateur automatiquement
          req.login(authenticatedUser, (err) => {
            if (err) {
              console.error('Auto-login error:', err);
              return res.redirect(
                `/login?register=success&email=${encodeURIComponent(email)}`,
              );
            }
            console.log(
              'User auto-logged in after registration:',
              authenticatedUser,
            );
            return res.redirect('/?welcome=true');
          });
        } else {
          // Fallback: rediriger vers login avec l'email pré-rempli
          return res.redirect(
            `/login?register=success&email=${encodeURIComponent(email)}`,
          );
        }
      } else {
        return res.redirect('/register?error=creation_failed');
      }
    } catch (error) {
      console.error('Register error:', error);
      return res.redirect('/register?error=server_error');
    }
  }

  @Post('forgot-password')
  async forgotPassword(@Body() body: { email: string }, @Res() res: Response) {
    try {
      const { email } = body;
      console.log('Forgot password request for:', email);

      // Vérifier si l'utilisateur existe
      const user = await this.authService.checkIfUserExists({
        email,
        withPassword: false,
        password: '',
      });

      if (!user || user.error) {
        // Pour des raisons de sécurité, on ne révèle pas si l'email existe
        return res.redirect('/forgot-password?status=sent');
      }

      // Générer un token de réinitialisation
      const resetToken =
        await this.authService.generatePasswordResetToken(email);

      if (resetToken) {
        // TODO: Envoyer l'email avec le token
        console.log('Password reset token generated:', resetToken);
        // Pour l'instant, on log le token (à remplacer par l'envoi d'email)
        console.log(`Reset link: /reset-password/${resetToken}`);
      }

      return res.redirect('/forgot-password?status=sent');
    } catch (error) {
      console.error('Forgot password error:', error);
      return res.redirect('/forgot-password?error=server_error');
    }
  }

  @Post('reset-password/:token')
  async resetPassword(
    @Param('token') token: string,
    @Body() body: { password: string },
    @Res() res: Response,
  ) {
    try {
      const { password } = body;
      console.log('Reset password request with token:', token);

      // Vérifier et utiliser le token
      const result = await this.authService.resetPasswordWithToken(
        token,
        password,
      );

      if (result.success) {
        return res.redirect('/login?reset=success');
      } else {
        return res.redirect(`/reset-password/${token}?error=${result.error}`);
      }
    } catch (error) {
      console.error('Reset password error:', error);
      return res.redirect(`/reset-password/${token}?error=server_error`);
    }
  }

  @Get('test-errors')
  async testErrors(@Res() response: Response) {
    const errorExamples = {
      success: false,
      message: "Exemples de messages d'erreur améliorés",
      examples: {
        invalid_credentials: {
          type: 'invalid_credentials',
          message:
            "L'email ou le mot de passe que vous avez saisi est incorrect.",
          details: 'Veuillez vérifier vos identifiants et réessayer.',
          suggestions: [
            'Vérifiez que votre email est correctement saisi',
            'Assurez-vous que votre mot de passe est correct',
            "Vérifiez que la touche Caps Lock n'est pas activée",
          ],
        },
        rate_limited: {
          type: 'rate_limited',
          message: 'Trop de tentatives de connexion détectées.',
          details:
            'Votre compte est temporairement bloqué. Veuillez réessayer dans quelques minutes.',
          suggestions: [
            'Attendez quelques minutes avant de réessayer',
            'Vérifiez vos identifiants pour éviter de nouveaux échecs',
            'Contactez le support si le problème persiste',
          ],
        },
        account_disabled: {
          type: 'account_disabled',
          message: 'Votre compte est désactivé.',
          details:
            "Veuillez contacter l'administrateur pour réactiver votre compte.",
          suggestions: [
            "Contactez l'administrateur du site",
            "Vérifiez vos emails pour d'éventuelles notifications",
            "Assurez-vous que votre compte n'a pas expiré",
          ],
        },
        email_not_found: {
          type: 'email_not_found',
          message: 'Aucun compte associé à cette adresse email.',
          details:
            "Vérifiez l'orthographe de votre email ou créez un nouveau compte.",
          suggestions: [
            "Vérifiez l'orthographe de votre adresse email",
            'Essayez avec une autre adresse email',
            'Créez un nouveau compte si nécessaire',
          ],
        },
      },
    };

    response.json(errorExamples);
  }
}
