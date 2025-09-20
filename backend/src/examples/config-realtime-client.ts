import { io, Socket } from 'socket.io-client';

/**
 * 🌐 Client TypeScript pour configuration en temps réel
 * Parfait pour React, Vue, Angular ou vanilla TypeScript
 */

export interface ConfigEvent {
  key: string;
  value: any;
  previousValue?: any;
  timestamp: string;
  changedBy?: string;
}

export interface ConfigAlert {
  key: string;
  alertType: string;
  message: string;
  severity: 'low' | 'medium' | 'high';
  timestamp: string;
}

export interface ConfigMetrics {
  totalConfigs: number;
  activeUsers: number;
  lastUpdate: string;
  popularConfigs: Array<{
    key: string;
    accessCount: number;
  }>;
}

export class ConfigRealtimeClient {
  private socket: Socket;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private subscriptions = new Set<string>();
  private eventCallbacks = new Map<string, Function[]>();

  constructor(
    private serverUrl: string = 'http://localhost:3000',
    private options: any = {}
  ) {
    this.connect();
  }

  /**
   * 🔌 Établir la connexion WebSocket
   */
  private connect() {
    this.socket = io(`${this.serverUrl}/config`, {
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      ...this.options,
    });

    this.setupEventHandlers();
    this.socket.connect();
  }

  /**
   * 🎯 Configuration des gestionnaires d'événements
   */
  private setupEventHandlers() {
    // Connexion établie
    this.socket.on('connect', () => {
      console.log('✅ Connecté au serveur de configuration');
      this.reconnectAttempts = 0;
      this.emit('connected');
      
      // Rétablir les abonnements après reconnexion
      this.reestablishSubscriptions();
    });

    // Déconnexion
    this.socket.on('disconnect', (reason) => {
      console.log('❌ Déconnecté du serveur:', reason);
      this.emit('disconnected', reason);
    });

    // Configurations initiales reçues
    this.socket.on('config:initial', (data) => {
      console.log('📦 Configurations initiales reçues:', data);
      this.emit('initial', data);
    });

    // Configuration mise à jour
    this.socket.on('config:updated', (event: ConfigEvent) => {
      console.log('🔄 Configuration mise à jour:', event);
      this.emit('updated', event);
      this.emit(`updated:${event.key}`, event);
    });

    // Configuration changée (par un autre client)
    this.socket.on('config:changed', (event: ConfigEvent) => {
      console.log('🔄 Configuration changée par un autre client:', event);
      this.emit('changed', event);
      this.emit(`changed:${event.key}`, event);
    });

    // Abonnement confirmé
    this.socket.on('config:subscribed', (data) => {
      console.log('📡 Abonné à la configuration:', data.key);
      this.emit('subscribed', data);
    });

    // Désabonnement confirmé
    this.socket.on('config:unsubscribed', (data) => {
      console.log('📡 Désabonné de la configuration:', data.key);
      this.emit('unsubscribed', data);
    });

    // Métriques reçues
    this.socket.on('config:metrics', (data) => {
      this.emit('metrics', data);
    });

    // Alertes
    this.socket.on('config:alert', (alert: ConfigAlert) => {
      console.warn('🚨 Alerte de configuration:', alert);
      this.emit('alert', alert);
    });

    // Notifications
    this.socket.on('config:notification', (notification) => {
      console.log('📢 Notification:', notification);
      this.emit('notification', notification);
    });

    // Mode maintenance
    this.socket.on('config:maintenance', (data) => {
      console.log('🔧 Mode maintenance:', data);
      this.emit('maintenance', data);
    });

    // Erreurs
    this.socket.on('config:error', (error) => {
      console.error('❌ Erreur de configuration:', error);
      this.emit('error', error);
    });
  }

