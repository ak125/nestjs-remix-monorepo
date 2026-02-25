import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '../database/database.module';
import { UsersModule } from './users/users.module';
import { NavigationModule } from './navigation/navigation.module';
import { CommercialModule } from './commercial/commercial.module';
import { SystemModule } from './system/system.module';
import { SeoLogsModule } from './seo-logs/seo-logs.module';

// Services
import { OrdersService } from '../database/services/orders.service';

// Controllers
import { UsersController } from '../controllers/users.controller';
import { OrdersController } from '../controllers/orders.controller';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    UsersModule, // Fournit UserDataConsolidatedService pour UsersController
    NavigationModule,
    CommercialModule, // Module commercial avec archives
    SystemModule, // Nouveau module system avec monitoring
    SeoLogsModule, // Module d'analyse des logs SEO via Loki
  ],
  providers: [OrdersService],
  controllers: [UsersController, OrdersController],
  exports: [OrdersService],
})
export class ApiModule {}
