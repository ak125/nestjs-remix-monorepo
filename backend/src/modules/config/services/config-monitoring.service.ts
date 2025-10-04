import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class ConfigMonitoringService {
  private readonly logger = new Logger(ConfigMonitoringService.name);
  private monitoringInterval: NodeJS.Timeout | null = null;

  async startMonitoring(): Promise<void> {
    this.logger.log('Démarrage du monitoring des configurations');
    
    // Monitor every 30 minutes
    this.monitoringInterval = setInterval(() => {
      this.performHealthCheck();
    }, 30 * 60 * 1000);
  }

  async stopMonitoring(): Promise<void> {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      this.logger.log('Arrêt du monitoring des configurations');
    }
  }

  private async performHealthCheck(): Promise<void> {
    try {
      // Check critical environment variables
      const criticalVars = ['NODE_ENV', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'JWT_SECRET'];
      const missing = criticalVars.filter(varName => !process.env[varName]);
      
      if (missing.length > 0) {
        this.logger.error(`Variables d'environnement manquantes: ${missing.join(', ')}`);
      } else {
        this.logger.debug('Health check des configurations réussi');
      }
    } catch (error) {
      this.logger.error('Erreur lors du health check des configurations', error);
    }
  }
}
