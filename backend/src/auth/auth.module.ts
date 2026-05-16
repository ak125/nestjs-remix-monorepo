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
import { AdminSessionGuard } from './admin-session.guard';
import { CookieSerializer } from './cookie-serializer';
import { GithubOidcGuard } from './github-oidc.guard';
import { GithubOidcService } from './github-oidc.service';
import { IsAdminGuard } from './is-admin.guard';
import { LocalAuthGuard } from './local-auth.guard';
import { LocalStrategy } from './local.strategy';
import { PermissionsService } from './permissions.service';
import { PermissionsGuard } from './guards/permissions.guard';

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
    PermissionsService,
    PermissionsGuard,
    GithubOidcService,
    AdminSessionGuard,
    GithubOidcGuard,
  ],
  exports: [
    AuthService,
    PermissionsService,
    PermissionsGuard,
    GithubOidcService,
    AdminSessionGuard,
    GithubOidcGuard,
  ],
})
export class AuthModule {}
