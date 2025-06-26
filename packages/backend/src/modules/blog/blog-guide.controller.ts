/**
 * MCP GENERATED CONTROLLER
 * Généré automatiquement par MCP Context-7
 * Source: blog.guide.php
 * Module: blog
 */

import { Controller, Get, Post, Body, Param, Query, Session } from '@nestjs/common';
import { BlogGuideService } from './blog-guide.service';
import { BlogGuideDto } from './dto/blog-guide.dto';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('blog')
@Controller('blog/blog-guide')
export class BlogGuideController {
  constructor(private readonly blog-guideService: BlogGuideService) {}

  @Get()
  @ApiOperation({ summary: 'Get blog-guide data' })
  @ApiResponse({ status: 200, description: 'blog-guide data retrieved successfully' })
  async getIndex(@Session() session: any, @Query() query: any) {
    return this.blog-guideService.getIndex(session, query);
  }

  @Post()
  @ApiOperation({ summary: 'Process blog-guide form' })
  @ApiResponse({ status: 201, description: 'blog-guide processed successfully' })
  async processForm(@Body() dto: BlogGuideDto, @Session() session: any) {
    return this.blog-guideService.processForm(dto, session);
  }
}
