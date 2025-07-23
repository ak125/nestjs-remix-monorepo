/**
 * 📋 SERVICE STAFF ADMIN - SUPPRIMÉ
 * 
 * Ce service a été migré vers le module admin moderne
 * Utiliser AdminStaffService dans modules/admin/services/admin-staff.service.ts
 */

// Ce fichier est désormais vide - utiliser le nouveau module admin

import { Injectable, Logger } from '@nestjs/common';
import { AdminStaffService } from '../modules/admin/services/admin-staff.service';
import {
  LegacyAdminStaff,
  CreateLegacyStaff,
  UpdateLegacyStaff,
  LegacyStaffQuery,
  convertLegacyToModern,
} from '../modules/admin/schemas/legacy-staff.schemas';

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

/**
 * @deprecated Utiliser AdminStaffService du module admin à la place
 * Ce service est conservé pour la compatibilité mais redirige vers le nouveau service
 */
@Injectable()
export class StaffAdminService {
  private readonly logger = new Logger(StaffAdminService.name);

  constructor(
    private readonly adminStaffService: AdminStaffService,
  ) {
    this.logger.warn('⚠️ StaffAdminService deprecated - Utiliser AdminStaffService du module admin');
  }

  /**
   * @deprecated Utiliser adminStaffService.getAllStaff()
   */
  async findAllStaff(currentUserLevel: number): Promise<AdminStaff[]> {
    this.logger.warn('🔄 Redirection vers AdminStaffService.getAllStaff');
    
    const query: LegacyStaffQuery = {
      page: 1,
      limit: 100,
    };

    const result = await this.adminStaffService.getAllStaff(query, 'legacy-compat');
    return result.staff;
  }

  /**
   * @deprecated Utiliser adminStaffService.getStaffById()
   */
  async findStaffById(id: number, currentUserLevel: number): Promise<AdminStaff | null> {
    this.logger.warn(`🔄 Redirection vers AdminStaffService.getStaffById(${id})`);
    return this.adminStaffService.getStaffById(id.toString());
  }

  /**
   * @deprecated Utiliser adminStaffService.createStaff()
   */
  async createStaff(staffData: CreateStaffDto): Promise<AdminStaff> {
    this.logger.warn('� Redirection vers AdminStaffService.createStaff');
    
    const createData: CreateLegacyStaff = {
      login: staffData.login,
      password: staffData.password,
      email: staffData.email,
      level: staffData.level,
      job: staffData.job,
      firstName: staffData.firstName,
      lastName: staffData.lastName,
      phone: staffData.phone,
    };

    return this.adminStaffService.createStaff(createData, 'legacy-compat');
  }

  /**
   * @deprecated Utiliser adminStaffService.updateStaff()
   */
  async updateStaff(
    id: number,
    staffData: UpdateStaffDto,
    currentUserLevel: number,
  ): Promise<AdminStaff> {
    this.logger.warn(`🔄 Redirection vers AdminStaffService.updateStaff(${id})`);
    
    const updateData: UpdateLegacyStaff = {
      id,
      login: staffData.login,
      email: staffData.email,
      level: staffData.level,
      job: staffData.job,
      firstName: staffData.firstName,
      lastName: staffData.lastName,
      phone: staffData.phone,
    };

    return this.adminStaffService.updateStaff(updateData, 'legacy-compat');
  }

  /**
   * @deprecated Utiliser adminStaffService.toggleStaffStatus()
   */
  async enableStaff(id: number, currentUserLevel: number): Promise<boolean> {
    this.logger.warn(`� Redirection vers AdminStaffService.toggleStaffStatus(${id}, true)`);
    
    try {
      await this.adminStaffService.toggleStaffStatus(id.toString(), true, 'legacy-compat');
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * @deprecated Utiliser adminStaffService.toggleStaffStatus()
   */
  async disableStaff(id: number, currentUserLevel: number): Promise<boolean> {
    this.logger.warn(`� Redirection vers AdminStaffService.toggleStaffStatus(${id}, false)`);
    
    try {
      await this.adminStaffService.toggleStaffStatus(id.toString(), false, 'legacy-compat');
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * @deprecated Utiliser adminStaffService.getStaffStats()
   */
  async getStaffStats(currentUserLevel: number): Promise<{
    total: number;
    active: number;
    inactive: number;
    byLevel: Record<number, number>;
  }> {
    this.logger.warn('� Redirection vers AdminStaffService.getStaffStats');
    
    const stats = await this.adminStaffService.getStaffStats();
    
    // Convertir le format
    const byLevel: Record<number, number> = {};
    Object.entries(stats.byLevel).forEach(([level, count]) => {
      byLevel[parseInt(level)] = count;
    });

    return {
      total: stats.total,
      active: stats.active,
      inactive: stats.inactive,
      byLevel,
    };
  }

  /**
   * @deprecated Utiliser adminStaffService.getPermissions()
   */
  async getPermissions(level: number): Promise<string[]> {
    this.logger.warn(`� Redirection vers AdminStaffService.getPermissions(${level})`);
    return this.adminStaffService.getPermissions(level);
  }

  /**
   * @deprecated Utiliser adminStaffService.canManageStaff()
   */
  canManageStaff(currentUserLevel: number, staffLevel: number): boolean {
    return this.adminStaffService.canManageStaff(currentUserLevel, staffLevel);
  }

  /**
   * @deprecated Utiliser adminStaffService.getPermissions()
   */
  getStaffPermissions(level: number): string[] {
    this.logger.warn(`🔄 Redirection vers AdminStaffService.getPermissions(${level})`);
    return this.adminStaffService.getPermissions(level);
  }

  /**
   * @deprecated Utiliser adminStaffService.createSuperAdmin()
   */
  async createSuperAdmin(superAdminData: {
    login: string;
    email: string;
    firstName: string;
    lastName: string;
    phone: string;
  }): Promise<AdminStaff> {
    this.logger.warn('🔄 Redirection vers AdminStaffService.createSuperAdmin');
    return this.adminStaffService.createSuperAdmin(superAdminData);
  }
}
