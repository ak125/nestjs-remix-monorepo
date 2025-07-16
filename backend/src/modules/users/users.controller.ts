import { Controller, Get, Param, HttpException, HttpStatus } from '@nestjs/common';
import { UsersService } from './users.service';

@Controller('api/users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get(':id')
  async getUserById(@Param('id') id: string) {
    try {
      console.log(`🔍 GET /api/users/${id}`);
      const user = await this.usersService.findById(id);
      
      if (!user) {
        throw new HttpException('User not found', HttpStatus.NOT_FOUND);
      }
      
      console.log(`✅ User found: ${user.cst_mail}`);
      return user;
    } catch (error) {
      console.error(`❌ Error getting user ${id}:`, error);
      
      const errorMessage = error instanceof Error ? error.message : 'Error retrieving user';
      const errorStatus = error instanceof HttpException ? error.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
      
      throw new HttpException(errorMessage, errorStatus);
    }
  }

  @Get('email/:email')
  async getUserByEmail(@Param('email') email: string) {
    try {
      console.log(`🔍 GET /api/users/email/${email}`);
      
      // Créer temporairement une méthode findByEmail dans le service
      const user = await this.usersService.findByEmail(email);
      
      if (!user) {
        throw new HttpException('User not found by email', HttpStatus.NOT_FOUND);
      }
      
      console.log(`✅ User found by email: ${user.cst_mail}`);
      return user;
    } catch (error) {
      console.error(`❌ Error getting user by email ${email}:`, error);
      
      const errorMessage = error instanceof Error ? error.message : 'Error retrieving user by email';
      const errorStatus = error instanceof HttpException ? error.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
      
      throw new HttpException(errorMessage, errorStatus);
    }
  }
}