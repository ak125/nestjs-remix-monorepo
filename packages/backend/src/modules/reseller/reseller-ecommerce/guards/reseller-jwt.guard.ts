/**
 * MCP GENERATED GUARD - RESELLER SECURITY
 * Généré automatiquement par MCP Context-7
 * Protection: REVENDEURS UNIQUEMENT
 * Source: massdoc security requirements
 */
import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class ResellerJwtGuard implements CanActivate {
  constructor(private jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const token = request.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      throw new ForbiddenException('Token d\'accès revendeur requis');
    }

    try {
      const payload = this.jwtService.verify(token, {
        secret: process.env.RESELLER_JWT_SECRET || process.env.JWT_SECRET
      });
      
      // Vérification spécifique revendeur
      if (payload.userType !== 'reseller' && payload.userType !== 'admin') {
        throw new ForbiddenException('Accès réservé aux revendeurs uniquement');
      }

      if (!payload.resellerId) {
        throw new ForbiddenException('ID revendeur manquant');
      }

      // Vérification statut revendeur actif
      if (payload.status !== 'active') {
        throw new ForbiddenException('Compte revendeur inactif');
      }

      // Validation des permissions massdoc
      if (!payload.permissions?.includes('massdoc:access')) {
        throw new ForbiddenException('Permissions massdoc insuffisantes');
      }

      request.user = payload;
      request.resellerId = payload.resellerId;
      return true;
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw error;
      }
      throw new ForbiddenException('Token revendeur invalide');
    }
  }
}

@Injectable()
export class MassdocAccessGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // Vérifications obligatoires massdoc
    const checks = [
      user?.userType === 'reseller' || user?.userType === 'admin',
      user?.resellerId && user.resellerId.length > 0,
      user?.permissions?.includes('massdoc:access'),
      user?.status === 'active'
    ];

    const isValid = checks.every(check => check === true);

    if (!isValid) {
      throw new ForbiddenException('Accès massdoc non autorisé - Revendeurs actifs uniquement');
    }

    return true;
  }
}
