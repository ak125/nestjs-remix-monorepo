import { Injectable } from '@nestjs/common';
import { SupabaseRestService } from '../database/supabase-rest.service';
import { CacheService } from '../cache/cache.service';
import * as bcrypt from 'bcryptjs';

export interface StaffMember {
  id: string;
  login: string;
  email: string;
  level: number;
  job: string;
  name: string;
  firstName: string;
  phone: string;
  isActive: boolean;
  keylog: string;
  departmentId: string;
}

export interface CreateStaffDto {
  login: string;
  email: string;
  level: number;
  job: string;
  name: string;
  firstName: string;
  phone: string;
  password?: string;
}

export interface UpdateStaffDto {
  login?: string;
  email?: string;
  level?: number;
  job?: string;
  name?: string;
  firstName?: string;
  phone?: string;
  isActive?: boolean;
}

@Injectable()
export class StaffService {
  constructor(
    private readonly supabaseRestService: SupabaseRestService,
    private readonly cacheService: CacheService,
  ) {}

  async findAll(): Promise<StaffMember[]> {
    console.log('🔍 StaffService.findAll');
    
    try {
      const { data } = await this.supabaseRestService.supabase
        .from('___config_admin')
        .select('*')
        .eq('cnfa_activ', '1')
        .order('cnfa_level', { ascending: false });
      
      return data?.map(this.mapToStaffMember) || [];
    } catch (error) {
      console.error('❌ Erreur findAll staff:', error);
      throw error;
    }
  }

  async findById(id: string): Promise<StaffMember | null> {
    console.log('🔍 StaffService.findById:', id);
    
    try {
      const { data } = await this.supabaseRestService.supabase
        .from('___config_admin')
        .select('*')
        .eq('cnfa_id', id)
        .eq('cnfa_activ', '1')
        .single();
      
      return data ? this.mapToStaffMember(data) : null;
    } catch (error) {
      console.error('❌ Erreur findById staff:', error);
      return null;
    }
  }

  async findByLogin(login: string): Promise<StaffMember | null> {
    console.log('🔍 StaffService.findByLogin:', login);
    
    try {
      const { data } = await this.supabaseRestService.supabase
        .from('___config_admin')
        .select('*')
        .eq('cnfa_login', login)
        .eq('cnfa_activ', '1')
        .single();
      
      return data ? this.mapToStaffMember(data) : null;
    } catch (error) {
      console.error('❌ Erreur findByLogin staff:', error);
      return null;
    }
  }

  async create(staffData: Partial<StaffMember>): Promise<StaffMember> {
    console.log('🔧 StaffService.create:', staffData);
    
    try {
      const hashedPassword = await bcrypt.hash(staffData.password || 'TempPassword123!', 10);
      const keylog = `STAFF_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const { data } = await this.supabaseRestService.supabase
        .from('___config_admin')
        .insert([{
          cnfa_login: staffData.login,
          cnfa_pswd: hashedPassword,
          cnfa_mail: staffData.email,
          cnfa_keylog: keylog,
          cnfa_level: staffData.level || 7,
          cnfa_job: staffData.job || 'Administrateur',
          cnfa_name: staffData.name,
          cnfa_fname: staffData.firstName,
          cnfa_tel: staffData.phone,
          cnfa_activ: '1',
          s_id: staffData.departmentId || 'ADM'
        }])
        .select()
        .single();
      
      return this.mapToStaffMember(data);
    } catch (error) {
      console.error('❌ Erreur create staff:', error);
      throw error;
    }
  }

  async update(id: string, updates: Partial<StaffMember>): Promise<StaffMember> {
    console.log('🔧 StaffService.update:', id, updates);
    
    try {
      const updateData: any = {};
      
      if (updates.email) updateData.cnfa_mail = updates.email;
      if (updates.level) updateData.cnfa_level = updates.level;
      if (updates.job) updateData.cnfa_job = updates.job;
      if (updates.name) updateData.cnfa_name = updates.name;
      if (updates.firstName) updateData.cnfa_fname = updates.firstName;
      if (updates.phone) updateData.cnfa_tel = updates.phone;
      if (updates.isActive !== undefined) updateData.cnfa_activ = updates.isActive ? '1' : '0';
      
      const { data } = await this.supabaseRestService.supabase
        .from('___config_admin')
        .update(updateData)
        .eq('cnfa_id', id)
        .select()
        .single();
      
      return this.mapToStaffMember(data);
    } catch (error) {
      console.error('❌ Erreur update staff:', error);
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    console.log('🗑️ StaffService.delete:', id);
    
    try {
      await this.supabaseRestService.supabase
        .from('___config_admin')
        .update({ cnfa_activ: '0' })
        .eq('cnfa_id', id);
    } catch (error) {
      console.error('❌ Erreur delete staff:', error);
      throw error;
    }
  }

  private mapToStaffMember(data: any): StaffMember {
    return {
      id: data.cnfa_id,
      login: data.cnfa_login,
      email: data.cnfa_mail,
      level: parseInt(data.cnfa_level) || 7,
      job: data.cnfa_job,
      name: data.cnfa_name,
      firstName: data.cnfa_fname,
      phone: data.cnfa_tel,
      isActive: data.cnfa_activ === '1',
      keylog: data.cnfa_keylog,
      departmentId: data.s_id
    };
  }
}
