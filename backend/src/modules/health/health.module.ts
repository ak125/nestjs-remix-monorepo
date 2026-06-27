import { Module } from '@nestjs/common';
import {
  Controller,
  Get,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Injectable } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { RpcGateService } from '@security/rpc-gate/rpc-gate.service';
import { SessionInfrastructureModule } from '../session/session-infrastructure.module';
import { SessionStoreService } from '../session/session-store.service';

@Injectable()
export class HealthService {
  getHealth() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }
}

@SkipThrottle() // 🛡️ Health checks exemptés du rate limiting
@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(
    private readonly healthService: HealthService,
    private readonly rpcGateService: RpcGateService,
    private readonly sessionStore: SessionStoreService,
  ) {}

  /**
   * Liveness — ALWAYS 200, never Redis-dependent. This is the endpoint Docker
   * healthchecks hit (`wget http://localhost:3000/health`): a Redis blip must
   * NOT mark the container unhealthy and trigger a restart loop.
   */
  @Get()
  getHealth() {
    return this.healthService.getHealth();
  }

  /**
   * Readiness — 200/503. Synchronous connection-state check (no I/O). Returns
   * 503 if the session store is not connected. Diagnostic until a consumer
   * (deploy gate / upstream LB) queries it. No secret/URL leakage on failure.
   */
  @Get('ready')
  getReadiness() {
    const sessionStoreOpen = this.sessionStore.isOpen();
    if (!sessionStoreOpen) {
      throw new ServiceUnavailableException({
        status: 'not_ready',
        checks: { sessionStore: 'down' },
      });
    }
    return { status: 'ready', checks: { sessionStore: 'up' } };
  }

  /**
   * Active session-store probe — 200/503. Runs a bounded Redis PING via
   * SessionStoreService.healthCheck(). On failure logs the real error
   * server-side and returns a GENERIC 503 (no URL / creds / error string
   * leaked to the client).
   */
  @Get('session-store')
  async getSessionStoreHealth() {
    try {
      await this.sessionStore.healthCheck();
      return { status: 'ok' };
    } catch (err) {
      this.logger.error('Session-store health probe failed', err as Error);
      throw new ServiceUnavailableException({ status: 'unavailable' });
    }
  }

  /**
   * 🛡️ RPC Safety Gate metrics endpoint
   * Returns gate configuration and call statistics
   */
  @Get('rpc-gate')
  getRpcGateHealth() {
    return this.rpcGateService.getMetrics();
  }

  // Throws on demand to verify Sentry wiring end-to-end.
  // Disabled in production unless SENTRY_ALLOW_DEBUG_ENDPOINT=true to avoid
  // exposing a public 500 oracle. Returns 404 in PROD by default.
  @Get('sentry-debug')
  triggerSentryError() {
    if (
      process.env.NODE_ENV === 'production' &&
      process.env.SENTRY_ALLOW_DEBUG_ENDPOINT !== 'true'
    ) {
      throw new NotFoundException();
    }
    throw new Error(
      'Sentry test error — if you see this in Sentry Issues, wiring works.',
    );
  }
}

@Module({
  imports: [SessionInfrastructureModule],
  controllers: [HealthController],
  providers: [HealthService],
  exports: [HealthService],
})
export class HealthModule {}
