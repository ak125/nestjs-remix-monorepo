# 🔧 Plan de Correction: Système d'Authentification

**Date**: 8 octobre 2025, 22:35  
**Basé sur**: ANALYSE-COMPLETE-AUTH-SESSIONS.md

---

## 🎯 Objectifs

1. **Immédiat**: Débloquer le chargement de `/api/orders`
2. **Court terme**: Améliorer la performance des sessions
3. **Moyen terme**: Rendre le système résilient aux pannes Supabase
4. **Long terme**: Optimiser l'architecture d'authentification

---

## 📋 Corrections Phase 1: Déblocage Immédiat (30 min)

### Correction 1.1: Mode Bypass Développement

**Fichier**: `backend/src/auth/authenticated.guard.ts`

**But**: Permettre l'accès aux routes même si Supabase timeout

```typescript
@Injectable()
export class AuthenticatedGuard implements CanActivate {
  private readonly logger = new Logger(AuthenticatedGuard.name);

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const isAuthenticated = request.isAuthenticated();

    // 🔓 Mode développement: bypass si variable d'environnement activée
    const isDevelopment = process.env.NODE_ENV !== 'production';
    const bypassAuth = process.env.BYPASS_AUTH === 'true';
    
    if (isDevelopment && bypassAuth && !isAuthenticated) {
      this.logger.warn(
        `⚠️ [DEV MODE] Authentication bypassed for: ${request.path}`,
      );
      
      // Créer un user de test pour éviter les erreurs
      request.user = {
        id: 'dev-user-bypass',
        email: 'dev@example.com',
        firstName: 'Dev',
        lastName: 'User',
        level: 9,
        isAdmin: true,
        isPro: true,
        isActive: true,
      };
      
      return true;
    }

    this.logger.log(
      `AuthenticatedGuard - Path: ${request.path}, ` +
      `Authenticated: ${isAuthenticated}, ` +
      `User: ${request.user?.email || 'none'}`,
    );

    return isAuthenticated;
  }
}
```

**Variables d'environnement** (`.env`):
```env
NODE_ENV=development
BYPASS_AUTH=true  # À mettre à false en production !
```

---

### Correction 1.2: Timeout Supabase

**Fichier**: `backend/src/database/services/supabase-base.service.ts`

**But**: Échouer rapidement au lieu de bloquer indéfiniment

```typescript
export class SupabaseBaseService {
  protected supabase: SupabaseClient;
  protected readonly logger = new Logger(SupabaseBaseService.name);
  
  private readonly SUPABASE_TIMEOUT = 
    parseInt(process.env.SUPABASE_TIMEOUT || '3000'); // 3 secondes

  constructor(configService?: ConfigService) {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY required');
    }

    this.supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false },
      global: {
        // Ajouter timeout personnalisé
        fetch: (url, options = {}) => {
          const controller = new AbortController();
          const timeoutId = setTimeout(
            () => controller.abort(), 
            this.SUPABASE_TIMEOUT
          );

          return fetch(url, {
            ...options,
            signal: controller.signal,
          }).finally(() => clearTimeout(timeoutId));
        },
      },
    });

    this.logger.log(
      `SupabaseBaseService initialized with ${this.SUPABASE_TIMEOUT}ms timeout`
    );
  }
}
```

**Variables d'environnement** (`.env`):
```env
SUPABASE_TIMEOUT=3000  # 3 secondes max
```

---

### Correction 1.3: Logging Amélioré

**Fichier**: `backend/src/auth/cookie-serializer.ts`

**But**: Mieux comprendre les erreurs de désérialisation

```typescript
async deserializeUser(
  userId: string,
  done: (err: any, user?: any) => void,
) {
  const startTime = Date.now();
  
  try {
    console.log(`🔍 [${startTime}] Deserializing user ID:`, userId);

    const user = await this.authService.getUserById(userId);
    const duration = Date.now() - startTime;

    if (!user) {
      console.log(
        `⚠️  [${duration}ms] User not found during deserialization:`, 
        userId
      );
      return done(null, false);
    }

    console.log(
      `✅ [${duration}ms] User deserialized:`, 
      user.email
    );
    done(null, user);
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(
      `❌ [${duration}ms] Deserialization error for ${userId}:`, 
      error.message
    );
    
    // Ne pas bloquer: retourner false au lieu de propager l'erreur
    done(null, false);
  }
}
```

---

## 📋 Corrections Phase 2: Cache Redis (2h)

### Correction 2.1: Cache Utilisateurs dans Deserializer

**Fichier**: `backend/src/auth/cookie-serializer.ts`

