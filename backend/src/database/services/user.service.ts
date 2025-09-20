import { Injectable } from '@nestjs/common';
import { SupabaseBaseService } from './supabase-base.service';
import * as bcrypt from 'bcrypt';
import { createHash } from 'crypto';

export interface User {
  cst_id: string;
  cst_mail: string;
  cst_pswd: string;
  cst_fname?: string;
  cst_name?: string;
  cst_tel?: string;
  cst_gsm?: string;
  cst_address?: string;
  cst_city?: string;
  cst_zip_code?: string;
  cst_country?: string;
  cst_is_pro: string;
  cst_is_cpy?: string;
  cst_activ: string;
  cst_level: number;
  cst_civility?: string;
  cst_rs?: string;
  cst_siret?: string;
}

@Injectable()
export class UserService extends SupabaseBaseService {
  /**
   * Trouver un utilisateur par email
   */
  async findUserByEmail(email: string): Promise<User | null> {
    try {
      console.log(`🔍 findUserByEmail: ${email}`);
      const url = `${this.baseUrl}/___xtr_customer?cst_mail=eq.${email}&select=*`;

      const response = await fetch(url, {
        method: 'GET',
        headers: this.headers,
      });

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

  /**
   * Récupérer un utilisateur par ID
   */
  async getUserById(userId: string): Promise<User | null> {
    try {
      // 1. Essayer d'abord dans la table des customers
      const response = await fetch(
        `${this.baseUrl}/___xtr_customer?select=*&cst_id=eq.${userId}`,
        {
          method: 'GET',
          headers: this.headers,
        },
      );

      if (response.ok) {
        const users = await response.json();
        if (users && users.length > 0) {
          return users[0];
        }
      }

      // 2. Si non trouvé, essayer dans la table des admins
      const adminResponse = await fetch(
        `${this.baseUrl}/___config_admin?select=*&cnfa_id=eq.${userId}`,
        {
          method: 'GET',
          headers: this.headers,
        },
      );

      if (adminResponse.ok) {
        const admins = await adminResponse.json();
        if (admins && admins.length > 0) {
          const admin = admins[0];
          // Convertir les données admin vers le format User
          return {
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
        }
      }

      console.error('User not found in both tables:', userId);
      return null;
    } catch (error) {
      console.error('Erreur lors de la récupération utilisateur:', error);
      return null;
    }
  }

  /**
   * Récupérer tous les utilisateurs avec pagination
   */
  async getAllUsers(
    page: number = 1,
    limit: number = 10,
    search?: string,
    level?: number,
  ): Promise<{ users: User[]; total: number }> {
    try {
      console.log(
        `🔍 getAllUsers: page=${page}, limit=${limit}, search=${search}, level=${level}`,
      );

      const offset = (page - 1) * limit;

      // Construire la requête avec filtres
      let query = `${this.baseUrl}/___xtr_customer?select=*`;

      if (search) {
        query += `&or=(cst_firstname.ilike.*${search}*,cst_lastname.ilike.*${search}*,cst_email.ilike.*${search}*)`;
      }

      if (level !== undefined) {
        query += `&cst_level=eq.${level}`;
      }

      query += `&order=cst_id.desc&offset=${offset}&limit=${limit}`;

      const response = await fetch(query, {
        method: 'GET',
        headers: this.headers,
      });

      if (!response.ok) {
        console.error('Erreur récupération utilisateurs:', response.status);
        return { users: [], total: 0 };
      }

      const users = await response.json();

      // Compter le total
      const total = await this._getTotalUsersCount(search, level);

      console.log(`✅ Users retrieved: ${users.length}/${total}`);

      return {
        users: users || [],
        total: total,
      };
    } catch (error) {
      console.error('Erreur lors de la récupération des utilisateurs:', error);
      return { users: [], total: 0 };
    }
  }

  /**
   * Compter le total d'utilisateurs
   */
  private async _getTotalUsersCount(
    search?: string,
    level?: number,
  ): Promise<number> {
    try {
      let countQuery = `${this.baseUrl}/___xtr_customer?select=count`;
      if (search) {
        countQuery += `&or=(cst_firstname.ilike.*${search}*,cst_lastname.ilike.*${search}*,cst_email.ilike.*${search}*)`;
      }
      if (level !== undefined) {
        countQuery += `&cst_level=eq.${level}`;
      }

      const countResponse = await fetch(countQuery, {
        method: 'GET',
        headers: this.headers,
      });

      if (countResponse.ok) {
        const countResult = await countResponse.json();
        return countResult[0]?.count || 0;
      }
    } catch (error) {
      console.error('Erreur comptage utilisateurs:', error);
    }
    return 0;
  }

  /**
   * Créer un nouvel utilisateur
   */
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

  /**
   * Valider un mot de passe (supporte multiple formats)
   */
  async validatePassword(
    plainPassword: string,
    hashedPassword: string,
  ): Promise<boolean> {
    try {
      // Vérification si le mot de passe est déjà en clair (ancien système)
      if (plainPassword === hashedPassword) {
        return true;
      }

      // Vérification avec SHA-1 (système intermédiaire)
      const sha1Hash = createHash('sha1').update(plainPassword).digest('hex');
      if (sha1Hash === hashedPassword) {
        return true;
      }

      // Vérification avec bcrypt (nouveau système)
      const bcryptResult = await bcrypt.compare(plainPassword, hashedPassword);
      if (bcryptResult) {
        return true;
      }

      // Vérification avec Unix DES crypt (ancien système Unix)
      if (hashedPassword.length === 13) {
        try {
          const crypt = await import('unix-crypt-td-js');
          const salt = hashedPassword.substring(0, 2);
          const cryptResult = crypt.default(plainPassword, salt);
          if (cryptResult === hashedPassword) {
            return true;
          }
        } catch (cryptError) {
          console.error('Erreur Unix DES crypt:', cryptError);
        }
      }

      return false;
    } catch (error) {
      console.error('Erreur validation mot de passe:', error);
      return false;
    }
  }

  /**
   * Mettre à jour un utilisateur
   */
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

  /**
   * Hasher un mot de passe
   */
  async hashPassword(password: string): Promise<string> {
    try {
      const saltRounds = 10;
      return await bcrypt.hash(password, saltRounds);
    } catch (error) {
      console.error('Erreur lors du hashage du mot de passe:', error);
      throw error;
    }
  }

  /**
   * Mettre à jour le mot de passe d'un utilisateur
   */
  async updateUserPassword(
    email: string,
    hashedPassword: string,
  ): Promise<boolean> {
    try {
      const response = await fetch(
        `${this.baseUrl}/___xtr_customer?cst_mail=eq.${email}`,
        {
          method: 'PATCH',
          headers: this.headers,
          body: JSON.stringify({
            cst_pswd: hashedPassword,
          }),
        },
      );

      if (!response.ok) {
        console.error('Erreur HTTP:', response.status, response.statusText);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Erreur lors de la mise à jour du mot de passe:', error);
      return false;
    }
  }

  /**
   * Mettre à jour le profil d'un utilisateur
   */
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
  ): Promise<User | null> {
    try {
      const updateData: any = {};

      if (updates.firstName) updateData.cst_fname = updates.firstName;
      if (updates.lastName) updateData.cst_name = updates.lastName;
      if (updates.email) updateData.cst_mail = updates.email;
      if (updates.tel) updateData.cst_tel = updates.tel;
      if (updates.address) updateData.cst_address = updates.address;
      if (updates.city) updateData.cst_city = updates.city;
      if (updates.zipCode) updateData.cst_zip_code = updates.zipCode;
      if (updates.country) updateData.cst_country = updates.country;

      const response = await fetch(
        `${this.baseUrl}/___xtr_customer?cst_id=eq.${userId}`,
        {
          method: 'PATCH',
          headers: this.headers,
          body: JSON.stringify(updateData),
        },
      );

      if (!response.ok) {
        console.error('Erreur HTTP:', response.status, response.statusText);
        return null;
      }

      return await this.getUserById(userId);
    } catch (error) {
      console.error('Erreur lors de la mise à jour du profil:', error);
      return null;
    }
  }

  /**
   * Trouver un admin par email
   */
  async findAdminByEmail(email: string): Promise<any | null> {
    try {
      console.log(`🔍 findAdminByEmail: ${email}`);
      const url = `${this.baseUrl}/___config_admin?cnfa_mail=eq.${email}&select=*`;

      const response = await fetch(url, {
        method: 'GET',
        headers: this.headers,
      });

      if (!response.ok) {
        console.error(
          'Erreur Supabase (admin):',
          response.status,
          response.statusText,
        );
        return null;
      }

      const admins = await response.json();
      return admins.length > 0 ? admins[0] : null;
    } catch (error) {
      console.error('Erreur lors de la recherche admin:', error);
      return null;
    }
  }
}
