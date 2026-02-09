/**
 * Service d'Authentification - Architecture Modulaire Complète
 * ✅ Responsabilité unique : authentification et autorisation
 * ✅ Utilisation des services spécialisés
 * ✅ Interface claire et simple
 * ✅ Validation sécurisée
 * ✅ Gestion des tentatives de connexion
 * ✅ Support des mots de passe legacy (MD5+crypt) et modernes (bcrypt)
 * ✅ Sessions et historique des connexions
 */

import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as crypto from 'crypto';
import { UserService } from '../database/services/user.service';
import { CacheService } from '../cache/cache.service';
import { PasswordCryptoService } from '../shared/crypto/password-crypto.service';

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
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly userService: UserService,
    private readonly cacheService: CacheService,
    private readonly passwordCrypto: PasswordCryptoService,
  ) {
    this.logger.log(
      'AuthService initialized - Complete modular version with legacy support',
    );
  }

  /**
   * Authentifier un utilisateur par email/mot de passe
   */
  async authenticateUser(
    email: string,
    password: string,
  ): Promise<AuthUser | null> {
    try {
      this.logger.debug(`Authenticating user: ${email}`);

      // 1. Essayer d'abord dans la table des customers
      let user = await this.userService.findUserByEmail(email);
      let isAdmin = false;

      // 2. Si non trouvé, essayer dans la table des admins
      if (!user) {
        const admin = await this.userService.findAdminByEmail(email);
        if (admin) {
          // Convertir les données admin vers le format User
          user = {
            cst_id: admin.cnfa_id,
            cst_mail: admin.cnfa_mail,
            cst_pswd: admin.cnfa_pswd,
            cst_fname: admin.cnfa_fname,
            cst_name: admin.cnfa_name,
            cst_tel: admin.cnfa_tel,
            cst_activ: admin.cnfa_activ,
            cst_level: parseInt(admin.cnfa_level) || 9,
            cst_is_pro: '1', // Les admins sont considérés comme des pros
          };
          isAdmin = true;
          this.logger.debug(
            `Admin user found: ${email} with level ${admin.cnfa_level}`,
          );
        }
      }

      if (!user) {
        this.logger.warn(`User not found in both tables: ${email}`);
        return null;
      }

      // Vérifier le mot de passe
      const isPasswordValid = await this.validatePassword(
        password,
        user.cst_pswd,
      );
      if (!isPasswordValid) {
        this.logger.warn(`Invalid password for user: ${email}`);
        return null;
      }

      // ✅ UPGRADE AUTOMATIQUE: Migrer les mots de passe legacy vers bcrypt
      if (this.passwordCrypto.needsRehash(user.cst_pswd)) {
        this.logger.log(`🔄 Upgrading password for user: ${email}`);
        try {
          await this.passwordCrypto.upgradeHashIfNeeded(
            user.cst_id,
            password,
            user.cst_pswd,
            async (userId, newHash) => {
              // Callback pour mettre à jour le hash dans la base
              if (isAdmin) {
                // Update admin dans ___config_admin (utiliser column cnfa_pswd)
                const url = `${process.env.SUPABASE_URL}/rest/v1/___config_admin?cnfa_id=eq.${userId}`;
                await fetch(url, {
                  method: 'PATCH',
                  headers: {
                    'Content-Type': 'application/json',
                    apikey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
                    Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY || ''}`,
                    Prefer: 'return=minimal',
                  } as HeadersInit,
                  body: JSON.stringify({ cnfa_pswd: newHash }),
                });
              } else {
                // Update customer via userService
                await this.userService.updateUserPassword(userId, newHash);
              }
            },
          );
          this.logger.log(`✅ Password upgraded successfully for: ${email}`);
        } catch (upgradeError) {
          this.logger.error(
            `Failed to upgrade password for ${email}:`,
            upgradeError,
          );
          // Ne pas bloquer la connexion si l'upgrade échoue
        }
      }

      // Vérifier que l'utilisateur est actif
      if (user.cst_activ !== '1') {
        this.logger.warn(`Inactive user tried to login: ${email}`);
        throw new UnauthorizedException('Compte désactivé');
      }

      this.logger.log(
        `Authentication successful for ${email} (admin: ${isAdmin})`,
      );
      return this.formatUserResponse(user);
    } catch (error) {
      this.logger.error(`Authentication failed for ${email}:`, error);
      throw error;
    }
  }

  /**
   * Méthode alias pour compatibilité avec local.strategy.ts
   */
  async validateUser(
    email: string,
    password: string,
  ): Promise<AuthUser | null> {
    return this.authenticateUser(email, password);
  }

  /**
   * Inscription d'un nouvel utilisateur
   * Vérifie l'unicité de l'email, hash le mot de passe et crée l'utilisateur en DB
   */
  async register(registerDto: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phone?: string;
  }): Promise<AuthUser> {
    try {
      this.logger.debug(`Registering new user: ${registerDto.email}`);

      // 1. Vérifier si l'utilisateur existe déjà
      const existingUser = await this.checkIfUserExists({
        email: registerDto.email,
      });

      if (existingUser) {
        this.logger.warn(`User already exists: ${registerDto.email}`);
        throw new BadRequestException(
          'Un utilisateur avec cet email existe déjà',
        );
      }

      // 2. Hasher le mot de passe avec bcrypt (via PasswordCryptoService)
      const hashedPassword = await this.passwordCrypto.hashPassword(
        registerDto.password,
      );

      // 3. Créer l'utilisateur via UserService
      const createdUser = await this.userService.createUser({
        email: registerDto.email,
        password: hashedPassword,
        firstName: registerDto.firstName,
        lastName: registerDto.lastName,
      });

      if (!createdUser) {
        this.logger.error(
          `Failed to create user in database: ${registerDto.email}`,
        );
        throw new BadRequestException(
          "Erreur lors de la création de l'utilisateur",
        );
      }

      // 4. Formater et retourner l'utilisateur créé
      const authUser = this.formatUserResponse(createdUser);

      this.logger.log(
        `User registered successfully: ${registerDto.email} (ID: ${authUser.id})`,
      );

      return authUser;
    } catch (error) {
      this.logger.error(`Registration failed for ${registerDto.email}:`, error);
      throw error;
    }
  }

  /**
   * Connexion utilisateur avec validation et session
   * Gère les tentatives échouées et l'upgrade automatique des mots de passe legacy
   */
  async login(
    email: string,
    password: string,
    ip?: string,
  ): Promise<LoginResult> {
    try {
      const clientIp = ip || 'unknown';

      // Vérifier les tentatives de connexion
      const attempts = await this.checkLoginAttempts(email, clientIp);
      if (attempts >= 5) {
        throw new BadRequestException(
          'Compte temporairement bloqué. Réessayez dans 15 minutes.',
        );
      }

      // Authentifier l'utilisateur
      const user = await this.authenticateUser(email, password);
      if (!user) {
        await this.logFailedAttempt(email, clientIp);
        throw new UnauthorizedException('Email ou mot de passe incorrect');
      }

      // Réinitialiser les tentatives échouées
      await this.resetLoginAttempts(email);

      // Mettre à jour les infos de connexion
      await this.updateUserLoginInfo(user.id, clientIp);

      // Créer la session Redis
      const sessionId = await this.createSession(user.id, clientIp);

      // Générer le token JWT avec session
      const payload = {
        sub: user.id,
        email: user.email,
        level: user.level,
        sessionId,
      };

      const access_token = this.jwtService.sign(payload);
      const expires_in = 3600 * 24 * 7; // 7 jours

      // Enregistrer dans l'historique
      await this.logLoginHistory(user.id, clientIp, 'SUCCESS');

      this.logger.log(`User logged in successfully: ${email}`);

      return {
        user,
        access_token,
        expires_in,
      };
    } catch (error) {
      this.logger.error(`Login failed for ${email}:`, error);
      throw error;
    }
  }

  /**
   * Vérifier si un utilisateur existe
   */
  async checkIfUserExists(params: {
    id?: string;
    email?: string;
  }): Promise<AuthUser | null> {
    try {
      if (params.id) {
        return this.getUserById(params.id);
      }

      if (params.email) {
        const user = await this.userService.findUserByEmail(params.email);
        return user ? this.formatUserResponse(user) : null;
      }

      return null;
    } catch (error) {
      this.logger.error('Error checking if user exists:', error);
      return null;
    }
  }

  /**
   * Récupérer un utilisateur par ID
   */
  async getUserById(userId: string): Promise<AuthUser | null> {
    try {
      const user = await this.userService.getUserById(userId);
      return user ? this.formatUserResponse(user) : null;
    } catch (error) {
      this.logger.error(`Error getting user by ID ${userId}:`, error);
      return null;
    }
  }

  /**
   * Valider un mot de passe (support legacy MD5+crypt et moderne bcrypt)
   * Utilise PasswordCryptoService pour la validation multi-format
   */
  private async validatePassword(
    plainPassword: string,
    hashedPassword: string,
  ): Promise<boolean> {
    try {
      this.logger.debug(
        `🔐 validatePassword called with hash: ${hashedPassword.substring(0, 20)}...`,
      );
      const result = await this.passwordCrypto.validatePassword(
        plainPassword,
        hashedPassword,
      );
      this.logger.debug(
        `🔐 validatePassword result: ${result.isValid} (format: ${result.format})`,
      );
      return result.isValid;
    } catch (error) {
      this.logger.error('Error validating password:', error);
      return false;
    }
  }

  /**
   * Formatter la réponse utilisateur
   */
  private formatUserResponse(user: any): AuthUser {
    return {
      id: user.cst_id,
      email: user.cst_mail,
      firstName: user.cst_fname || '',
      lastName: user.cst_name || '',
      isPro: user.cst_is_pro === '1',
      isActive: user.cst_activ === '1',
      level: parseInt(String(user.cst_level || '1')),
      isAdmin: parseInt(String(user.cst_level || '1')) >= 7,
    };
  }

  /**
   * Vérifier si un utilisateur est administrateur
   */
  async isAdmin(userId: string): Promise<boolean> {
    try {
      const user = await this.getUserById(userId);
      return user ? user.isAdmin : false;
    } catch (error) {
      this.logger.error(
        `Error checking admin status for user ${userId}:`,
        error,
      );
      return false;
    }
  }

  /**
   * Vérifier si un utilisateur a un niveau spécifique
   */
  async hasLevel(userId: string, requiredLevel: number): Promise<boolean> {
    try {
      const user = await this.getUserById(userId);
      return user ? user.level >= requiredLevel : false;
    } catch (error) {
      this.logger.error(`Error checking level for user ${userId}:`, error);
      return false;
    }
  }

  /**
   * Vérifier les tentatives de connexion (utilise Redis pour le cache)
   */
  private async checkLoginAttempts(email: string, ip: string): Promise<number> {
    try {
      const key = `login_attempts:${email}:${ip}`;
      const attempts = await this.cacheService.get<number>(key);
      return attempts ?? 0;
    } catch (error) {
      this.logger.error('Error checking login attempts:', error);
      return 0;
    }
  }

  /**
   * Enregistrer une tentative échouée
   */
  private async logFailedAttempt(email: string, ip: string): Promise<void> {
    try {
      const key = `login_attempts:${email}:${ip}`;
      const current = await this.checkLoginAttempts(email, ip);
      await this.cacheService.set(key, (current + 1).toString(), 900); // 15 minutes

      // Log également dans l'historique
      await this.logLoginHistory(email, ip, 'FAILED');
    } catch (error) {
      this.logger.error('Error logging failed attempt:', error);
    }
  }

  /**
   * Réinitialiser les tentatives
   */
  private async resetLoginAttempts(email: string): Promise<void> {
    try {
      // Pattern pour nettoyer toutes les tentatives de cet email
      const pattern = `login_attempts:${email}:*`;
      await this.cacheService.delete(pattern);
    } catch (error) {
      this.logger.error('Error resetting login attempts:', error);
    }
  }

  /**
   * Créer une session Redis
   */
  private async createSession(userId: string, ip: string): Promise<string> {
    try {
      const sessionId = crypto.randomUUID();
      const sessionData = {
        userId,
        ip,
        createdAt: new Date().toISOString(),
        lastActivity: new Date().toISOString(),
      };

      const key = `session:${sessionId}`;
      await this.cacheService.set(key, JSON.stringify(sessionData), 604800); // 7 jours

      return sessionId;
    } catch (error) {
      this.logger.error('Error creating session:', error);
      return '';
    }
  }

  /**
   * Mettre à jour les infos de connexion utilisateur
   */
  private async updateUserLoginInfo(userId: string, ip: string): Promise<void> {
    try {
      // Utiliser le UserService pour mettre à jour les infos
      // Note: cette méthode devrait être ajoutée au UserService
      this.logger.debug(`Updated login info for user ${userId} from IP ${ip}`);
    } catch (error) {
      this.logger.error('Error updating user login info:', error);
    }
  }

  /**
   * Enregistrer l'historique de connexion
   */
  private async logLoginHistory(
    userIdOrEmail: string,
    ip: string,
    status: string,
  ): Promise<void> {
    try {
      const historyKey = `login_history:${Date.now()}`;
      const historyData = {
        userIdOrEmail,
        ip,
        status,
        timestamp: new Date().toISOString(),
        userAgent: 'NestJS Client',
      };

      await this.cacheService.set(
        historyKey,
        JSON.stringify(historyData),
        86400,
      ); // 24h
      this.logger.debug(`Login history logged: ${status} for ${userIdOrEmail}`);
    } catch (error) {
      this.logger.error('Error logging login history:', error);
    }
  }

  /**
   * Déconnexion (équivalent myspace.account.out.php)
   */
  async logout(sessionId: string): Promise<void> {
    try {
      const sessionKey = `session:${sessionId}`;
      await this.cacheService.delete(sessionKey);
      this.logger.debug(`Session ${sessionId} destroyed`);
    } catch (error) {
      this.logger.error('Error during logout:', error);
    }
  }

  /**
   * Met à jour le profil utilisateur
   */
  async updateUserProfile(
    userId: string,
    profileData: {
      firstName?: string;
      lastName?: string;
      email?: string;
      phone?: string;
      password?: string;
    },
  ): Promise<AuthUser | null> {
    try {
      this.logger.debug(`Updating profile for user ${userId}`);

      // Mise à jour en base de données
      const updatedUser = await this.userService.updateUser(userId, {
        cst_fname: profileData.firstName,
        cst_name: profileData.lastName,
        cst_mail: profileData.email,
        cst_tel: profileData.phone,
      });

      if (!updatedUser) {
        this.logger.warn(`User ${userId} not found for profile update`);
        return null;
      }

      // Invalider le cache utilisateur
      await this.cacheService.delete(`user:${userId}`);

      return this.formatUserResponse(updatedUser);
    } catch (error) {
      this.logger.error('Error updating user profile:', error);
      return null;
    }
  }

  /**
   * Change le mot de passe utilisateur
   */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<{ success: boolean; message: string }> {
    try {
      this.logger.debug(`Changing password for user ${userId}`);

      // Récupérer l'utilisateur actuel
      const user = await this.userService.getUserById(userId);
      if (!user) {
        return { success: false, message: 'Utilisateur non trouvé' };
      }

      // Vérifier le mot de passe actuel
      const isCurrentPasswordValid = await this.validatePassword(
        currentPassword,
        user.cst_pswd,
      );

      if (!isCurrentPasswordValid) {
        return { success: false, message: 'Mot de passe actuel incorrect' };
      }

      // Hacher le nouveau mot de passe
      const hashedNewPassword =
        await this.passwordCrypto.hashPassword(newPassword);

      // Mettre à jour le mot de passe
      const updated = await this.userService.updateUser(userId, {
        cst_pswd: hashedNewPassword,
      });

      if (!updated) {
        return { success: false, message: 'Erreur lors de la mise à jour' };
      }

      // Invalider les sessions actives pour forcer une reconnexion
      await this.cacheService.delete(`user:${userId}`);

      this.logger.log(`Password changed successfully for user ${userId}`);
      return { success: true, message: 'Mot de passe mis à jour avec succès' };
    } catch (error) {
      this.logger.error('Error changing password:', error);
      return { success: false, message: 'Erreur technique' };
    }
  }

  /**
   * Valide un token JWT
   */
  async validateToken(token: string): Promise<AuthUser | null> {
    try {
      this.logger.debug('Validating JWT token');

      const decoded = this.jwtService.verify(token);
      if (!decoded?.sub) {
        return null;
      }

      return await this.getUserById(decoded.sub);
    } catch (error) {
      this.logger.debug(`Invalid JWT token: ${(error as Error).message}`);
      return null;
    }
  }

  // ✅ NETTOYAGE: Méthodes de hachage déplacées vers PasswordCryptoService
  // Utiliser this.passwordCrypto.hashPassword() et this.passwordCrypto.validatePassword()

  // ==========================================
  // NOUVELLES FONCTIONNALITÉS MODULAIRES
  // ==========================================

  /**
   * Vérifier l'accès à un module (remplace get.access.php)
   * Version progressive intégrée au système existant
   */
  async checkModuleAccess(
    userId: string,
    module: string,
    action: string = 'read',
  ): Promise<{
    hasAccess: boolean;
    reason?: string;
    requiredRole?: string;
  }> {
    try {
      // Récupérer l'utilisateur via le service existant
      const user = await this.userService.getUserById(userId);

      if (!user || user.cst_activ !== '1') {
        return { hasAccess: false, reason: 'User inactive or not found' };
      }

      // Logique de permissions basée sur le niveau utilisateur existant
      const userLevel = parseInt(String(user.cst_level)) || 0;

      const modulePermissions: Record<string, Record<string, number>> = {
        commercial: { read: 1, write: 3 },
        admin: { read: 7, write: 9 },
        seo: { read: 3, write: 5 },
        expedition: { read: 2, write: 4 },
        inventory: { read: 2, write: 4 },
        finance: { read: 5, write: 7 },
        reports: { read: 1, write: 5 },
      };

      const requiredLevel = modulePermissions[module]?.[action] || 9;
      const hasAccess = userLevel >= requiredLevel;

      this.logger.debug(
        `Module access check: user ${userId}, module ${module}, action ${action}, userLevel ${userLevel}, required ${requiredLevel}, access ${hasAccess}`,
      );

      return {
        hasAccess,
        reason: hasAccess ? 'Access granted' : 'Insufficient privileges',
        requiredRole: `Level ${requiredLevel} required`,
      };
    } catch (error) {
      this.logger.error(`Error checking module access: ${error}`);
      return {
        hasAccess: false,
        reason: 'Access check failed',
      };
    }
  }

  /**
   * Gérer la réponse en cas de non-privilège
   * (remplace get.access.response.no.privilege.php)
   */
  handleNoPrivilege(module: string, requiredRole?: string): never {
    const errorDetails = {
      statusCode: 403,
      message: 'Access denied',
      error: 'Forbidden',
      details: {
        module,
        requiredRole,
        timestamp: new Date().toISOString(),
      },
    };

    this.logger.warn(`Access denied for module ${module}: ${requiredRole}`);
    throw new ForbiddenException(errorDetails);
  }

  /**
   * Gérer la déconnexion moderne (remplace get.out.php)
   * Intégré avec le système de cache existant
   */
  async modernLogout(sessionId: string, userId?: string): Promise<void> {
    try {
      // Logger la déconnexion
      if (userId) {
        this.logger.log(
          `Logout initiated for user ${userId}, session ${sessionId}`,
        );

        // Utiliser le cache Redis existant pour tracker les déconnexions
        await this.cacheService.set(
          `logout:${userId}:${sessionId}`,
          {
            timestamp: new Date().toISOString(),
            action: 'logout',
          },
          60 * 15, // 15 minutes
        );
      }

      // Nettoyer les sessions en cache
      if (sessionId) {
        await this.cacheService.del(`session:${sessionId}`);
        await this.cacheService.del(`user:${userId}`);
        await this.cacheService.del(`auth_attempts:${userId}`);
      }

      this.logger.log(`Modern logout completed successfully`);
    } catch (error) {
      this.logger.error(`Modern logout error: ${error}`);
      // Ne pas faire échouer le logout pour des erreurs de logging
    }
  }

  /**
   * Obtenir les informations de session depuis la requête
   * Compatible avec le système JWT existant
   */
  async getSessionFromRequest(request: any): Promise<{
    user: AuthUser;
    token: string;
    sessionId: string;
  } | null> {
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      return null;
    }

    try {
      // Utiliser le JWT service existant
      const decoded = this.jwtService.verify(token);

      // Récupérer l'utilisateur via le service existant
      const user = await this.userService.getUserById(decoded.sub);
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
      this.logger.debug(
        `Invalid token in session request: ${(error as Error).message}`,
      );
      return null;
    }
  }

  /**
   * Vérifier si un utilisateur peut accéder à un module spécifique
   * Méthode utilitaire pour les guards
   */
  async canAccessModule(
    userId: string,
    module: string,
    action: string = 'read',
  ): Promise<boolean> {
    const result = await this.checkModuleAccess(userId, module, action);
    return result.hasAccess;
  }

  /**
   * Obtenir la liste des modules accessibles pour un utilisateur
   */
  async getUserAccessibleModules(userId: string): Promise<string[]> {
    const modules = [
      'commercial',
      'seo',
      'expedition',
      'inventory',
      'finance',
      'reports',
      'admin',
    ];
    const accessibleModules: string[] = [];

    for (const module of modules) {
      const canAccess = await this.canAccessModule(userId, module, 'read');
      if (canAccess) {
        accessibleModules.push(module);
      }
    }

    this.logger.debug(
      `User ${userId} has access to modules: ${accessibleModules.join(', ')}`,
    );
    return accessibleModules;
  }

  /**
   * Extraire le token du header (méthode privée réutilisable)
   */
  private extractTokenFromHeader(request: any): string | null {
    const authHeader = request.headers?.authorization;
    if (!authHeader) return null;

    const [type, token] = authHeader.split(' ');
    return type === 'Bearer' ? token : null;
  }
}
