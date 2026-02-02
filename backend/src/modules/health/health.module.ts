import { Module } from '@nestjs/common';
import { Controller, Get } from '@nestjs/common';
import { Injectable } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { RpcGateService } from '../../security/rpc-gate/rpc-gate.service';

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
}

@Module({
  controllers: [HealthController],
  providers: [HealthService],
  exports: [HealthService],
})
export class HealthModule {}
