import { Controller, Get, Post, UseGuards, Request, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { JwtAuthGuard } from './jwt-auth.guard';

@Controller('api/jwt-test')
export class TestJwtController {
  private readonly logger = new Logger(TestJwtController.name);

  constructor(private jwtService: JwtService) {}

  @Post('generate')
  async generateToken() {
    const payload = { 
      sub: 'test-123', 
      email: 'test@example.com',
      role: 'admin' 
    };
    
    const secret = process.env.JWT_SECRET || 'default-secret-key';
    this.logger.log(`🔑 Generating token with secret: ${secret ? 'JWT_SECRET' : 'default'}`);
    
    const token = this.jwtService.sign(payload);
    
    return {
      success: true,
      token,
      payload,
      expiresIn: '24h'
    };
  }

  @Get('protected')
  @UseGuards(JwtAuthGuard)
  async protectedRoute(@Request() req: any) {
    this.logger.log(`✅ Protected route accessed by: ${JSON.stringify(req.user)}`);
    return {
      success: true,
      message: 'JWT authentication successful!',
      user: req.user
    };
  }

  @Get('verify-config')
  async verifyConfig() {
    return {
      JWT_SECRET_SET: !!process.env.JWT_SECRET,
      JWT_SECRET_VALUE: process.env.JWT_SECRET ? 'Hidden' : 'Not set',
      NODE_ENV: process.env.NODE_ENV,
      MODULE_STATUS: 'Loaded'
    };
  }
}