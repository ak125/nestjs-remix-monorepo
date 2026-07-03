import { Module } from '@nestjs/common';
import { CacheModule as NestCacheModule } from '@nestjs/cache-manager';
import { boundedMemoryCache } from '../../config/cache-store.factory';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { DatabaseModule } from '../../database/database.module';
import { AuthModule } from '../../auth/auth.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    DatabaseModule,
    AuthModule, // Pour ModulePermissionGuard et AuthService
    ConfigModule, // Import du module Config pour utiliser ConfigService
    NestCacheModule.register(boundedMemoryCache(180, 50)), // Cache pour CacheInterceptor
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
  exports: [DashboardService],
})
export class DashboardModule {}
