import { Controller, Post, Body } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('enhanced-auth')
export class SimpleEnhancedAuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * POST /enhanced-auth/simple-check
   * Test simple du système d'authentification
   */
  @Post('simple-check')
  async simpleCheck(@Body() dto: { userId: string; resource: string }) {
    try {
      // Utiliser le service existant pour vérifier l'accès
      const result = await this.authService.checkModuleAccess(
        dto.userId,
        dto.resource,
        'read',
      );

      return {
        success: true,
        result,
        message: 'Test du système d\'authentification amélioré',
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * POST /enhanced-auth/test-auth
   * Test d'authentification avec les vraies données
   */
  @Post('test-auth')
  async testAuth(@Body() dto: { email: string; password: string }) {
    try {
      // Authentifier l'utilisateur
      const user = await this.authService.authenticateUser(dto.email, dto.password);

      if (!user) {
        return {
          success: false,
          message: 'Identifiants incorrects',
        };
      }

      // Créer un token pour l'utilisateur
      const loginResult = await this.authService.login(user);

      return {
        success: true,
        user,
        token: loginResult.access_token,
        message: 'Authentification réussie',
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }
}