  /**
   * 📡 S'abonner aux changements d'une configuration
   */
  subscribe(key: string): Promise<any> {
    return new Promise((resolve, reject) => {
      this.socket.emit('config:subscribe', { key });
      
      // Écouter la confirmation d'abonnement
      const timeout = setTimeout(() => {
        reject(new Error(`Timeout lors de l'abonnement à ${key}`));
      }, 5000);

      this.socket.once('config:subscribed', (data) => {
        if (data.key === key) {
          clearTimeout(timeout);
          this.subscriptions.add(key);
          resolve(data);
        }
      });

      this.socket.once('config:error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  /**
   * ❌ Se désabonner d'une configuration
   */
  unsubscribe(key: string): void {
    this.socket.emit('config:unsubscribe', { key });
    this.subscriptions.delete(key);
  }

  /**
   * 🔄 Mettre à jour une configuration
   */
  updateConfig(key: string, value: any, userId?: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket.emit('config:update', { key, value, userId });

      const timeout = setTimeout(() => {
        reject(new Error(`Timeout lors de la mise à jour de ${key}`));
      }, 5000);

      // Écouter la confirmation ou l'erreur
      this.socket.once('config:updated', (event) => {
        if (event.key === key) {
          clearTimeout(timeout);
          resolve();
        }
      });

      this.socket.once('config:error', (error) => {
        if (error.key === key) {
          clearTimeout(timeout);
          reject(error);
        }
      });
    });
  }

  /**
   * 📊 Demander les métriques
   */
  getMetrics(timeframe: 'day' | 'week' | 'month' = 'day'): Promise<ConfigMetrics> {
    return new Promise((resolve, reject) => {
      this.socket.emit('config:metrics', { timeframe });

      const timeout = setTimeout(() => {
        reject(new Error('Timeout lors de la récupération des métriques'));
      }, 5000);

      this.socket.once('config:metrics', (data) => {
        clearTimeout(timeout);
        resolve(data.metrics);
      });
    });
  }

  /**
   * 🎧 Écouter un événement
   */
  on(event: string, callback: Function): void {
    if (!this.eventCallbacks.has(event)) {
      this.eventCallbacks.set(event, []);
    }
    this.eventCallbacks.get(event)!.push(callback);
  }

  /**
   * 🔇 Arrêter d'écouter un événement
   */
  off(event: string, callback?: Function): void {
    if (callback) {
      const callbacks = this.eventCallbacks.get(event) || [];
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    } else {
      this.eventCallbacks.delete(event);
    }
  }

  /**
   * 📢 Émettre un événement interne
   */
  private emit(event: string, data?: any): void {
    const callbacks = this.eventCallbacks.get(event) || [];
    callbacks.forEach(callback => callback(data));
  }

  /**
   * 🔄 Rétablir les abonnements après reconnexion
   */
  private reestablishSubscriptions(): void {
    this.subscriptions.forEach(key => {
      this.socket.emit('config:subscribe', { key });
    });
  }

  /**
   * 🔌 Déconnecter le client
   */
  disconnect(): void {
    this.socket.disconnect();
  }

  /**
   * 🔗 Reconnecter le client
   */
  reconnect(): void {
    this.socket.connect();
  }

  /**
   * ✅ Vérifier si connecté
   */
  isConnected(): boolean {
    return this.socket.connected;
  }

  /**
   * 🆔 Obtenir l'ID du socket
   */
  getSocketId(): string {
    return this.socket.id;
  }
}

/**
 * 🎛️ Hook React pour utilisation facile (exemple)
 */
export function useConfigRealtime(serverUrl?: string) {
  const client = new ConfigRealtimeClient(serverUrl);

  const subscribe = async (key: string, callback: (event: ConfigEvent) => void) => {
    await client.subscribe(key);
    client.on(`changed:${key}`, callback);
    client.on(`updated:${key}`, callback);
  };

  const unsubscribe = (key: string) => {
    client.unsubscribe(key);
    client.off(`changed:${key}`);
    client.off(`updated:${key}`);
  };

  return {
    client,
    subscribe,
    unsubscribe,
    updateConfig: client.updateConfig.bind(client),
    getMetrics: client.getMetrics.bind(client),
    isConnected: client.isConnected.bind(client),
  };
}

/**
 * 🎯 Exemples d'utilisation
 */

// Usage basique
const configClient = new ConfigRealtimeClient('http://localhost:3000');

// S'abonner aux changements d'une configuration
configClient.subscribe('ui.theme_config').then((data) => {
  console.log('Abonné au thème, valeur actuelle:', data.value);
});

// Écouter les changements
configClient.on('changed:ui.theme_config', (event: ConfigEvent) => {
  console.log('Thème changé:', event.value);
  // Mettre à jour l'interface utilisateur
});

// Mettre à jour une configuration
configClient.updateConfig('ui.theme_config', { 
  primary: '#007bff',
  secondary: '#6c757d' 
});

// Écouter les alertes
configClient.on('alert', (alert: ConfigAlert) => {
  if (alert.severity === 'high') {
    // Afficher une notification urgente
    console.error('Alerte critique:', alert.message);
  }
});

// Écouter le mode maintenance
configClient.on('maintenance', (data) => {
  if (data.enabled) {
    // Afficher une bannière de maintenance
    console.log('Application en maintenance');
  }
});

export default ConfigRealtimeClient;