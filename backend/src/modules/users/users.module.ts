import { Module } from '@nestjs/common';
// import { UsersController } from './users.controller'; // Désactivé pour éviter les conflits
import { UsersApiController } from './users-api.controller';
import { UsersService } from './users.service';
import { DatabaseModule } from '../../database/database.module';
import { CacheModule } from '../../cache/cache.module';

@Module({
  imports: [DatabaseModule, CacheModule],
  controllers: [
    // UsersController,      // Désactivé pour éviter les conflits de routes
    UsersApiController,   // Nouveau contrôleur API fonctionnel
  ],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
