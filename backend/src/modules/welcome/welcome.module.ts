/**
 * MCP GENERATED MODULE
 * Généré selon standards enterprise MCP
 * Ne pas dupliquer - Améliorer par diff incrémental
 */

import { Module } from '@nestjs/common';
import { WelcomeController } from './welcome.controller';
import { WelcomeService } from './welcome.service';

@Module({
  controllers: [WelcomeController],
  providers: [WelcomeService],
  exports: [WelcomeService],
})
export class WelcomeModule {}
