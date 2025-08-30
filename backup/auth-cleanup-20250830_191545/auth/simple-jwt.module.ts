import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { SimpleJwtStrategy } from './simple-jwt.strategy';
import { SimpleJwtController } from './simple-jwt.controller';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'test-secret-key-123',
      signOptions: { expiresIn: '1h' },
    }),
  ],
  controllers: [SimpleJwtController],
  providers: [SimpleJwtStrategy],
  exports: [JwtModule, SimpleJwtStrategy],
})
export class SimpleJwtModule {}
