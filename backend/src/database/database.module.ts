import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SupabaseRestService } from './supabase-rest.service';

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: SupabaseRestService,
      useFactory: (configService?: ConfigService) => {
        return new SupabaseRestService(configService);
      },
      inject: [ConfigService],
    },
  ],
  exports: [SupabaseRestService],
})
export class DatabaseModule {}
