import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { SupplierCardModule } from '../supplier-truth/supplier-card.module';
import { SuppliersService } from './suppliers.service';
import { SupplierCardService } from './supplier-card.service';
import { SuppliersController } from './suppliers.controller';
import { SuppliersModernController } from './suppliers-modern.controller';

@Module({
  imports: [DatabaseModule, SupplierCardModule],
  providers: [SuppliersService, SupplierCardService],
  controllers: [SuppliersController, SuppliersModernController],
  exports: [SuppliersService],
})
export class SuppliersModule {}
