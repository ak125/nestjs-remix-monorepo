import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { DatabaseModule } from '../database/database.module';
import { CacheModule } from '../cache/cache.module';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { ProfileController } from './profile.controller';
import { CookieSerializer } from './cookie-serializer';
import { IsAdminGuard } from './is-admin.guard';
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
    CacheModule,
  ],
  controllers: [AuthController, ProfileController],
  providers: [
    AuthService,
    LocalStrategy,
    LocalAuthGuard,
    CookieSerializer,
    IsAdminGuard,
  ],
  exports: [AuthService],
})
export class AuthModule {}
