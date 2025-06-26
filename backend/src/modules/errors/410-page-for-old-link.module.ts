/**
 * MCP GENERATED MODULE
 * Généré automatiquement par MCP Context-7
 * Module: errors
 */

import { Module } from '@nestjs/common';
import { Page410ForOldLinkController } from './410-page-for-old-link.controller';
import { Page410ForOldLinkService } from './410-page-for-old-link.service';

@Module({
  controllers: [Page410ForOldLinkController],
  providers: [Page410ForOldLinkService],
  exports: [Page410ForOldLinkService]
})
export class Page410ForOldLinkModule {}
