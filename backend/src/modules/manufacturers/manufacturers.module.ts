/**
 * 🏭 MANUFACTURERS MODULE HYBRIDE
 *
 * Combine le meilleur des deux approches :
 * - Tables auto_* existantes (version simple validée)
 * - Cache et optimisations (version sophistiquée)
 */

import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { ManufacturersController } from './manufacturers.controller';
import { ManufacturersService } from './manufacturers.service';

@Module({
  imports: [
    // Cache pour optimiser les requêtes fréquentes
    CacheModule.register({
      ttl: 300, // 5 minutes
      max: 1000, // 1000 entrées max
    }),
  ],
  controllers: [ManufacturersController],
  providers: [ManufacturersService],
  exports: [ManufacturersService],
})
export class ManufacturersModule {}
