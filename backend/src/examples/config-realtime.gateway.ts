import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable, Logger, UseGuards } from '@nestjs/common';
import { EnhancedConfigService } from '../modules/config/services/enhanced-config.service';
import { ConfigAnalyticsService } from '../modules/config/services/config-analytics.service';
import { ConfigValidationService } from '../modules/config/services/config-validation.service';

/**
 * 🔄 Gateway WebSocket pour configuration en temps réel
 */
@WebSocketGateway({
  namespace: '/config',
  cors: {
    origin: '*',
  },
})
@Injectable()
export class ConfigRealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ConfigRealtimeGateway.name);
  private connectedClients = new Map<string, Socket>();

  constructor(
    private readonly configService: EnhancedConfigService,
    private readonly analyticsService: ConfigAnalyticsService,
    private readonly validationService: ConfigValidationService,
  ) {}

  async handleConnection(client: Socket) {
    this.connectedClients.set(client.id, client);
    this.logger.log(`🔌 Client connecté: ${client.id}`);

    // Envoyer les configurations initiales
    await this.sendInitialConfigs(client);

    // Tracker la connexion
    await this.analyticsService.trackConfigEvent({
      type: 'config_access',
      category: 'websocket',
      action: 'client_connected',
      label: client.id,
      metadata: {
        clientId: client.id,
        timestamp: new Date().toISOString(),
      },
    });
  }

  handleDisconnect(client: Socket) {
    this.connectedClients.delete(client.id);
    this.logger.log(`🔌 Client déconnecté: ${client.id}`);
  }

  /**
   * 📡 Envoyer les configurations initiales au client
   */
  private async sendInitialConfigs(client: Socket) {
    try {
      // Configurations publiques
      const publicConfigs = await this.configService.getAll({ publicOnly: true });
      
      // Configurations UI
      const uiConfigs = await this.configService.getByCategory('ui');
      
      // Features activées
      const features = await this.configService.getByCategory('features');

      client.emit('config:initial', {
        public: publicConfigs,
        ui: uiConfigs,
        features: features,
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      this.logger.error('❌ Erreur lors de l\'envoi des configs initiales:', error);
      client.emit('config:error', {
        message: 'Erreur lors du chargement des configurations',
        error: error.message,
      });
    }
  }

  /**
   * 🔍 S'abonner aux changements d'une configuration
   */
  @SubscribeMessage('config:subscribe')
  async handleSubscribeToConfig(
    @MessageBody() data: { key: string },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const { key } = data;

      // Valider la clé
      const keyValidation = this.validationService.validateConfigKey(key);
      if (!keyValidation.isValid) {
        client.emit('config:error', {
          message: 'Clé de configuration invalide',
          errors: keyValidation.errors,
        });
        return;
      }

      // Ajouter le client à la room de cette configuration
      client.join(`config:${key}`);

      // Envoyer la valeur actuelle
      const currentValue = await this.configService.get(key);
      client.emit('config:subscribed', {
        key,
        value: currentValue,
        timestamp: new Date().toISOString(),
      });

      // Tracker l'abonnement
      await this.analyticsService.trackConfigEvent({
        type: 'config_access',
        category: 'websocket',
        action: 'config_subscribed',
        label: key,
        metadata: {
          clientId: client.id,
          configKey: key,
        },
      });

      this.logger.log(`📡 Client ${client.id} abonné à ${key}`);

    } catch (error) {
      client.emit('config:error', {
        message: 'Erreur lors de l\'abonnement',
        error: error.message,
      });
    }
  }

  /**
   * ❌ Se désabonner des changements d'une configuration
   */
  @SubscribeMessage('config:unsubscribe')
  async handleUnsubscribeFromConfig(
    @MessageBody() data: { key: string },
    @ConnectedSocket() client: Socket,
  ) {
    const { key } = data;
    client.leave(`config:${key}`);
    
    client.emit('config:unsubscribed', {
      key,
      timestamp: new Date().toISOString(),
    });

    this.logger.log(`📡 Client ${client.id} désabonné de ${key}`);
  }

  /**
   * 🔄 Mettre à jour une configuration en temps réel
   */
  @SubscribeMessage('config:update')
  async handleUpdateConfig(
    @MessageBody() data: { key: string; value: any; userId?: string },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const { key, value, userId } = data;

      // Validation des permissions (à implémenter selon vos besoins)
      const canUpdate = await this.checkUpdatePermissions(client, key);
      if (!canUpdate) {
        client.emit('config:error', {
          message: 'Permissions insuffisantes pour modifier cette configuration',
          key,
        });
        return;
      }

      // Mettre à jour la configuration
      const updatedConfig = await this.configService.update(key, { value });

      // Notifier tous les clients abonnés à cette configuration
      this.server.to(`config:${key}`).emit('config:updated', {
        key,
        value,
        previousValue: updatedConfig.value, // À ajuster selon votre implémentation
        updatedBy: userId || client.id,
        timestamp: new Date().toISOString(),
      });

      // Tracker la mise à jour en temps réel
      await this.analyticsService.trackConfigEvent({
        type: 'config_change',
        category: 'websocket',
        action: 'realtime_update',
        label: key,
        userId: userId || client.id,
        metadata: {
          clientId: client.id,
          configKey: key,
          newValue: value,
          updateMethod: 'websocket',
        },
      });

      this.logger.log(`🔄 Configuration ${key} mise à jour via WebSocket par ${client.id}`);

    } catch (error) {
      client.emit('config:error', {
        message: 'Erreur lors de la mise à jour',
        error: error.message,
        key: data.key,
      });
    }
  }

  /**
   * 📊 Obtenir les métriques en temps réel
   */
  @SubscribeMessage('config:metrics')
  async handleGetMetrics(
    @MessageBody() data: { timeframe?: 'day' | 'week' | 'month' },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const timeframe = data.timeframe || 'day';
      const metrics = await this.analyticsService.getConfigMetrics(timeframe);

      client.emit('config:metrics', {
        metrics,
        timeframe,
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      client.emit('config:error', {
        message: 'Erreur lors de la récupération des métriques',
        error: error.message,
      });
    }
  }

  /**
   * 🎛️ Diffuser les changements de configuration à tous les clients
   */
  async broadcastConfigChange(key: string, newValue: any, oldValue: any, userId?: string) {
    this.server.to(`config:${key}`).emit('config:changed', {
      key,
      value: newValue,
      previousValue: oldValue,
      changedBy: userId,
      timestamp: new Date().toISOString(),
    });

    // Notifier également les clients abonnés aux notifications générales
    this.server.emit('config:notification', {
      type: 'config_changed',
      message: `Configuration ${key} mise à jour`,
      key,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * 🚨 Diffuser les alertes de configuration
   */
  async broadcastConfigAlert(key: string, alertType: string, message: string) {
    this.server.emit('config:alert', {
      key,
      alertType,
      message,
      severity: 'high',
      timestamp: new Date().toISOString(),
    });

    this.logger.warn(`🚨 Alerte diffusée: ${key} - ${message}`);
  }

  /**
   * 📱 Envoyer les notifications de maintenance
   */
  async broadcastMaintenanceMode(isEnabled: boolean) {
    this.server.emit('config:maintenance', {
      enabled: isEnabled,
      message: isEnabled 
        ? 'Application en mode maintenance' 
        : 'Mode maintenance désactivé',
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * 🔐 Vérifier les permissions de mise à jour (à personnaliser)
   */
  private async checkUpdatePermissions(client: Socket, key: string): Promise<boolean> {
    // Ici vous pouvez implémenter votre logique de permissions
    // Par exemple, vérifier le token JWT, les rôles utilisateur, etc.
    
    const publicConfigs = ['ui.theme_config', 'features.new_dashboard'];
    return publicConfigs.includes(key);
  }

  /**
   * 🔄 Méthodes utilitaires pour intégration avec les services
   */
  
  // Appelée par EnhancedConfigService lors d'une mise à jour
  async onConfigUpdated(key: string, newValue: any, oldValue: any, userId?: string) {
    await this.broadcastConfigChange(key, newValue, oldValue, userId);
  }

  // Appelée par le système de monitoring
  async onConfigAlert(key: string, alertType: string, message: string) {
    await this.broadcastConfigAlert(key, alertType, message);
  }

  // Appelée lors des changements de mode maintenance
  async onMaintenanceModeChanged(isEnabled: boolean) {
    await this.broadcastMaintenanceMode(isEnabled);
  }
}