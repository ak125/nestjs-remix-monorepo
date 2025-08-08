/**
 * Contrôleur API Users - Version complète avec vraies données
 */

import {
  Controller,
  Get,
  Query,
  HttpException,
  HttpStatus,
  Param,
} from '@nestjs/common';
import { SupabaseServiceFacade } from '../../database/supabase-service-facade';

@Controller('api/users')
export class UsersApiController {
  constructor(private readonly supabaseService: SupabaseServiceFacade) {}

  /**
   * Récupérer la liste des utilisateurs avec pagination
   * GET /api/users?limit=10&page=1&search=terme
   */
  @Get()
  async getUsers(
    @Query('limit') limit?: string,
    @Query('page') page?: string,
    @Query('search') search?: string,
  ) {
    console.log(
      `📡 API Users: GET /api/users?limit=${limit}&page=${page}&search=${search}`,
    );

    try {
      // Paramètres avec valeurs par défaut
      const pageNum = parseInt(page || '1', 10);
      const limitNum = parseInt(limit || '10', 10);

      // ✅ Utiliser les vraies données depuis Supabase
      const result = await this.supabaseService.getAllUsers(
        pageNum,
        limitNum,
        search,
      );

      // Mapper les données de la vraie table vers le format de l'API
      const mappedUsers = await Promise.all(
        result.users.map(async (user: any) => {
          // Récupérer les adresses pour chaque utilisateur
          let billingAddress: any | null = null;
          let deliveryAddress: any | null = null;

          try {
            billingAddress =
              await this.supabaseService.getCustomerBillingAddressByCustomerId(
                user.cst_id,
              );
            deliveryAddress =
              await this.supabaseService.getCustomerDeliveryAddressByCustomerId(
                user.cst_id,
              );
          } catch (error) {
            console.log(
              `⚠️ Impossible de récupérer les adresses pour l'utilisateur ${user.cst_id}`,
            );
          }

          return {
            id: user.cst_id || `user-${Date.now()}`,
            email: user.cst_mail || 'non-defini@example.com',
            firstName: user.cst_fname || 'Prénom',
            lastName: user.cst_name || 'Nom',
            phone: user.cst_tel || user.cst_gsm || 'Non défini',
            isActive: user.cst_activ === '1',
            isPro: user.cst_is_pro === '1' || user.cst_is_cpy === '1',
            emailVerified: user.cst_activ === '1',
            registrationDate: new Date().toISOString(), // Pas de champ date dans la table
            lastLoginDate: new Date().toISOString(), // Pas de champ last_login dans la table
            city: user.cst_city || 'Non définie',
            country: user.cst_country || 'France',
            level: parseInt(user.cst_level?.toString() || '1', 10),
            address: user.cst_address || 'Non définie',
            zipCode: user.cst_zip_code || 'Non défini',
            civility: user.cst_civility || 'M.',
            companyName: user.cst_rs || '',
            siret: user.cst_siret || '',
            // ✅ Adresses enrichies
            billingAddress: billingAddress
              ? {
                  id: billingAddress.cba_id,
                  email: billingAddress.cba_mail,
                  civility: billingAddress.cba_civility,
                  firstName: billingAddress.cba_fname,
                  lastName: billingAddress.cba_name,
                  address: billingAddress.cba_address,
                  zipCode: billingAddress.cba_zip_code,
                  city: billingAddress.cba_city,
                  country: billingAddress.cba_country,
                  phone: billingAddress.cba_tel || billingAddress.cba_gsm,
                }
              : null,
            deliveryAddress: deliveryAddress
              ? {
                  id: deliveryAddress.cda_id,
                  email: deliveryAddress.cda_mail,
                  civility: deliveryAddress.cda_civility,
                  firstName: deliveryAddress.cda_fname,
                  lastName: deliveryAddress.cda_name,
                  address: deliveryAddress.cda_address,
                  zipCode: deliveryAddress.cda_zip_code,
                  city: deliveryAddress.cda_city,
                  country: deliveryAddress.cda_country,
                  phone: deliveryAddress.cda_tel || deliveryAddress.cda_gsm,
                }
              : null,
          };
        }),
      );

      const totalPages = Math.ceil(result.total / limitNum);

      const response = {
        users: mappedUsers,
        totalUsers: result.total,
        currentPage: pageNum,
        totalPages: totalPages,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1,
      };

      console.log(
        `✅ API Users - ${mappedUsers.length}/${result.total} utilisateurs retournés (page ${pageNum})`,
      );
      return response;
    } catch (error: any) {
      console.error(`❌ API Users Error: ${error.message || error}`);
      throw new HttpException(
        'Erreur serveur lors de la récupération des utilisateurs',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Récupérer un utilisateur par ID
   * GET /api/users/:id
   */
  @Get(':id')
  async getUserById(@Param('id') id: string) {
    console.log(`📡 API Users: GET /api/users/${id}`);

    try {
      // ✅ Utiliser les vraies données depuis Supabase
      const user = await this.supabaseService.getUserById(id);

      if (!user) {
        console.log(`❌ API Users: Utilisateur ${id} non trouvé`);
        throw new HttpException('Utilisateur non trouvé', HttpStatus.NOT_FOUND);
      }

      // Récupérer les adresses
      let billingAddress: any | null = null;
      let deliveryAddress: any | null = null;

      try {
        billingAddress =
          await this.supabaseService.getCustomerBillingAddressByCustomerId(
            user.cst_id,
          );
        deliveryAddress =
          await this.supabaseService.getCustomerDeliveryAddressByCustomerId(
            user.cst_id,
          );
      } catch (error) {
        console.log(
          `⚠️ Impossible de récupérer les adresses pour l'utilisateur ${user.cst_id}`,
        );
      }

      // Mapper les données vers le format de l'API
      const mappedUser = {
        id: user.cst_id || id,
        email: user.cst_mail || 'non-defini@example.com',
        firstName: user.cst_fname || 'Prénom',
        lastName: user.cst_name || 'Nom',
        phone: user.cst_tel || user.cst_gsm || 'Non défini',
        isActive: user.cst_activ === '1',
        isPro: user.cst_is_pro === '1' || user.cst_is_cpy === '1',
        emailVerified: user.cst_activ === '1',
        registrationDate: new Date().toISOString(), // Pas de champ date dans la table
        lastLoginDate: new Date().toISOString(), // Pas de champ last_login dans la table
        city: user.cst_city || 'Non définie',
        country: user.cst_country || 'France',
        level: parseInt(user.cst_level?.toString() || '1', 10),
        address: user.cst_address || 'Non définie',
        zipCode: user.cst_zip_code || 'Non défini',
        civility: user.cst_civility || 'M.',
        companyName: user.cst_rs || '',
        siret: user.cst_siret || '',
        // ✅ Adresses enrichies
        billingAddress: billingAddress
          ? {
              id: billingAddress.cba_id,
              email: billingAddress.cba_mail,
              civility: billingAddress.cba_civility,
              firstName: billingAddress.cba_fname,
              lastName: billingAddress.cba_name,
              address: billingAddress.cba_address,
              zipCode: billingAddress.cba_zip_code,
              city: billingAddress.cba_city,
              country: billingAddress.cba_country,
              phone: billingAddress.cba_tel || billingAddress.cba_gsm,
            }
          : null,
        deliveryAddress: deliveryAddress
          ? {
              id: deliveryAddress.cda_id,
              email: deliveryAddress.cda_mail,
              civility: deliveryAddress.cda_civility,
              firstName: deliveryAddress.cda_fname,
              lastName: deliveryAddress.cda_name,
              address: deliveryAddress.cda_address,
              zipCode: deliveryAddress.cda_zip_code,
              city: deliveryAddress.cda_city,
              country: deliveryAddress.cda_country,
              phone: deliveryAddress.cda_tel || deliveryAddress.cda_gsm,
            }
          : null,
      };

      console.log(`✅ API Users: Utilisateur ${id} trouvé`);
      return mappedUser;
    } catch (error: any) {
      if (error.status === HttpStatus.NOT_FOUND) {
        throw error;
      }
      console.error(`❌ API Users Error: ${error.message || error}`);
      throw new HttpException(
        "Erreur serveur lors de la récupération de l'utilisateur",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Récupérer les statistiques des utilisateurs
   * GET /api/users/stats
   */
  @Get('stats')
  async getUserStats() {
    console.log(`📡 API Users: GET /api/users/stats`);

    try {
      // ✅ Utiliser les vraies données depuis Supabase pour calculer les stats
      const allUsers = await this.supabaseService.getAllUsers(1, 1000); // Récupérer un échantillon large

      const stats = {
        totalUsers: allUsers.total,
        activeUsers: allUsers.users.filter(
          (user: any) => user.cst_activ === '1' || user.cst_active === true,
        ).length,
        proUsers: allUsers.users.filter(
          (user: any) => user.cst_is_pro === '1' || user.cst_is_cpy === '1',
        ).length,
        verifiedUsers: allUsers.users.filter(
          (user: any) => user.cst_activ === '1',
        ).length,
        byLevel: allUsers.users.reduce((acc: any, user: any) => {
          const level = user.cst_level || '1';
          acc[level] = (acc[level] || 0) + 1;
          return acc;
        }, {}),
      };

      console.log(`✅ API Users: Statistiques calculées`);
      return stats;
    } catch (error: any) {
      console.error(`❌ API Users Stats Error: ${error.message || error}`);
      throw new HttpException(
        'Erreur serveur lors du calcul des statistiques',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
