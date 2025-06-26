/**
 * MCP GENERATED CONTROLLER
 * Généré automatiquement par MCP Context-7
 * Source: blog.global.header.section.php
 * Module: blog
 */

import { Controller, Get, Post, Body, Param, Query, Session } from '@nestjs/common';
import { BlogGlobalHeaderSectionService } from './blog-global-header-section.service';
import { BlogGlobalHeaderSectionDto } from './dto/blog-global-header-section.dto';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('blog')
@Controller('blog/blog-global-header-section')
export class BlogGlobalHeaderSectionController {
  constructor(private readonly blog-global-header-sectionService: BlogGlobalHeaderSectionService) {}

  @Get()
  @ApiOperation({ summary: 'Get blog-global-header-section data' })
  @ApiResponse({ status: 200, description: 'blog-global-header-section data retrieved successfully' })
  async getIndex(@Session() session: any, @Query() query: any) {
    return this.blog-global-header-sectionService.getIndex(session, query);
  }

  @Post()
  @ApiOperation({ summary: 'Process blog-global-header-section form' })
  @ApiResponse({ status: 201, description: 'blog-global-header-section processed successfully' })
  async processForm(@Body() dto: BlogGlobalHeaderSectionDto, @Session() session: any) {
    return this.blog-global-header-sectionService.processForm(dto, session);
  }
}
