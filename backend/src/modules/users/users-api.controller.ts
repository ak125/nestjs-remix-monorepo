import {
  Controller,
  Get,
  Query,
  Param,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { SupabaseServiceFacade } from '../../database/supabase-service-facade';

@Controller('api/users')
export class UsersApiController {
  constructor(private readonly supabaseService: SupabaseServiceFacade) {}

  @Get()
  async getUsers(@Query('page') page?: string, @Query('limit') limit?: string) {
    try {
      const pageNum = parseInt(page || '1', 10);
      const limitNum = parseInt(limit || '10', 10);

      console.log(
        `API Users: Récupération page ${pageNum}, limite ${limitNum}`,
      );

      const result = await this.supabaseService.getAllUsers(pageNum, limitNum);

      if (!result || !result.users) {
        return {
          users: [],
          totalUsers: 0,
          currentPage: pageNum,
          totalPages: 0,
          hasNextPage: false,
          hasPreviousPage: false,
        };
      }

      const mappedUsers = result.users.map((user: any) => {
        return {
          id: user.cst_id || `user-${Date.now()}`,
          email: user.cst_mail || 'non-defini@example.com',
          firstName: user.cst_fname || 'Prénom',
          lastName: user.cst_name || 'Nom',
          phone: user.cst_tel || user.cst_gsm || 'Non défini',
          isActive: user.cst_activ === '1',
          isPro: user.cst_is_pro === '1' || user.cst_is_cpy === '1',
          emailVerified: user.cst_activ === '1',
          registrationDate: new Date().toISOString(),
          lastLoginDate: new Date().toISOString(),
          city: user.cst_city || 'Non définie',
          country: user.cst_country || 'France',
          level: parseInt(user.cst_level?.toString() || '1', 10),
          address: user.cst_address || 'Non définie',
          zipCode: user.cst_zip_code || 'Non défini',
          civility: user.cst_civility || 'M.',
          companyName: user.cst_rs || '',
          siret: user.cst_siret || '',
          billingAddress: null,
          deliveryAddress: null,
        };
      });

      const totalPages = Math.ceil(result.total / limitNum);

      return {
        users: mappedUsers,
        totalUsers: result.total,
        currentPage: pageNum,
        totalPages: totalPages,
        hasNextPage: pageNum < totalPages,
        hasPreviousPage: pageNum > 1,
      };
    } catch (error: any) {
      console.error(`API Users Error: ${error.message || error}`);
      throw new HttpException(
        'Erreur serveur lors de la récupération des utilisateurs',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(':id')
  async getUserById(@Param('id') id: string) {
    try {
      const user = await this.supabaseService.getUserById(id);

      if (!user) {
        throw new HttpException('Utilisateur non trouvé', HttpStatus.NOT_FOUND);
      }

      return {
        id: user.cst_id || id,
        email: user.cst_mail || 'non-defini@example.com',
        firstName: user.cst_fname || 'Prénom',
        lastName: user.cst_name || 'Nom',
        phone: user.cst_tel || user.cst_gsm || 'Non défini',
        isActive: user.cst_activ === '1',
        isPro: user.cst_is_pro === '1' || user.cst_is_cpy === '1',
        emailVerified: user.cst_activ === '1',
        registrationDate: new Date().toISOString(),
        lastLoginDate: new Date().toISOString(),
        city: user.cst_city || 'Non définie',
        country: user.cst_country || 'France',
        level: parseInt(user.cst_level?.toString() || '1', 10),
        address: user.cst_address || 'Non définie',
        zipCode: user.cst_zip_code || 'Non défini',
        civility: user.cst_civility || 'M.',
        companyName: user.cst_rs || '',
        siret: user.cst_siret || '',
        billingAddress: null,
        deliveryAddress: null,
      };
    } catch (error: any) {
      if (error.status === HttpStatus.NOT_FOUND) {
        throw error;
      }
      console.error(`API Users Error: ${error.message || error}`);
      throw new HttpException(
        "Erreur serveur lors de la récupération de l'utilisateur",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
