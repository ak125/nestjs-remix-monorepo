/**
 * MCP GENERATED CONTROLLER
 * Généré automatiquement par MCP Context-7
 * Source: myspace.pswd.php
 * Module: authentication
 */

import { Controller, Get, Post, Body, Param, Query, Session } from '@nestjs/common';
import { MyspacePswdService } from './myspace-pswd.service';
import { MyspacePswdDto } from './dto/myspace-pswd.dto';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('authentication')
@Controller('authentication/myspace-pswd')
export class MyspacePswdController {
  constructor(private readonly myspace-pswdService: MyspacePswdService) {}

  @Get()
  @ApiOperation({ summary: 'Get myspace-pswd data' })
  @ApiResponse({ status: 200, description: 'myspace-pswd data retrieved successfully' })
  async getIndex(@Session() session: any, @Query() query: any) {
    return this.myspace-pswdService.getIndex(session, query);
  }

  @Post()
  @ApiOperation({ summary: 'Process myspace-pswd form' })
  @ApiResponse({ status: 201, description: 'myspace-pswd processed successfully' })
  async processForm(@Body() dto: MyspacePswdDto, @Session() session: any) {
    return this.myspace-pswdService.processForm(dto, session);
  }
}
