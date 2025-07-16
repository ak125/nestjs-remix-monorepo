import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { AuthModule } from '../auth/auth.module';
import { RemixService } from './remix.service';

@Module({
  imports: [DatabaseModule, AuthModule],
  providers: [RemixService],
  exports: [RemixService],
})
export class RemixModule {}
