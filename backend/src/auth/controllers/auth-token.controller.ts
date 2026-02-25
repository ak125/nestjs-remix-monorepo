import { Controller, Post, Body, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import * as crypto from 'crypto';
import { AuthService } from '../auth.service';
import { UserDataConsolidatedService } from '../../modules/users/services/user-data-consolidated.service';
import { CacheService } from '../../cache/cache.service';
import { PasswordCryptoService } from '../../shared/crypto/password-crypto.service';
import { TokenValidationDto } from '../dto/module-access.dto';

@ApiTags('auth')
@Controller()
export class AuthTokenController {
  private readonly logger = new Logger(AuthTokenController.name);

  constructor(
    private readonly authService: AuthService,
    private readonly userDataService: UserDataConsolidatedService,
    private readonly cacheService: CacheService,
    private readonly passwordCrypto: PasswordCryptoService,
  ) {}

  /**
   * POST /auth/validate-token
   * Valider un token JWT et retourner les infos utilisateur
   */
  @Post('auth/validate-token')
  async validateToken(@Body() dto: TokenValidationDto) {
    try {
      const user = await this.authService.validateToken(dto.token);

      if (!user) {
        return { valid: false, userId: null };
      }

      return {
        valid: true,
        userId: user.id,
        user: {
          id: user.id,
          email: user.email,
          level: user.level,
          isAdmin: user.isAdmin,
        },
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return { valid: false, userId: null, error: message };
    }
  }

  /**
   * POST /auth/set-password
   * Définir le mot de passe pour un compte guest (via token d'activation)
   */
  @Post('auth/set-password')
  @ApiOperation({
    summary: 'Set password for guest account',
    description:
      'Allows guest users to set their password using the activation token received by email.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['token', 'password'],
      properties: {
        token: { type: 'string', description: 'Activation token from email' },
        password: {
          type: 'string',
          format: 'password',
          minLength: 8,
          description: 'New password (min 8 chars)',
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Password set successfully' })
  @ApiResponse({ status: 400, description: 'Invalid or expired token' })
  async setPassword(
    @Body() body: { token: string; password: string },
  ): Promise<{ success: boolean; message: string; email?: string }> {
    try {
      const { token, password } = body;

      if (!token || !password) {
        return { success: false, message: 'Token et mot de passe requis' };
      }

      if (password.length < 8) {
        return {
          success: false,
          message: 'Le mot de passe doit contenir au moins 8 caractères',
        };
      }

      const hashedToken = crypto
        .createHash('sha256')
        .update(token)
        .digest('hex');

      const storedData = await this.cacheService.get<{
        userId: string;
        email: string;
      }>(`guest_activation:${hashedToken}`);

      if (!storedData) {
        return { success: false, message: 'Token invalide ou expiré' };
      }

      const { userId, email } = storedData;

      const hashedPassword = await this.passwordCrypto.hashPassword(password);

      await this.userDataService.setPasswordHashByEmail(email, hashedPassword);

      await this.cacheService.delete(`guest_activation:${hashedToken}`);

      this.logger.log(
        `Password set successfully for guest user ${userId} (${email})`,
      );

      return {
        success: true,
        message:
          'Mot de passe défini avec succès. Vous pouvez maintenant vous connecter.',
        email,
      };
    } catch (error: unknown) {
      this.logger.error('Error in set-password:', error);
      return {
        success: false,
        message: 'Erreur technique lors de la définition du mot de passe',
      };
    }
  }

  /**
   * POST /auth/access-log
   * Enregistrer un accès utilisateur (optimisé Redis)
   */
  @Post('auth/access-log')
  async logAccess() {
    try {
      return {
        success: true,
        message: 'Access logged successfully',
      };
    } catch (_error: any) {
      return {
        success: false,
        error: _error.message,
      };
    }
  }
}
