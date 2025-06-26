/**
 * MCP GENERATED MODULE
 * Généré automatiquement par MCP Context-7
 * Module: blog
 */

import { Module } from '@nestjs/common';
import { BlogGuideController } from './blog-guide.controller';
import { BlogGuideService } from './blog-guide.service';

@Module({
  controllers: [BlogGuideController],
  providers: [BlogGuideService],
  exports: [BlogGuideService]
})
export class BlogGuideModule {}
