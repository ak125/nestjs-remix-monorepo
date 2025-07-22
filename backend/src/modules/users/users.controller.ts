import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Patch,
  Param,
  Body,
  Query,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto, CreateUserSchema } from './dto/create-user.dto';
import { UpdateUserDto, UpdateUserSchema } from './dto/update-user.dto';
import {
  ChangePasswordDto,
  ChangePasswordSchema,
} from './dto/change-password.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { UserProfileDto } from './dto/user-profile.dto';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';

@Controller('api/users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  async getAllUsers(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
    @Query('search') search?: string,
  ) {
    try {
      console.log(
        `🔍 GET /api/users - page: ${page}, limit: ${limit}, search: ${search}`,
      );

      const pageNum = parseInt(page, 10);
      const limitNum = parseInt(limit, 10);

      if (search) {
        const users = await this.usersService.searchUsers(search);
        return { users, total: users.length, page: pageNum, limit: limitNum };
      }

      const result = await this.usersService.getAllUsers(pageNum, limitNum);
      console.log(`✅ Found ${result.total} users`);
      return result;
    } catch (error) {
      console.error(`❌ Error getting users:`, error);
      throw new HttpException(
        error instanceof Error ? error.message : 'Error retrieving users',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(':id')
  async getUserById(@Param('id') id: string): Promise<UserResponseDto> {
    try {
      console.log(`🔍 GET /api/users/${id}`);
      const user = await this.usersService.findById(id);

      if (!user) {
        throw new HttpException('Utilisateur non trouvé', HttpStatus.NOT_FOUND);
      }

      console.log(`✅ User found: ${user.email}`);
      return user;
    } catch (error) {
      console.error(`❌ Error getting user ${id}:`, error);

      const errorMessage =
        error instanceof Error
          ? error.message
          : "Erreur lors de la récupération de l'utilisateur";
      const errorStatus =
        error instanceof HttpException
          ? error.getStatus()
          : HttpStatus.INTERNAL_SERVER_ERROR;

      throw new HttpException(errorMessage, errorStatus);
    }
  }

  @Get('email/:email')
  async getUserByEmail(
    @Param('email') email: string,
  ): Promise<UserResponseDto> {
    try {
      console.log(`🔍 GET /api/users/email/${email}`);

      const user = await this.usersService.findByEmail(email);

      if (!user) {
        throw new HttpException(
          'Utilisateur non trouvé avec cet email',
          HttpStatus.NOT_FOUND,
        );
      }

      console.log(`✅ User found by email: ${user.email}`);
      return user;
    } catch (error) {
      console.error(`❌ Error getting user by email ${email}:`, error);

      const errorMessage =
        error instanceof Error
          ? error.message
          : "Erreur lors de la récupération de l'utilisateur par email";
      const errorStatus =
        error instanceof HttpException
          ? error.getStatus()
          : HttpStatus.INTERNAL_SERVER_ERROR;

      throw new HttpException(errorMessage, errorStatus);
    }
  }

  @Post()
  async createUser(
    @Body(new ZodValidationPipe(CreateUserSchema)) createUserDto: CreateUserDto,
  ): Promise<UserResponseDto> {
    try {
      console.log(`🔨 POST /api/users`, { email: createUserDto.email });

      const user = await this.usersService.createUser(createUserDto);

      console.log(`✅ User created: ${user.email}`);
      return user;
    } catch (error) {
      console.error(`❌ Error creating user:`, error);

      const errorMessage =
        error instanceof Error
          ? error.message
          : "Erreur lors de la création de l'utilisateur";
      const errorStatus =
        error instanceof HttpException
          ? error.getStatus()
          : HttpStatus.INTERNAL_SERVER_ERROR;

      throw new HttpException(errorMessage, errorStatus);
    }
  }

  @Put(':id')
  async updateUser(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateUserSchema)) updateUserDto: UpdateUserDto,
  ): Promise<UserResponseDto> {
    try {
      console.log(`🔧 PUT /api/users/${id}`, updateUserDto);

      const user = await this.usersService.updateUser(id, updateUserDto);

      console.log(`✅ User updated: ${user.email}`);
      return user;
    } catch (error) {
      console.error(`❌ Error updating user ${id}:`, error);

      const errorMessage =
        error instanceof Error
          ? error.message
          : "Erreur lors de la mise à jour de l'utilisateur";
      const errorStatus =
        error instanceof HttpException
          ? error.getStatus()
          : HttpStatus.INTERNAL_SERVER_ERROR;

      throw new HttpException(errorMessage, errorStatus);
    }
  }

  @Delete(':id')
  async deleteUser(
    @Param('id') id: string,
  ): Promise<{ success: boolean; message: string }> {
    try {
      console.log(`🗑️ DELETE /api/users/${id}`);

      const success = await this.usersService.deleteUser(id);

      console.log(`✅ User deactivated: ${id}`);
      return { success, message: 'Utilisateur désactivé avec succès' };
    } catch (error) {
      console.error(`❌ Error deleting user ${id}:`, error);

      const errorMessage =
        error instanceof Error
          ? error.message
          : "Erreur lors de la suppression de l'utilisateur";
      const errorStatus =
        error instanceof HttpException
          ? error.getStatus()
          : HttpStatus.INTERNAL_SERVER_ERROR;

      throw new HttpException(errorMessage, errorStatus);
    }
  }

  @Get(':id/profile')
  async getUserProfile(@Param('id') id: string): Promise<UserProfileDto> {
    try {
      console.log(`👤 GET /api/users/${id}/profile`);

      const profile = await this.usersService.getUserProfile(id);

      console.log(`✅ User profile retrieved: ${profile.email}`);
      return profile;
    } catch (error) {
      console.error(`❌ Error getting user profile ${id}:`, error);

      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Erreur lors de la récupération du profil';
      const errorStatus =
        error instanceof HttpException
          ? error.getStatus()
          : HttpStatus.INTERNAL_SERVER_ERROR;

      throw new HttpException(errorMessage, errorStatus);
    }
  }

  @Patch(':id/password')
  async changePassword(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(ChangePasswordSchema))
    changePasswordDto: ChangePasswordDto,
  ): Promise<{ success: boolean; message: string }> {
    try {
      console.log(`🔒 PATCH /api/users/${id}/password`);

      const success = await this.usersService.changePassword(
        id,
        changePasswordDto,
      );

      console.log(`✅ Password changed for user: ${id}`);
      return { success, message: 'Mot de passe modifié avec succès' };
    } catch (error) {
      console.error(`❌ Error changing password for user ${id}:`, error);

      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Erreur lors du changement de mot de passe';
      const errorStatus =
        error instanceof HttpException
          ? error.getStatus()
          : HttpStatus.INTERNAL_SERVER_ERROR;

      throw new HttpException(errorMessage, errorStatus);
    }
  }

  @Patch(':id/level')
  async updateUserLevel(
    @Param('id') id: string,
    @Body('level') level: number,
  ): Promise<UserResponseDto> {
    try {
      console.log(`⬆️ PATCH /api/users/${id}/level`, { level });

      const user = await this.usersService.updateUserLevel(id, level);

      console.log(`✅ User level updated: ${user.email}`);
      return user;
    } catch (error) {
      console.error(`❌ Error updating user level ${id}:`, error);

      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Erreur lors de la mise à jour du niveau';
      const errorStatus =
        error instanceof HttpException
          ? error.getStatus()
          : HttpStatus.INTERNAL_SERVER_ERROR;

      throw new HttpException(errorMessage, errorStatus);
    }
  }

  @Patch(':id/deactivate')
  async deactivateUser(
    @Param('id') id: string,
    @Body('reason') reason?: string,
  ): Promise<{ success: boolean; message: string }> {
    try {
      console.log(`🚫 PATCH /api/users/${id}/deactivate`, { reason });

      const success = await this.usersService.deactivateUser(id, reason);

      console.log(`✅ User deactivated: ${id}`);
      return { success, message: 'Utilisateur désactivé avec succès' };
    } catch (error) {
      console.error(`❌ Error deactivating user ${id}:`, error);

      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Erreur lors de la désactivation';
      const errorStatus =
        error instanceof HttpException
          ? error.getStatus()
          : HttpStatus.INTERNAL_SERVER_ERROR;

      throw new HttpException(errorMessage, errorStatus);
    }
  }

  @Patch(':id/reactivate')
  async reactivateUser(@Param('id') id: string): Promise<UserResponseDto> {
    try {
      console.log(`✅ PATCH /api/users/${id}/reactivate`);

      const user = await this.usersService.reactivateUser(id);

      console.log(`✅ User reactivated: ${user.email}`);
      return user;
    } catch (error) {
      console.error(`❌ Error reactivating user ${id}:`, error);

      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Erreur lors de la réactivation';
      const errorStatus =
        error instanceof HttpException
          ? error.getStatus()
          : HttpStatus.INTERNAL_SERVER_ERROR;

      throw new HttpException(errorMessage, errorStatus);
    }
  }

  @Get('level/:level')
  async getUsersByLevel(
    @Param('level') level: string,
  ): Promise<UserResponseDto[]> {
    try {
      const levelNum = parseInt(level, 10);
      console.log(`📊 GET /api/users/level/${levelNum}`);

      const users = await this.usersService.getUsersByLevel(levelNum);

      console.log(`✅ Found ${users.length} users with level ${levelNum}`);
      return users;
    } catch (error) {
      console.error(`❌ Error getting users by level ${level}:`, error);

      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Erreur lors de la récupération des utilisateurs par niveau';
      const errorStatus =
        error instanceof HttpException
          ? error.getStatus()
          : HttpStatus.INTERNAL_SERVER_ERROR;

      throw new HttpException(errorMessage, errorStatus);
    }
  }

  @Get('active')
  async getActiveUsers(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
  ) {
    try {
      const pageNum = parseInt(page, 10);
      const limitNum = parseInt(limit, 10);

      console.log(
        `✅ GET /api/users/active - page: ${pageNum}, limit: ${limitNum}`,
      );

      const result = await this.usersService.getActiveUsers(pageNum, limitNum);

      console.log(`✅ Found ${result.total} active users`);
      return result;
    } catch (error) {
      console.error(`❌ Error getting active users:`, error);

      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Erreur lors de la récupération des utilisateurs actifs';
      const errorStatus =
        error instanceof HttpException
          ? error.getStatus()
          : HttpStatus.INTERNAL_SERVER_ERROR;

      throw new HttpException(errorMessage, errorStatus);
    }
  }
}
