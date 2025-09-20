import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '../database/database.module';
import { NavigationModule } from './navigation/navigation.module';
import { CommercialModule } from './commercial/commercial.module';
import { SystemModule } from './system/system.module';

// Services
import { LegacyUserService } from '../database/services/legacy-user.service';
import { LegacyOrderService } from '../database/services/legacy-order.service';

// Controllers
import { UsersController } from '../controllers/users.controller';
import { OrdersController } from '../controllers/orders.controller';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    NavigationModule,
    CommercialModule, // Module commercial avec archives
    SystemModule, // Nouveau module system avec monitoring
  ],
  providers: [LegacyUserService, LegacyOrderService],
  controllers: [UsersController, OrdersController],
  exports: [LegacyUserService, LegacyOrderService],
})
export class ApiModule {}
