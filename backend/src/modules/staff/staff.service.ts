/**
 * 👥 STAFF SERVICE - Service de gestion du personnel administratif
 *
 * ✅ ARCHITECTURE RECOMMANDÉE : Utilise StaffDataService pour l'accès aux données
 * ✅ Suit les patterns établis dans le projet (séparation logique/données)
 * ✅ Service métier pur (pas d'héritage de SupabaseBaseService)
 */

import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { StaffDataService } from './services/staff-data.service';
import type { Staff } from './dto/staff.dto';

// Interfaces controller-facing (contrat API REST)
export type { Staff };

export interface CreateStaffDto {
  email: string;
  firstName: string;
  lastName: string;
  department: string;
  role: string;
  password?: string;
  isActive?: boolean;
}

export interface UpdateStaffDto {
  firstName?: string;
  lastName?: string;
  department?: string;
  role?: string;
  isActive?: boolean;
}

@Injectable()
export class StaffService {
  private readonly logger = new Logger(StaffService.name);

  constructor(private readonly staffDataService: StaffDataService) {
    this.logger.log('StaffService initialized');
  }

  /**
   * Récupérer tous les membres du staff avec pagination et filtres
   */
  async findAll(
    page: number = 1,
    limit: number = 10,
    filters?: {
      department?: string;
      isActive?: boolean;
      search?: string;
    },
  ) {
    try {
      this.logger.log(`Récupération staff: page=${page}, limit=${limit}`);

      const result = await this.staffDataService.findAll({
        page,
        limit,
        search: filters?.search,
        job: filters?.department,
        isActive: filters?.isActive,
      });

      this.logger.log(
        `${result.data.length}/${result.total} membres du staff récupérés`,
      );

      return {
        success: true,
        data: {
          staff: result.data,
          total: result.total,
          page,
          limit,
        },
      };
    } catch (error) {
      this.logger.error('Erreur findAll staff:', error);
      throw new BadRequestException('Erreur lors de la récupération du staff');
    }
  }

  /**
   * Récupérer un membre du staff par ID
   */
  async findById(id: string): Promise<Staff> {
    try {
      this.logger.log(`Récupération staff ID: ${id}`);

      const staff = await this.staffDataService.findById(id);

      this.logger.log(`Staff trouvé: ${staff.email}`);
      return staff;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error('Erreur findById staff:', error);
      throw new BadRequestException(
        'Erreur lors de la récupération du membre du staff',
      );
    }
  }

  /**
   * Créer un nouveau membre du staff
   */
  async create(staffData: CreateStaffDto): Promise<Staff> {
    try {
      this.logger.log(`Création staff: ${staffData.email}`);

      // Validation métier
      this.validateStaffData(staffData);

      // Vérifier si l'email existe déjà
      const exists = await this.staffDataService.existsByEmail(staffData.email);
      if (exists) {
        throw new BadRequestException(
          'Un membre du staff avec cet email existe déjà',
        );
      }

      const newStaff = await this.staffDataService.create({
        email: staffData.email,
        password: staffData.password || 'Temp1234!',
        firstName: staffData.firstName,
        lastName: staffData.lastName,
        level: 7,
        job: staffData.department || staffData.role,
      });

      this.logger.log(`Staff créé: ${newStaff.id}`);
      return newStaff;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error('Erreur create staff:', error);
      throw new BadRequestException(
        'Erreur lors de la création du membre du staff',
      );
    }
  }

  /**
   * Mettre à jour un membre du staff
   */
  async update(id: string, updates: UpdateStaffDto): Promise<Staff> {
    try {
      this.logger.log(`Mise à jour staff: ${id}`);

      // Vérifier que le staff existe
      await this.findById(id);

      const updatedStaff = await this.staffDataService.update(id, {
        firstName: updates.firstName,
        lastName: updates.lastName,
        job: updates.department || updates.role,
        isActive: updates.isActive,
      });

      this.logger.log(`Staff mis à jour: ${id}`);
      return updatedStaff;
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      this.logger.error('Erreur update staff:', error);
      throw new BadRequestException(
        'Erreur lors de la mise à jour du membre du staff',
      );
    }
  }

  /**
   * Supprimer un membre du staff
   */
  async delete(id: string): Promise<void> {
    try {
      this.logger.log(`Suppression staff: ${id}`);

      // Vérifier que le staff existe
      await this.findById(id);

      await this.staffDataService.delete(id);

      this.logger.log(`Staff supprimé: ${id}`);
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      this.logger.error('Erreur delete staff:', error);
      throw new BadRequestException(
        'Erreur lors de la suppression du membre du staff',
      );
    }
  }

  /**
   * Obtenir les statistiques du staff
   */
  async getStats() {
    try {
      this.logger.log('Récupération statistiques staff');

      const stats = await this.staffDataService.getStats();

      return {
        success: true,
        data: stats,
      };
    } catch (error) {
      this.logger.error('Erreur getStats staff:', error);
      throw new BadRequestException(
        'Erreur lors de la récupération des statistiques',
      );
    }
  }

  /**
   * Validation des données staff (logique métier)
   */
  private validateStaffData(staffData: CreateStaffDto): void {
    if (!staffData.email || !staffData.email.includes('@')) {
      throw new BadRequestException('Email invalide');
    }

    if (!staffData.firstName || staffData.firstName.trim().length < 2) {
      throw new BadRequestException(
        'Le prénom doit contenir au moins 2 caractères',
      );
    }

    if (!staffData.lastName || staffData.lastName.trim().length < 2) {
      throw new BadRequestException(
        'Le nom doit contenir au moins 2 caractères',
      );
    }

    if (!staffData.department || staffData.department.trim().length === 0) {
      throw new BadRequestException('Le département est obligatoire');
    }

    if (!staffData.role || staffData.role.trim().length === 0) {
      throw new BadRequestException('Le rôle est obligatoire');
    }
  }
}
