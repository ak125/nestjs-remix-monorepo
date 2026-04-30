/**
 * OperatingMatrixModule — minimal NestJS context exposing OperatingMatrixService.
 *
 * Used by scripts/seo/dump-agent-matrix.ts via NestFactory.createApplicationContext.
 *
 * Why a dedicated lightweight module rather than reusing WriteGuardModule:
 *   - WriteGuardModule is `@Global` and pulls Redis, feature-flags and ledger
 *     services via OnModuleInit — booting from a CLI would require live env
 *     vars (REDIS_URL, SUPABASE_*) and risk runtime drift.
 *   - The matrix is read-only by construction (registry × catalog × filesystem
 *     scan of .claude/agents). It deserves a context with zero infra deps.
 *
 * Purely additive: this module is not imported anywhere in the live app today.
 * Wiring into AdminModule (for an admin endpoint) is a separate decision.
 */

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { OperatingMatrixService } from './operating-matrix.service';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true })],
  providers: [OperatingMatrixService],
  exports: [OperatingMatrixService],
})
export class OperatingMatrixModule {}
