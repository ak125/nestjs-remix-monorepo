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
   * Supporte le nouveau format { userId, authSource } et l'ancien format string (rétrocompat)
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Passport deserializeUser signature
  async deserializeUser(
    sessionData: string | { userId: string; authSource?: 'admin' | 'customer' },
    done: (err: any, user?: any) => void,
  ) {
    try {
      // Normaliser : ancien format (string) → nouveau format (object)
      const { userId, authSource } =
        typeof sessionData === 'string'
          ? { userId: sessionData, authSource: undefined }
          : sessionData;

      const cacheKey = `${authSource || 'unknown'}:${userId}`;

      // 🔍 Vérifier le cache d'abord
      const cached = this.userCache.get(cacheKey);
      const now = Date.now();

      if (cached && now - cached.timestamp < this.CACHE_TTL) {
        return done(null, cached.user);
      }

      // Cache miss ou expiré: requête BDD avec routage par source
      const user = authSource
        ? await this.authService.getUserByIdAndSource(userId, authSource)
        : await this.authService.getUserById(userId);

      if (!user) {
        this.logger.log(`User not found during deserialization: ${cacheKey}`);
        this.userCache.delete(cacheKey);
        return done(null, false);
      }

      // 💾 Mettre en cache pour 5 secondes
      this.userCache.set(cacheKey, { user, timestamp: now });

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

    // ✅ Sauvegarder l'ID ET la source (admin vs customer) pour routage déterministe
    const userId = user.id || user.cst_id || user.cnfa_id;

    if (!userId) {
      this.logger.warn(
        `No user ID found, cannot serialize. Keys: ${Object.keys(user || {}).join(',')}`,
      );
      return done(null, false);
    }

    const authSource: 'admin' | 'customer' =
      user.authSource || (user.isAdmin ? 'admin' : 'customer');

    done(null, { userId, authSource });
  }
}
