import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { DatabaseModule } from '../database/database.module';
import { AuthService } from './auth.service';
import { CookieSerializer } from './cookie-serializer';
import { LocalAuthGuard } from './local-auth.guard';
import { LocalStrategy } from './local.strategy';

@Module({
  imports: [
    PassportModule.register({
      defaultStrategy: 'local',
      property: 'user',
      session: true,
    }),
    DatabaseModule,
  ],
  controllers: [],
  providers: [
    LocalStrategy,
    LocalAuthGuard,
    CookieSerializer,
    AuthService,
  ],
  exports: [AuthService],
})
export class AuthModule {}
