import { Controller, Get, Post, UseGuards, Request, Logger, Body } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthGuard } from '@nestjs/passport';

@Controller('api/auth-clean')
export class AuthCleanTestController {
  private readonly logger = new Logger(AuthCleanTestController.name);

  constructor(private jwtService: JwtService) {}

  @Post('test/generate-token')
  async generateToken(@Body() payload?: any) {
    const tokenPayload = payload || { 
      sub: 'clean-test-user-456', 
      email: 'clean@test.com',
      role: 'admin',
      level: 9,
    };
    
    this.logger.log('🔑 AuthCleanModule - Génération token de test');
    const token = this.jwtService.sign(tokenPayload);
    
    return {
      success: true,
      token,
      payload: tokenPayload,
      message: 'Token généré par AuthCleanModule',
      usage: `curl -H "Authorization: Bearer ${token}" http://localhost:3000/api/auth-clean/test/protected`,
    };
  }

  @Get('test/protected')
  @UseGuards(AuthGuard('jwt'))
  async protectedEndpoint(@Request() req: any) {
    this.logger.log('✅ AuthCleanModule - Endpoint protégé accessible !');
    
    return {
      success: true,
      message: '🎉 AuthCleanModule + JWT Strategy FONCTIONNE !',
      user: req.user,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('test/status')
  async getStatus() {
    return {
      status: 'READY',
      module: 'AuthCleanModule',
      jwtConfigured: !!process.env.JWT_SECRET,
      timestamp: new Date().toISOString(),
    };
  }
}
