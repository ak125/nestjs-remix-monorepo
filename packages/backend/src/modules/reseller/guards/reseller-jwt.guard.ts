/**
 * MCP GENERATED GUARD - RESELLER SECURITY
 * Généré automatiquement par MCP Context-7
 * Protection: Accès massdoc revendeurs uniquement
 * Source: massdoc/get.access.php
 */
import { Injectable, CanActivate, ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '@/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ResellerJwtGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    private prisma: PrismaService,
    private configService: ConfigService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException('Token d\'accès revendeur requis');
    }

    try {
      // Vérification et décodage du JWT
      const payload = await this.jwtService.verifyAsync(token, {
        secret: this.configService.get<string>('RESELLER_JWT_SECRET')
      });
      
      // Vérification spécifique revendeur
      if (!this.isValidResellerPayload(payload)) {
        throw new ForbiddenException('Token revendeur invalide');
      }

      // Validation en temps réel du statut revendeur
      const resellerStatus = await this.validateResellerStatus(payload.resellerId);
      
      if (!resellerStatus.isValid) {
        throw new ForbiddenException(`Accès revendeur suspendu: ${resellerStatus.reason}`);
      }

      // Validation des restrictions IP (si configurée)
      if (this.configService.get<boolean>('ENABLE_IP_RESTRICTIONS')) {
        await this.validateIPRestrictions(request.ip, payload.territory);
      }

      // Injection des données utilisateur dans la requête
      request.user = {
        ...payload,
        resellerLevel: resellerStatus.level,
        permissions: resellerStatus.permissions
      };

      return true;
    } catch (error) {
      if (error instanceof ForbiddenException || error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Token revendeur invalide ou expiré');
    }
  }

  private extractTokenFromHeader(request: any): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }

  private isValidResellerPayload(payload: any): boolean {
    const requiredFields = ['sub', 'resellerId', 'userType'];
    const hasRequiredFields = requiredFields.every(field => payload[field]);
    
    const validUserTypes = ['reseller', 'admin', 'super_admin'];
    const hasValidUserType = validUserTypes.includes(payload.userType);
    
    const hasResellerId = payload.resellerId && payload.resellerId.length > 0;

    return hasRequiredFields && hasValidUserType && hasResellerId;
  }

  private async validateResellerStatus(resellerId: string) {
    try {
      const reseller = await this.prisma.reseller.findUnique({
        where: { id: resellerId },
        include: {
          account: true,
          permissions: true,
          territory: true
        }
      });

      if (!reseller) {
        return {
          isValid: false,
          reason: 'Revendeur non trouvé'
        };
      }

      if (!reseller.isActive) {
        return {
          isValid: false,
          reason: 'Compte revendeur désactivé'
        };
      }

      if (reseller.account?.status === 'suspended') {
        return {
          isValid: false,
          reason: 'Compte temporairement suspendu'
        };
      }

      if (reseller.account?.expirationDate && reseller.account.expirationDate < new Date()) {
        return {
          isValid: false,
          reason: 'Compte revendeur expiré'
        };
      }

      return {
        isValid: true,
        level: reseller.level || 'standard',
        permissions: reseller.permissions?.map(p => p.name) || [],
        territory: reseller.territory?.code
      };
    } catch (error) {
      return {
        isValid: false,
        reason: 'Erreur de validation du statut'
      };
    }
  }

  private async validateIPRestrictions(clientIP: string, territory?: string): Promise<void> {
    if (!territory || !clientIP) {
      return; // Pas de restrictions si pas de territoire défini
    }

    try {
      // Vérification des IP autorisées pour ce territoire
      const allowedIPs = await this.prisma.territoryIPRestriction.findMany({
        where: {
          territoryCode: territory,
          isActive: true
        }
      });

      if (allowedIPs.length === 0) {
        return; // Pas de restrictions IP configurées
      }

      const isIPAllowed = allowedIPs.some(restriction => 
        this.isIPInRange(clientIP, restriction.ipRange)
      );

      if (!isIPAllowed) {
        throw new ForbiddenException(`Accès depuis cette adresse IP non autorisé pour le territoire ${territory}`);
      }
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw error;
      }
      // En cas d'erreur de validation IP, on laisse passer (fail-open)
      console.warn('Erreur validation IP:', error.message);
    }
  }

  private isIPInRange(ip: string, range: string): boolean {
    // Implémentation simple pour les ranges IP
    // En production, utiliser une librairie spécialisée comme 'ip-range-check'
    if (range.includes('/')) {
      // CIDR notation
      return this.isIPInCIDR(ip, range);
    } else if (range.includes('-')) {
      // IP range (ex: 192.168.1.1-192.168.1.100)
      return this.isIPInIPRange(ip, range);
    } else {
      // IP exacte
      return ip === range;
    }
  }

  private isIPInCIDR(ip: string, cidr: string): boolean {
    // Implémentation basique CIDR
    // En production, utiliser une librairie spécialisée
    const [network, prefixLength] = cidr.split('/');
    // Logique de vérification CIDR...
    return true; // Placeholder
  }

  private isIPInIPRange(ip: string, range: string): boolean {
    // Implémentation basique range IP
    const [startIP, endIP] = range.split('-');
    // Logique de vérification range...
    return true; // Placeholder
  }
}

