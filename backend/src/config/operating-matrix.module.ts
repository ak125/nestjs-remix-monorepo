/**
 * OperatingMatrixModule — minimal NestJS context exposing OperatingMatrixService.
 *
 * Imported by:
 *   - WriteGuardModule (boot-log invariant — single source of truth for the
 *     "WriteGuard: role X owns N fields…" lines; cf. formatBootLog()).
 *
 * Reused by scripts/seo/dump-agent-matrix.ts in standalone mode (the CLI
 * bypasses NestJS DI and instantiates OperatingMatrixService directly with a
 * stub ConfigService — esbuild/tsx does not emit emitDecoratorMetadata).
 *
 * Why a dedicated lightweight module rather than embedding the provider in
 * WriteGuardModule directly:
 *   - The matrix is read-only by construction (registry × catalog × filesystem
 *     scan of .claude/agents). It deserves a context with zero infra deps so
 *     it can later be imported by AdminModule (REST endpoint) without dragging
 *     in WriteGuardModule's @Global Redis / ledger / feature-flag stack.
 *   - Plain `ConfigModule` (no forRoot/isGlobal) is sufficient: ConfigModule
 *     is already initialized at app root by AppModule, and a non-global
 *     re-import is idempotent. The CLI does not import this module so does
 *     not depend on the global config context.
 */

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { OperatingMatrixService } from './operating-matrix.service';

@Module({
  imports: [ConfigModule],
  providers: [OperatingMatrixService],
  exports: [OperatingMatrixService],
})
export class OperatingMatrixModule {}
