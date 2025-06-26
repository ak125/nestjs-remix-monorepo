/**
 * MCP GENERATED CONTROLLER
 * Généré automatiquement par MCP Context-7
 * Source: products.gamme.php
 * Module: catalog
 */

import { Controller, Get, Post, Body, Param, Query, Session } from '@nestjs/common';
import { ProductsGammeService } from './products-gamme.service';
import { ProductsGammeDto } from './dto/products-gamme.dto';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('catalog')
@Controller('catalog/products-gamme')
export class ProductsGammeController {
  constructor(private readonly products-gammeService: ProductsGammeService) {}

  @Get()
  @ApiOperation({ summary: 'Get products-gamme data' })
  @ApiResponse({ status: 200, description: 'products-gamme data retrieved successfully' })
  async getIndex(@Session() session: any, @Query() query: any) {
    return this.products-gammeService.getIndex(session, query);
  }

  @Post()
  @ApiOperation({ summary: 'Process products-gamme form' })
  @ApiResponse({ status: 201, description: 'products-gamme processed successfully' })
  async processForm(@Body() dto: ProductsGammeDto, @Session() session: any) {
    return this.products-gammeService.processForm(dto, session);
  }
}
