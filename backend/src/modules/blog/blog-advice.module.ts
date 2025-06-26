/**
 * MCP GENERATED MODULE
 * Généré automatiquement par MCP Context-7
 * Module: blog
 */

import { Module } from '@nestjs/common';
import { BlogAdviceController } from './blog-advice.controller';
import { BlogAdviceService } from './blog-advice.service';

@Module({
  controllers: [BlogAdviceController],
  providers: [BlogAdviceService],
  exports: [BlogAdviceService]
})
export class BlogAdviceModule {}
