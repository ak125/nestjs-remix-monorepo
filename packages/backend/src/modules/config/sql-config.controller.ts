/**
 * MCP GENERATED CONTROLLER
 * Généré automatiquement par MCP Context-7
 * Source: sql.conf.php
 * Module: core
 */

import { Controller, Get, Post, Body, Param, Query, Session } from '@nestjs/common';
import { SqlConfService } from './sql.conf.service';
import { SqlConfDto } from './dto/sql.conf.dto';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('core')
@Controller('core/sql.conf')
export class SqlConfController {
  constructor(private readonly SqlConfService: SqlConfService) {}

  @Get()
  @ApiOperation({ summary: 'Get sql.conf data' })
  @ApiResponse({ status: 200, description: 'sql.conf data retrieved successfully' })
  async getIndex(@Session() session: any, @Query() query: any) {
    return this.SqlConfService.getIndex(session, query);
  }

  @Post()
  @ApiOperation({ summary: 'Process sql.conf form' })
  @ApiResponse({ status: 201, description: 'sql.conf processed successfully' })
  async processForm(@Body() dto: SqlConfDto, @Session() session: any) {
    return this.SqlConfService.processForm(dto, session);
  }
}
