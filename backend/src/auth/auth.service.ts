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
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import { UserDataConsolidatedService } from '../modules/users/services/user-data-consolidated.service';
import type { User } from '../modules/users/dto/user.dto';
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
  authSource?: 'admin' | 'customer';
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
  private readonly googleClient: OAuth2Client | null;
  private readonly googleClientId: string;

  private readonly googleClientSecret: string;

  constructor(
    private readonly jwtService: JwtService,
    private readonly userDataService: UserDataConsolidatedService,
    private readonly cacheService: CacheService,
    private readonly passwordCrypto: PasswordCryptoService,
    private readonly configService: ConfigService,
  ) {
    this.googleClientId = this.configService.get('GOOGLE_CLIENT_ID') || '';
    this.googleClientSecret =
      this.configService.get('GOOGLE_CLIENT_SECRET') || '';
    this.googleClient = this.googleClientId
      ? new OAuth2Client(this.googleClientId)
      : null;
    this.logger.log(
      `AuthService initialized - Google Sign-In ${this.googleClientId ? 'enabled' : 'disabled (no GOOGLE_CLIENT_ID)'}`,
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

      // Lookup unifié via RPC : admin prioritaire, puis customer
      const resolved = await this.userDataService.resolveUserByEmail(email);

      if (!resolved) {
        this.logger.warn(`User not found in any table: ${email}`);
        return null;
      }

      const { userId, passwordHash, authSource } = resolved;
      const isAdmin = authSource === 'admin';

      // Vérifier le mot de passe
      const isPasswordValid = await this.validatePassword(
        password,
        passwordHash,
      );
      if (!isPasswordValid) {
        this.logger.warn(`Invalid password for user: ${email}`);
        return null;
      }

      // UPGRADE AUTOMATIQUE: Migrer les mots de passe legacy vers bcrypt
      if (this.passwordCrypto.needsRehash(passwordHash)) {
        this.logger.log(`Upgrading password for user: ${email}`);
        try {
          await this.passwordCrypto.upgradeHashIfNeeded(
            userId,
            password,
            passwordHash,
            async (uid, newHash) => {
              if (isAdmin) {
                const url = `${process.env.SUPABASE_URL}/rest/v1/___config_admin?cnfa_id=eq.${uid}`;
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
                await this.userDataService.setPasswordHash(uid, newHash);
              }
            },
          );
          this.logger.log(`Password upgraded successfully for: ${email}`);
        } catch (upgradeError) {
          this.logger.error(
            `Failed to upgrade password for ${email}:`,
            upgradeError,
          );
        }
      }

      const authUser: AuthUser = {
        id: resolved.userId,
        email: resolved.email,
        firstName: resolved.firstName,
        lastName: resolved.lastName,
        level: resolved.level,
        isActive: resolved.isActive,
        isPro: isAdmin || resolved.level >= 5,
        isAdmin: isAdmin && resolved.level >= 7,
        authSource,
      };

      // Vérifier que l'utilisateur est actif
      if (!authUser.isActive) {
        this.logger.warn(`Inactive user tried to login: ${email}`);
        throw new UnauthorizedException('Compte désactivé');
      }

      this.logger.log(
        `Authentication successful for ${email} (source: ${authSource}, admin: ${authUser.isAdmin})`,
      );
      return authUser;
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

      // 2. Créer l'utilisateur via le service canonique (hashing interne)
      const createdUser = await this.userDataService.create({
        email: registerDto.email,
        password: registerDto.password,
        firstName: registerDto.firstName,
        lastName: registerDto.lastName,
      });

      // 3. Formater et retourner l'utilisateur créé
      const authUser = this.mapUserToAuthUser(createdUser);

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
   * Authentification via Google ID token (Google Identity Services)
   * Vérifie le token, crée ou lie le compte, retourne l'AuthUser
   */
  async authenticateWithGoogle(idToken: string): Promise<AuthUser> {
    if (!this.googleClient || !this.googleClientId) {
      throw new BadRequestException(
        'Google Sign-In is not configured on this server',
      );
    }

    // 1. Vérifier le token Google
    let payload;
    try {
      const ticket = await this.googleClient.verifyIdToken({
        idToken,
        audience: this.googleClientId,
      });
      payload = ticket.getPayload();
    } catch (error) {
      this.logger.warn(
        `Google token verification failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new UnauthorizedException('Token Google invalide ou expiré');
    }

    if (!payload || !payload.sub || !payload.email) {
      throw new UnauthorizedException('Token Google incomplet');
    }

    const googleId = payload.sub;
    const email = payload.email.toLowerCase().trim();
    const firstName = payload.given_name || '';
    const lastName = payload.family_name || '';

    this.logger.debug(`Google auth for: ${email} (sub: ${googleId})`);

    // 2. Chercher par google_id
    let user = await this.userDataService.findByGoogleId(googleId);
    if (user) {
      this.logger.log(`Google login: existing user ${email}`);
      return this.mapUserToAuthUser(user);
    }

    // 3. Chercher par email → lier automatiquement
    user = await this.userDataService.findByEmail(email);
    if (user) {
      await this.userDataService.linkGoogleId(user.id, googleId);
      this.logger.log(`Google login: linked existing account ${email}`);
      return this.mapUserToAuthUser(user);
    }

    // 4. Créer un nouveau compte
    const randomPassword =
      crypto.randomBytes(32).toString('base64url') + '!Aa1';
    const newUser = await this.userDataService.create({
      email,
      password: randomPassword,
      firstName,
      lastName,
    });

    // Lier le Google ID au nouveau compte
    await this.userDataService.linkGoogleId(newUser.id, googleId);

    this.logger.log(`Google login: new account created for ${email}`);
    return this.mapUserToAuthUser(newUser);
  }

  /**
   * Construit l'URL d'autorisation Google OAuth2 (redirect flow)
   */
  getGoogleAuthUrl(
    redirectUri: string,
    redirectTo?: string,
  ): { url: string; nonce: string } {
    if (!this.googleClientId) {
      throw new BadRequestException(
        'Google Sign-In is not configured on this server',
      );
    }

    // State param avec nonce CSRF + redirectTo
    const nonce = crypto.randomBytes(16).toString('hex');
    const state = Buffer.from(
      JSON.stringify({ nonce, redirectTo: redirectTo || '/' }),
    ).toString('base64url');

    const params = new URLSearchParams({
      client_id: this.googleClientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      access_type: 'online',
      state,
      prompt: 'select_account',
    });

    return {
      url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
      nonce,
    };
  }

  /**
   * Échange un code d'autorisation Google contre un ID token
   */
  async exchangeCodeForTokens(
    code: string,
    redirectUri: string,
  ): Promise<string> {
    if (!this.googleClientId || !this.googleClientSecret) {
      throw new BadRequestException(
        'Google OAuth2 is not fully configured (missing client_id or client_secret)',
      );
    }

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: this.googleClientId,
        client_secret: this.googleClientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }).toString(),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok || !tokenData.id_token) {
      this.logger.error(
        `Google token exchange failed: ${JSON.stringify(tokenData)}`,
      );
      throw new UnauthorizedException("Échec de l'échange du code Google");
    }

    return tokenData.id_token as string;
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
        // Check cross-tables (admin + customer) via RPC
        const exists = await this.userDataService.emailExistsAnywhere(
          params.email,
        );
        if (!exists) return null;

        const resolved = await this.userDataService.resolveUserByEmail(
          params.email,
        );
        if (!resolved) return null;

        return {
          id: resolved.userId,
          email: resolved.email,
          firstName: resolved.firstName,
          lastName: resolved.lastName,
          level: resolved.level,
          isActive: resolved.isActive,
          isPro: resolved.authSource === 'admin' || resolved.level >= 5,
          isAdmin: resolved.authSource === 'admin' && resolved.level >= 7,
          authSource: resolved.authSource,
        };
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
  /**
   * Récupérer un utilisateur par ID avec routage déterministe par source.
   * Utilisé par le nouveau cookie-serializer (format { userId, authSource }).
   */
  async getUserByIdAndSource(
    userId: string,
    authSource: 'admin' | 'customer',
  ): Promise<AuthUser | null> {
    try {
      if (authSource === 'admin') {
        const admin = await this.userDataService.findAdminById(userId);
        if (admin) return this.mapAdminToAuthUser(admin);
        return null;
      }

      const user = await this.userDataService.findById(userId);
      if (user) return this.mapUserToAuthUser(user);
      return null;
    } catch (error) {
      this.logger.error(
        `Error getting user by ID+source ${authSource}:${userId}:`,
        error,
      );
      return null;
    }
  }

  /**
   * Récupérer un utilisateur par ID (rétrocompat anciennes sessions).
   * Ordre inversé : admin d'abord pour éviter collision d'ID.
   */
  async getUserById(userId: string): Promise<AuthUser | null> {
    try {
      // 1. Chercher dans les admins d'abord (évite collision ID admin/customer)
      const admin = await this.userDataService.findAdminById(userId);
      if (admin) return this.mapAdminToAuthUser(admin);

      // 2. Fallback: chercher dans les customers
      const user = await this.userDataService.findById(userId);
      if (user) return this.mapUserToAuthUser(user);

      return null;
    } catch (error) {
      this.logger.error(`Error getting user by ID ${userId}:`, error);
      return null;
    }
  }

  private mapAdminToAuthUser(admin: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    isActive: boolean;
    level: number;
  }): AuthUser {
    return {
      id: admin.id,
      email: admin.email,
      firstName: admin.firstName,
      lastName: admin.lastName,
      isPro: true,
      isActive: admin.isActive,
      level: admin.level,
      isAdmin: admin.level >= 7,
      authSource: 'admin',
    };
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
   * Mapper un User DTO vers AuthUser
   */
  private mapUserToAuthUser(user: User): AuthUser {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      isPro: user.isPro,
      isActive: user.isActive,
      level: user.level,
      isAdmin: user.level >= 7,
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
      await this.cacheService.atomicIncr(key, 900); // 15 minutes, atomic

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

      // Mise à jour en base de données via le service canonique
      const updatedUser = await this.userDataService.update(userId, {
        firstName: profileData.firstName,
        lastName: profileData.lastName,
        email: profileData.email,
        phone: profileData.phone,
      });

      if (!updatedUser) {
        this.logger.warn(`User ${userId} not found for profile update`);
        return null;
      }

      // Invalider le cache utilisateur
      await this.cacheService.delete(`user:${userId}`);

      return this.mapUserToAuthUser(updatedUser);
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

      // Récupérer l'utilisateur actuel avec le hash du mot de passe
      const result = await this.userDataService.findByIdForAuth(userId);
      if (!result) {
        return { success: false, message: 'Utilisateur non trouvé' };
      }

      // Vérifier le mot de passe actuel
      const isCurrentPasswordValid = await this.validatePassword(
        currentPassword,
        result.passwordHash,
      );

      if (!isCurrentPasswordValid) {
        return { success: false, message: 'Mot de passe actuel incorrect' };
      }

      // Hacher le nouveau mot de passe
      const hashedNewPassword =
        await this.passwordCrypto.hashPassword(newPassword);

      // Mettre à jour le mot de passe
      const updated = await this.userDataService.setPasswordHash(
        userId,
        hashedNewPassword,
      );

      if (!updated) {
        return { success: false, message: 'Erreur lors de la mise à jour' };
      }

      // Invalider TOUTES les sessions pour forcer reconnexion sur tous les appareils
      await this.invalidateAllSessions(userId);

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
      // Récupérer l'utilisateur via le service canonique
      const user = await this.userDataService.findById(userId);

      if (!user || !user.isActive) {
        return { hasAccess: false, reason: 'User inactive or not found' };
      }

      // Logique de permissions basée sur le niveau utilisateur existant
      const userLevel = user.level;

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
   * Invalidate all sessions for a user (logout everywhere).
   * Increments the session version — all existing sessions with older version
   * will be rejected at deserialization time.
   * Use after password change, account compromise, or explicit "logout all devices".
   */
  async invalidateAllSessions(userId: string): Promise<void> {
    try {
      const versionKey = `session_version:${userId}`;
      const newVersion = await this.cacheService.atomicIncr(
        versionKey,
        86400 * 30,
      ); // 30 days TTL
      this.logger.log(
        `All sessions invalidated for user ${userId} (version=${newVersion})`,
      );

      // Also clear user cache to force re-fetch
      await this.cacheService.del(`user:${userId}`);
    } catch (error) {
      this.logger.error(
        `Failed to invalidate all sessions for ${userId}: ${error}`,
      );
    }
  }

  /**
   * Get current session version for a user.
   * Returns 0 if no version set (= all sessions valid).
   */
  async getSessionVersion(userId: string): Promise<number> {
    try {
      const version = await this.cacheService.get<number>(
        `session_version:${userId}`,
      );
      return version || 0;
    } catch {
      return 0;
    }
  }

  /**
   * Obtenir les informations de session depuis la requête
   * Compatible avec le système JWT existant
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Express request
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

      // Récupérer l'utilisateur via le service canonique
      const user = await this.userDataService.findById(decoded.sub);
      if (!user || !user.isActive) {
        return null;
      }

      return {
        user: this.mapUserToAuthUser(user),
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Express request
  private extractTokenFromHeader(request: any): string | null {
    const authHeader = request.headers?.authorization;
    if (!authHeader) return null;

    const [type, token] = authHeader.split(' ');
    return type === 'Bearer' ? token : null;
  }
}
