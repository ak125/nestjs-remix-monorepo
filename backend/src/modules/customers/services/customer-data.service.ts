import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import type { Customer, CreateCustomerDto, UpdateCustomerDto, CustomerFilters, PaginatedCustomers } from '../dto/customer.dto';
import * as bcrypt from 'bcrypt';

/**
 * 🎯 Service d'accès aux données CLIENTS (table ___xtr_customer)
 *
 * RESPONSABILITÉ: Accès direct à la base de données pour les clients
 * NE PAS utiliser pour le staff admin !
 */
@Injectable()
export class CustomerDataService extends SupabaseBaseService {
  private readonly logger = new Logger(CustomerDataService.name);

  constructor(configService?: ConfigService) {
    super(configService);
    this.logger.log('CustomerDataService initialized');
  }

  /**
   * Récupère tous les clients avec pagination et filtres
   */
  async findAll(filters: CustomerFilters): Promise<PaginatedCustomers> {
    try {
      const { page, limit, search, level, isPro, isActive, city, country } = filters;
      const offset = (page - 1) * limit;

      let query = this.supabase
        .from('___xtr_customer')
        .select('*', { count: 'exact' });

      // Filtres
      if (search) {
        query = query.or(
          `cst_mail.ilike.%${search}%,cst_name.ilike.%${search}%,cst_fname.ilike.%${search}%`,
        );
      }
      if (level !== undefined) {
        query = query.eq('cst_level', level);
      }
      if (isPro !== undefined) {
        query = query.eq('cst_is_pro', isPro ? 1 : 0);
      }
      if (isActive !== undefined) {
        query = query.eq('cst_activ', isActive ? '1' : '0');
      }
      if (city) {
        query = query.ilike('cst_city', `%${city}%`);
      }
      if (country) {
        query = query.eq('cst_country', country);
      }

      // Pagination
      query = query
        .order('cst_id', { ascending: false })
        .range(offset, offset + limit - 1);

      const { data, error, count } = await query;

      if (error) {
        this.logger.error('Failed to fetch customers:', error);
        throw error;
      }

      const customers = (data || []).map(this.mapToCustomer);
      const total = count || 0;
      const totalPages = Math.ceil(total / limit);

      return {
        data: customers,
        total,
        page,
        limit,
        totalPages,
      };
    } catch (error) {
      this.logger.error('Failed to find all customers:', error);
      throw error;
    }
  }

  /**
   * Récupère un client par son ID
   */
  async findById(id: string): Promise<Customer> {
    try {
      const { data, error } = await this.supabase
        .from('___xtr_customer')
        .select('*')
        .eq('cst_id', id)
        .single();

      if (error || !data) {
        throw new NotFoundException(`Client ${id} non trouvé`);
      }

      return this.mapToCustomer(data);
    } catch (error) {
      this.logger.error(`Failed to find customer ${id}:`, error);
      throw error;
    }
  }

  /**
   * Récupère un client par son email
   */
  async findByEmail(email: string): Promise<Customer | null> {
    try {
      const { data, error } = await this.supabase
        .from('___xtr_customer')
        .select('*')
        .eq('cst_mail', email)
        .single();

      if (error || !data) {
        return null;
      }

      return this.mapToCustomer(data);
    } catch (error) {
      this.logger.error(`Failed to find customer by email ${email}:`, error);
      return null;
    }
  }

