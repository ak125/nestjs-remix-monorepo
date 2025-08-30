import { Module, Global, OnModuleInit, Logger } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DatabaseModule } from '../database/database.module';
import { CacheModule } from '../cache/cache.module';
import { UsersModule } from '../modules/users/users.module';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { ProfileController } from './profile.controller';
import { CookieSerializer } from './cookie-serializer';
import { IsAdminGuard } from './is-admin.guard';
import { LocalAuthGuard } from './local-auth.guard';
import { JwtAuthGuard } from './jwt-auth.guard';
import { LocalStrategy } from './local.strategy';
import { JwtStrategy } from './jwt.strategy';
// Nouveaux services améliorés
import { SessionService } from './services/session.service';
import { PermissionService } from './services/permission.service';
import { AccessLogService } from './services/access-log.service';

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    PassportModule.register({
      defaultStrategy: 'jwt',
      session: false,
    }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        const secret =
          configService.get<string>('JWT_SECRET') || 'default-secret-key';
        console.log(
          '🔑 JwtModule using secret:',
          secret ? 'JWT_SECRET from env' : 'default-secret-key',
        );
        return {
          secret: secret,
          signOptions: { expiresIn: '24h' },
        };
      },
    }),
    DatabaseModule,
    CacheModule,
    UsersModule,
  ],
  controllers: [
    AuthController,
    ProfileController,
  ],
  providers: [
    // Services existants
    AuthService,
    LocalStrategy,
    JwtStrategy,
    LocalAuthGuard,
    JwtAuthGuard,
    CookieSerializer,
    IsAdminGuard,
    // Nouveaux services
    SessionService,
    PermissionService,
    AccessLogService,
  ],
  exports: [
    AuthService,
    JwtAuthGuard,
    SessionService,
    PermissionService,
    AccessLogService,
    JwtModule,
  ],
})
export class AuthModule {}