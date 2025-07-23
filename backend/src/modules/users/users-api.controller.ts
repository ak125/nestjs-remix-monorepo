/**
 * Contrôleur API Users - Version complète avec fonctionnalités étendues
 */

import { Controller, Get, Query, HttpException, HttpStatus, Param } from '@nestjs/common';

@Controller('api/users')
export class UsersApiController {
  /**
   * Récupérer la liste des utilisateurs avec pagination
   * GET /api/users?limit=10&page=1&search=terme
   */
  @Get()
  async getUsers(
    @Query('limit') limit?: string,
    @Query('page') page?: string,
    @Query('search') search?: string
  ) {
    console.log(`📡 API Users: GET /api/users?limit=${limit}&page=${page}&search=${search}`);
    
    try {
      const users = [
        {
          id: 'autoparts-admin-001',
          email: 'admin.autoparts@example.com',
          firstName: 'Admin',
          lastName: 'AutoParts',
          phone: '0654321098',
          isActive: true,
          isPro: true,
          emailVerified: true,
          registrationDate: '2024-01-15T10:30:00Z',
          lastLoginDate: new Date().toISOString(),
          city: 'AutoParts City',
          country: 'France',
          level: 8
        },
        {
          id: 'user-001',
          email: 'client@test.com',
          firstName: 'Jean',
          lastName: 'Dupont',
          phone: '+33987654321',
          isActive: true,
          isPro: false,
          emailVerified: true,
          registrationDate: '2024-03-20T14:15:00Z',
          lastLoginDate: '2025-07-20T09:45:00Z',
          city: 'Lyon',
          country: 'France',
          level: 2
        },
        {
          id: 'user-002',
          email: 'pro@garage.com',
          firstName: 'Marie',
          lastName: 'Martin',
          phone: '+33555666777',
          isActive: true,
          isPro: true,
          emailVerified: true,
          registrationDate: '2024-02-10T16:20:00Z',
          lastLoginDate: '2025-07-22T18:30:00Z',
          city: 'Marseille',
          country: 'France',
          level: 6
        },
        {
          id: 'user-003',
          email: 'client2@example.com',
          firstName: 'Pierre',
          lastName: 'Durand',
          phone: '+33444555666',
          isActive: false,
          isPro: false,
          emailVerified: false,
          registrationDate: '2024-05-05T11:00:00Z',
          lastLoginDate: '2025-06-15T12:00:00Z',
          city: 'Toulouse',
          country: 'France',
          level: 2
        },
        {
          id: 'user-004',
          email: 'mechanic@workshop.fr',
          firstName: 'Sophie',
          lastName: 'Bernard',
          phone: '+33333444555',
          isActive: true,
          isPro: true,
          emailVerified: true,
          registrationDate: '2024-04-12T08:45:00Z',
          lastLoginDate: '2025-07-23T07:15:00Z',
          city: 'Nice',
          country: 'France',
          level: 9
        }
      ];

      let filteredUsers = users;

      // Filtrage par recherche
      if (search && search.trim()) {
        const searchTerm = search.toLowerCase();
        filteredUsers = users.filter(user => 
          user.email.toLowerCase().includes(searchTerm) ||
          user.firstName.toLowerCase().includes(searchTerm) ||
          user.lastName.toLowerCase().includes(searchTerm) ||
          user.city.toLowerCase().includes(searchTerm)
        );
      }

      // Pagination
      const limitNum = limit ? parseInt(limit, 10) : 50;
      const pageNum = page ? parseInt(page, 10) : 1;
      const startIndex = (pageNum - 1) * limitNum;
      const endIndex = startIndex + limitNum;
      
      const paginatedUsers = filteredUsers.slice(startIndex, endIndex);

      console.log(`✅ API Users - ${paginatedUsers.length}/${filteredUsers.length} utilisateurs retournés (page ${pageNum})`);

      return {
        users: paginatedUsers,
        totalUsers: filteredUsers.length,
        currentPage: pageNum,
        totalPages: Math.ceil(filteredUsers.length / limitNum),
        hasNextPage: endIndex < filteredUsers.length,
        hasPrevPage: pageNum > 1
      };
    } catch (error: any) {
      console.error('❌ Erreur API Users:', error);
      throw new HttpException(
        'Erreur lors de la récupération des utilisateurs',
        HttpStatus.INTERNAL_SERVER_ERROR
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
      const users = await this.getUsers(); // Récupérer tous les users
      const user = users.users.find((u: any) => u.id === id);
      
      if (!user) {
        throw new HttpException('Utilisateur non trouvé', HttpStatus.NOT_FOUND);
      }

      console.log(`✅ Utilisateur trouvé: ${user.email}`);
      return { user };
    } catch (error: any) {
      console.error('❌ Erreur lors de la récupération de l\'utilisateur:', error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Erreur lors de la récupération de l\'utilisateur',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Statistiques des utilisateurs
   * GET /api/users/stats
   */
  @Get('stats/summary')
  async getUserStats() {
    console.log('📊 API Users: GET /api/users/stats/summary');
    
    try {
      const usersData = await this.getUsers('1000'); // Récupérer tous les users
      const users = usersData.users;

      const stats = {
        total: users.length,
        active: users.filter((u: any) => u.isActive).length,
        inactive: users.filter((u: any) => !u.isActive).length,
        professional: users.filter((u: any) => u.isPro).length,
        verified: users.filter((u: any) => u.emailVerified).length,
        unverified: users.filter((u: any) => !u.emailVerified).length,
        byLevel: {
          level2: users.filter((u: any) => u.level === 2).length,
          level6: users.filter((u: any) => u.level === 6).length,
          level8: users.filter((u: any) => u.level === 8).length,
          level9: users.filter((u: any) => u.level === 9).length,
        },
        recentlyActive: users.filter((u: any) => {
          const lastLogin = new Date(u.lastLoginDate);
          const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
          return lastLogin > oneDayAgo;
        }).length
      };

      console.log('✅ Statistiques calculées:', stats);
      return { stats };
    } catch (error: any) {
      console.error('❌ Erreur lors du calcul des statistiques:', error);
      throw new HttpException(
        'Erreur lors du calcul des statistiques',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}