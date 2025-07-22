import { Injectable } from '@nestjs/common';
import { CacheService } from '../cache/cache.service';
import * as bcrypt from 'bcryptjs';

// Interface pour la table ___config_admin basée sur l'analyse PHP
export interface AdminStaff {
  cnfa_id: number;
  cnfa_login: string;
  cnfa_pswd: string;
  cnfa_mail: string;
  cnfa_keylog: string;
  cnfa_level: number;
  cnfa_job: string;
  cnfa_name: string;
  cnfa_fname: string;
  cnfa_tel: string;
  cnfa_activ: '0' | '1';
  s_id: string;
}

export interface CreateStaffDto {
  login: string;
  password: string;
  email: string;
  level: number;
  job: string;
  firstName: string;
  lastName: string;
  phone: string;
}

export interface UpdateStaffDto {
  login?: string;
  email?: string;
  level?: number;
  job?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
}

@Injectable()
export class StaffAdminService {
  constructor(private readonly cacheService: CacheService) {}

  /**
   * Récupère tous les staff selon le niveau d'autorisation
   */
  async findAllStaff(currentUserLevel: number): Promise<AdminStaff[]> {
    console.log(
      '🔍 StaffAdminService.findAllStaff pour niveau:',
      currentUserLevel,
    );

    try {
      // Simuler des données d'admin basées sur l'analyse PHP
      const mockStaff: AdminStaff[] = [
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
      ];

      // Filtrer selon le niveau d'autorisation
      const accessibleStaff = mockStaff.filter(
        (staff) => staff.cnfa_level < currentUserLevel,
      );

      return accessibleStaff;
    } catch (error) {
      console.error('❌ Erreur findAllStaff:', error);
      throw error;
    }
  }

  /**
   * Récupère un staff par ID
   */
  async findStaffById(
    id: number,
    currentUserLevel: number,
  ): Promise<AdminStaff | null> {
    console.log(
      '🔍 StaffAdminService.findStaffById:',
      id,
      'niveau:',
      currentUserLevel,
    );

    try {
      // Simuler la récupération d'un admin spécifique
      const mockStaff: AdminStaff = {
        cnfa_id: id,
        cnfa_login: `admin_${id}`,
        cnfa_pswd: '$2a$10$...',
        cnfa_mail: `admin${id}@example.com`,
        cnfa_keylog: `ADMIN_${id}_KEY`,
        cnfa_level: 7,
        cnfa_job: 'Commercial Admin',
        cnfa_name: 'Martin',
        cnfa_fname: 'Jean',
        cnfa_tel: '0123456789',
        cnfa_activ: '1',
        s_id: 'dept_1',
      };

      // Vérifier l'autorisation
      if (mockStaff.cnfa_level >= currentUserLevel) {
        return null;
      }

      return mockStaff;
    } catch (error) {
      console.error('❌ Erreur findStaffById:', error);
      throw error;
    }
  }

