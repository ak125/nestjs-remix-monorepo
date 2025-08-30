import { Controller, Post, Get, Body, UseGuards, Req, Param } from '@nestjs/common';
import { EnhancedAuthService, AccessRequest } from './enhanced-auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';

@Controller('enhanced-auth')
export class EnhancedAuthController {
  constructor(private readonly enhancedAuthService: EnhancedAuthService) {}

  /**
   * POST /enhanced-auth/check-access
   * Vérifier l'accès à une ressource avec logging complet
   */
  @Post('check-access')
  async checkAccess(@Body() request: AccessRequest) {
    return this.enhancedAuthService.checkAccess(request);
  }

  /**
   * POST /enhanced-auth/check-permission
   * Vérifier une permission spécifique
   */
  @Post('check-permission')
  async checkPermission(
    @Body() dto: { userId: string; resource: string; action?: string },
  ) {
    return this.enhancedAuthService.checkPermission(
      dto.userId,
      dto.resource,
      dto.action || 'read',
    );
  }

  /**
   * GET /enhanced-auth/user-stats/:userId
   * Statistiques d'accès pour un utilisateur
   */
  @UseGuards(JwtAuthGuard)
  @Get('user-stats/:userId')
  async getUserStats(@Param('userId') userId: string) {
    return this.enhancedAuthService.getUserAccessStats(userId);
  }

  /**
   * GET /enhanced-auth/suspicious-activity
   * Détecter une activité suspecte
   */
  @UseGuards(JwtAuthGuard)
  @Get('suspicious-activity')
  async getSuspiciousActivity() {
    return this.enhancedAuthService.detectSuspiciousActivity();
  }

  /**
   * POST /enhanced-auth/logout
   * Déconnexion améliorée avec logging
   */
  @UseGuards(JwtAuthGuard)
  @Post('logout')
  async logout(@Req() request: any) {
    const userId = request.user?.id;
    const sessionId = request.sessionId;

    await this.enhancedAuthService.logout(userId, sessionId);
    
    return { success: true, message: 'Déconnexion réussie' };
  }

  /**
   * POST /enhanced-auth/create-access-token
   * Créer un token d'accès avec logging
   */
  @Post('create-access-token')
  async createAccessToken(@Body() dto: { userId: string; sessionId: string }) {
    const token = await this.enhancedAuthService.createAccessToken(
      dto.userId,
      dto.sessionId,
    );
    
    return { token, expiresIn: '24h' };
  }

  /**
   * POST /enhanced-auth/validate-access-token
   * Valider un token d'accès avec vérification de session
   */
  @Post('validate-access-token')
  async validateAccessToken(@Body() dto: { token: string }) {
    try {
      const payload = await this.enhancedAuthService.validateAccessToken(dto.token);
      return { valid: true, payload };
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }
}
