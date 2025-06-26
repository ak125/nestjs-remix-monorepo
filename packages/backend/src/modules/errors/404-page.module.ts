/**
 * MCP GENERATED MODULE
 * Généré automatiquement par MCP Context-7
 * Module: errors
 */

import { Module } from '@nestjs/common';
import { Page404Controller } from './404-page.controller';
import { Page404Service } from './404-page.service';

@Module({
  controllers: [Page404Controller],
  providers: [Page404Service],
  exports: [Page404Service]
})
export class Page404Module {}
