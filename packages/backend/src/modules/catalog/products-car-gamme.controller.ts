/**
 * MCP GENERATED CONTROLLER
 * Généré automatiquement par MCP Context-7
 * Source: products.car.gamme.php
 * Module: catalog
 */

import { Controller, Get, Post, Body, Param, Query, Session } from '@nestjs/common';
import { ProductsCarGammeService } from './products-car-gamme.service';
import { ProductsCarGammeDto } from './dto/products-car-gamme.dto';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('catalog')
@Controller('catalog/products-car-gamme')
export class ProductsCarGammeController {
  constructor(private readonly products-car-gammeService: ProductsCarGammeService) {}

  @Get()
  @ApiOperation({ summary: 'Get products-car-gamme data' })
  @ApiResponse({ status: 200, description: 'products-car-gamme data retrieved successfully' })
  async getIndex(@Session() session: any, @Query() query: any) {
    return this.products-car-gammeService.getIndex(session, query);
  }

  @Post()
  @ApiOperation({ summary: 'Process products-car-gamme form' })
  @ApiResponse({ status: 201, description: 'products-car-gamme processed successfully' })
  async processForm(@Body() dto: ProductsCarGammeDto, @Session() session: any) {
    return this.products-car-gammeService.processForm(dto, session);
  }
}
