import { Injectable } from '@nestjs/common';
import { SupabaseBaseService } from './supabase-base.service';

/**
 * StaffDataService - Service de données pour le personnel administratif
 * ✅ Utilise la table existante ___config_admin (architecture legacy)
 * ✅ Hérite de SupabaseBaseService (architecture recommandée)
 * ✅ Mapping des colonnes legacy vers interface moderne
 */
@Injectable()
export class StaffDataService extends SupabaseBaseService {
  private readonly tableName = '___config_admin';

  constructor() {
    super();
  }

  /**
   * Récupérer tous les membres du staff avec pagination
   */
  async findAll(page: number = 1, limit: number = 10, filters?: {
    department?: string;
    isActive?: boolean;
    search?: string;
  }) {
    try {
      const offset = (page - 1) * limit;
      let query = `${this.baseUrl}/${this.tableName}?select=*`;

      // Appliquer les filtres
      if (filters?.department) {
        query += `&cnfa_job=eq.${filters.department}`;
      }
      if (filters?.isActive !== undefined) {
        const activeValue = filters.isActive ? '1' : '0';
        query += `&cnfa_activ=eq.${activeValue}`;
      }
      if (filters?.search) {
        query += `&or=(cnfa_fname.ilike.*${filters.search}*,cnfa_name.ilike.*${filters.search}*,cnfa_mail.ilike.*${filters.search}*)`;
      }

      query += `&order=cnfa_name.asc,cnfa_fname.asc&offset=${offset}&limit=${limit}`;

      const response = await fetch(query, {
        method: 'GET',
        headers: this.headers,
      });

      if (!response.ok) {
        this.logger.error('Erreur récupération staff:', response.status);
        return { staff: [], total: 0 };
      }

      const rawStaff = await response.json();

      // Mapper les données legacy vers format moderne
      const staff = rawStaff.map((item: any) => this.mapLegacyToModern(item));

      // Compter le total
      const countQuery = `${this.baseUrl}/${this.tableName}?select=count`;
      const countResponse = await fetch(countQuery, {
        method: 'GET',
        headers: this.headers,
      });

      let total = 0;
      if (countResponse.ok) {
        const countData = await countResponse.json();
        total = countData[0]?.count || 0;
      }

      return { staff, total };
    } catch (error) {
      this.logger.error('Erreur findAll staff:', error);
      return { staff: [], total: 0 };
    }
  }

  /**
   * Récupérer un membre du staff par ID
   */
  async findById(id: string) {
    try {
      const response = await fetch(
        `${this.baseUrl}/${this.tableName}?cnfa_id=eq.${id}&select=*`,
        {
          method: 'GET',
          headers: this.headers,
        },
      );

      if (!response.ok) {
        return null;
      }

      const staff = await response.json();
      if (staff.length === 0) return null;

      return this.mapLegacyToModern(staff[0]);
    } catch (error) {
      this.logger.error('Erreur findById staff:', error);
      return null;
    }
  }

