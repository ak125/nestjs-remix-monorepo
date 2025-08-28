import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { UserService } from '../database/services/user.service';
import { RedisCacheService } from '../database/services/redis-cache.service';
import { SupabaseBaseService } from '../database/services/supabase-base.service';

interface AccessCheckResult {
  hasAccess: boolean;
  reason?: string;
  requiredRole?: string;
}

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  isPro: boolean;
  isActive: boolean;
  level: number;
  isAdmin: boolean;
  error?: string;
}

export interface LoginResult {
  user: AuthUser;
  access_token: string;
  expires_in: number;
}

@Injectable()
export class AuthService extends SupabaseBaseService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly userService: UserService,
    private readonly cacheService: RedisCacheService,
  ) {
    super();
    this.logger.log(
      'AuthService initialized - Hybrid version with modern + legacy support',
    );
  }

  /**
   * NOUVELLE FONCTIONNALITÉ : Vérifier l'accès à un module
   * (remplace get.access.php)
   */
  async checkModuleAccess(
    userId: string,
    module: string,
    action: string = 'read',
  ): Promise<AccessCheckResult> {
    try {
      // Essayer d'abord avec les RPC Supabase modernes
      const { data, error } = await this.supabase.rpc('check_module_access', {
        p_user_id: userId,
        p_module: module,
        p_action: action,
      });

      if (!error && data !== null) {
        return {
          hasAccess: data,
          reason: data ? 'Access granted' : 'Insufficient privileges',
        };
      }

      // Fallback : utiliser la logique legacy
      return this.checkModuleAccessLegacy(userId, module, action);
    } catch (error) {
      this.logger.error(`Error checking module access: ${error}`);
      // Fallback sécurisé
      return {
        hasAccess: false,
        reason: 'Access check failed',
      };
    }
  }

  /**
   * Méthode legacy de vérification d'accès
   */
  private async checkModuleAccessLegacy(
    userId: string,
    module: string,
    action: string,
  ): Promise<AccessCheckResult> {
    // Récupérer l'utilisateur via le service existant
    const user = await this.userService.findUserById(userId);

    if (!user || user.cst_activ !== '1') {
      return { hasAccess: false, reason: 'User inactive' };
    }

    // Logique de permissions basée sur le niveau utilisateur
    const userLevel = parseInt(user.cst_level) || 0;

    const modulePermissions = {
      commercial: { read: 1, write: 3 },
      admin: { read: 7, write: 9 },
      seo: { read: 3, write: 5 },
      expedition: { read: 2, write: 4 },
    };

    const requiredLevel = modulePermissions[module]?.[action] || 9;
    const hasAccess = userLevel >= requiredLevel;

    return {
      hasAccess,
      reason: hasAccess ? 'Access granted' : 'Insufficient level',
      requiredRole: `Level ${requiredLevel} required`,
    };
  }

  /**
   * Gérer la réponse en cas de non-privilège
   * (remplace get.access.response.no.privilege.php)
   */
  handleNoPrivilege(module: string, requiredRole?: string): never {
    throw new ForbiddenException({
      statusCode: 403,
      message: 'Access denied',
      error: 'Forbidden',
      details: {
        module,
        requiredRole,
        timestamp: new Date().toISOString(),
      },
    });
  }

  /**
   * NOUVELLE FONCTIONNALITÉ : Gérer la déconnexion moderne
   * (remplace get.out.php)
   */
  async logout(sessionId: string, userId?: string): Promise<void> {
    try {
      // Logger la déconnexion en base
      if (userId) {
        await this.supabase.from('___AUTH_LOGS').insert({
          user_id: userId,
          session_id: sessionId,
          action: 'logout',
          timestamp: new Date().toISOString(),
        });
      }

      // Nettoyer le cache Redis
      if (sessionId) {
        await this.cacheService.del(`session:${sessionId}`);
        await this.cacheService.del(`user:${userId}`);
      }

      this.logger.log(`Logout successful for user ${userId}`);
    } catch (error) {
      this.logger.error(`Logout error: ${error}`);
      // Ne pas faire échouer le logout pour des erreurs de logging
    }
  }

  /**
   * NOUVELLE FONCTIONNALITÉ : Obtenir les informations de session depuis la requête
   */
  async getSessionFromRequest(request: Request) {
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      return null;
    }

    try {
      // Vérifier le token JWT
      const decoded = this.jwtService.verify(token);

      // Récupérer les informations utilisateur
      const user = await this.userService.findUserById(decoded.sub);
      if (!user || user.cst_activ !== '1') {
        return null;
      }

      return {
        user: this.formatUserResponse(user),
        token,
        sessionId:
          request.sessionID || (request.headers['x-session-id'] as string),
      };
    } catch (error) {
      this.logger.debug(`Invalid token: ${error.message}`);
      return null;
    }
  }

  /**
   * Méthode existante : Authentifier un utilisateur
   * (garde la compatibilité avec le système existant)
   */
  async authenticateUser(
    email: string,
    password: string,
  ): Promise<AuthUser | null> {
    try {
      this.logger.debug(`Authenticating user: ${email}`);

      // Utiliser le service existant pour la compatibilité
      let user = await this.userService.findUserByEmail(email);
      let isAdmin = false;

      // Essayer dans la table des admins si non trouvé
      if (!user) {
        const admin = await this.userService.findAdminByEmail(email);
        if (admin) {
          user = {
            cst_id: admin.cnfa_id,
            cst_mail: admin.cnfa_mail,
            cst_pswd: admin.cnfa_pswd,
            cst_fname: admin.cnfa_fname,
            cst_name: admin.cnfa_name,
            cst_tel: admin.cnfa_tel,
            cst_activ: admin.cnfa_activ,
            cst_level: parseInt(admin.cnfa_level) || 9,
            cst_is_pro: '1',
          };
          isAdmin = true;
        }
      }

      if (!user) {
        return null;
      }

      // Utiliser la validation de mot de passe existante
      const isPasswordValid = await this.validatePassword(
        password,
        user.cst_pswd,
      );
      if (!isPasswordValid) {
        return null;
      }

      if (user.cst_activ !== '1') {
        throw new UnauthorizedException('Compte désactivé');
      }

      return this.formatUserResponse(user);
    } catch (error) {
      this.logger.error(`Authentication failed for ${email}:`, error);
      throw error;
    }
  }

  /**
   * Méthode privée : Extraire le token du header
   */
  private extractTokenFromHeader(request: Request): string | null {
    const authHeader = request.headers.authorization;
    if (!authHeader) return null;

    const [type, token] = authHeader.split(' ');
    return type === 'Bearer' ? token : null;
  }

  /**
   * Méthode privée : Validation du mot de passe (garde la logique existante)
   */
  private async validatePassword(
    inputPassword: string,
    storedPassword: string,
  ): boolean {
    // Cette méthode devrait être implémentée selon la logique existante
    // Pour l'instant, on fait un placeholder
    return inputPassword === storedPassword;
  }

  /**
   * Méthode privée : Formater la réponse utilisateur
   */
  private formatUserResponse(user: any): AuthUser {
    return {
      id: user.cst_id.toString(),
      email: user.cst_mail,
      firstName: user.cst_fname || '',
      lastName: user.cst_name || '',
      isPro: user.cst_is_pro === '1',
      isActive: user.cst_activ === '1',
      level: parseInt(user.cst_level) || 0,
      isAdmin: (parseInt(user.cst_level) || 0) >= 7,
    };
  }

  /**
   * Méthode alias pour compatibilité
   */
  async validateUser(
    email: string,
    password: string,
  ): Promise<AuthUser | null> {
    return this.authenticateUser(email, password);
  }
}
