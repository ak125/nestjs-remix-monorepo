/**
 * 🚀 Service d'Optimisation Performance - Cache Batch
 * Résolution des problèmes de timeout et requêtes N+1
 */
import { Injectable, Logger } from '@nestjs/common';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

@Injectable()
export class PerformanceOptimizationService {
  private readonly logger = new Logger(PerformanceOptimizationService.name);

  // Cache en mémoire avec TTL
  private cache = new Map<string, CacheEntry<any>>();

  // Configuration
  private readonly DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes
  private readonly BATCH_SIZE = 50; // Taille max des batches

  /**
   * ⚡ Pré-charger les utilisateurs en batch
   */
  async batchLoadUsers(
    userIds: string[],
    loadFunction: (id: string) => Promise<any>,
  ): Promise<Map<string, any>> {
    const userMap = new Map<string, any>();
    const uncachedIds: string[] = [];

    // Vérifier le cache d'abord
    for (const userId of userIds) {
      const cached = this.getFromCache(`user:${userId}`);
      if (cached) {
        userMap.set(userId, cached);
      } else {
        uncachedIds.push(userId);
      }
    }

    if (uncachedIds.length === 0) {
      this.logger.log(
        `✅ Cache hit pour tous les ${userIds.length} utilisateurs`,
      );
      return userMap;
    }

    this.logger.log(
      `🔄 Chargement de ${uncachedIds.length}/${userIds.length} utilisateurs depuis la base`,
    );

    // Traiter par batch pour éviter la surcharge
    const batches = this.createBatches(uncachedIds, this.BATCH_SIZE);

    for (const batch of batches) {
      const results = await Promise.allSettled(
        batch.map((id) => this.safeLoad(id, loadFunction)),
      );

      results.forEach((result, index) => {
        const userId = batch[index];
        if (result.status === 'fulfilled' && result.value) {
          userMap.set(userId, result.value);
          this.setCache(`user:${userId}`, result.value);
        } else {
          this.logger.warn(`⚠️ Échec chargement utilisateur ${userId}`);
          // Créer un utilisateur placeholder pour éviter les erreurs
          const placeholder = {
            id: userId,
            name: `User ${userId}`,
            email: `user${userId}@system.local`,
            _isPlaceholder: true,
          };
          userMap.set(userId, placeholder);
          this.setCache(`user:${userId}`, placeholder, 30000); // TTL court pour les placeholders
        }
      });
    }

    return userMap;
  }

  /**
   * 🔄 Pré-charger les adresses en batch
   */
  async batchLoadAddresses(
    addressIds: string[],
    loadFunction: (id: string) => Promise<any>,
    type: 'billing' | 'delivery',
  ): Promise<Map<string, any>> {
    const addressMap = new Map<string, any>();
    const uncachedIds: string[] = [];

    // Vérifier le cache
    for (const addressId of addressIds) {
      const cached = this.getFromCache(`address:${type}:${addressId}`);
      if (cached) {
        addressMap.set(addressId, cached);
      } else {
        uncachedIds.push(addressId);
      }
    }

    if (uncachedIds.length === 0) {
      return addressMap;
    }

    // Charger en batch avec timeout plus court
    const results = await Promise.allSettled(
      uncachedIds.map((id) => this.safeLoad(id, loadFunction, 3000)), // 3 sec timeout
    );

    results.forEach((result, index) => {
      const addressId = uncachedIds[index];
      if (result.status === 'fulfilled' && result.value) {
        addressMap.set(addressId, result.value);
        this.setCache(`address:${type}:${addressId}`, result.value);
      } else {
        console.warn(
          `⏱️ Timeout lors de la récupération de l'adresse de ${type === 'billing' ? 'facturation' : 'livraison'} ${addressId}`,
        );
        addressMap.set(addressId, null); // Éviter les requêtes répétées
        this.setCache(`address:${type}:${addressId}`, null, 60000); // Cache court pour les échecs
      }
    });

    return addressMap;
  }

  /**
   * 🔧 Chargement sécurisé avec timeout
   */
  private async safeLoad<T>(
    id: string,
    loadFunction: (id: string) => Promise<T>,
    timeout: number = 5000,
  ): Promise<T | null> {
    return new Promise(async (resolve) => {
      const timeoutId = setTimeout(() => {
        resolve(null);
      }, timeout);

      try {
        const result = await loadFunction(id);
        clearTimeout(timeoutId);
        resolve(result);
      } catch {
        clearTimeout(timeoutId);
        resolve(null);
      }
    });
  }

  /**
   * 📦 Gestion du cache
   */
  private setCache<T>(
    key: string,
    data: T,
    ttl: number = this.DEFAULT_TTL,
  ): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });
  }

  private getFromCache<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) {
      return null;
    }

    // Vérifier TTL
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  /**
   * 🧹 Nettoyage du cache
   */
  cleanExpiredCache(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.logger.log(
        `🧹 Cache nettoyé: ${cleaned} entrées expirées supprimées`,
      );
    }
  }

  /**
   * 📊 Statistiques du cache
   */
  getCacheStats(): { size: number; hitRate: number; entries: number } {
    return {
      size: this.cache.size,
      hitRate: 0, // TODO: Implémenter le calcul du hit rate
      entries: this.cache.size,
    };
  }

  /**
   * 🔨 Utilitaires
   */
  private createBatches<T>(array: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < array.length; i += batchSize) {
      batches.push(array.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * 🔄 Clear cache pour tests
   */
  clearCache(): void {
    this.cache.clear();
    this.logger.log('🔄 Cache vidé complètement');
  }
}
