/**
 * MCP GENERATED CONTROLLER - RESELLER PROTECTED
 * Généré automatiquement par MCP Context-7
 * Module: reseller-ecommerce
 * Sécurité: REVENDEURS UNIQUEMENT
 * Source: massdoc/mycart.php
 */
import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { ResellerJwtGuard } from './guards/reseller-jwt.guard';
import { ResellerRole } from './decorators/reseller-role.decorator';
import { ResellerMycartShowService } from './reseller-mycart-show.service';
import { ResellerMycartShowDto } from './dto/reseller-mycart-show.dto';

@Controller('api/reseller/ecommerce/mycart')
@UseGuards(ResellerJwtGuard)
@ResellerRole('reseller', 'admin') // Seuls les revendeurs et admins
export class ResellerMycartShowController {
  constructor(private readonly service: ResellerMycartShowService) {}

  @Get('show')
  async showResellerCart(@Query() query: any) {
    return this.service.showResellerCart(query);
  }

  @Post('add')
  async addToResellerCart(@Body() dto: ResellerMycartShowDto) {
    return this.service.addToResellerCart(dto);
  }

  @Get('discounts')
  async getResellerDiscounts(@Query() query: any) {
    return this.service.getResellerDiscounts(query);
  }

  @Post('validate')
  async validateResellerCart(@Body() dto: ResellerMycartShowDto) {
    return this.service.validateResellerCart(dto);
  }
}
