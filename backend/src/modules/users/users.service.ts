import { Injectable } from '@nestjs/common';
import { SupabaseRestService } from '../../database/supabase-rest.service';

@Injectable()
export class UsersService {
  constructor(private readonly supabaseService: SupabaseRestService) {}

  async findById(id: string) {
    try {
      console.log(`🔍 UsersService.findById: ${id}`);
      const user = await this.supabaseService.getUserById(id);
      console.log(`✅ User found in service: ${user?.cst_mail || 'none'}`);
      return user;
    } catch (error) {
      console.error(`❌ Error in UsersService.findById: ${error}`);
      throw error;
    }
  }

  async findByEmail(email: string) {
    try {
      console.log(`🔍 UsersService.findByEmail: ${email}`);
      const user = await this.supabaseService.findUserByEmail(email);
      console.log(`✅ User found by email in service: ${user?.cst_mail || 'none'}`);
      return user;
    } catch (error) {
      console.error(`❌ Error in UsersService.findByEmail: ${error}`);
      throw error;
    }
  }
}