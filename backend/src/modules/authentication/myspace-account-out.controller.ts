/**
 * MCP GENERATED CONTROLLER
 * Généré automatiquement par MCP Context-7
 * Source: myspace.account.out.php
 * Module: authentication
 */

import { Controller, Get, Post, Body, Param, Query, Session } from '@nestjs/common';
import { MyspaceAccountOutService } from './myspace-account-out.service';
import { MyspaceAccountOutDto } from './dto/myspace-account-out.dto';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('authentication')
@Controller('authentication/myspace-account-out')
export class MyspaceAccountOutController {
  constructor(private readonly myspace-account-outService: MyspaceAccountOutService) {}

  @Get()
  @ApiOperation({ summary: 'Get myspace-account-out data' })
  @ApiResponse({ status: 200, description: 'myspace-account-out data retrieved successfully' })
  async getIndex(@Session() session: any, @Query() query: any) {
    return this.myspace-account-outService.getIndex(session, query);
  }

  @Post()
  @ApiOperation({ summary: 'Process myspace-account-out form' })
  @ApiResponse({ status: 201, description: 'myspace-account-out processed successfully' })
  async processForm(@Body() dto: MyspaceAccountOutDto, @Session() session: any) {
    return this.myspace-account-outService.processForm(dto, session);
  }
}
