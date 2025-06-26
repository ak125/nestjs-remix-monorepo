/**
 * MCP GENERATED MODULE
 * Généré automatiquement par MCP Context-7
 * Module: blog
 */

import { Module } from '@nestjs/common';
import { BlogGuideItemController } from './blog-guide-item.controller';
import { BlogGuideItemService } from './blog-guide-item.service';

@Module({
  controllers: [BlogGuideItemController],
  providers: [BlogGuideItemService],
  exports: [BlogGuideItemService]
})
export class BlogGuideItemModule {}
