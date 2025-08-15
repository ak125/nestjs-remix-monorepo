import {
  Controller,
  Get,
  Post,
  Body,
  Req,
  Res,
  // Param, Put, UseGuards, HttpStatus - imports temporairement non utilisés
} from '@nestjs/common';
import { Response } from 'express';
import { Request as ExpressRequest } from 'express';
import { AuthService } from '../auth/auth.service';

// Guard simple pour vérifier si l'utilisateur est authentifié
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const AuthenticatedGuard = (req: ExpressRequest, res: Response, next: any) => {
  if (req.isAuthenticated()) {
    return next();
  }
  return res.redirect('/auth/login');
};

@Controller('profile')
export class ProfileController {
  constructor(private authService: AuthService) {}

  @Get()
  async getProfile(@Req() req: ExpressRequest, @Res() res: Response) {
    try {
      // Vérifier si l'utilisateur est connecté
      if (!req.isAuthenticated() || !req.user) {
        return res.redirect('/auth/login');
      }

      const user = req.user as any;
      console.log('Profile request for user:', user.id);

      // Récupérer les informations complètes de l'utilisateur
      const fullUser = await this.authService.checkIfUserExists({
        email: user.email,
      });

      if (!fullUser || fullUser.error) {
        return res.redirect('/auth/login');
      }

      // Rediriger vers une page de profil (à créer dans le frontend)
      return res.redirect(`/profile/edit?userId=${user.id}`);
    } catch (error) {
      console.error('Profile error:', error);
      return res.redirect('/');
    }
  }

  @Post('update')
  async updateProfile(
    @Body()
    body: {
      firstName?: string;
      lastName?: string;
      email?: string;
      tel?: string;
      address?: string;
      city?: string;
      zipCode?: string;
      country?: string;
    },
    @Req() req: ExpressRequest,
    @Res() res: Response,
  ) {
    try {
      // Vérifier si l'utilisateur est connecté
      if (!req.isAuthenticated() || !req.user) {
        return res.redirect('/login');
      }

      const user = req.user as any;
      console.log('Update profile request for user:', user.id);
      console.log('Update data:', body);

      // Mettre à jour le profil
      const updatedUser = await this.authService.updateUserProfile(
        user.id,
        body,
      );

      if (updatedUser) {
        // Mettre à jour les informations dans la session
        req.user = { ...req.user, ...updatedUser };
        return res.redirect('/profile?update=success');
      } else {
        return res.redirect('/profile?error=update_failed');
      }
    } catch (error) {
      console.error('Update profile error:', error);
      return res.redirect('/profile?error=server_error');
    }
  }

  @Post('change-password')
  async changePassword(
    @Body()
    body: {
      currentPassword: string;
      newPassword: string;
      confirmPassword: string;
    },
    @Req() req: ExpressRequest,
    @Res() res: Response,
  ) {
    try {
      // Vérifier si l'utilisateur est connecté
      if (!req.isAuthenticated() || !req.user) {
        return res.redirect('/login');
      }

      const user = req.user as any;
      const { currentPassword, newPassword, confirmPassword } = body;

      // Vérifier que les mots de passe correspondent
      if (newPassword !== confirmPassword) {
        return res.redirect('/profile?error=password_mismatch');
      }

      // Vérifier la longueur du mot de passe
      if (newPassword.length < 6) {
        return res.redirect('/profile?error=password_too_short');
      }

      console.log('Change password request for user:', user.id);

      // Changer le mot de passe
      const result = await this.authService.changePassword(
        user.id,
        currentPassword,
        newPassword,
      );

      if (result.success) {
        return res.redirect('/profile?password=success');
      } else {
        return res.redirect(`/profile?error=${result.message || 'Erreur lors du changement de mot de passe'}`);
      }
    } catch (error) {
      console.error('Change password error:', error);
      return res.redirect('/profile?error=server_error');
    }
  }
}
