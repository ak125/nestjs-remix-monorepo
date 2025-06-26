/**
 * MCP GENERATED CONTROLLER
 * Généré automatiquement par MCP Context-7
 * Source: meta.conf.php
 * Module: config
 */

import { Controller, Get, Post, Body, Param, Query, Session } from '@nestjs/common';
import { MetaConfigService } from './meta-config.service';
import { MetaConfigDto } from './dto/meta-config.dto';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('config')
@Controller('config/meta')
export class MetaConfigController {
  constructor(private readonly metaConfigService: MetaConfigService) {}

  @Get()
  @ApiOperation({ summary: 'Get meta config data' })
  @ApiResponse({ status: 200, description: 'Meta config data retrieved successfully' })
  async getIndex(@Session() session: any, @Query() query: any) {
    return this.metaConfigService.getIndex(session, query);
  }

  @Post()
  @ApiOperation({ summary: 'Process meta config form' })
  @ApiResponse({ status: 201, description: 'Meta config processed successfully' })
  async processForm(@Body() dto: MetaConfigDto, @Session() session: any) {
    return this.metaConfigService.processForm(dto, session);
  }
}
