import { Injectable, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'default-secret-key',
    });
    this.logger.log('🔐 JwtStrategy initialized with secret: ' + (process.env.JWT_SECRET ? 'JWT_SECRET' : 'default-secret-key'));
  }

  async validate(payload: any) {
    this.logger.log(`🔍 JWT validation called with payload: ${JSON.stringify(payload)}`);
    
    // Pour les tests, on accepte tout payload valide
    if (payload.sub) {
      const user = {
        id: payload.sub,
        email: payload.email || 'test@example.com',
        role: payload.role || 'user'
      };
      this.logger.log(`✅ JWT validated successfully for user: ${user.id}`);
      return user;
    }
    
    this.logger.warn('❌ JWT validation failed - no sub in payload');
    return null;
  }
}