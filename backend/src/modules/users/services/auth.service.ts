/**
 * Service d'authentification - Responsabilité unique
 * Gère l'inscription, la connexion, et la validation des tokens
 */

import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import { UserDataService } from '../../../database/services/user-data.service';
import { CacheService } from '../../../cache/cache.service';
import {
  RegisterDto,
  LoginDto,
  UserResponseDto,
  LoginResponseDto,
  ResetPasswordDto,
  ConfirmResetPasswordDto,
} from '../dto/users.dto';

@Injectable()
export class AuthService extends SupabaseBaseService {
  constructor(
    configService: ConfigService,
    private readonly userDataService: UserDataService,
    private readonly cacheService: CacheService,
  ) {
    super(configService);
  }

  /**
   * Inscription d'un nouvel utilisateur
   */
  async register(registerDto: RegisterDto): Promise<UserResponseDto> {
    console.log('🔐 AuthService.register:', registerDto.email);

    try {
      // Vérifier si l'utilisateur existe déjà
      const existingUser = await this.findByEmail(registerDto.email);
      if (existingUser) {
        throw new ConflictException(
          'Un utilisateur avec cet email existe déjà',
        );
      }

      // Créer le nouvel utilisateur via UserDataService
      const userData = {
        email: registerDto.email,
        first_name: registerDto.firstName,
        last_name: registerDto.lastName,
        password_hash: await this.hashPassword(registerDto.password),
        is_pro: false,
        is_active: true,
        level: 1, // Utilisateur standard
        created_at: new Date(),
        updated_at: new Date(),
      };

      const newUser = await this.userDataService.createUser(userData);

      // Convertir vers le format de réponse
      const userResponse: UserResponseDto = {
        id: String(newUser.id),
        email: newUser.email,
        firstName: newUser.first_name,
        lastName: newUser.last_name,
        isPro: newUser.is_pro,
        isActive: newUser.is_active,
        level: newUser.level,
        createdAt: newUser.created_at,
        updatedAt: newUser.updated_at,
      };

      console.log('✅ Utilisateur créé:', userResponse.id);
      return userResponse;
    } catch (error: any) {
      console.error('❌ Erreur création utilisateur:', error);
      throw new HttpException(
        error?.message || "Erreur lors de la création de l'utilisateur",
        error?.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Connexion utilisateur
   */
  async login(loginDto: LoginDto): Promise<LoginResponseDto> {
    console.log('🔑 AuthService.login:', loginDto.email);

    try {
      // Trouver l'utilisateur
      const user = await this.findByEmail(loginDto.email);
      if (!user) {
        throw new UnauthorizedException('Email ou mot de passe incorrect');
      }

      if (!user.isActive) {
        throw new UnauthorizedException('Compte désactivé');
      }

      // Vérifier le mot de passe
      const isPasswordValid = await this.verifyPassword(
        loginDto.password,
        user.passwordHash,
      );
      if (!isPasswordValid) {
        throw new UnauthorizedException('Email ou mot de passe incorrect');
      }

      // Générer un token JWT
      const token = await this.generateJwtToken(user);

      const response: LoginResponseDto = {
        user,
        accessToken: token,
        expiresIn: 86400, // 24h en secondes
      };

      // Mettre en cache la session
      await this.cacheService.set(
        `user_session_${user.id}`,
        user,
        86400, // 24h
      );

      console.log('✅ Connexion réussie:', user.id);
      return response;
    } catch (error: any) {
      console.error('❌ Erreur connexion:', error);
      throw new HttpException(
        error?.message || 'Erreur lors de la connexion',
        error?.status || HttpStatus.UNAUTHORIZED,
      );
    }
  }

  /**
   * Demande de réinitialisation de mot de passe
   */
  async requestPasswordReset(resetDto: ResetPasswordDto): Promise<boolean> {
    console.log('🔐 AuthService.requestPasswordReset:', resetDto.email);

    try {
      const user = await this.findByEmail(resetDto.email);
      if (!user) {
        // Ne pas révéler si l'email existe ou non pour la sécurité
        return true;
      }

      // Générer un token de réinitialisation
      const resetToken = await this.generateResetToken();
      const expiresAt = new Date(Date.now() + 3600000); // 1h

      // Stocker le token en base
      await this.userDataService.storeResetToken(
        user.id,
        resetToken,
        expiresAt,
      );

      // Envoyer l'email de réinitialisation
      // TODO: Implémenter l'envoi d'email
      console.log('📧 Email de réinitialisation à envoyer:', resetToken);

      return true;
    } catch (error: any) {
      console.error('❌ Erreur reset password:', error);
      throw new HttpException(
        'Erreur lors de la demande de réinitialisation',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Confirmation de réinitialisation de mot de passe
   */
  async confirmPasswordReset(
    confirmDto: ConfirmResetPasswordDto,
  ): Promise<boolean> {
    console.log('🔐 AuthService.confirmPasswordReset');

    try {
      // Vérifier le token
      const resetData = await this.userDataService.getResetToken(
        confirmDto.token,
      );
      if (!resetData || resetData.expires_at < new Date()) {
        throw new UnauthorizedException('Token invalide ou expiré');
      }

      // Mettre à jour le mot de passe
      const hashedPassword = await this.hashPassword(confirmDto.newPassword);
      await this.userDataService.updatePassword(
        resetData.user_id,
        hashedPassword,
      );

      // Supprimer le token de réinitialisation
      await this.userDataService.deleteResetToken(confirmDto.token);

      return true;
    } catch (error: any) {
      console.error('❌ Erreur confirmation reset:', error);
      throw new HttpException(
        error?.message || 'Erreur lors de la réinitialisation',
        error?.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Validation d'un token JWT
   */
  async validateToken(token: string): Promise<UserResponseDto | null> {
    try {
      const decoded = await this.verifyJwtToken(token);
      const user = await this.findById(decoded.sub);
      return user;
    } catch (error) {
      console.error('❌ Token invalide:', error);
      return null;
    }
  }

  /**
   * Déconnexion utilisateur
   */
  async logout(userId: string): Promise<boolean> {
    try {
      await this.cacheService.del(`user_session_${userId}`);
      return true;
    } catch (error) {
      console.error('❌ Erreur déconnexion:', error);
      return false;
    }
  }

  // ========== MÉTHODES PRIVÉES ==========

  private async findByEmail(email: string): Promise<UserResponseDto | null> {
    try {
      const user = await this.userDataService.findByEmail(email);
      if (!user) return null;

      return {
        id: String(user.id),
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        isPro: user.is_pro,
        isActive: user.is_active,
        level: user.level,
        passwordHash: user.password_hash,
        createdAt: user.created_at,
        updatedAt: user.updated_at,
      };
    } catch (error) {
      console.error('❌ Erreur findByEmail:', error);
      return null;
    }
  }

  private async findById(id: string): Promise<UserResponseDto | null> {
    try {
      const user = await this.userDataService.findById(parseInt(id));
      if (!user) return null;

      return {
        id: String(user.id),
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        isPro: user.is_pro,
        isActive: user.is_active,
        level: user.level,
        createdAt: user.created_at,
        updatedAt: user.updated_at,
      };
    } catch (error) {
      console.error('❌ Erreur findById:', error);
      return null;
    }
  }

  private async hashPassword(password: string): Promise<string> {
    // TODO: Implémenter le hashage avec bcrypt
    return `hashed_${password}_${Date.now()}`;
  }

  private async verifyPassword(
    password: string,
    hash: string,
  ): Promise<boolean> {
    // TODO: Implémenter la vérification avec bcrypt
    return hash.includes(password);
  }

  private async generateJwtToken(user: UserResponseDto): Promise<string> {
    // TODO: Implémenter la génération JWT réelle
    return `jwt_${user.id}_${Date.now()}`;
  }

  private async verifyJwtToken(token: string): Promise<any> {
    // TODO: Implémenter la vérification JWT réelle
    const parts = token.split('_');
    return { sub: parts[1] };
  }

  private async generateResetToken(): Promise<string> {
    return `reset_${Date.now()}_${Math.random().toString(36).substring(2)}`;
  }
}
