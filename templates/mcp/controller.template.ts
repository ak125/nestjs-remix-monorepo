/**
 * MCP GENERATED CONTROLLER
 * Généré automatiquement par MCP Context-7
 * Module: {{MODULE_NAME}}
 */

import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { {{SERVICE_NAME}} } from './{{FILE_NAME}}.service';
import { {{DTO_NAME}} } from './dto/{{FILE_NAME}}.dto';

@Controller('{{ROUTE_PREFIX}}')
export class {{CONTROLLER_NAME}} {
  constructor(private readonly service: {{SERVICE_NAME}}) {}

  @Get()
  async findAll(@Query() query: any) {
    return this.service.findAll(query);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  async create(@Body() dto: {{DTO_NAME}}) {
    return this.service.create(dto);
  }
}
