import { Injectable } from '@nestjs/common';
import { SupabaseRestService } from '../database/supabase-rest.service';
import { CacheService } from '../cache/cache.service';
import * as crypto from 'crypto';

@Injectable()
export class AuthService {
  constructor(
    private supabaseRestService: SupabaseRestService,
    private cacheService: CacheService,
  ) {}

  async checkIfUserExists(params: {
    email: string;
    password: string;
    withPassword: boolean;
  }): Promise<any> {
    console.log('--- Début de checkIfUserExists ---');
    console.log('Paramètres reçus :', params);

    const { email, password, withPassword } = params;
    console.log('Email extrait :', email);
    console.log('Mot de passe extrait :', password);
    console.log('withPassword :', withPassword);

    // Vérifie si l'utilisateur existe dans la base via l'API REST
    const existingUser = await this.supabaseRestService.findUserByEmail(email);

    if (!existingUser) {
      console.log('Utilisateur non trouvé');
      return {
        message: "L'email est invalide",
        error: true,
      };
    }

    console.log('Utilisateur trouvé:', existingUser);

    // Si withPassword est false, on ne vérifie que l'existence de l'email
    if (!withPassword) {
      console.log('Vérification uniquement email - utilisateur existe');
      return {
        id: existingUser.cst_id,
        email: existingUser.cst_mail,
        firstName: existingUser.cst_fname,
        lastName: existingUser.cst_name,
        isPro: existingUser.cst_is_pro === '1',
        isActive: existingUser.cst_activ === '1',
      };
    }

    // Vérifie le mot de passe seulement si withPassword est true
    const isPasswordValid = await this.supabaseRestService.validatePassword(
      password,
      existingUser.cst_pswd,
    );

    if (!isPasswordValid) {
      console.log('Mot de passe invalide');
      return {
        message: 'Le mot de passe est invalide',
        error: true,
      };
    }

    console.log('Authentification réussie');
    return {
      id: existingUser.cst_id,
      email: existingUser.cst_mail,
      firstName: existingUser.cst_fname,
      lastName: existingUser.cst_name,
      isPro: existingUser.cst_is_pro === '1',
      isActive: existingUser.cst_activ === '1',
    };
  }

  async createUser(userData: {
    email: string;
    password: string;
    firstName?: string;
    lastName?: string;
  }): Promise<any> {
    console.log('--- Début de createUser ---');
    console.log('[AuthService] Données utilisateur reçues:', userData);

    // Vérifie si l'utilisateur existe déjà
    const existingUser = await this.supabaseRestService.findUserByEmail(
      userData.email,
    );

    if (existingUser) {
      console.log('[AuthService] Utilisateur déjà existant:', existingUser);
      return null;
    }

    // Crée l'utilisateur
    let newUser;
    try {
      newUser = await this.supabaseRestService.createUser(userData);
      console.log('[AuthService] Utilisateur créé:', newUser);
    } catch (err) {
      console.error('[AuthService] Erreur lors de la création:', err);
      return null;
    }

    if (!newUser) {
      console.log('[AuthService] Erreur lors de la création (newUser null)');
      return null;
    }

    return {
      id: newUser.cst_id,
      email: newUser.cst_mail,
      firstName: newUser.cst_fname,
      lastName: newUser.cst_name,
      isPro: newUser.cst_is_pro === '1',
      isActive: newUser.cst_activ === '1',
    };
  }

  async authenticateUser(email: string, password: string): Promise<any> {
    console.log('--- Début de authenticateUser ---');
    console.log('Type email:', typeof email, 'Valeur:', email);
    console.log('Type password:', typeof password, 'Valeur:', password);

    try {
      // Vérifier les tentatives de connexion (avec fallback)
      const attempts = await this.cacheService.getLoginAttempts(email);
      if (attempts >= 5) {
        console.log('Trop de tentatives de connexion pour:', email);
        return {
          message: 'Trop de tentatives de connexion. Réessayez plus tard.',
          error: true,
        };
      }
    } catch (error) {
      console.log(
        'Erreur cache lors de la vérification des tentatives:',
        error,
      );
      // Continuer sans cache
    }

    const result = await this.checkIfUserExists({
      email,
      password,
      withPassword: true,
    });

    if (result && !result.error) {
      // Connexion réussie, effacer les tentatives
      try {
        await this.cacheService.clearLoginAttempts(email);
        // Mettre en cache les données utilisateur
        await this.cacheService.cacheUser(result.id, result);
      } catch (error) {
        console.log('Erreur cache lors de la connexion réussie:', error);
        // Continuer sans cache
      }
      return result;
    } else {
      // Connexion échouée, incrémenter les tentatives
      try {
        await this.cacheService.incrementLoginAttempts(email);
      } catch (error) {
        console.log("Erreur cache lors de l'échec de connexion:", error);
        // Continuer sans cache
      }
      return result;
    }
  }