**But**: Éviter les appels répétés à Supabase

```typescript
@Injectable()
export class CookieSerializer extends PassportSerializer {
  private readonly CACHE_TTL = 300; // 5 minutes
  
  constructor(
    private readonly authService: AuthService,
    private readonly cacheService: RedisCacheService, // Injection
  ) {
    super();
  }

  async deserializeUser(
    userId: string,
    done: (err: any, user?: any) => void,
  ) {
    const startTime = Date.now();
    
    try {
      console.log(`🔍 Deserializing user ID:`, userId);

      // 1. Essayer le cache d'abord
      const cacheKey = `user:session:${userId}`;
      const cachedUser = await this.cacheService.get(cacheKey);
      
      if (cachedUser) {
        const user = JSON.parse(cachedUser);
        const duration = Date.now() - startTime;
        console.log(`✅ [${duration}ms] User from cache:`, user.email);
        return done(null, user);
      }

      // 2. Si pas en cache, fetch depuis DB avec timeout
      const userPromise = this.authService.getUserById(userId);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), 3000)
      );
      
      const user = await Promise.race([userPromise, timeoutPromise]);

      if (!user) {
        console.log(`⚠️  User not found:`, userId);
        return done(null, false);
      }

      // 3. Mettre en cache pour les prochaines requêtes
      await this.cacheService.set(
        cacheKey, 
        JSON.stringify(user), 
        this.CACHE_TTL
      );

      const duration = Date.now() - startTime;
      console.log(`✅ [${duration}ms] User cached:`, user.email);
      done(null, user);
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(
        `❌ [${duration}ms] Deserialization error:`, 
        error.message
      );
      
      // Mode dégradé: permettre l'accès sans user
      done(null, false);
    }
  }
}
```

---

### Correction 2.2: Invalider Cache lors du Logout

**Fichier**: `backend/src/auth/auth.controller.ts`

**But**: Nettoyer le cache quand user se déconnecte

```typescript
@Post('auth/logout')
async logout(
  @Req() request: Express.Request,
  @Res() response: Response,
  @Next() next: NextFunction,
) {
  const userId = (request.user as any)?.id;
  
  console.log('--- POST /auth/logout ---');
  console.log('User ID:', userId);

  // Nettoyer le cache utilisateur
  if (userId) {
    await this.cacheService.delete(`user:session:${userId}`);
    console.log('✅ Cache utilisateur nettoyé');
  }

  request.logOut(function (err) {
    if (err) {
      console.error('Erreur logout:', err);
      return next(err);
    }

    request.session.destroy(() => {
      response.clearCookie('connect.sid');
      console.log('✅ Session détruite');
      response.redirect('/');
    });
  });
}
```

---

## 📋 Corrections Phase 3: Circuit Breaker (4h)

### Correction 3.1: Service Circuit Breaker

**Nouveau fichier**: `backend/src/common/circuit-breaker.service.ts`

```typescript
import { Injectable, Logger } from '@nestjs/common';

export interface CircuitBreakerConfig {
  failureThreshold: number;
  resetTimeout: number;
  name: string;
}

@Injectable()
export class CircuitBreakerService {
  private readonly logger = new Logger(CircuitBreakerService.name);
  private breakers = new Map<string, CircuitBreakerState>();

  async execute<T>(
    name: string,
    fn: () => Promise<T>,
    config: Partial<CircuitBreakerConfig> = {},
  ): Promise<T> {
    const state = this.getOrCreateBreaker(name, config);

    // Si circuit ouvert, rejeter immédiatement
    if (state.state === 'OPEN') {
      if (Date.now() - state.lastFailure > state.resetTimeout) {
        this.logger.log(`Circuit ${name} moving to HALF_OPEN`);
        state.state = 'HALF_OPEN';
      } else {
        throw new Error(`Circuit breaker ${name} is OPEN`);
      }
    }

    try {
      const result = await fn();
      this.onSuccess(name);
      return result;
    } catch (error) {
      this.onFailure(name);
      throw error;
    }
  }

  private getOrCreateBreaker(
    name: string,
    config: Partial<CircuitBreakerConfig>,
  ): CircuitBreakerState {
    if (!this.breakers.has(name)) {
      this.breakers.set(name, {
        name,
        state: 'CLOSED',
        failures: 0,
        lastFailure: 0,
        failureThreshold: config.failureThreshold || 5,
        resetTimeout: config.resetTimeout || 60000, // 1 minute
      });
    }
    return this.breakers.get(name)!;
  }

  private onSuccess(name: string) {
    const state = this.breakers.get(name);
    if (!state) return;

    state.failures = 0;
    if (state.state === 'HALF_OPEN') {
      this.logger.log(`Circuit ${name} closed after successful test`);
      state.state = 'CLOSED';
    }
  }

  private onFailure(name: string) {
    const state = this.breakers.get(name);
    if (!state) return;

    state.failures++;
    state.lastFailure = Date.now();

    if (state.failures >= state.failureThreshold) {
      this.logger.error(
        `⚠️ Circuit breaker ${name} OPEN ` +
        `(${state.failures} failures)`
      );
      state.state = 'OPEN';
    }
  }

  getState(name: string): string {
    return this.breakers.get(name)?.state || 'UNKNOWN';
  }

  getStats(name: string) {
    const state = this.breakers.get(name);
    if (!state) return null;

    return {
      name: state.name,
      state: state.state,
      failures: state.failures,
      lastFailure: state.lastFailure,
    };
  }
}

interface CircuitBreakerState extends CircuitBreakerConfig {
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  failures: number;
  lastFailure: number;
}
```

