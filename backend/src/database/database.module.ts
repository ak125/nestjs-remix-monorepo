import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SupabaseRestService } from './supabase-rest.service';

@Module({
  imports: [ConfigModule],
  providers: [SupabaseRestService],
  exports: [SupabaseRestService],
})
export class DatabaseModule {}
