import { Injectable } from '@nestjs/common';

@Injectable()
export class SimpleSystemService {
  getHealth() {
    return {
      status: 'OK',
      uptime: Math.floor(process.uptime()),
      memory: process.memoryUsage(),
      timestamp: new Date().toISOString(),
    };
  }

  getMetrics() {
    const memUsage = process.memoryUsage();
    return {
      memory: {
        used: memUsage.heapUsed,
        total: memUsage.heapTotal,
      },
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  }
}
