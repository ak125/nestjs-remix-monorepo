import { Module } from '@nestjs/common';
import { CacheModule as NestCacheModule } from '@nestjs/cache-manager';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { DatabaseModule } from '../../database/database.module';
import { AuthModule } from '../../auth/auth.module';
import { ConfigModule } from '@nestjs/config';
import { CacheModule } from '../cache/cache.module';

@Module({
  imports: [
    DatabaseModule,
    AuthModule, // Pour ModulePermissionGuard et AuthService
    ConfigModule, // Import du module Config pour utiliser ConfigService
    CacheModule, // Import du module Cache pour utiliser CacheService
    NestCacheModule.register({ ttl: 180, max: 50 }), // Cache pour CacheInterceptor (3min pour stats)
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
  exports: [DashboardService],
})
export class DashboardModule {}
