/**
 * MCP GENERATED CONTROLLER
 * Généré automatiquement par MCP Context-7
 * Source: blog.index.php
 * Module: blog
 */

import { Controller, Get, Post, Body, Param, Query, Session } from '@nestjs/common';
import { BlogIndexService } from './blog-index.service';
import { BlogIndexDto } from './dto/blog-index.dto';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('blog')
@Controller('blog/blog-index')
export class BlogIndexController {
  constructor(private readonly blog-indexService: BlogIndexService) {}

  @Get()
  @ApiOperation({ summary: 'Get blog-index data' })
  @ApiResponse({ status: 200, description: 'blog-index data retrieved successfully' })
  async getIndex(@Session() session: any, @Query() query: any) {
    return this.blog-indexService.getIndex(session, query);
  }

  @Post()
  @ApiOperation({ summary: 'Process blog-index form' })
  @ApiResponse({ status: 201, description: 'blog-index processed successfully' })
  async processForm(@Body() dto: BlogIndexDto, @Session() session: any) {
    return this.blog-indexService.processForm(dto, session);
  }
}