  async testConnection(): Promise<boolean> {
    return await this.supabaseRestService.testConnection();
  }

  async generatePasswordResetToken(email: string): Promise<string | null> {
    try {
      console.log('--- Début de generatePasswordResetToken ---');
      console.log('Email:', email);

      // Générer un token unique
      const token = crypto.randomBytes(32).toString('hex');
      const expires = new Date(Date.now() + 3600000); // 1 heure

      console.log('Token généré:', token);
      console.log('Expire le:', expires);

      // Stocker le token dans Redis (avec fallback)
      try {
        await this.cacheService.setResetToken(token, email, 3600);
      } catch (error) {
        console.log('Erreur cache lors du stockage du token:', error);
        // Pour l'instant, on continue sans cache
        // TODO: Implémenter un fallback avec base de données
      }

      return token;
    } catch (error) {
      console.error('Erreur lors de la génération du token:', error);
      return null;
    }
  }

  async resetPasswordWithToken(
    token: string,
    newPassword: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('--- Début de resetPasswordWithToken ---');
      console.log('Token:', token);

      // Vérifier le token dans Redis (avec fallback)
      let tokenData = null;
      try {
        tokenData = await this.cacheService.getResetToken(token);
      } catch (error) {
        console.log('Erreur cache lors de la vérification du token:', error);
        // TODO: Implémenter un fallback avec base de données
        return { success: false, error: 'cache_error' };
      }

      if (!tokenData) {
        return { success: false, error: 'invalid_token' };
      }

      if (tokenData.used) {
        return { success: false, error: 'token_used' };
      }

      if (new Date(tokenData.expires) < new Date()) {
        return { success: false, error: 'token_expired' };
      }

      // Mettre à jour le mot de passe
      const hashedPassword =
        await this.supabaseRestService.hashPassword(newPassword);
      const updateResult = await this.supabaseRestService.updateUserPassword(
        tokenData.email,
        hashedPassword,
      );

      if (updateResult) {
        // Marquer le token comme utilisé
        try {
          await this.cacheService.markTokenAsUsed(token);
        } catch (error) {
          console.log('Erreur cache lors du marquage du token:', error);
          // Continuer sans cache
        }
        console.log('Mot de passe mis à jour avec succès');
        return { success: true };
      } else {
        return { success: false, error: 'update_failed' };
      }
    } catch (error) {
      console.error('Erreur lors du reset du mot de passe:', error);
      return { success: false, error: 'server_error' };
    }
  }

  async updateUserProfile(
    userId: string,
    updates: {
      firstName?: string;
      lastName?: string;
      email?: string;
      tel?: string;
      address?: string;
      city?: string;
      zipCode?: string;
      country?: string;
    },
  ): Promise<any> {
    try {
      console.log('--- Début de updateUserProfile ---');
      console.log('User ID:', userId);
      console.log('Updates:', updates);

      const result = await this.supabaseRestService.updateUserProfile(
        userId,
        updates,
      );

      if (result) {
        const userResponse = {
          id: result.cst_id,
          email: result.cst_mail,
          firstName: result.cst_fname,
          lastName: result.cst_name,
          tel: result.cst_tel,
          address: result.cst_address,
          city: result.cst_city,
          zipCode: result.cst_zip_code,
          country: result.cst_country,
          isPro: result.cst_is_pro === '1',
          isActive: result.cst_activ === '1',
        };

        // Mettre à jour le cache (avec fallback)
        try {
          await this.cacheService.cacheUser(userId, userResponse);
        } catch (error) {
          console.log('Erreur cache lors de la mise à jour du profil:', error);
          // Continuer sans cache
        }

        return userResponse;
      }

      return null;
    } catch (error) {
      console.error('Erreur lors de la mise à jour du profil:', error);
      return null;
    }
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('--- Début de changePassword ---');
      console.log('User ID:', userId);

      // Récupérer l'utilisateur
      const user = await this.supabaseRestService.findUserById(userId);
      if (!user) {
        return { success: false, error: 'user_not_found' };
      }

      // Vérifier le mot de passe actuel
      const isCurrentPasswordValid =
        await this.supabaseRestService.validatePassword(
          currentPassword,
          user.cst_pswd,
        );

      if (!isCurrentPasswordValid) {
        return { success: false, error: 'invalid_current_password' };
      }

      // Changer le mot de passe
      const hashedPassword =
        await this.supabaseRestService.hashPassword(newPassword);
      const updateResult = await this.supabaseRestService.updateUserPassword(
        user.cst_mail,
        hashedPassword,
      );

      if (updateResult) {
        return { success: true };
      } else {
        return { success: false, error: 'update_failed' };
      }
    } catch (error) {
      console.error('Erreur lors du changement de mot de passe:', error);
      return { success: false, error: 'server_error' };
    }
  }
}
