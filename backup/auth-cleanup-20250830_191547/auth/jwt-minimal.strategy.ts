import { Injectable, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class JwtMinimalStrategy extends PassportStrategy(Strategy, 'jwt') {
  private readonly logger = new Logger(JwtMinimalStrategy.name);

  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'default-secret-key',
    });
    
    console.log('🚀 JwtMinimalStrategy - Constructeur appelé !');
    console.log('🔑 Secret utilisé:', process.env.JWT_SECRET ? 'JWT_SECRET' : 'default-secret-key');
    this.logger.log('✅ JwtMinimalStrategy initialisée');
  }

  async validate(payload: any) {
    console.log('🔍 JwtMinimalStrategy - validate() appelé !');
    console.log('📋 Payload reçu:', JSON.stringify(payload, null, 2));
    
    // Validation simple - accepter tout payload valide
    if (payload && payload.sub) {
      const user = {
        id: payload.sub,
        email: payload.email || 'unknown@example.com',
        role: payload.role || 'user',
      };
      
      console.log('✅ Utilisateur validé:', JSON.stringify(user, null, 2));
      this.logger.log(`✅ JWT validé avec succès pour utilisateur: ${user.id}`);
      return user;
    }
    
    console.log('❌ Validation échouée - payload invalide');
    this.logger.warn('❌ JWT validation échouée - payload invalide');
    return null;
  }
}
