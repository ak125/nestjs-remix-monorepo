import { Injectable, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class JwtCleanStrategy extends PassportStrategy(Strategy, 'jwt') {
  private readonly logger = new Logger(JwtCleanStrategy.name);

  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'fallback-secret-key',
    });
    
    console.log('🚀 JwtCleanStrategy - CONSTRUCTEUR APPELÉ !');
    console.log('🔑 JwtCleanStrategy - Secret:', process.env.JWT_SECRET ? 'JWT_SECRET configuré' : 'fallback utilisé');
    this.logger.log('✅ JwtCleanStrategy initialisée avec succès');
  }

  async validate(payload: any) {
    console.log('🔍 JwtCleanStrategy - VALIDATE APPELÉ !');
    console.log('🔍 JwtCleanStrategy - Payload:', JSON.stringify(payload, null, 2));
    
    // Validation simple basée sur le payload JWT
    if (payload && payload.sub) {
      const user = {
        id: payload.sub,
        email: payload.email || 'unknown@example.com',
        role: payload.role || 'user',
        level: payload.level || 1,
        isAuthenticated: true,
        authMethod: 'jwt',
      };
      
      console.log('✅ JwtCleanStrategy - Utilisateur validé avec succès:', JSON.stringify(user, null, 2));
      return user;
    }
    
    console.log('❌ JwtCleanStrategy - Validation échouée - payload invalide');
    return null;
  }
}
