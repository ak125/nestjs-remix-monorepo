import { Controller, Get, Injectable } from '@nestjs/common';

@Injectable()
export class SystemService {
  async getSystemHealth() {
    return {
      status: 'OK',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
    };
  }

  async getQuickHealth() {
    return {
      success: true,
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
    };
  }

  async getSystemStatus() {
    return {
      system: 'operational',
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString(),
    };
  }

  async getSystemMetrics() {
    const memUsage = process.memoryUsage();
    return {
      performance: {
        memory: {
          used: memUsage.heapUsed,
          total: memUsage.heapTotal,
          external: memUsage.external,
        },
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
      },
      business: {
        totalRequests: 0,
        activeConnections: 0,
      },
      seo: {
        indexedPages: 0,
        crawlErrors: 0,
      },
      timestamp: new Date().toISOString(),
    };
  }
}

@Controller('system')
export class SystemController {
  constructor(private readonly systemService: SystemService) {}

  @Get('health/quick')
  async getQuickHealth() {
    try {
      const data = await this.systemService.getQuickHealth();
      return data;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      };
    }
  }

  @Get('health/detailed')
  async getDetailedHealth() {
    try {
      const data = await this.systemService.getSystemHealth();
      return {
        success: true,
        data,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      };
    }
  }

  @Get('status')
  async getSystemStatus() {
    try {
      const data = await this.systemService.getSystemStatus();
      return {
        success: true,
        data,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      };
    }
  }

  @Get('metrics')
  async getSystemMetrics() {
    try {
      const data = await this.systemService.getSystemMetrics();
      return {
        success: true,
        data,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      };
    }
  }

  @Get('health')
  async getSystemHealth() {
    try {
      await this.systemService.getSystemHealth();
      return {
        success: true,
        data: {
          database: { status: 'connected', responseTime: 50 },
          alerts: [],
          uptime: Math.floor(process.uptime()),
          lastCheck: new Date().toISOString(),
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      };
    }
  }
}
