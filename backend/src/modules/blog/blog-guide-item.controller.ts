/**
 * MCP GENERATED CONTROLLER
 * Généré automatiquement par MCP Context-7
 * Source: blog.guide.item.php
 * Module: blog
 */

import { Controller, Get, Post, Body, Param, Query, Session } from '@nestjs/common';
import { BlogGuideItemService } from './blog-guide-item.service';
import { BlogGuideItemDto } from './dto/blog-guide-item.dto';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('blog')
@Controller('blog/blog-guide-item')
export class BlogGuideItemController {
  constructor(private readonly blog-guide-itemService: BlogGuideItemService) {}

  @Get()
  @ApiOperation({ summary: 'Get blog-guide-item data' })
  @ApiResponse({ status: 200, description: 'blog-guide-item data retrieved successfully' })
  async getIndex(@Session() session: any, @Query() query: any) {
    return this.blog-guide-itemService.getIndex(session, query);
  }

  @Post()
  @ApiOperation({ summary: 'Process blog-guide-item form' })
  @ApiResponse({ status: 201, description: 'blog-guide-item processed successfully' })
  async processForm(@Body() dto: BlogGuideItemDto, @Session() session: any) {
    return this.blog-guide-itemService.processForm(dto, session);
  }
}
