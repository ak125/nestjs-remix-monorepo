/**
 * MCP GENERATED CONTROLLER - RESELLER STOCK
 * Généré automatiquement par MCP Context-7
 * Module: reseller-stock
 * Sécurité: REVENDEURS UNIQUEMENT
 * Source: massdoc/gestion.stock.php
 */
import { Controller, Get, Post, Put, Body, Query, UseGuards, Param } from '@nestjs/common';
import { ResellerJwtGuard } from '../reseller-ecommerce/guards/reseller-jwt.guard';
import { ResellerRole, ResellerId } from '../reseller-ecommerce/decorators/reseller-role.decorator';
import { ResellerStockService } from './reseller-stock.service';
import { ResellerStockDto } from './dto/reseller-stock.dto';

@Controller('api/reseller/stock')
@UseGuards(ResellerJwtGuard)
@ResellerRole('reseller', 'admin') // Seuls les revendeurs et admins
export class ResellerStockController {
  constructor(private readonly service: ResellerStockService) {}

  @Get()
  async getResellerStock(@Query() query: any, @ResellerId() resellerId: string) {
    return this.service.getResellerStock({ ...query, resellerId });
  }

  @Get(':productId')
  async getProductStock(@Param('productId') productId: string, @ResellerId() resellerId: string) {
    return this.service.getProductStock(productId, resellerId);
  }

  @Post('reserve')
  async reserveStock(@Body() dto: ResellerStockDto, @ResellerId() resellerId: string) {
    return this.service.reserveStock({ ...dto, resellerId });
  }

  @Put('update')
  async updateStock(@Body() dto: ResellerStockDto, @ResellerId() resellerId: string) {
    return this.service.updateStock({ ...dto, resellerId });
  }

  @Get('movements/history')
  async getStockMovements(@Query() query: any, @ResellerId() resellerId: string) {
    return this.service.getStockMovements({ ...query, resellerId });
  }

  @Post('alert/threshold')
  async setStockAlert(@Body() dto: ResellerStockDto, @ResellerId() resellerId: string) {
    return this.service.setStockAlert({ ...dto, resellerId });
  }
}
