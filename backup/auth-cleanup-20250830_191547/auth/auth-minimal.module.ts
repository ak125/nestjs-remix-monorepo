import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { JwtMinimalStrategy } from './jwt-minimal.strategy';
import { AuthMinimalController } from './auth-minimal.controller';
import { CustomJwtGuard } from './custom-jwt.guard';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'default-secret-key',
      signOptions: { expiresIn: '24h' },
    }),
  ],
  controllers: [AuthMinimalController],
  providers: [JwtMinimalStrategy, CustomJwtGuard],
  exports: [JwtModule, JwtMinimalStrategy, CustomJwtGuard],
})
export class AuthMinimalModule {
  constructor() {
    console.log('✅ AuthMinimalModule - Module minimal initialisé');
  }
}
