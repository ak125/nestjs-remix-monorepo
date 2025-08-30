import { Injectable, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class SimpleJwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  private readonly logger = new Logger(SimpleJwtStrategy.name);

  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'test-secret-key-123',
    });
    
    console.log('🚀 SimpleJwtStrategy - CONSTRUCTEUR APPELÉ !');
    console.log('🔑 SimpleJwtStrategy - Secret:', process.env.JWT_SECRET ? 'JWT_SECRET défini' : 'test-secret-key-123');
    this.logger.log('✅ SimpleJwtStrategy créée avec succès');
  }

  async validate(payload: any) {
    this.logger.log(`🔍 SimpleJwtStrategy - validate appelé avec:`, JSON.stringify(payload, null, 2));
    
    // Validation simple pour tous les payloads valides
    if (payload && payload.sub) {
      const user = {
        id: payload.sub,
        email: payload.email || 'unknown@example.com',
        role: payload.role || 'user',
      };
      
      this.logger.log(`✅ SimpleJwtStrategy - Utilisateur validé:`, JSON.stringify(user, null, 2));
      return user;
    }
    
    this.logger.warn('❌ SimpleJwtStrategy - Validation échouée - payload invalide');
    return null;
  }
}
