/**
 * MCP GENERATED CONTROLLER
 * Généré automatiquement par MCP Context-7
 * Source: myspace.subscribe.php
 * Module: authentication
 */

import { Controller, Get, Post, Body, Param, Query, Session } from '@nestjs/common';
import { MyspaceSubscribeService } from './myspace-subscribe.service';
import { MyspaceSubscribeDto } from './dto/myspace-subscribe.dto';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('authentication')
@Controller('authentication/myspace-subscribe')
export class MyspaceSubscribeController {
  constructor(private readonly myspace-subscribeService: MyspaceSubscribeService) {}

  @Get()
  @ApiOperation({ summary: 'Get myspace-subscribe data' })
  @ApiResponse({ status: 200, description: 'myspace-subscribe data retrieved successfully' })
  async getIndex(@Session() session: any, @Query() query: any) {
    return this.myspace-subscribeService.getIndex(session, query);
  }

  @Post()
  @ApiOperation({ summary: 'Process myspace-subscribe form' })
  @ApiResponse({ status: 201, description: 'myspace-subscribe processed successfully' })
  async processForm(@Body() dto: MyspaceSubscribeDto, @Session() session: any) {
    return this.myspace-subscribeService.processForm(dto, session);
  }
}
