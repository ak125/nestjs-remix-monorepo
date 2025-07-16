import { Injectable } from '@nestjs/common';
import { SupabaseRestService } from '../database/supabase-rest.service';

@Injectable()
export class AuthService {
  constructor(private supabaseRestService: SupabaseRestService) {}

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
    
    return await this.checkIfUserExists({
      email,
      password,
      withPassword: true,
    });
  }

  async testConnection(): Promise<boolean> {
    return await this.supabaseRestService.testConnection();
  }
}