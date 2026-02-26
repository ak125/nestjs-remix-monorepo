import { Module, forwardRef } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { DatabaseModule } from '../database/database.module';
import { UsersModule } from '../modules/users/users.module';
import { AuthService } from './auth.service';
import { AuthLoginController } from './controllers/auth-login.controller';
import { AuthSessionController } from './controllers/auth-session.controller';
import { AuthPermissionsController } from './controllers/auth-permissions.controller';
import { AuthTokenController } from './controllers/auth-token.controller';
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
    JwtModule.register({
      secret: process.env.SESSION_SECRET || 'default-secret-key',
      signOptions: { expiresIn: '24h' },
    }),
    DatabaseModule,
    forwardRef(() => UsersModule),
  ],
  controllers: [
    AuthLoginController,
    AuthSessionController,
    AuthPermissionsController,
    AuthTokenController,
    ProfileController,
  ],
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
