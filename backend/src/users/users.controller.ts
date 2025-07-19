import { Controller, Post, Body, HttpStatus, HttpException, Get, Query } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';

@Controller('api/users')
export class UsersController {
  constructor(private authService: AuthService) {}

  @Get()
  async getUsers(@Query('level') level?: string) {
    try {
      if (level) {
        const levelNumber = parseInt(level, 10);
        if (isNaN(levelNumber)) {
          throw new HttpException('Le niveau doit être un nombre valide', HttpStatus.BAD_REQUEST);
        }
        
        // Récupérer les utilisateurs avec un niveau spécifique
        // Pour l'instant, on utilise une méthode simple
        return await this.getAdminUsers(levelNumber);
      }
      
      // Récupérer tous les utilisateurs administrateurs (niveau 7+)
      return await this.getAdminUsers(7);
    } catch (error) {
      throw new HttpException(
        'Erreur lors de la récupération des utilisateurs',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  private async getAdminUsers(minLevel: number = 7) {
    // Cette méthode devrait être ajoutée au service d'authentification
    // Pour l'instant, on simule avec l'utilisateur de test
    const testUser = {
      id: 'test-user-123',
      email: 'test@example.com',
      firstName: 'Test20',
      lastName: 'Testeur',
      level: 7,
      isPro: true,
      isActive: true
    };
    
    return minLevel <= 7 ? [testUser] : [];
  }

  @Post('update-level')
  async updateUserLevel(@Body() body: { email: string; level: string }) {
    try {
      const { email, level } = body;
      
      if (!email || !level) {
        throw new HttpException('Email et niveau requis', HttpStatus.BAD_REQUEST);
      }

      // Convertir level en number
      const levelNumber = parseInt(level, 10);
      if (isNaN(levelNumber)) {
        throw new HttpException('Le niveau doit être un nombre valide', HttpStatus.BAD_REQUEST);
      }

      // Utiliser le service d'authentification pour mettre à jour l'utilisateur
      const result = await this.authService.updateUserLevel(email, levelNumber);
      
      return {
        success: true,
        message: `Utilisateur ${email} mis à jour au niveau ${levelNumber}`,
        user: result
      };
    } catch (error) {
      throw new HttpException(
        'Erreur lors de la mise à jour du niveau utilisateur',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}
