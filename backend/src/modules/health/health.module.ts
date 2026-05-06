import { Module } from '@nestjs/common';
import { Controller, Get, NotFoundException } from '@nestjs/common';
import { Injectable } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { RpcGateService } from '@security/rpc-gate/rpc-gate.service';

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
  constructor(
    private readonly healthService: HealthService,
    private readonly rpcGateService: RpcGateService,
  ) {}

  @Get()
  getHealth() {
    return this.healthService.getHealth();
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
  controllers: [HealthController],
  providers: [HealthService],
  exports: [HealthService],
})
export class HealthModule {}