  /**
   * Crée un nouveau client
   */
  async create(dto: CreateCustomerDto): Promise<Customer> {
    try {
      // Hasher le mot de passe
      const hashedPassword = await bcrypt.hash(dto.password, 10);

      const { data, error } = await this.supabase
        .from('___xtr_customer')
        .insert({
          cst_mail: dto.email,
          cst_pswd: hashedPassword,
          cst_fname: dto.firstName,
          cst_name: dto.lastName,
          cst_civility: dto.civility,
          cst_phone: dto.phone,
          cst_mobile: dto.mobile,
          cst_is_pro: dto.isPro ? 1 : 0,
          cst_is_company: dto.isCompany ? 1 : 0,
          cst_company_name: dto.companyName,
          cst_siret: dto.siret,
          cst_level: 1, // Niveau par défaut
          cst_activ: '1', // Actif par défaut
        })
        .select()
        .single();

      if (error) {
        this.logger.error('Failed to create customer:', error);
        throw error;
      }

      return this.mapToCustomer(data);
    } catch (error) {
      this.logger.error('Failed to create customer:', error);
      throw error;
    }
  }

  /**
   * Met à jour un client
   */
  async update(id: string, dto: UpdateCustomerDto): Promise<Customer> {
    try {
      const updateData: any = {};

      if (dto.email) updateData.cst_mail = dto.email;
      if (dto.firstName) updateData.cst_fname = dto.firstName;
      if (dto.lastName) updateData.cst_name = dto.lastName;
      if (dto.civility) updateData.cst_civility = dto.civility;
      if (dto.address) updateData.cst_address = dto.address;
      if (dto.zipCode) updateData.cst_zip = dto.zipCode;
      if (dto.city) updateData.cst_city = dto.city;
      if (dto.country) updateData.cst_country = dto.country;
      if (dto.phone) updateData.cst_phone = dto.phone;
      if (dto.mobile) updateData.cst_mobile = dto.mobile;
      if (dto.isPro !== undefined) updateData.cst_is_pro = dto.isPro ? 1 : 0;
      if (dto.isCompany !== undefined) updateData.cst_is_company = dto.isCompany ? 1 : 0;
      if (dto.level !== undefined) updateData.cst_level = dto.level;
      if (dto.isActive !== undefined) updateData.cst_activ = dto.isActive ? '1' : '0';
      if (dto.companyName) updateData.cst_company_name = dto.companyName;
      if (dto.siret) updateData.cst_siret = dto.siret;

      const { data, error } = await this.supabase
        .from('___xtr_customer')
        .update(updateData)
        .eq('cst_id', id)
        .select()
        .single();

      if (error || !data) {
        throw new NotFoundException(`Client ${id} non trouvé`);
      }

      return this.mapToCustomer(data);
    } catch (error) {
      this.logger.error(`Failed to update customer ${id}:`, error);
      throw error;
    }
  }

  /**
   * Supprime un client (soft delete)
   */
  async delete(id: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('___xtr_customer')
        .update({ cst_activ: '0' })
        .eq('cst_id', id);

      if (error) {
        throw new NotFoundException(`Client ${id} non trouvé`);
      }
    } catch (error) {
      this.logger.error(`Failed to delete customer ${id}:`, error);
      throw error;
    }
  }

  /**
   * Vérifie si un email existe déjà
   */
  async emailExists(email: string): Promise<boolean> {
    const customer = await this.findByEmail(email);
    return customer !== null;
  }

  /**
   * Mappe les données DB vers le DTO Customer
   */
  private mapToCustomer(data: any): Customer {
    return {
      id: String(data.cst_id),
      email: data.cst_mail,
      firstName: data.cst_fname || undefined,
      lastName: data.cst_name || undefined,
      civility: data.cst_civility || undefined,
      address: data.cst_address || undefined,
      zipCode: data.cst_zip || undefined,
      city: data.cst_city || undefined,
      country: data.cst_country || 'FR',
      phone: data.cst_phone || undefined,
      mobile: data.cst_mobile || undefined,
      isPro: data.cst_is_pro === 1,
      isCompany: data.cst_is_company === 1,
      level: parseInt(String(data.cst_level || '1')),
      isActive: data.cst_activ === '1',
      siret: data.cst_siret || undefined,
      companyName: data.cst_company_name || undefined,
      createdAt: data.created_at ? new Date(data.created_at) : undefined,
      updatedAt: data.updated_at ? new Date(data.updated_at) : undefined,
    };
  }
}
