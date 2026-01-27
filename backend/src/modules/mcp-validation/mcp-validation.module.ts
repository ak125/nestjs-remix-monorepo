import {
  Module,
  Global,
  MiddlewareConsumer,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';

// Phase 6: Cache Layer
import { CacheModule } from '../../cache/cache.module';

// Phase 1: Shadow Mode
import { McpValidationService } from './mcp-validation.service';
import { McpShadowInterceptor } from './interceptors/mcp-shadow.interceptor';
import { RequestIdMiddleware } from './middleware/request-id.middleware';

// Phase 2: Verification Mode
import { McpVerifyInterceptor } from './interceptors/mcp-verify.interceptor';
import { McpQueryService } from './services/mcp-query.service';
import { McpAlertingService } from './services/mcp-alerting.service';

// Phase 5: External Compatibility Verification (Chrome DevTools scraping)
import { ChromeDevToolsClientService } from './services/chrome-devtools-client.service';
import { ExternalCompatibilityService } from './services/external-compatibility.service';

/**
 * MCP Validation Module - Phases 1-6
 *
 * Global module for MCP validation layer that prevents AI hallucinations
 * on critical data (compatibility, price, stock, references).
 *
 * Principle: L'IA NE CREE PAS LA VERITE (AI-COS Axiome Zero)
 * Rule: JAMAIS de blocage vente - redirection vers diagnostic
 *
 * Features:
 * - RequestIdMiddleware: Reliable request tracking (X-Request-ID)
 * - McpShadowInterceptor: Parallel validation without blocking (Phase 1)
 * - McpVerifyInterceptor: Synchronous verification with @McpVerify decorator (Phase 2-4)
 * - McpQueryService: Real MCP tool implementations
 * - McpAlertingService: High-severity mismatch alerts
 * - ExternalCompatibilityService: Chrome DevTools scraping (Phase 5)
 * - CacheService: Redis cache for external sources (Phase 6)
 *
 * Phase 1 (Shadow): Runs validation in parallel, logs discrepancies ✅
 * Phase 2 (Verification): Secondary check with warnings ✅
 * Phase 3 (Gatekeeper): Mandatory gate with fallbacks ✅
 * Phase 4 (Enforcement): Redirect to diagnostic if inconclusive ✅
 * Phase 5 (External): Chrome DevTools scraping of external sources ✅
 * Phase 6 (Aggregation): Weighted consensus + OEM cross-validation + Redis cache ✅
 *
 * Configuration:
 * - MCP_SHADOW_MODE=true|false (default: true)
 * - MCP_VERIFICATION_MODE=true|false (default: true)
 * - MCP_ENFORCEMENT_MODE=true|false (default: false)
 * - MCP_ALERT_WEBHOOK_URL=https://... (optional)
 * - EXTERNAL_SOURCES_ENABLED=partlink,catcar,partslink24 (Phase 5)
 * - EXTERNAL_SCRAPE_TIMEOUT=15000 (Phase 5)
 * - PARTSLINK24_ACCOUNT_ID/USERNAME/PASSWORD (Phase 5)
 */
@Global()
@Module({
  imports: [ConfigModule, CacheModule],
  providers: [
    // Core validation service
    McpValidationService,

    // Phase 2: Query and Alerting services
    McpQueryService,
    McpAlertingService,

    // Phase 5: External Compatibility (Chrome DevTools scraping)
    ChromeDevToolsClientService,
    ExternalCompatibilityService,

    // Phase 1: Shadow interceptor (runs MCP in parallel, no blocking)
    // Comment out to disable shadow mode entirely
    {
      provide: APP_INTERCEPTOR,
      useClass: McpShadowInterceptor,
    },

    // Phase 2: Verify interceptor (synchronous, for @McpVerify decorated endpoints)
    // This only affects endpoints with @McpVerify() decorator
    {
      provide: APP_INTERCEPTOR,
      useClass: McpVerifyInterceptor,
    },
  ],
  exports: [
    // Services available for injection
    McpValidationService,
    McpQueryService,
    McpAlertingService,

    // Phase 5: External sources
    ChromeDevToolsClientService,
    ExternalCompatibilityService,
  ],
})
export class McpValidationModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Apply RequestIdMiddleware to all routes
    consumer
      .apply(RequestIdMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
