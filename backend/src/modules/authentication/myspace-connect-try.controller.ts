/**
 * MCP GENERATED CONTROLLER
 * Généré automatiquement par MCP Context-7
 * Source: myspace.connect.try.php
 * Module: authentication
 */

import { Controller, Get, Post, Body, Param, Query, Session } from '@nestjs/common';
import { MyspaceConnectTryService } from './myspace-connect-try.service';
import { MyspaceConnectTryDto } from './dto/myspace-connect-try.dto';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('authentication')
@Controller('authentication/myspace-connect-try')
export class MyspaceConnectTryController {
  constructor(private readonly myspace-connect-tryService: MyspaceConnectTryService) {}

  @Get()
  @ApiOperation({ summary: 'Get myspace-connect-try data' })
  @ApiResponse({ status: 200, description: 'myspace-connect-try data retrieved successfully' })
  async getIndex(@Session() session: any, @Query() query: any) {
    return this.myspace-connect-tryService.getIndex(session, query);
  }

  @Post()
  @ApiOperation({ summary: 'Process myspace-connect-try form' })
  @ApiResponse({ status: 201, description: 'myspace-connect-try processed successfully' })
  async processForm(@Body() dto: MyspaceConnectTryDto, @Session() session: any) {
    return this.myspace-connect-tryService.processForm(dto, session);
  }
}
