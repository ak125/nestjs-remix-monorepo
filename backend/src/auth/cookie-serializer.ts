import { Injectable, Logger } from '@nestjs/common';
import { PassportSerializer } from '@nestjs/passport';
import { AuthService } from './auth.service';

@Injectable()
export class CookieSerializer extends PassportSerializer {
  private readonly logger = new Logger(CookieSerializer.name);

  private userCache = new Map<string, { user: unknown; timestamp: number }>();
  private readonly CACHE_TTL = 5000; // 5 secondes

  constructor(private readonly authService: AuthService) {
    super();
  }

  /**
   * ✅ DESERIALIZE: Récupérer l'utilisateur depuis la BDD avec cache
   * Cache de 5 secondes pour éviter les boucles infinies
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Passport deserializeUser signature
  async deserializeUser(userId: string, done: (err: any, user?: any) => void) {
    try {
      // 🔍 Vérifier le cache d'abord
      const cached = this.userCache.get(userId);
      const now = Date.now();

      if (cached && now - cached.timestamp < this.CACHE_TTL) {
        // ✅ Cache hit: pas de log pour éviter le spam
        return done(null, cached.user);
      }

      // Cache miss ou expiré: requête BDD
      const user = await this.authService.getUserById(userId);

      if (!user) {
        this.logger.log(`User not found during deserialization: ${userId}`);
        this.userCache.delete(userId); // Nettoyer le cache
        return done(null, false);
      }

      // 💾 Mettre en cache pour 5 secondes
      this.userCache.set(userId, { user, timestamp: now });

      // 🧹 Nettoyer les entrées expirées (toutes les 100 requêtes)
      if (Math.random() < 0.01) {
        this.cleanExpiredCache();
      }

      done(null, user);
    } catch (error) {
      this.logger.error(`Deserialization error: ${error}`);
      done(error, null);
    }
  }

  /**
   * 🧹 Nettoyer les entrées de cache expirées
   */
  private cleanExpiredCache() {
    const now = Date.now();
    for (const [userId, cached] of this.userCache.entries()) {
      if (now - cached.timestamp > this.CACHE_TTL) {
        this.userCache.delete(userId);
      }
    }
  }

  /**
   * ✅ SERIALIZE: Sauvegarder UNIQUEMENT l'ID utilisateur dans la session
   * Pas l'objet complet pour éviter les données obsolètes
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Passport serializeUser signature
  serializeUser(user: any, done: (err: any, userId?: any) => void) {
    // Si user est undefined, false ou null, ne pas créer de session
    if (!user || user === false || user === null) {
      this.logger.log(
        'User is undefined/false/null, skipping session creation',
      );
      return done(null, false);
    }

    // ✅ Sauvegarder UNIQUEMENT l'ID (pas l'objet complet)
    const userId = user.id || user.cst_id || user.cnfa_id;

    if (!userId) {
      this.logger.warn(
        `No user ID found, cannot serialize. Keys: ${Object.keys(user || {}).join(',')}`,
      );
      return done(null, false);
    }

    done(null, userId);
  }
}
