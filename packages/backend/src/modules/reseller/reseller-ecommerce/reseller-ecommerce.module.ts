/**
 * MCP GENERATED MODULE - RESELLER ECOMMERCE
 * Généré automatiquement par MCP Context-7
 * Module: reseller-ecommerce
 * Sécurité: REVENDEURS UNIQUEMENT
 * Source: massdoc/mycart.php
 */
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ResellerMycartShowController } from './reseller-mycart-show.controller';
import { ResellerMycartShowService } from './reseller-mycart-show.service';
import { ResellerJwtGuard, MassdocAccessGuard } from './guards/reseller-jwt.guard';
import { PrismaModule } from '@/prisma/prisma.module';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.RESELLER_JWT_SECRET || process.env.JWT_SECRET,
      signOptions: { 
        expiresIn: process.env.RESELLER_SESSION_DURATION || '8h',
        issuer: 'mcp-context-7-reseller'
      },
    }),
    PrismaModule,
  ],
  controllers: [ResellerMycartShowController],
  providers: [
    ResellerMycartShowService,
    ResellerJwtGuard,
    MassdocAccessGuard,
  ],
  exports: [
    ResellerMycartShowService,
    ResellerJwtGuard,
    MassdocAccessGuard,
  ],
})
export class ResellerEcommerceModule {}
