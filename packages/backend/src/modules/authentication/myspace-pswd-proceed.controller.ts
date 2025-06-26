/**
 * MCP GENERATED CONTROLLER
 * Généré automatiquement par MCP Context-7
 * Source: myspace.pswd.proceed.php
 * Module: authentication
 */

import { Controller, Get, Post, Body, Param, Query, Session } from '@nestjs/common';
import { MyspacePswdProceedService } from './myspace-pswd-proceed.service';
import { MyspacePswdProceedDto } from './dto/myspace-pswd-proceed.dto';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('authentication')
@Controller('authentication/myspace-pswd-proceed')
export class MyspacePswdProceedController {
  constructor(private readonly myspace-pswd-proceedService: MyspacePswdProceedService) {}

  @Get()
  @ApiOperation({ summary: 'Get myspace-pswd-proceed data' })
  @ApiResponse({ status: 200, description: 'myspace-pswd-proceed data retrieved successfully' })
  async getIndex(@Session() session: any, @Query() query: any) {
    return this.myspace-pswd-proceedService.getIndex(session, query);
  }

  @Post()
  @ApiOperation({ summary: 'Process myspace-pswd-proceed form' })
  @ApiResponse({ status: 201, description: 'myspace-pswd-proceed processed successfully' })
  async processForm(@Body() dto: MyspacePswdProceedDto, @Session() session: any) {
    return this.myspace-pswd-proceedService.processForm(dto, session);
  }
}
