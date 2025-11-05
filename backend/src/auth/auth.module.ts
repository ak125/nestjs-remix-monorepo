import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { DatabaseModule } from '../database/database.module';
import { CacheModule } from '../cache/cache.module';
import { UsersModule } from '../modules/users/users.module';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
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
    JwtModule.register({
      secret: process.env.SESSION_SECRET || 'default-secret-key',
      signOptions: { expiresIn: '24h' },
    }),
    DatabaseModule,
    CacheModule,
    UsersModule,
  ],
  controllers: [AuthController],
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
