/**
 * MCP GENERATED CONTROLLER
 * Généré automatiquement par MCP Context-7
 * Source: mycart.validate.php
 * Module: ecommerce
 */

import { Controller, Get, Post, Body, Param, Query, Session } from '@nestjs/common';
import { MycartValidateService } from './mycart-validate.service';
import { MycartValidateDto } from './dto/mycart-validate.dto';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('ecommerce')
@Controller('ecommerce/mycart-validate')
export class MycartValidateController {
  constructor(private readonly mycart-validateService: MycartValidateService) {}

  @Get()
  @ApiOperation({ summary: 'Get mycart-validate data' })
  @ApiResponse({ status: 200, description: 'mycart-validate data retrieved successfully' })
  async getIndex(@Session() session: any, @Query() query: any) {
    return this.mycart-validateService.getIndex(session, query);
  }

  @Post()
  @ApiOperation({ summary: 'Process mycart-validate form' })
  @ApiResponse({ status: 201, description: 'mycart-validate processed successfully' })
  async processForm(@Body() dto: MycartValidateDto, @Session() session: any) {
    return this.mycart-validateService.processForm(dto, session);
  }
}