@Injectable()
export class MassdocAccessGuard implements CanActivate {
  constructor(
    private prisma: PrismaService,
    private configService: ConfigService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException('Utilisateur non authentifié');
    }

    // Vérifications spécifiques massdoc
    const massdocChecks = [
      this.checkUserType(user),
      this.checkResellerPermissions(user),
      await this.checkMassdocAccess(user.resellerId),
      this.checkSessionLimits(user)
    ];

    const failedChecks = massdocChecks.filter(check => !check.valid);
    
    if (failedChecks.length > 0) {
      const reasons = failedChecks.map(check => check.reason).join(', ');
      throw new ForbiddenException(`Accès massdoc refusé: ${reasons}`);
    }

    // Log d'accès pour audit
    await this.logMassdocAccess(user, request);

    return true;
  }

  private checkUserType(user: any) {
    const validTypes = ['reseller', 'admin', 'super_admin'];
    return {
      valid: validTypes.includes(user.userType),
      reason: 'Type d\'utilisateur non autorisé pour massdoc'
    };
  }

  private checkResellerPermissions(user: any) {
    const requiredPermissions = ['massdoc:access', 'reseller:cart'];
    const hasPermissions = requiredPermissions.every(perm => 
      user.permissions?.includes(perm)
    );
    
    return {
      valid: hasPermissions,
      reason: 'Permissions massdoc insuffisantes'
    };
  }

  private async checkMassdocAccess(resellerId: string) {
    try {
      const access = await this.prisma.resellerMassdocAccess.findUnique({
        where: { resellerId }
      });

      return {
        valid: access?.isEnabled === true,
        reason: 'Accès massdoc non activé pour ce revendeur'
      };
    } catch (error) {
      return {
        valid: false,
        reason: 'Erreur vérification accès massdoc'
      };
    }
  }

  private checkSessionLimits(user: any) {
    // Vérification des limites de session simultanées
    const maxSessions = this.configService.get<number>('MAX_RESELLER_SESSIONS') || 3;
    
    // En production, vérifier en base les sessions actives
    return {
      valid: true, // Placeholder
      reason: 'Limite de sessions simultanées dépassée'
    };
  }

  private async logMassdocAccess(user: any, request: any) {
    try {
      await this.prisma.massdocAccessLog.create({
        data: {
          resellerId: user.resellerId,
          action: 'massdoc_access',
          endpoint: request.url,
          method: request.method,
          ip: request.ip,
          userAgent: request.headers['user-agent'],
          timestamp: new Date()
        }
      });
    } catch (error) {
      console.warn('Erreur log massdoc access:', error.message);
    }
  }
}
