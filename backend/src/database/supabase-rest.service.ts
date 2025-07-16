import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { createHash } from 'crypto';
import { debugConfiguration } from '../debug-config';

export interface User {
  cst_id: string;
  cst_mail: string;
  cst_pswd: string;
  cst_fname?: string;
  cst_name?: string;
  cst_civility?: string;
  cst_address?: string;
  cst_zip_code?: string;
  cst_city?: string;
  cst_country?: string;
  cst_tel?: string;
  cst_gsm?: string;
  cst_is_pro: string;
  cst_rs?: string;
  cst_siret?: string;
  cst_activ: string;
  cst_level?: number;
  cst_is_cpy?: string;
}

@Injectable()
export class SupabaseRestService {
  private readonly supabaseUrl: string;
  private readonly supabaseServiceKey: string;
  private readonly baseUrl: string;

  constructor(private configService: ConfigService) {
    // Debug de la configuration
    debugConfiguration(configService);
    
    this.supabaseUrl = this.configService.get<string>('SUPABASE_URL') || '';
    this.supabaseServiceKey =
      this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY') || '';
    this.baseUrl = `${this.supabaseUrl}/rest/v1`;

    console.log('🔧 Configuration Supabase :');
    console.log('  - SUPABASE_URL:', this.supabaseUrl);
    console.log('  - BASE_URL:', this.baseUrl);
    console.log(
      '  - SERVICE_KEY présente:',
      this.supabaseServiceKey ? 'OUI' : 'NON',
    );
  }

  private get headers() {
    return {
      'Content-Type': 'application/json',
      apikey: this.supabaseServiceKey,
      Authorization: `Bearer ${this.supabaseServiceKey}`,
      Prefer: 'return=representation',
    };
  }

  async findUserByEmail(email: string): Promise<User | null> {
    try {
      const response = await fetch(
        `${this.baseUrl}/___xtr_customer?cst_mail=eq.${email}&select=*`,
        {
          method: 'GET',
          headers: this.headers,
        },
      );

      if (!response.ok) {
        console.error('Erreur Supabase:', response.status, response.statusText);
        return null;
      }

      const users = await response.json();
      return users.length > 0 ? users[0] : null;
    } catch (error) {
      console.error('Erreur lors de la recherche utilisateur:', error);
      return null;
    }
  }

  async createUser(userData: {
    email: string;
    password: string;
    firstName?: string;
    lastName?: string;
  }): Promise<User | null> {
    try {
      const hashedPassword = await bcrypt.hash(userData.password, 10);

      const newUser = {
        cst_id: `usr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        cst_mail: userData.email,
        cst_pswd: hashedPassword,
        cst_fname: userData.firstName || '',
        cst_name: userData.lastName || '',
        cst_is_pro: '0',
        cst_activ: '1',
        cst_level: 1,
      };

      const response = await fetch(`${this.baseUrl}/___xtr_customer`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(newUser),
      });

      if (!response.ok) {
        console.error(
          'Erreur création utilisateur:',
          response.status,
          response.statusText,
        );
        return null;
      }

      const createdUsers = await response.json();
      return createdUsers[0];
    } catch (error) {
      console.error('Erreur lors de la création utilisateur:', error);
      return null;
    }
  }

  async validatePassword(
    plainPassword: string,
    hashedPassword: string,
  ): Promise<boolean> {
    try {
      console.log('=== Validation du mot de passe ===');
      console.log('Mot de passe en clair:', plainPassword);
      console.log('Mot de passe stocké:', hashedPassword);
      
      // Vérification si le mot de passe est déjà en clair (ancien système)
      if (plainPassword === hashedPassword) {
        console.log('✅ Mot de passe en clair - correspondance directe');
        return true;
      }
      
      // Vérification avec SHA-1 (système intermédiaire)
      const sha1Hash = createHash('sha1').update(plainPassword).digest('hex');
      console.log('🔍 SHA-1 hash calculé:', sha1Hash);
      
      if (sha1Hash === hashedPassword) {
        console.log('✅ Mot de passe SHA-1 - correspondance');
        return true;
      }
      
      // Vérification avec bcrypt (nouveau système)
      const bcryptResult = await bcrypt.compare(plainPassword, hashedPassword);
      console.log('🔐 Résultat bcrypt:', bcryptResult);
      
      if (bcryptResult) {
        return true;
      }
      
      // Vérification avec Unix DES crypt (ancien système Unix)
      if (hashedPassword.length === 13) {
        console.log('🔑 Test Unix DES crypt (longueur 13)');
        try {
          const crypt = await import('unix-crypt-td-js');
          const salt = hashedPassword.substring(0, 2);
          const cryptResult = crypt.default(plainPassword, salt);
          console.log('🔍 Hash Unix DES calculé:', cryptResult);
          
          if (cryptResult === hashedPassword) {
            console.log('✅ Mot de passe Unix DES crypt - correspondance');
            return true;
          }
        } catch (cryptError) {
          console.error('Erreur Unix DES crypt:', cryptError);
        }
      }
      
      console.log('❌ Aucune correspondance trouvée');
      return false;
    } catch (error) {
      console.error('Erreur validation mot de passe:', error);
      return false;
    }
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | null> {
    try {
      const response = await fetch(
        `${this.baseUrl}/___xtr_customer?cst_id=eq.${id}`,
        {
          method: 'PATCH',
          headers: this.headers,
          body: JSON.stringify(updates),
        },
      );

      if (!response.ok) {
        console.error(
          'Erreur mise à jour utilisateur:',
          response.status,
          response.statusText,
        );
        return null;
      }

      const updatedUsers = await response.json();
      return updatedUsers[0];
    } catch (error) {
      console.error('Erreur lors de la mise à jour utilisateur:', error);
      return null;
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch(
        `${this.baseUrl}/___xtr_customer?select=count&limit=1`,
        {
          method: 'GET',
          headers: this.headers,
        },
      );

      return response.ok;
    } catch (error) {
      console.error('Erreur test connexion:', error);
      return false;
    }
  }

  async getUserById(userId: string): Promise<User | null> {
    try {
      console.log('--- Début de getUserById ---');
      console.log('ID utilisateur recherché:', userId);
      
      const response = await fetch(
        `${this.baseUrl}/___xtr_customer?cst_id=eq.${userId}&select=*`,
        {
          method: 'GET',
          headers: this.headers,
        },
      );

      if (!response.ok) {
        console.error(
          'Erreur récupération utilisateur:',
          response.status,
          response.statusText,
        );
        return null;
      }

      const users = await response.json();
      console.log('Utilisateurs trouvés:', users);
      
      if (users && users.length > 0) {
        const user = users[0];
        console.log('Utilisateur récupéré:', user);
        return user;
      }
      
      console.log('Aucun utilisateur trouvé avec cet ID');
      return null;
    } catch (error) {
      console.error('Erreur lors de la récupération utilisateur:', error);
      return null;
    }
  }
}
