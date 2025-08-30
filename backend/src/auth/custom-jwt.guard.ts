import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class CustomJwtGuard implements CanActivate {
  private readonly logger = new Logger(CustomJwtGuard.name);

  constructor(private jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    
    this.logger.log(`🔒 CustomJwtGuard - Protection de: ${request.method} ${request.url}`);
    
    // Extraire le token de l'en-tête Authorization
    const token = this.extractTokenFromHeader(request);
    if (!token) {
      this.logger.warn('❌ Aucun token JWT trouvé dans Authorization header');
      throw new UnauthorizedException('Token JWT requis');
    }

    try {
      // Vérifier et décoder le token avec JwtService
      const payload = await this.jwtService.verifyAsync(token);
      
      this.logger.log(`✅ Token JWT validé pour utilisateur: ${payload.sub}`);
      
      // Créer l'objet utilisateur à partir du payload
      const user = {
        id: payload.sub,
        email: payload.email,
        role: payload.role,
        ...payload, // Inclure tous les autres champs du payload
      };
      
      // Attacher l'utilisateur à la requête (comme Passport le fait)
      request.user = user;
      
      return true;
    } catch (error) {
      this.logger.error(`❌ Token JWT invalide: ${(error as Error).message}`);
      throw new UnauthorizedException('Token JWT invalide ou expiré');
    }
  }

  private extractTokenFromHeader(request: any): string | undefined {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return undefined;
    }
    return authHeader.substring(7); // Retirer "Bearer "
  }
}
