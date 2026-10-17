import { Controller, Get, Injectable, Logger } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { SystemService } from './services/system.service';

@Injectable()
export class SystemHealthService {
  getQuickHealth() {
    return {
      success: true,
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
    };
  }

  getSystemMetrics() {
    const memUsage = process.memoryUsage();
    return {
      success: true,
      data: {
        memory: {
          used: memUsage.heapUsed,
          total: memUsage.heapTotal,
        },
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development',
      },
      timestamp: new Date().toISOString(),
    };
  }
}

@SkipThrottle() // 🛡️ Health checks exemptés du rate limiting
@Controller('api/system')
export class SystemHealthController {
  private readonly logger = new Logger(SystemHealthController.name);

  constructor(
    private readonly systemHealthService: SystemHealthService,
    private readonly systemService: SystemService, // Service avancé
  ) {}

  @Get('health')
  async getHealth() {
    this.logger.log('🏥 Health check demandé');
    try {
      const result = this.systemHealthService.getQuickHealth();
      this.logger.log('✅ Health check réussi');
      return result;
    } catch (error) {
      this.logger.error('❌ Health check échoué', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      };
    }
  }

  @Get('metrics')
  async getMetrics() {
    this.logger.log('📊 Métriques système demandées');
    try {
      const result = this.systemHealthService.getSystemMetrics();
      this.logger.log('✅ Métriques récupérées');
      return result;
    } catch (error) {
      this.logger.error('❌ Erreur métriques', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      };
    }
  }

  // 🚀 Nouveaux endpoints avancés utilisant le SystemService existant

  @Get('status')
  async getSystemStatus() {
    this.logger.log('🎯 System status demandé (avancé)');
    try {
      const result = await this.systemService.getSystemStatus();
      this.logger.log('✅ System status récupéré', {
        overall: result.overall,
        alertsCount: result.alerts.length,
      });
      return {
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('❌ Erreur system status', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      };
    }
  }

  @Get('insights')
  async getSystemInsights() {
    this.logger.log('🧠 System insights demandés');
    try {
      const result = await this.systemService.getSystemInsights();
      this.logger.log('✅ System insights générés', {
        recommendationsCount: result.recommendations.length,
      });
      return {
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('❌ Erreur system insights', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      };
    }
  }

  @Get('dashboard')
  async getSystemDashboard() {
    this.logger.log('📈 System dashboard demandé');
    try {
      const [status, insights] = await Promise.all([
        this.systemService.getSystemStatus(),
        this.systemService.getSystemInsights(),
      ]);

      const dashboardData = {
        system: status,
        insights,
        quick: this.systemHealthService.getQuickHealth(),
        metrics: this.systemHealthService.getSystemMetrics(),
        recommendations: insights.recommendations.slice(0, 5),
      };

      this.logger.log('✅ System dashboard généré');
      return {
        success: true,
        data: dashboardData,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('❌ Erreur system dashboard', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      };
    }
  }
}
