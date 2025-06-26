/**
 * MCP GENERATED MODULE
 * Généré automatiquement par MCP Context-7
 * Module: errors
 */

import { Module } from '@nestjs/common';
import { Page412Controller } from './412-page.controller';
import { Page412Service } from './412-page.service';

@Module({
  controllers: [Page412Controller],
  providers: [Page412Service],
  exports: [Page412Service]
})
export class Page412Module {}
