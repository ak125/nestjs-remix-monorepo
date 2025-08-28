import { Controller, Get, UseGuards, Req } from '@nestjs/common';
import { AuthService } from '../auth.service';
import { ModulePermissionGuard, RequireModule } from '../guards/module-permission.guard';

@Controller('auth-demo')
export class AuthDemoController {
  constructor(private readonly authService: AuthService) {}

  /**
   * Test d'accès public (sans guard)
   */
  @Get('public')
  getPublic() {
    return {
      message: 'Accès public autorisé',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Test d'accès au module commercial
   */
  @Get('commercial')
  @UseGuards(ModulePermissionGuard)
  @RequireModule('commercial', 'read')
  async testCommercialAccess(@Req() request: any) {
    const userModules = await this.authService.getUserAccessibleModules(
      request.user?.id || 'demo-user',
    );
    
    return {
      message: 'Accès commercial autorisé',
      user: request.user?.email || 'Demo User',
      userLevel: request.user?.level || 5,
      accessibleModules: userModules,
    };
  }

  /**
   * Test d'accès au module admin
   */
  @Get('admin')
  @UseGuards(ModulePermissionGuard)
  @RequireModule('admin', 'read')
  async testAdminAccess(@Req() request: any) {
    return {
      message: 'Accès administrateur autorisé',
      user: request.user?.email || 'Demo User',
      userLevel: request.user?.level || 9,
      isAdmin: request.user?.isAdmin || true,
    };
  }

  /**
   * Test d'accès en écriture
   */
  @Get('commercial-write')
  @UseGuards(ModulePermissionGuard)
  @RequireModule('commercial', 'write')
  async testCommercialWrite(@Req() request: any) {
    return {
      message: 'Accès écriture commercial autorisé',
      user: request.user?.email || 'Demo User',
      action: 'write',
      requiredLevel: 3,
    };
  }

  /**
   * Test d'accès multiple avec condition complexe
   */
  @Get('expedition')
  @UseGuards(ModulePermissionGuard)
  @RequireModule('expedition', 'read')
  async testExpeditionAccess(@Req() request: any) {
    const sessionInfo = await this.authService.getSessionFromRequest(request);
    
    return {
      message: 'Accès expédition autorisé',
      sessionInfo,
      timestamp: new Date().toISOString(),
    };
  }
}
