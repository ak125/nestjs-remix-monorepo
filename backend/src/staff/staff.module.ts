import { Module } from '@nestjs/common';
import { StaffController } from './staff.controller';
import { StaffAdminService } from './staff-admin-simple.service';
import { DatabaseModule } from '../database/database.module';
import { CacheModule } from '../cache/cache.module';

@Module({
  imports: [DatabaseModule, CacheModule],
  controllers: [StaffController],
  providers: [StaffAdminService],
  exports: [StaffAdminService],
})
export class StaffModule {}
