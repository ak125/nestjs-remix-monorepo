/**
 * MCP GENERATED MODULE
 * Généré automatiquement par MCP Context-7
 * Module: errors
 */

import { Module } from '@nestjs/common';
import { Page410Controller } from './410-page.controller';
import { Page410Service } from './410-page.service';

@Module({
  controllers: [Page410Controller],
  providers: [Page410Service],
  exports: [Page410Service]
})
export class Page410Module {}
