import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { SuppliersService } from './suppliers.service';
import { SuppliersController } from './suppliers.controller';
import { SuppliersModernController } from './suppliers-modern.controller';

@Module({
  imports: [DatabaseModule],
  providers: [SuppliersService],
  controllers: [SuppliersController, SuppliersModernController],
  exports: [SuppliersService],
})
export class SuppliersModule {}
