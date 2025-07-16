import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RemixController } from './remix/remix.controller';
import { AuthController } from './auth/auth.controller';
import { AuthModule } from './auth/auth.module';
import { RemixModule } from './remix/remix.module';
import { DatabaseModule } from './database/database.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    DatabaseModule,
    AuthModule,
    RemixModule,
  ],
  controllers: [AuthController, RemixController],
  providers: [],
})
export class AppModule {}