---

### Correction 3.2: Utiliser Circuit Breaker dans LegacyUserService

**Fichier**: `backend/src/database/services/legacy-user.service.ts`

```typescript
@Injectable()
export class LegacyUserService extends SupabaseBaseService {
  constructor(
    configService?: ConfigService,
    private readonly circuitBreaker?: CircuitBreakerService,
  ) {
    super(configService);
  }

  async getUserById(userId: string): Promise<LegacyUser> {
    try {
      this.logger.debug(`🔍 Recherche utilisateur: ${userId}`);

      // Utiliser circuit breaker si disponible
      const query = () => this.supabase
        .from('___xtr_customer')
        .select('*')
        .eq('cst_id', userId)
        .single();

      const { data, error } = this.circuitBreaker
        ? await this.circuitBreaker.execute('supabase-users', query)
        : await query();

      if (error) {
        this.logger.error(`❌ Erreur Supabase pour user ${userId}:`, error);
        throw new NotFoundException(`User not found: ${userId}`);
      }

      if (!data) {
        throw new NotFoundException(`User not found: ${userId}`);
      }

      this.logger.debug(`✅ Utilisateur trouvé: ${data.cst_mail}`);
      return this.mapToLegacyUser(data);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      
      this.logger.error(`❌ Error fetching user ${userId}:`, error);
      throw new NotFoundException(`Cannot fetch user ${userId}`);
    }
  }
}
```

---

## 📋 Corrections Phase 4: Optimisations Long Terme

### Correction 4.1: Stocker User Complet dans Session

**Fichier**: `backend/src/auth/cookie-serializer.ts`

**But**: Éliminer complètement les appels DB lors de désérialisation

```typescript
@Injectable()
export class CookieSerializer extends PassportSerializer {
  constructor(private readonly authService: AuthService) {
    super();
  }

  // ✅ OPTION 1: Stocker l'objet user complet dans Redis
  serializeUser(user: any, done: Function) {
    if (!user) {
      return done(null, false);
    }

    // Stocker l'objet entier (session Redis peut le gérer)
    const userData = {
      id: user.id || user.cst_id || user.cnfa_id,
      email: user.email || user.cst_mail,
      firstName: user.firstName || user.cst_fname,
      lastName: user.lastName || user.cst_name,
      level: user.level || user.cst_level || 0,
      isAdmin: user.isAdmin || parseInt(user.cst_level || '0') >= 7,
      isPro: user.isPro || user.cst_is_pro === '1',
      isActive: user.isActive || user.cst_activ === '1',
      // Metadata pour refresh
      _cachedAt: Date.now(),
    };

    console.log('✅ Serializing full user:', userData.email);
    done(null, userData);
  }

  // ✅ OPTION 1: Désérialiser sans appel DB
  async deserializeUser(userData: any, done: Function) {
    try {
      // Vérifier si les données sont récentes (< 5 minutes)
      const cacheAge = Date.now() - (userData._cachedAt || 0);
      const maxAge = 5 * 60 * 1000; // 5 minutes

      if (cacheAge < maxAge) {
        // Données encore fraîches, les utiliser directement
        console.log('✅ Using cached user data:', userData.email);
        return done(null, userData);
      }

      // Données trop anciennes, refresh depuis DB
      console.log('🔄 Refreshing user data:', userData.id);
      const freshUser = await this.authService.getUserById(userData.id);

      if (freshUser) {
        // Mettre à jour le timestamp
        (freshUser as any)._cachedAt = Date.now();
        return done(null, freshUser);
      }

      // User n'existe plus, invalider session
      console.log('⚠️  User no longer exists:', userData.id);
      done(null, false);
    } catch (error) {
      console.error('❌ Deserialization error:', error);
      
      // Fallback: utiliser les données obsolètes
      console.log('⚠️  Using stale user data as fallback');
      done(null, userData);
    }
  }
}
```

