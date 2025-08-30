import {
  Injectable,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { SupabaseBaseService } from '../database/services/supabase-base.service';
import { SessionService } from './services/session.service';
import { PermissionService } from './services/permission.service';
import { AccessLogService } from './services/access-log.service';
import { RedisCacheService } from '../database/services/redis-cache.service';
import { AuthService as ExistingAuthService } from './auth.service';

export interface AccessRequest {
  userId?: string;
  resource: string;
  action?: string;
  ipAddress?: string;
  userAgent?: string;
  section?: 'core' | 'massdoc' | 'public' | 'blog';
}

export interface AccessResponse {
  granted: boolean;
  reason?: string;
  redirectUrl?: string;
  permissions?: string[];
  sessionInfo?: any;
}

@Injectable()
export class EnhancedAuthService extends SupabaseBaseService {
  protected readonly logger = new Logger(EnhancedAuthService.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly sessionService: SessionService,
    private readonly permissionService: PermissionService,
    private readonly accessLogService: AccessLogService,
    private readonly cacheService: RedisCacheService,
    private readonly existingAuthService: ExistingAuthService,
  ) {
    super();
  }

  /**
   * Vérifier l'accès à une ressource (remplace get.access.php)
   * Méthode unifiée qui combine l'existant et le nouveau
   */
  async checkAccess(request: AccessRequest): Promise<AccessResponse> {
    const startTime = Date.now();

    try {
      // Vérifier si la section est publique
      const sectionConfig = await this.getSectionConfig(request.section || 'public');

      if (sectionConfig?.is_public) {
        await this.accessLogService.logAccess({
          ...request,
          access_granted: true,
          execution_time_ms: Date.now() - startTime,
        });

        return {
          granted: true,
          permissions: ['read'],
        };
      }

      // Vérifier si l'utilisateur est authentifié
      if (!request.userId) {
        await this.accessLogService.logAccess({
          ...request,
          access_granted: false,
          denial_reason: 'Non authentifié',
          execution_time_ms: Date.now() - startTime,
        });

        return {
          granted: false,
          reason: 'Authentication required',
          redirectUrl: '/login',
        };
      }

      // Utiliser le service existant pour vérifier l'accès module
      const moduleAccess = await this.existingAuthService.checkModuleAccess(
        request.userId,
        request.resource,
        request.action || 'read',
      );

      if (!moduleAccess.hasAccess) {
        await this.accessLogService.logAccess({
          ...request,
          user_id: request.userId,
          access_granted: false,
          denial_reason: 'Permission insuffisante',
          execution_time_ms: Date.now() - startTime,
        });

        return this.handleNoPrivilege(request);
      }

      // Logger l'accès autorisé
      await this.accessLogService.logAccess({
        ...request,
        user_id: request.userId,
        access_granted: true,
        execution_time_ms: Date.now() - startTime,
      });

      // Récupérer les permissions de l'utilisateur
      const permissions = await this.permissionService.getUserPermissions(
        request.userId,
        request.resource,
      );

      return {
        granted: true,
        permissions: permissions.map(p => p.action),
        sessionInfo: {
          lastActivity: new Date(),
        },
      };
    } catch (error) {
      this.logger.error('Access check error:', error);

      return {
        granted: false,
        reason: 'Internal error',
        redirectUrl: '/error',
      };
    }
  }

  /**
   * Gérer le refus d'accès (remplace get.access.response.no.privilege.php)
   */
  private async handleNoPrivilege(request: AccessRequest): Promise<AccessResponse> {
    // Déterminer la page de redirection selon le contexte
    let redirectUrl = '/access-denied';

    if (request.section === 'core') {
      redirectUrl = '/core/no-access';
    } else if (request.section === 'massdoc') {
      redirectUrl = '/massdoc/no-access';
    } else if (request.section === 'blog') {
      redirectUrl = '/admin/no-access';
    }

    // Enregistrer la tentative
    await this.supabase
      .from('access_denied_logs')
      .insert({
        user_id: request.userId,
        resource: request.resource,
        section: request.section,
        ip_address: request.ipAddress,
        user_agent: request.userAgent,
      });

    return {
      granted: false,
      reason: 'Insufficient privileges',
      redirectUrl,
    };
  }

  /**
   * Traiter la réponse d'accès (remplace get.access.response.php)
   */
  async processAccessResponse(
    accessResponse: AccessResponse,
    userId?: string,
  ): Promise<any> {
    if (accessResponse.granted) {
      // Accès autorisé - utiliser le service existant
      const userData = userId ? await this.existingAuthService.getUserById(userId) : null;

      return {
        status: 'granted',
        user: userData,
        permissions: accessResponse.permissions,
        sessionInfo: accessResponse.sessionInfo,
      };
    } else {
      // Accès refusé - préparer la réponse appropriée
      return {
        status: 'denied',
        reason: accessResponse.reason,
        redirectUrl: accessResponse.redirectUrl,
        message: this.getAccessDeniedMessage(accessResponse.reason),
      };
    }
  }

  /**
   * Déconnexion améliorée (remplace get.out.php)
   */
  async logout(userId: string, sessionId?: string): Promise<void> {
    try {
      // Utiliser la déconnexion moderne existante
      await this.existingAuthService.modernLogout(sessionId || '', userId);

      // Invalider la session avec le SessionService
      if (sessionId) {
        await this.sessionService.destroySession(sessionId);
      }

      // Logger la déconnexion
      await this.accessLogService.logAccess({
        user_id: userId,
        resource: 'logout',
        action: 'logout',
        access_granted: true,
      });
    } catch (error) {
      this.logger.error('Enhanced logout error:', error);
      throw error;
    }
  }

  /**
   * Authentifier un utilisateur (utilise le service existant)
   */
  async authenticateUser(email: string, password: string) {
    return this.existingAuthService.authenticateUser(email, password);
  }

  /**
   * Créer un token JWT (utilise le service existant)
   */
  async createJwtToken(user: any) {
    return this.existingAuthService.createJwtToken(user);
  }

  /**
   * Valider un token JWT (utilise le service existant)
   */
  async validateJwtToken(token: string) {
    return this.existingAuthService.validateJwtToken(token);
  }

  /**
   * Créer un token d'accès avec logging amélioré
   */
  async createAccessToken(userId: string, sessionId: string) {
    const payload = {
      sub: userId,
      sessionId,
      type: 'access',
    };

    const token = this.jwtService.sign(payload);

    // Logger la création du token
    await this.accessLogService.logAccess({
      user_id: userId,
      resource: 'token',
      action: 'create',
      access_granted: true,
      session_id: sessionId,
    });

    return token;
  }

  /**
   * Valider un token d'accès avec vérification de session
   */
  async validateAccessToken(token: string) {
    try {
      const payload = this.jwtService.verify(token);

      // Vérifier que la session est toujours active
      const session = await this.sessionService.getSession(payload.sessionId);

      if (!session) {
        await this.accessLogService.logAccess({
          user_id: payload.sub,
          resource: 'token',
          action: 'validate',
          access_granted: false,
          denial_reason: 'Session invalide',
        });

        throw new UnauthorizedException('Session invalid');
      }

      // Mettre à jour l'activité de session
      await this.sessionService.updateSessionActivity(payload.sessionId);

      // Logger la validation réussie
      await this.accessLogService.logAccess({
        user_id: payload.sub,
        resource: 'token',
        action: 'validate',
        access_granted: true,
        session_id: payload.sessionId,
      });

      return payload;
    } catch (error) {
      throw new UnauthorizedException('Token invalid');
    }
  }

  /**
   * Vérifier les permissions avec cache et logging
   */
  async checkPermission(
    userId: string,
    resource: string,
    action: string = 'read',
  ): Promise<boolean> {
    const hasPermission = await this.permissionService.checkPermission(
      userId,
      resource,
      action,
    );

    // Logger la vérification de permission
    await this.accessLogService.logAccess({
      user_id: userId,
      resource,
      action: `check_permission_${action}`,
      access_granted: hasPermission,
      denial_reason: hasPermission ? undefined : 'Permission manquante',
    });

    return hasPermission;
  }

  /**
   * Récupérer les statistiques d'accès pour un utilisateur
   */
  async getUserAccessStats(userId: string, periodDays: number = 30) {
    return this.accessLogService.getUserAccessStats(userId, periodDays);
  }

  /**
   * Détecter une activité suspecte
   */
  async detectSuspiciousActivity() {
    return this.accessLogService.detectSuspiciousActivity();
  }

  /**
   * Récupérer la configuration d'une section
   */
  private async getSectionConfig(section: string) {
    const cacheKey = `section_config:${section}`;
    
    // Vérifier le cache
    const cached = await this.cacheService.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const { data } = await this.supabase
      .from('access_sections')
      .select('*')
      .eq('section_key', section)
      .single();

    // Mettre en cache (1 heure)
    if (data) {
      await this.cacheService.set(cacheKey, JSON.stringify(data), 3600);
    }

    return data;
  }

  /**
   * Message d'erreur selon la raison
   */
  private getAccessDeniedMessage(reason?: string): string {
    const messages: Record<string, string> = {
      'Authentication required': 'Veuillez vous connecter pour accéder à cette ressource',
      'Session expired': 'Votre session a expiré, veuillez vous reconnecter',
      'Insufficient privileges': "Vous n'avez pas les droits nécessaires pour accéder à cette ressource",
      'Internal error': 'Une erreur est survenue, veuillez réessayer',
    };

    return messages[reason || ''] || 'Accès refusé';
  }
}
