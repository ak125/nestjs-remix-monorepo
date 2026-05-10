/**
 * MarketingMatrixModule — exposes MarketingMatrixService to consumers
 * (admin governance controller, CLI dump scripts, brief validation DTO).
 *
 * Pattern miroir de operating-matrix.module.ts (ADR-025).
 */
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MarketingMatrixService } from './marketing-matrix.service';

@Module({
  imports: [ConfigModule],
  providers: [MarketingMatrixService],
  exports: [MarketingMatrixService],
})
export class MarketingMatrixModule {}
