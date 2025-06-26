/**
 * MCP GENERATED CONTROLLER
 * Généré automatiquement par MCP Context-7
 * Source: blog.constructeurs.php
 * Module: blog
 */

import { Controller, Get, Post, Body, Param, Query, Session } from '@nestjs/common';
import { BlogConstructeursService } from './blog-constructeurs.service';
import { BlogConstructeursDto } from './dto/blog-constructeurs.dto';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('blog')
@Controller('blog/blog-constructeurs')
export class BlogConstructeursController {
  constructor(private readonly blog-constructeursService: BlogConstructeursService) {}

  @Get()
  @ApiOperation({ summary: 'Get blog-constructeurs data' })
  @ApiResponse({ status: 200, description: 'blog-constructeurs data retrieved successfully' })
  async getIndex(@Session() session: any, @Query() query: any) {
    return this.blog-constructeursService.getIndex(session, query);
  }

  @Post()
  @ApiOperation({ summary: 'Process blog-constructeurs form' })
  @ApiResponse({ status: 201, description: 'blog-constructeurs processed successfully' })
  async processForm(@Body() dto: BlogConstructeursDto, @Session() session: any) {
    return this.blog-constructeursService.processForm(dto, session);
  }
}
