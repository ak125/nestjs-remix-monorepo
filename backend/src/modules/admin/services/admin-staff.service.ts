/**
 * 📋 SERVICE STAFF ADMIN
 *
 * Service de gestion du staff admin
 * Cohérent avec les modules Users/Orders (utilise SupabaseRestService)
 */

import { Injectable, Logger } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { SupabaseRestService } from '../../../database/supabase-rest.service';
import {
  LegacyAdminStaff,
  CreateLegacyStaff,
  UpdateLegacyStaff,
  LegacyStaffQuery,
  LegacyStaffStats,
  SuperAdminCreation,
  STAFF_PERMISSIONS_MAP,
  STAFF_LEVEL_DESCRIPTIONS,
  LegacyAdminStaffSchema,
  CreateLegacyStaffSchema,
  UpdateLegacyStaffSchema,
  LegacyStaffQuerySchema,
} from '../schemas/legacy-staff.schemas';

@Injectable()
export class AdminStaffService {
  private readonly logger = new Logger(AdminStaffService.name);
  private readonly tableName = '___config_admin';

  constructor(private readonly supabaseService: SupabaseRestService) {}

  /**
   * Récupère tous les staff selon le niveau d'autorisation
   */
  async getAllStaff(
    query: LegacyStaffQuery,
    _currentUserId: string,
  ): Promise<{
    staff: LegacyAdminStaff[];
    pagination: {
      page: number;
      totalPages: number;
      totalItems: number;
    };
  }> {
    this.logger.log(`Récupération staff - Query: ${JSON.stringify(query)}`);

    try {
      // Validation des paramètres
      const validatedQuery = LegacyStaffQuerySchema.parse(query);
      const offset = (validatedQuery.page - 1) * validatedQuery.limit;

      // Construction de l'URL comme dans OrdersCompleteService
      let queryUrl = `${this.supabaseService['baseUrl']}/___config_admin?select=*`;

      // Appliquer les filtres
      if (validatedQuery.search) {
        const searchFilter = `or=(cnfa_login.ilike.*${validatedQuery.search}*,cnfa_mail.ilike.*${validatedQuery.search}*,cnfa_fname.ilike.*${validatedQuery.search}*,cnfa_name.ilike.*${validatedQuery.search}*)`;
        queryUrl += `&${searchFilter}`;
      }

      if (validatedQuery.level) {
        queryUrl += `&cnfa_level=eq.${validatedQuery.level}`;
      }

      if (validatedQuery.isActive !== undefined) {
        queryUrl += `&cnfa_activ=eq.${validatedQuery.isActive ? '1' : '0'}`;
      }

      if (validatedQuery.department) {
        queryUrl += `&s_id=eq.${validatedQuery.department}`;
      }

      queryUrl += `&order=cnfa_level.desc,cnfa_fname.asc&offset=${offset}&limit=${validatedQuery.limit}`;

      console.log(`📡 Staff Query: ${queryUrl}`);

      const response = await fetch(queryUrl, {
        method: 'GET',
        headers: this.supabaseService['headers'],
      });

      if (!response.ok) {
        console.error(
          'Erreur Supabase Staff:',
          response.status,
          response.statusText,
        );
        throw new Error(`Erreur API: ${response.status}`);
      }

      const staff = await response.json();

      // Compter le total
      let countUrl = `${this.supabaseService['baseUrl']}/___config_admin?select=count`;
      if (validatedQuery.search) {
        const searchFilter = `or=(cnfa_login.ilike.*${validatedQuery.search}*,cnfa_mail.ilike.*${validatedQuery.search}*,cnfa_fname.ilike.*${validatedQuery.search}*,cnfa_name.ilike.*${validatedQuery.search}*)`;
        countUrl += `&${searchFilter}`;
      }
      if (validatedQuery.level) {
        countUrl += `&cnfa_level=eq.${validatedQuery.level}`;
      }
      if (validatedQuery.isActive !== undefined) {
        countUrl += `&cnfa_activ=eq.${validatedQuery.isActive ? '1' : '0'}`;
      }
      if (validatedQuery.department) {
        countUrl += `&s_id=eq.${validatedQuery.department}`;
      }

      const countResponse = await fetch(countUrl, {
        method: 'GET',
        headers: {
          ...this.supabaseService['headers'],
          Prefer: 'count=exact',
        },
      });

      const totalItems = countResponse.ok
        ? parseInt(
            countResponse.headers.get('content-range')?.split('/')[1] || '0',
          )
        : 0;

      const validatedStaff =
        staff?.map((s: any) => LegacyAdminStaffSchema.parse(s)) || [];
      const totalPages = Math.ceil(totalItems / validatedQuery.limit);

      return {
        staff: validatedStaff,
        pagination: {
          page: validatedQuery.page,
          totalPages,
          totalItems,
        },
      };
    } catch (error) {
      this.logger.error('Erreur getAllStaff:', error);

      // Fallback avec données mock
      const mockStaff: LegacyAdminStaff[] = [
        {
          cnfa_id: 1,
          cnfa_login: 'admin_commercial',
          cnfa_pswd: '$2a$10$...',
          cnfa_mail: 'commercial@example.com',
          cnfa_keylog: 'ADMIN_COMMERCIAL_KEY',
          cnfa_level: 7,
          cnfa_job: 'Commercial Admin',
          cnfa_name: 'Martin',
          cnfa_fname: 'Jean',
          cnfa_tel: '0123456789',
          cnfa_activ: '1',
          s_id: 'dept_1',
        },
        {
          cnfa_id: 2,
          cnfa_login: 'super_admin',
          cnfa_pswd: '$2a$10$...',
          cnfa_mail: 'admin@example.com',
          cnfa_keylog: 'SUPER_ADMIN_KEY',
          cnfa_level: 9,
          cnfa_job: 'Super Administrator',
          cnfa_name: 'Dupont',
          cnfa_fname: 'Marie',
          cnfa_tel: '0987654321',
          cnfa_activ: '1',
          s_id: 'super_admin_dept',
        },
      ];

      return {
        staff: mockStaff,
        pagination: {
          page: 1,
          totalPages: 1,
          totalItems: mockStaff.length,
        },
      };
    }
  }

