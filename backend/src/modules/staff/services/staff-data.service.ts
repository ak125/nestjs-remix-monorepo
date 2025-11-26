import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { TABLES } from '@repo/database-types';
import { ConfigService } from '@nestjs/config';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import type {
  Staff,
  CreateStaffDto,
  UpdateStaffDto,
  StaffFilters,
  PaginatedStaff,
} from '../dto/staff.dto';
import * as bcrypt from 'bcrypt';

/**
 * 🎯 Service d'accès aux données STAFF (table ___config_admin)
 *
 * RESPONSABILITÉ: Accès direct à la base de données pour le personnel admin
 * NE PAS utiliser pour les clients !
 */
@Injectable()
export class StaffDataService extends SupabaseBaseService {
  protected readonly logger = new Logger(StaffDataService.name);

  constructor(configService?: ConfigService) {
    super(configService);
    this.logger.log('StaffDataService initialized');
  }

  /**
   * Récupère tous les membres du staff avec pagination et filtres
   */
  async findAll(filters: StaffFilters): Promise<PaginatedStaff> {
    try {
      const { page, limit, search, level, isActive, job } = filters;
      const offset = (page - 1) * limit;

      let query = this.supabase
        .from(TABLES.config_admin)
        .select('*', { count: 'exact' });

      // Filtres
      if (search) {
        query = query.or(
          `cnfa_mail.ilike.%${search}%,cnfa_name.ilike.%${search}%,cnfa_fname.ilike.%${search}%`,
        );
      }
      if (level !== undefined) {
        query = query.eq('cnfa_level', level);
      }
      if (isActive !== undefined) {
        query = query.eq('cnfa_activ', isActive ? '1' : '0');
      }
      if (job) {
        query = query.ilike('cnfa_job', `%${job}%`);
      }

      // Pagination
      query = query
        .order('cnfa_id', { ascending: false })
        .range(offset, offset + limit - 1);

      const { data, error, count } = await query;

      if (error) {
        this.logger.error('Failed to fetch staff:', error);
        throw error;
      }

      const staff = (data || []).map(this.mapToStaff);
      const total = count || 0;
      const totalPages = Math.ceil(total / limit);

      return {
        data: staff,
        total,
        page,
        limit,
        totalPages,
      };
    } catch (error) {
      this.logger.error('Failed to find all staff:', error);
      throw error;
    }
  }

  /**
   * Récupère un membre du staff par son ID
   */
  async findById(id: string): Promise<Staff> {
    try {
      const { data, error } = await this.supabase
        .from(TABLES.config_admin)
        .select('*')
        .eq('cnfa_id', id)
        .single();

      if (error || !data) {
        throw new NotFoundException(`Staff ${id} non trouvé`);
      }

      return this.mapToStaff(data);
    } catch (error) {
      this.logger.error(`Failed to find staff ${id}:`, error);
      throw error;
    }
  }

  /**
   * Récupère un membre du staff par son email
   */
  async findByEmail(email: string): Promise<Staff | null> {
    try {
      const { data, error } = await this.supabase
        .from(TABLES.config_admin)
        .select('*')
        .eq('cnfa_mail', email)
        .single();

      if (error || !data) {
        return null;
      }

      return this.mapToStaff(data);
    } catch (error) {
      this.logger.error(`Failed to find staff by email ${email}:`, error);
      return null;
    }
  }

  /**
   * Crée un nouveau membre du staff
   */
  async create(dto: CreateStaffDto): Promise<Staff> {
    try {
      // Hasher le mot de passe
      const hashedPassword = await bcrypt.hash(dto.password, 10);

      const { data, error } = await this.supabase
        .from(TABLES.config_admin)
        .insert({
          cnfa_mail: dto.email,
          cnfa_pswd: hashedPassword,
          cnfa_fname: dto.firstName,
          cnfa_name: dto.lastName,
          cnfa_level: dto.level,
          cnfa_job: dto.job,
          cnfa_activ: '1', // Actif par défaut
        })
        .select()
        .single();

      if (error) {
        this.logger.error('Failed to create staff:', error);
        throw error;
      }

      return this.mapToStaff(data);
    } catch (error) {
      this.logger.error('Failed to create staff:', error);
      throw error;
    }
  }

  /**
   * Met à jour un membre du staff
   */
  async update(id: string, dto: UpdateStaffDto): Promise<Staff> {
    try {
      const updateData: any = {};

      if (dto.email) updateData.cnfa_mail = dto.email;
      if (dto.firstName) updateData.cnfa_fname = dto.firstName;
      if (dto.lastName) updateData.cnfa_name = dto.lastName;
      if (dto.level !== undefined) updateData.cnfa_level = dto.level;
      if (dto.job) updateData.cnfa_job = dto.job;
      if (dto.isActive !== undefined)
        updateData.cnfa_activ = dto.isActive ? '1' : '0';

      const { data, error } = await this.supabase
        .from(TABLES.config_admin)
        .update(updateData)
        .eq('cnfa_id', id)
        .select()
        .single();

      if (error || !data) {
        throw new NotFoundException(`Staff ${id} non trouvé`);
      }

      return this.mapToStaff(data);
    } catch (error) {
      this.logger.error(`Failed to update staff ${id}:`, error);
      throw error;
    }
  }

  /**
   * Supprime un membre du staff (soft delete)
   */
  async delete(id: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from(TABLES.config_admin)
        .update({ cnfa_activ: '0' })
        .eq('cnfa_id', id);

      if (error) {
        throw new NotFoundException(`Staff ${id} non trouvé`);
      }
    } catch (error) {
      this.logger.error(`Failed to delete staff ${id}:`, error);
      throw error;
    }
  }

  /**
   * Vérifie si un email existe déjà
   */
  async emailExists(email: string): Promise<boolean> {
    const staff = await this.findByEmail(email);
    return staff !== null;
  }

  /**
   * Mappe les données DB vers le DTO Staff
   */
  private mapToStaff(data: any): Staff {
    return {
      id: String(data.cnfa_id),
      email: data.cnfa_mail,
      firstName: data.cnfa_fname || undefined,
      lastName: data.cnfa_name || undefined,
      level: parseInt(String(data.cnfa_level || '7')),
      job: data.cnfa_job || undefined,
      isActive: data.cnfa_activ === '1',
      createdAt: data.created_at ? new Date(data.created_at) : undefined,
      updatedAt: data.updated_at ? new Date(data.updated_at) : undefined,
    };
  }
}
