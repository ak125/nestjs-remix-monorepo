import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

// Services
import { LegacyUserService } from '../database/services/legacy-user.service';
import { LegacyOrderService } from '../database/services/legacy-order.service';

// Controllers
import { UsersController } from '../controllers/users.controller';
import { OrdersController } from '../controllers/orders.controller';

@Module({
  imports: [ConfigModule],
  providers: [LegacyUserService, LegacyOrderService],
  controllers: [UsersController, OrdersController],
  exports: [LegacyUserService, LegacyOrderService],
})
export class ApiModule {}
