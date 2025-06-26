/**
 * MCP GENERATED CONTROLLER
 * Généré automatiquement par MCP Context-7
 * Source: products.car.gamme.fiche.php
 * Module: catalog
 */

import { Controller, Get, Post, Body, Param, Query, Session } from '@nestjs/common';
import { ProductsCarGammeFicheService } from './products-car-gamme-fiche.service';
import { ProductsCarGammeFicheDto } from './dto/products-car-gamme-fiche.dto';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('catalog')
@Controller('catalog/products-car-gamme-fiche')
export class ProductsCarGammeFicheController {
  constructor(private readonly products-car-gamme-ficheService: ProductsCarGammeFicheService) {}

  @Get()
  @ApiOperation({ summary: 'Get products-car-gamme-fiche data' })
  @ApiResponse({ status: 200, description: 'products-car-gamme-fiche data retrieved successfully' })
  async getIndex(@Session() session: any, @Query() query: any) {
    return this.products-car-gamme-ficheService.getIndex(session, query);
  }

  @Post()
  @ApiOperation({ summary: 'Process products-car-gamme-fiche form' })
  @ApiResponse({ status: 201, description: 'products-car-gamme-fiche processed successfully' })
  async processForm(@Body() dto: ProductsCarGammeFicheDto, @Session() session: any) {
    return this.products-car-gamme-ficheService.processForm(dto, session);
  }
}
