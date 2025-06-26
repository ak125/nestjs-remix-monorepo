/**
 * MCP GENERATED MODULE
 * Généré automatiquement par MCP Context-7
 * Module: blog
 */

import { Module } from '@nestjs/common';
import { BlogGlobalHeaderSectionController } from './blog-global-header-section.controller';
import { BlogGlobalHeaderSectionService } from './blog-global-header-section.service';

@Module({
  controllers: [BlogGlobalHeaderSectionController],
  providers: [BlogGlobalHeaderSectionService],
  exports: [BlogGlobalHeaderSectionService]
})
export class BlogGlobalHeaderSectionModule {}
