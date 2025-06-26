/**
 * MCP GENERATED CONTROLLER
 * Généré automatiquement par MCP Context-7
 * Source: blog.advice.php
 * Module: blog
 */

import { Controller, Get, Post, Body, Param, Query, Session } from '@nestjs/common';
import { BlogAdviceService } from './blog-advice.service';
import { BlogAdviceDto } from './dto/blog-advice.dto';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('blog')
@Controller('blog/blog-advice')
export class BlogAdviceController {
  constructor(private readonly blog-adviceService: BlogAdviceService) {}

  @Get()
  @ApiOperation({ summary: 'Get blog-advice data' })
  @ApiResponse({ status: 200, description: 'blog-advice data retrieved successfully' })
  async getIndex(@Session() session: any, @Query() query: any) {
    return this.blog-adviceService.getIndex(session, query);
  }

  @Post()
  @ApiOperation({ summary: 'Process blog-advice form' })
  @ApiResponse({ status: 201, description: 'blog-advice processed successfully' })
  async processForm(@Body() dto: BlogAdviceDto, @Session() session: any) {
    return this.blog-adviceService.processForm(dto, session);
  }
}