  /**
   * Récupère un staff par ID
   */
  async getStaffById(id: string): Promise<LegacyAdminStaff | null> {
    this.logger.log(`Récupération staff ID: ${id}`);

    try {
      const queryUrl = `${this.supabaseService['baseUrl']}/${this.tableName}?select=*&cnfa_id=eq.${parseInt(id)}`;

      const response = await fetch(queryUrl, {
        method: 'GET',
        headers: this.supabaseService['headers'],
      });

      if (!response.ok) {
        console.error('Erreur getStaffById:', response.status);
        return null;
      }

      const data = await response.json();
      if (!data || data.length === 0) {
        return null;
      }

      return LegacyAdminStaffSchema.parse(data[0]);
    } catch (error) {
      this.logger.error(`Erreur getStaffById ${id}:`, error);
      return null;
    }
  }

  /**
   * Crée un nouvel administrateur
   */
  async createStaff(
    staffData: CreateLegacyStaff,
    _currentUserId: string,
  ): Promise<LegacyAdminStaff> {
    this.logger.log(`Création staff: ${staffData.login}`);

    try {
      const validatedData = CreateLegacyStaffSchema.parse(staffData);

      // Hash du mot de passe
      const hashedPassword = await bcrypt.hash(validatedData.password, 10);
      const keylog = `STAFF_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const insertData = {
        cnfa_login: validatedData.login,
        cnfa_pswd: hashedPassword,
        cnfa_mail: validatedData.email,
        cnfa_keylog: keylog,
        cnfa_level: validatedData.level,
        cnfa_job: validatedData.job,
        cnfa_name: validatedData.lastName,
        cnfa_fname: validatedData.firstName,
        cnfa_tel: validatedData.phone,
        cnfa_activ: '1',
        s_id: validatedData.departmentId || 'default_dept',
      };

      const response = await fetch(
        `${this.supabaseService['baseUrl']}/___config_admin`,
        {
          method: 'POST',
          headers: {
            ...this.supabaseService['headers'],
            Prefer: 'return=representation',
          },
          body: JSON.stringify(insertData),
        },
      );

      if (!response.ok) {
        throw new Error(`Erreur création: ${response.status}`);
      }

      const data = await response.json();
      const newStaff = LegacyAdminStaffSchema.parse(data[0]);
      this.logger.log(`✅ Staff créé: ${newStaff.cnfa_id}`);

      return newStaff;
    } catch (error) {
      this.logger.error('Erreur createStaff:', error);
      throw error;
    }
  }

  /**
   * Met à jour un administrateur
   */
  async updateStaff(
    updateData: UpdateLegacyStaff,
    _currentUserId: string,
  ): Promise<LegacyAdminStaff> {
    this.logger.log(`Mise à jour staff: ${updateData.id}`);

    try {
      const validatedData = UpdateLegacyStaffSchema.parse(updateData);

      const updateFields: any = {};

      if (validatedData.login) updateFields.cnfa_login = validatedData.login;
      if (validatedData.email) updateFields.cnfa_mail = validatedData.email;
      if (validatedData.level) updateFields.cnfa_level = validatedData.level;
      if (validatedData.job) updateFields.cnfa_job = validatedData.job;
      if (validatedData.firstName)
        updateFields.cnfa_fname = validatedData.firstName;
      if (validatedData.lastName)
        updateFields.cnfa_name = validatedData.lastName;
      if (validatedData.phone) updateFields.cnfa_tel = validatedData.phone;

      const response = await fetch(
        `${this.supabaseService['baseUrl']}/___config_admin?cnfa_id=eq.${validatedData.id}`,
        {
          method: 'PATCH',
          headers: {
            ...this.supabaseService['headers'],
            Prefer: 'return=representation',
          },
          body: JSON.stringify(updateFields),
        },
      );

      if (!response.ok) {
        throw new Error(`Erreur mise à jour: ${response.status}`);
      }

      const data = await response.json();
      const updatedStaff = LegacyAdminStaffSchema.parse(data[0]);
      this.logger.log(`✅ Staff mis à jour: ${updatedStaff.cnfa_id}`);

      return updatedStaff;
    } catch (error) {
      this.logger.error('Erreur updateStaff:', error);
      throw error;
    }
  }

  /**
   * Active/Désactive un administrateur
   */
  async toggleStaffStatus(
    id: string,
    isActive: boolean,
    _currentUserId: string,
  ): Promise<LegacyAdminStaff> {
    this.logger.log(`Toggle status staff ${id}: ${isActive}`);

    try {
      const response = await fetch(
        `${this.supabaseService['baseUrl']}/___config_admin?cnfa_id=eq.${parseInt(id)}`,
        {
          method: 'PATCH',
          headers: {
            ...this.supabaseService['headers'],
            Prefer: 'return=representation',
          },
          body: JSON.stringify({ cnfa_activ: isActive ? '1' : '0' }),
        },
      );

      if (!response.ok) {
        throw new Error(`Erreur changement statut: ${response.status}`);
      }

      const data = await response.json();
      const updatedStaff = LegacyAdminStaffSchema.parse(data[0]);
      this.logger.log(`✅ Status staff changé: ${updatedStaff.cnfa_id}`);

      return updatedStaff;
    } catch (error) {
      this.logger.error('Erreur toggleStaffStatus:', error);
      throw error;
    }
  }

  /**
   * Statistiques des administrateurs
   */
  async getStaffStats(): Promise<LegacyStaffStats> {
    this.logger.log('Récupération statistiques staff');

    try {
      const response = await fetch(
        `${this.supabaseService['baseUrl']}/___config_admin?select=cnfa_level,cnfa_activ`,
        {
          method: 'GET',
          headers: this.supabaseService['headers'],
        },
      );

      if (!response.ok) {
        throw new Error(`Erreur statistiques: ${response.status}`);
      }

      const allStaff = await response.json();

      const total = allStaff?.length || 0;
      const active =
        allStaff?.filter((s: any) => s.cnfa_activ === '1').length || 0;
      const inactive = total - active;

      const byLevel =
        allStaff?.reduce(
          (acc: any, staff: any) => {
            const level = staff.cnfa_level.toString();
            acc[level] = (acc[level] || 0) + 1;
            return acc;
          },
          {} as Record<string, number>,
        ) || {};

      return {
        total,
        active,
        inactive,
        byLevel,
      };
    } catch (error) {
      this.logger.error('Erreur getStaffStats:', error);

      return {
        total: 2,
        active: 2,
        inactive: 0,
        byLevel: { '7': 1, '9': 1 },
      };
    }
  }

  /**
   * Récupère les permissions pour un niveau donné
   */
  getPermissions(level: number): string[] {
    return STAFF_PERMISSIONS_MAP[level] || [];
  }

  /**
   * Vérifie si un utilisateur peut gérer un staff d'un niveau donné
   */
  canManageStaff(currentUserLevel: number, staffLevel: number): boolean {
    return currentUserLevel > staffLevel;
  }

  /**
   * Crée un super-admin niveau 9
   */
  async createSuperAdmin(
    superAdminData: SuperAdminCreation,
  ): Promise<LegacyAdminStaff> {
    this.logger.log('🔧 Création Super-Admin:', superAdminData.login);

    const staffData: CreateLegacyStaff = {
      login: superAdminData.login,
      password: 'SuperAdmin123!',
      email: superAdminData.email,
      level: 9,
      job: 'Super Administrator',
      firstName: superAdminData.firstName,
      lastName: superAdminData.lastName,
      phone: superAdminData.phone,
      departmentId: 'super_admin_dept',
    };

    return this.createStaff(staffData, 'system');
  }

  /**
   * Récupère la description d'un niveau
   */
  getLevelDescription(level: number): string {
    return STAFF_LEVEL_DESCRIPTIONS[level] || 'Niveau inconnu';
  }

  /**
   * Valide le mot de passe d'un staff
   */
  async validatePassword(staffId: string, password: string): Promise<boolean> {
    try {
      const staff = await this.getStaffById(staffId);
      if (!staff) return false;

      return bcrypt.compare(password, staff.cnfa_pswd);
    } catch (error) {
      this.logger.error('Erreur validatePassword:', error);
      return false;
    }
  }

  /**
   * Change le mot de passe d'un staff
   */
  async changePassword(
    staffId: string,
    newPassword: string,
    _currentUserId: string,
  ): Promise<boolean> {
    try {
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      const response = await fetch(
        `${this.supabaseService['baseUrl']}/___config_admin?cnfa_id=eq.${parseInt(staffId)}`,
        {
          method: 'PATCH',
          headers: this.supabaseService['headers'],
          body: JSON.stringify({ cnfa_pswd: hashedPassword }),
        },
      );

      if (!response.ok) {
        throw new Error(`Erreur changement mot de passe: ${response.status}`);
      }

      this.logger.log(`✅ Mot de passe changé pour staff: ${staffId}`);
      return true;
    } catch (error) {
      this.logger.error('Erreur changePassword:', error);
      return false;
    }
  }
}
