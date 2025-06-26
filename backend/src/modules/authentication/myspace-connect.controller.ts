/**
 * MCP GENERATED CONTROLLER
 * Généré automatiquement par MCP Context-7
 * Source: myspace.connect.php
 * Module: authentication
 */

import { Controller, Get, Post, Body, Param, Query, Session } from '@nestjs/common';
import { MyspaceConnectService } from './myspace-connect.service';
import { MyspaceConnectDto } from './dto/myspace-connect.dto';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('authentication')
@Controller('authentication/myspace-connect')
export class MyspaceConnectController {
  constructor(private readonly myspace-connectService: MyspaceConnectService) {}

  @Get()
  @ApiOperation({ summary: 'Get myspace-connect data' })
  @ApiResponse({ status: 200, description: 'myspace-connect data retrieved successfully' })
  async getIndex(@Session() session: any, @Query() query: any) {
    return this.myspace-connectService.getIndex(session, query);
  }

  @Post()
  @ApiOperation({ summary: 'Process myspace-connect form' })
  @ApiResponse({ status: 201, description: 'myspace-connect processed successfully' })
  async processForm(@Body() dto: MyspaceConnectDto, @Session() session: any) {
    return this.myspace-connectService.processForm(dto, session);
  }
}
