import { Controller, Get, Post, UseGuards, Request, Logger } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { JwtService } from '@nestjs/jwt';

@Controller('api/simple-jwt')
export class SimpleJwtController {
  private readonly logger = new Logger(SimpleJwtController.name);

  constructor(private jwtService: JwtService) {}

  @Post('create-token')
  async createToken() {
    const payload = { 
      sub: 'simple-test-123', 
      email: 'simple@test.com',
      role: 'admin' 
    };
    
    this.logger.log('🔑 Création d\'un token de test');
    const token = this.jwtService.sign(payload);
    
    return {
      success: true,
      token,
      payload,
      usage: `curl -H "Authorization: Bearer ${token}" http://localhost:3000/api/simple-jwt/protected`,
    };
  }

  @Get('protected')
  @UseGuards(AuthGuard('jwt'))
  async protectedEndpoint(@Request() req: any) {
    this.logger.log(`✅ Endpoint protégé accessible ! Utilisateur:`, JSON.stringify(req.user, null, 2));
    
    return {
      success: true,
      message: 'JWT Authentication FONCTIONNE !',
      user: req.user,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('health')
  async healthCheck() {
    return {
      status: 'OK',
      service: 'SimpleJwtController',
      timestamp: new Date().toISOString(),
      jwtSecretSet: !!process.env.JWT_SECRET,
    };
  }
}
