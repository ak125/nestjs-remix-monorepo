/**
 * MCP GENERATED MODULE
 * Généré automatiquement par MCP Context-7
 * Module: blog
 */

import { Module } from '@nestjs/common';
import { BlogConstructeursController } from './blog-constructeurs.controller';
import { BlogConstructeursService } from './blog-constructeurs.service';

@Module({
  controllers: [BlogConstructeursController],
  providers: [BlogConstructeursService],
  exports: [BlogConstructeursService]
})
export class BlogConstructeursModule {}