  /**
   * Crée un nouvel administrateur
   */
  async createStaff(staffData: CreateStaffDto): Promise<AdminStaff> {
    console.log('🔧 StaffAdminService.createStaff:', staffData);

    try {
      const hashedPassword = await bcrypt.hash(
        staffData.password || 'TempPassword123!',
        10,
      );
      const keylog = `STAFF_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Simuler la création d'un admin
      const newStaff: AdminStaff = {
        cnfa_id: Date.now(),
        cnfa_login: staffData.login,
        cnfa_pswd: hashedPassword,
        cnfa_mail: staffData.email,
        cnfa_keylog: keylog,
        cnfa_level: staffData.level,
        cnfa_job: staffData.job,
        cnfa_name: staffData.lastName,
        cnfa_fname: staffData.firstName,
        cnfa_tel: staffData.phone,
        cnfa_activ: '1',
        s_id: 'dept_1',
      };

      console.log('✅ Admin créé:', newStaff);
      return newStaff;
    } catch (error) {
      console.error('❌ Erreur createStaff:', error);
      throw error;
    }
  }

  /**
   * Met à jour un administrateur
   */
  async updateStaff(
    id: number,
    staffData: UpdateStaffDto,
    currentUserLevel: number,
  ): Promise<AdminStaff> {
    console.log('🔧 StaffAdminService.updateStaff:', id, staffData);

    try {
      // Vérifier que l'admin existe et est accessible
      const existingStaff = await this.findStaffById(id, currentUserLevel);
      if (!existingStaff) {
        throw new Error('Admin non trouvé');
      }

      // Simuler la mise à jour
      const updatedStaff: AdminStaff = {
        ...existingStaff,
        cnfa_login: staffData.login || existingStaff.cnfa_login,
        cnfa_mail: staffData.email || existingStaff.cnfa_mail,
        cnfa_level: staffData.level || existingStaff.cnfa_level,
        cnfa_job: staffData.job || existingStaff.cnfa_job,
        cnfa_name: staffData.lastName || existingStaff.cnfa_name,
        cnfa_fname: staffData.firstName || existingStaff.cnfa_fname,
        cnfa_tel: staffData.phone || existingStaff.cnfa_tel,
      };

      console.log('✅ Admin mis à jour:', updatedStaff);
      return updatedStaff;
    } catch (error) {
      console.error('❌ Erreur updateStaff:', error);
      throw error;
    }
  }

  /**
   * Active un administrateur
   */
  async enableStaff(id: number, currentUserLevel: number): Promise<boolean> {
    console.log('🔧 StaffAdminService.enableStaff:', id);

    try {
      const staff = await this.findStaffById(id, currentUserLevel);
      if (!staff) {
        throw new Error('Admin non trouvé');
      }

      // Simuler l'activation
      console.log('✅ Admin activé:', id);
      return true;
    } catch (error) {
      console.error('❌ Erreur enableStaff:', error);
      throw error;
    }
  }

  /**
   * Désactive un administrateur
   */
  async disableStaff(id: number, currentUserLevel: number): Promise<boolean> {
    console.log('🔧 StaffAdminService.disableStaff:', id);

    try {
      const staff = await this.findStaffById(id, currentUserLevel);
      if (!staff) {
        throw new Error('Admin non trouvé');
      }

      // Simuler la désactivation
      console.log('✅ Admin désactivé:', id);
      return true;
    } catch (error) {
      console.error('❌ Erreur disableStaff:', error);
      throw error;
    }
  }

  /**
   * Statistiques des administrateurs
   */
  async getStaffStats(currentUserLevel: number): Promise<{
    total: number;
    active: number;
    inactive: number;
    byLevel: Record<number, number>;
  }> {
    console.log('📊 StaffAdminService.getStaffStats niveau:', currentUserLevel);

    try {
      const allStaff = await this.findAllStaff(currentUserLevel);

      const stats = {
        total: allStaff.length,
        active: allStaff.filter((s) => s.cnfa_activ === '1').length,
        inactive: allStaff.filter((s) => s.cnfa_activ === '0').length,
        byLevel: allStaff.reduce(
          (acc, staff) => {
            acc[staff.cnfa_level] = (acc[staff.cnfa_level] || 0) + 1;
            return acc;
          },
          {} as Record<number, number>,
        ),
      };

      console.log('📊 Statistiques:', stats);
      return stats;
    } catch (error) {
      console.error('❌ Erreur getStaffStats:', error);
      throw error;
    }
  }

  /**
   * Récupère les permissions pour un niveau donné
   */
  async getPermissions(level: number): Promise<string[]> {
    console.log('🔐 StaffAdminService.getPermissions niveau:', level);

    // Basé sur l'analyse PHP
    const permissions: Record<number, string[]> = {
      7: ['view_orders', 'manage_customers', 'view_stats'],
      8: [
        'view_orders',
        'manage_customers',
        'view_stats',
        'manage_staff_level_7',
        'advanced_settings',
      ],
      9: [
        'view_orders',
        'manage_customers',
        'view_stats',
        'manage_staff_level_7',
        'manage_staff_level_8',
        'advanced_settings',
        'super_admin_tools',
        'payment_management',
      ],
    };

    return permissions[level] || [];
  }

  /**
   * Vérifie si un utilisateur peut gérer un staff d'un niveau donné
   */
  canManageStaff(currentUserLevel: number, staffLevel: number): boolean {
    return currentUserLevel > staffLevel;
  }

  /**
   * Récupère les permissions pour un niveau donné (alias pour getPermissions)
   */
  getStaffPermissions(level: number): string[] {
    const permissions: Record<number, string[]> = {
      7: ['view_orders', 'manage_customers', 'view_stats'],
      8: [
        'view_orders',
        'manage_customers',
        'view_stats',
        'manage_staff_level_7',
        'advanced_settings',
      ],
      9: [
        'view_orders',
        'manage_customers',
        'view_stats',
        'manage_staff_level_7',
        'manage_staff_level_8',
        'advanced_settings',
        'super_admin_tools',
        'payment_management',
      ],
    };

    return permissions[level] || [];
  }

  /**
   * Crée un super-admin niveau 9
   */
  async createSuperAdmin(superAdminData: {
    login: string;
    email: string;
    firstName: string;
    lastName: string;
    phone: string;
  }): Promise<AdminStaff> {
    console.log('🔧 StaffAdminService.createSuperAdmin:', superAdminData);

    try {
      const hashedPassword = await bcrypt.hash('SuperAdmin123!', 10);
      const keylog = `SUPER_ADMIN_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const superAdmin: AdminStaff = {
        cnfa_id: Date.now(),
        cnfa_login: superAdminData.login,
        cnfa_pswd: hashedPassword,
        cnfa_mail: superAdminData.email,
        cnfa_keylog: keylog,
        cnfa_level: 9,
        cnfa_job: 'Super Administrator',
        cnfa_name: superAdminData.lastName,
        cnfa_fname: superAdminData.firstName,
        cnfa_tel: superAdminData.phone,
        cnfa_activ: '1',
        s_id: 'super_admin_dept',
      };

      console.log('✅ Super-Admin créé:', superAdmin);
      return superAdmin;
    } catch (error) {
      console.error('❌ Erreur createSuperAdmin:', error);
      throw error;
    }
  }
}
