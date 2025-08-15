/**
 * Module Users refactorisé avec architecture modulaire
 * Intègre tous les services spécialisés avec injection de dépendances
 */

import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users-refactored.service';
import { AuthService } from './services/auth.service';
import { UserProfileService } from './services/user-profile.service';
import { UserAdminService } from './services/user-admin.service';
import { SharedModule } from '../../shared/shared.module';

@Module({
  imports: [SharedModule],
  controllers: [UsersController],
  providers: [
    UsersService,
    AuthService,
    UserProfileService,
    UserAdminService,
  ],
  exports: [
    UsersService,
    AuthService,
    UserProfileService,
    UserAdminService,
  ],
})
export class UsersModule {}
