/**
 * MCP GENERATED MODULE
 * Généré automatiquement par MCP Context-7
 * Module: blog
 */

import { Module } from '@nestjs/common';
import { BlogIndexController } from './blog-index.controller';
import { BlogIndexService } from './blog-index.service';

@Module({
  controllers: [BlogIndexController],
  providers: [BlogIndexService],
  exports: [BlogIndexService]
})
export class BlogIndexModule {}