  /**
   * Créer un nouveau membre du staff
   */
  async create(staffData: {
    email: string;
    firstName: string;
    lastName: string;
    department: string;
    role: string;
    isActive?: boolean;
  }) {
    try {
      const legacyData = this.mapModernToLegacy(staffData);

      const response = await fetch(`${this.baseUrl}/${this.tableName}`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(legacyData),
      });

      if (!response.ok) {
        this.logger.error('Erreur création staff:', response.status);
        return null;
      }

      const newStaff = await response.json();
      return this.mapLegacyToModern(newStaff[0]);
    } catch (error) {
      this.logger.error('Erreur create staff:', error);
      return null;
    }
  }

  /**
   * Mettre à jour un membre du staff
   */
  async update(id: string, updates: Partial<{
    firstName: string;
    lastName: string;
    department: string;
    role: string;
    isActive: boolean;
  }>) {
    try {
      const legacyUpdates = this.mapModernToLegacy(updates);

      const response = await fetch(
        `${this.baseUrl}/${this.tableName}?cnfa_id=eq.${id}`,
        {
          method: 'PATCH',
          headers: this.headers,
          body: JSON.stringify(legacyUpdates),
        },
      );

      if (!response.ok) {
        this.logger.error('Erreur update staff:', response.status);
        return null;
      }

      const updatedStaff = await response.json();
      return this.mapLegacyToModern(updatedStaff[0]);
    } catch (error) {
      this.logger.error('Erreur update staff:', error);
      return null;
    }
  }

  /**
   * Supprimer un membre du staff (désactivation)
   */
  async delete(id: string): Promise<boolean> {
    try {
      // Au lieu de supprimer, on désactive
      const response = await fetch(
        `${this.baseUrl}/${this.tableName}?cnfa_id=eq.${id}`,
        {
          method: 'PATCH',
          headers: this.headers,
          body: JSON.stringify({ cnfa_activ: '0' }),
        },
      );

      return response.ok;
    } catch (error) {
      this.logger.error('Erreur delete staff:', error);
      return false;
    }
  }

  /**
   * Statistiques du staff
   */
  async getStats() {
    try {
      // Total staff
      const totalResponse = await fetch(
        `${this.baseUrl}/${this.tableName}?select=count`,
        {
          method: 'GET',
          headers: this.headers,
        },
      );

      // Staff actif
      const activeResponse = await fetch(
        `${this.baseUrl}/${this.tableName}?cnfa_activ=eq.1&select=count`,
        {
          method: 'GET',
          headers: this.headers,
        },
      );

      // Départements (jobs)
      const deptResponse = await fetch(
        `${this.baseUrl}/${this.tableName}?select=cnfa_job&distinct=cnfa_job`,
        {
          method: 'GET',
          headers: this.headers,
        },
      );

      const totalData = totalResponse.ok ? await totalResponse.json() : [{ count: 0 }];
      const activeData = activeResponse.ok ? await activeResponse.json() : [{ count: 0 }];
      const deptData = deptResponse.ok ? await deptResponse.json() : [];

      return {
        total: totalData[0]?.count || 0,
        active: activeData[0]?.count || 0,
        inactive: (totalData[0]?.count || 0) - (activeData[0]?.count || 0),
        departments: deptData.map((d: any) => d.cnfa_job).filter(Boolean),
      };
    } catch (error) {
      this.logger.error('Erreur getStats staff:', error);
      return { total: 0, active: 0, inactive: 0, departments: [] };
    }
  }

  /**
   * Vérifier si un email existe déjà
   */
  async existsByEmail(email: string): Promise<boolean> {
    try {
      const response = await fetch(
        `${this.baseUrl}/${this.tableName}?cnfa_mail=eq.${email}&select=cnfa_id`,
        {
          method: 'GET',
          headers: this.headers,
        },
      );

      if (!response.ok) {
        return false;
      }

      const result = await response.json();
      return result.length > 0;
    } catch (error) {
      this.logger.error('Erreur existsByEmail staff:', error);
      return false;
    }
  }

  /**
   * Mapper les données legacy vers le format moderne
   */
  private mapLegacyToModern(legacyData: any) {
    return {
      id: legacyData.cnfa_id,
      email: legacyData.cnfa_mail,
      firstName: legacyData.cnfa_fname,
      lastName: legacyData.cnfa_name,
      department: legacyData.cnfa_job,
      role: legacyData.cnfa_job, // Dans legacy, job = role
      isActive: legacyData.cnfa_activ === '1',
      level: legacyData.cnfa_level,
      phone: legacyData.cnfa_tel,
      login: legacyData.cnfa_login,
      createdAt: new Date().toISOString(), // Pas de created_at dans legacy
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Mapper les données modernes vers le format legacy
   */
  private mapModernToLegacy(modernData: any) {
    const mapped: any = {};

    if (modernData.email) mapped.cnfa_mail = modernData.email;
    if (modernData.firstName) mapped.cnfa_fname = modernData.firstName;
    if (modernData.lastName) mapped.cnfa_name = modernData.lastName;
    if (modernData.department) mapped.cnfa_job = modernData.department;
    if (modernData.role) mapped.cnfa_job = modernData.role; // role = job
    if (modernData.isActive !== undefined) {
      mapped.cnfa_activ = modernData.isActive ? '1' : '0';
    }
    if (modernData.phone) mapped.cnfa_tel = modernData.phone;

    // Générer login si création
    if (modernData.firstName && modernData.lastName && !modernData.id) {
      mapped.cnfa_login = `${modernData.firstName.toLowerCase()}.${modernData.lastName.toLowerCase()}`;
    }

    // Niveau par défaut
    if (!modernData.id) {
      mapped.cnfa_level = '7'; // Niveau staff par défaut
    }

    return mapped;
  }
}