---

## 🧪 Tests à Effectuer

### Test 1: Bypass Mode Dev
```bash
# 1. Activer le bypass
echo "BYPASS_AUTH=true" >> .env

# 2. Redémarrer le backend
npm run dev

# 3. Tester la route
curl http://localhost:3000/api/orders

# Résultat attendu: 200 OK avec liste des commandes
```

### Test 2: Timeout Supabase
```bash
# 1. Configurer timeout court
echo "SUPABASE_TIMEOUT=100" >> .env

# 2. Tester avec Supabase down
# (débrancher internet ou bloquer le domaine)

# 3. Vérifier les logs
# Résultat attendu: "Timeout after 100ms"
```

### Test 3: Cache Redis
```bash
# 1. Login
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123"}'

# 2. Première requête (hit DB)
time curl http://localhost:3000/api/orders

# 3. Deuxième requête (hit cache)
time curl http://localhost:3000/api/orders

# Résultat attendu: 2ème requête plus rapide
```

### Test 4: Circuit Breaker
```bash
# 1. Simuler 5 échecs Supabase
for i in {1..5}; do
  curl http://localhost:3000/api/users/fake-id-$i
done

# 2. Vérifier l'état
curl http://localhost:3000/api/health/circuit-breakers

# Résultat attendu: Circuit "OPEN"
```

---

## 📊 Métriques de Succès

### Performance
- ✅ Désérialisation < 50ms (cache hit)
- ✅ Désérialisation < 200ms (cache miss)
- ✅ Cache hit rate > 90%
- ✅ Timeout Supabase < 1%

### Disponibilité
- ✅ Taux de succès auth > 99%
- ✅ Aucun blocage > 5s
- ✅ Circuit breaker détecte pannes < 5s

### Expérience Utilisateur
- ✅ Page commandes charge en < 1s
- ✅ Pas d'erreur visible si Supabase down
- ✅ Logout instantané

---

## 🚀 Déploiement

### Étape 1: Préparation
```bash
# 1. Backup de la configuration actuelle
cp .env .env.backup
cp backend/src/auth/authenticated.guard.ts backend/src/auth/authenticated.guard.ts.backup

# 2. Vérifier Redis accessible
redis-cli ping
# Résultat attendu: PONG
```

### Étape 2: Application des Corrections Phase 1
```bash
# 1. Appliquer les corrections (via outils)
# (Les corrections seront appliquées par l'assistant)

# 2. Configurer .env
cat >> .env << EOF
NODE_ENV=development
BYPASS_AUTH=true
SUPABASE_TIMEOUT=3000
EOF

# 3. Redémarrer
npm run dev
```

### Étape 3: Validation
```bash
# Test login
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@fafa.fr","password":"yourpassword"}'

# Test route protégée
curl http://localhost:3000/api/orders \
  -H "Cookie: connect.sid=..."

# Vérifier les logs
tail -f backend/logs/app.log
```

### Étape 4: Production
```bash
# Désactiver le bypass
sed -i 's/BYPASS_AUTH=true/BYPASS_AUTH=false/' .env

# Build production
npm run build

# Déployer
pm2 restart all
```

---

## ✅ Checklist Finale

### Avant Déploiement
- [ ] Backup de la config actuelle
- [ ] Tests unitaires passent
- [ ] Tests d'intégration passent
- [ ] Documentation à jour

### Après Déploiement Phase 1
- [ ] Login fonctionne
- [ ] Routes protégées accessibles
- [ ] Timeout Supabase configuré
- [ ] Logs cohérents

### Après Déploiement Phase 2
- [ ] Cache Redis actif
- [ ] Cache hit rate > 80%
- [ ] Performance améliorée
- [ ] Logout nettoie cache

### Après Déploiement Phase 3
- [ ] Circuit breaker actif
- [ ] Détection pannes < 5s
- [ ] Mode dégradé fonctionne
- [ ] Métriques exposées

---

## 📞 Support

En cas de problème:
1. Vérifier les logs: `tail -f backend/logs/app.log`
2. Vérifier Redis: `redis-cli ping`
3. Vérifier Supabase: `curl https://cxpojprgwgubzjyqzmoq.supabase.co`
4. Activer bypass temporairement: `BYPASS_AUTH=true`

