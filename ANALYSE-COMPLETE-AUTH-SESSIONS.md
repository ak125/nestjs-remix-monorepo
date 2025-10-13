# 🔍 Analyse Approfondie: Système d'Authentification et Sessions

**Date**: 8 octobre 2025, 22:30  
**Objectif**: Comprendre l'architecture complète avant correction

---

## 📊 Vue d'Ensemble de l'Architecture

### Stack Technique
```
Frontend (Remix) 
    ↓ HTTP Requests (avec Cookie: connect.sid)
Backend (NestJS + Express)
    ↓ Session Middleware (express-session + RedisStore)
    ↓ Passport.js (serialize/deserialize)
    ↓ Guards NestJS (AuthenticatedGuard, IsAdminGuard)
    ↓ Controllers
    ↓ Services (AuthService, LegacyUserService, etc.)
    ↓ Supabase Database
```

---

## 🔐 Composants du Système d'Authentification

### 1. Configuration Session (main.ts)

**Fichier**: `backend/src/main.ts`

```typescript
// Redis Store Configuration
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const redisClient = new Redis(redisUrl);
const redisStore = new redisStoreFactory({
  client: redisClient,
  ttl: 86400 * 30, // 30 jours
});

// Session Middleware
app.use(session({
  store: redisStore,
  resave: false,
  saveUninitialized: true,  // ✅ Crée session même si vide
  secret: process.env.SESSION_SECRET || '123',
  name: 'connect.sid',  // Nom du cookie
  cookie: {
    maxAge: 1000 * 60 * 60 * 24 * 30, // 30 jours
    sameSite: 'lax',
    secure: false,  // ⚠️ DEV mode (HTTP)
    httpOnly: true,
    path: '/',
  },
}));

// Passport Initialization
app.use(passport.initialize());
app.use(passport.session());
```

**Points Critiques**:
- ✅ Redis comme store de session (persistant)
- ✅ Cookie `connect.sid` partagé entre frontend/backend
- ⚠️ `saveUninitialized: true` → Peut créer sessions vides
- ⚠️ `secure: false` → OK en dev, mais à passer à `true` en prod

---

### 2. Passport Configuration (AuthModule)

**Fichier**: `backend/src/auth/auth.module.ts`

```typescript
@Module({
  imports: [
    PassportModule.register({
      defaultStrategy: 'local',
      property: 'user',
      session: true,  // ✅ Sessions activées
    }),
    // ...
  ],
  providers: [
    LocalStrategy,      // Stratégie d'authentification
    CookieSerializer,   // Serialization/Deserialization
    // ...
  ],
})
export class AuthModule {}
```

**Problème Identifié**:
- ❌ `CookieSerializer` est dans les `providers` mais Passport doit l'utiliser explicitement
- ❌ Pas de configuration `passport.serializeUser()` visible dans app.module.ts

---

### 3. Serialization (CookieSerializer)

**Fichier**: `backend/src/auth/cookie-serializer.ts`

```typescript
@Injectable()
export class CookieSerializer extends PassportSerializer {
  constructor(private readonly authService: AuthService) {
    super();
  }

  // ✅ SERIALIZE: Sauvegarde UNIQUEMENT l'ID
  serializeUser(user: any, done: (err: any, userId?: any) => void) {
    const userId = user.id || user.cst_id || user.cnfa_id;
    
    if (!userId) {
      return done(null, false);
    }
    
    console.log('✅ Serializing user ID:', userId);
    done(null, userId); // ⚠️ IMPORTANT: Ne stocker QUE l'ID
  }

  // ❌ DESERIALIZE: Récupère user depuis DB (PROBLÈME ICI)
  async deserializeUser(userId: string, done: (err: any, user?: any) => void) {
    try {
      console.log('🔍 Deserializing user ID:', userId);
      
      // ❌ PROBLÈME: authService.getUserById() appelle LegacyUserService
      // qui fait des requêtes Supabase qui TIMEOUT
      const user = await this.authService.getUserById(userId);
      
      if (!user) {
        console.log('⚠️ User not found during deserialization:', userId);
        return done(null, false);
      }
      
      console.log('✅ User deserialized:', user.email);
      done(null, user);
    } catch (error) {
      console.error('❌ Deserialization error:', error);
      done(error, null);
    }
  }
}
```

**Problèmes Identifiés**:
1. ❌ **deserializeUser** est appelé à CHAQUE requête
2. ❌ Fait des requêtes Supabase qui **TIMEOUT** systématiquement
3. ❌ Pas de cache → Performance catastrophique
4. ❌ Si Supabase timeout → Session échoue → `isAuthenticated() = false`

---

### 4. AuthService Flow

**Fichier**: `backend/src/auth/auth.service.ts`

```typescript
// Utilisé dans deserializeUser
async getUserById(userId: string): Promise<AuthUser | null> {
  try {
    // ❌ PROBLÈME: Appelle UserService qui appelle LegacyUserService
    // qui fait fetch vers Supabase qui TIMEOUT
    const user = await this.userService.getUserById(userId);
    return user ? this.formatUserResponse(user) : null;
  } catch (error) {
    return null;
  }
}
```

**Chaîne d'appels problématique**:
```
deserializeUser()
  → authService.getUserById()
    → userService.getUserById()
      → legacyUserService.getUserById()
        → supabase.from('___xtr_customer').select('*')
          → ❌ TIMEOUT (fetch failed: ETIMEDOUT)
```

---

### 5. LegacyUserService (Point de Défaillance)

**Fichier**: `backend/src/database/services/legacy-user.service.ts`

```typescript
async getUserById(userId: string): Promise<LegacyUser> {
  try {
    const { data, error } = await this.supabase
      .from('___xtr_customer')
      .select('*')
      .eq('cst_id', userId)
      .single();

    if (error) {
      // ❌ ERREUR: TypeError: fetch failed, ETIMEDOUT
      throw new NotFoundException(`User not found: ${userId}`);
    }
    
    return this.mapToLegacyUser(data);
  } catch (error) {
    throw error;
  }
}
```

**Erreurs observées**:
```
TypeError: fetch failed
errno: 'ETIMEDOUT'
code: 'ETIMEDOUT'
at LegacyUserService.getUserById
```

---

### 6. Guards (AuthenticatedGuard)

**Fichier**: `backend/src/auth/authenticated.guard.ts`

```typescript
@Injectable()
export class AuthenticatedGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const isAuthenticated = request.isAuthenticated();
    
    // ❌ PROBLÈME: Si deserializeUser échoue, isAuthenticated = false
    // Même si le cookie connect.sid est valide
    
    this.logger.log(
      `AuthenticatedGuard - Path: ${request.path}, ` +
      `Authenticated: ${isAuthenticated}, ` +
      `User: ${request.user?.email || 'none'}`
    );
    
    return isAuthenticated;
  }
}
```

**Logs d'erreur observés**:
```
[AuthenticatedGuard] Path: /api/orders, Authenticated: false, User: none
❌ [Frontend] Erreur loader: Error: Erreur lors du chargement des commandes
```

---

## 🔴 Problèmes Identifiés

### Problème #1: Timeouts Supabase Systématiques

**Symptômes**:
```
TypeError: fetch failed
errno: 'ETIMEDOUT'
code: 'ETIMEDOUT'
```

**Causes possibles**:
1. Supabase endpoint `cxpojprgwgubzjyqzmoq.supabase.co` inaccessible
2. Problème réseau/firewall dans le dev container
3. Rate limiting Supabase dépassé
4. Credentials Supabase invalides/expirés

**Impact**:
- ❌ Toutes les requêtes `/api/orders` échouent
- ❌ Impossible de charger les commandes
- ❌ Pas d'authentification fonctionnelle

---

### Problème #2: Désérialisation à Chaque Requête

**Flux actuel**:
```
Requête HTTP → Session middleware → Passport → deserializeUser()
  → authService.getUserById() → Supabase fetch → TIMEOUT → FAIL
```

**Problème**:
- Chaque requête fait un appel Supabase (pas de cache)
- Si Supabase timeout → Session échoue
- Performance catastrophique même quand Supabase fonctionne

---

### Problème #3: Pas de Fallback/Resilience

**Manques**:
- ❌ Pas de cache Redis pour les utilisateurs
- ❌ Pas de timeout court sur les requêtes Supabase
- ❌ Pas de circuit breaker
- ❌ Pas de mode dégradé

---

### Problème #4: Utilisateurs Inexistants

**Erreurs**:
```
❌ Erreur récupération utilisateur 80878: NotFoundException
❌ Erreur récupération utilisateur 80758: NotFoundException
❌ Erreur récupération utilisateur 80840: NotFoundException
```

**Cause**:
- Des user IDs en session Redis qui n'existent plus dans Supabase
- Ou des IDs de test qui n'ont jamais existé

---

## 💡 Solutions Proposées

### Solution #1: Cache Redis pour Utilisateurs (IMMÉDIAT)

**Objectif**: Éviter les appels Supabase répétés

```typescript
// Dans CookieSerializer.deserializeUser()
async deserializeUser(userId: string, done: Function) {
  try {
    // 1. Chercher dans cache Redis (TTL: 5 minutes)
    const cachedUser = await this.cacheService.get(`user:${userId}`);
    if (cachedUser) {
      return done(null, JSON.parse(cachedUser));
    }
    
    // 2. Si pas en cache, fetch depuis DB avec timeout
    const user = await Promise.race([
      this.authService.getUserById(userId),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), 3000)
      )
    ]);
    
    if (user) {
      // 3. Mettre en cache
      await this.cacheService.set(`user:${userId}`, JSON.stringify(user), 300);
      return done(null, user);
    }
    
    done(null, false);
  } catch (error) {
    // 4. Fallback: Permettre l'accès en mode dégradé
    console.error('Deserialization failed, using degraded mode');
    done(null, false);
  }
}
```

---

### Solution #2: Timeout Supabase (IMMÉDIAT)

**Objectif**: Échouer rapidement au lieu de bloquer

```typescript
// Dans SupabaseBaseService
constructor() {
  this.supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
    global: {
      fetch: (url, options) => {
        // Timeout de 3 secondes
        return Promise.race([
          fetch(url, options),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Supabase timeout')), 3000)
          )
        ]);
      }
    }
  });
}
```

---

### Solution #3: Mode Développement Bypass (TEMPORAIRE)

**Objectif**: Débloquer le développement immédiatement

```typescript
// Dans AuthenticatedGuard
canActivate(context: ExecutionContext): boolean {
  const request = context.switchToHttp().getRequest();
  const isAuthenticated = request.isAuthenticated();
  
  // Mode dev: bypass si Supabase down
  const isDev = process.env.NODE_ENV !== 'production';
  const bypassAuth = process.env.BYPASS_AUTH === 'true';
  
  if (isDev && bypassAuth && !isAuthenticated) {
    this.logger.warn('⚠️ [DEV] Bypassing authentication');
    return true;
  }
  
  return isAuthenticated;
}
```

**Utilisation**:
```bash
# Dans .env
BYPASS_AUTH=true  # Temporaire pour dev
```

---

### Solution #4: Circuit Breaker Supabase (MOYEN TERME)

**Objectif**: Détecter et éviter les services down

```typescript
class SupabaseCircuitBreaker {
  private failures = 0;
  private lastFailure = 0;
  private state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
  
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailure > 60000) {
        this.state = 'HALF_OPEN';
      } else {
        throw new Error('Circuit breaker OPEN');
      }
    }
    
    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
  
  private onSuccess() {
    this.failures = 0;
    this.state = 'CLOSED';
  }
  
  private onFailure() {
    this.failures++;
    this.lastFailure = Date.now();
    if (this.failures >= 5) {
      this.state = 'OPEN';
      console.error('⚠️ Circuit breaker OPEN - Supabase is down');
    }
  }
}
```

---

### Solution #5: Migration Sessions vers Redis (LONG TERME)

**Objectif**: Ne plus dépendre de Supabase pour l'auth

```typescript
// Stocker user complet dans Redis session
passport.serializeUser((user, done) => {
  // Stocker l'objet user complet dans la session Redis
  done(null, user);
});

passport.deserializeUser((user, done) => {
  // Pas besoin de fetch DB, user déjà dans Redis
  done(null, user);
});
```

**Avantages**:
- ✅ Pas d'appel DB à chaque requête
- ✅ Performance maximale
- ✅ Resilient aux pannes Supabase

**Inconvénients**:
- ⚠️ Données utilisateur peuvent être obsolètes
- ⚠️ Besoin de refresh périodique

---

## 🎯 Plan d'Action Recommandé

### Phase 1: Déblocage Immédiat (30 min)
1. ✅ Activer mode bypass dev (`BYPASS_AUTH=true`)
2. ✅ Ajouter timeout 3s sur Supabase
3. ✅ Logger les erreurs de connection

### Phase 2: Cache Redis (2h)
1. ✅ Implémenter cache utilisateur dans deserializeUser
2. ✅ TTL 5 minutes
3. ✅ Fallback mode dégradé

### Phase 3: Circuit Breaker (4h)
1. ✅ Implémenter circuit breaker Supabase
2. ✅ Métriques de disponibilité
3. ✅ Alertes

### Phase 4: Migration Sessions (1 jour)
1. ✅ Stocker user complet dans Redis
2. ✅ Refresh périodique
3. ✅ Tests de charge

---

## 📈 Métriques à Surveiller

### Performance
- Temps de désérialisation (< 50ms)
- Cache hit rate (> 90%)
- Supabase timeout rate (< 1%)

### Disponibilité
- Taux de succès auth (> 99%)
- Circuit breaker état
- Sessions actives

### Sécurité
- Tentatives de login échouées
- Sessions expirées
- Tokens invalides

---

## 🔧 Configuration Recommandée

```env
# Session
SESSION_SECRET=your-secret-key-here-min-32-chars
REDIS_URL=redis://localhost:6379
SESSION_TTL=2592000  # 30 jours

# Auth
BYPASS_AUTH=false  # true uniquement en dev si Supabase down
JWT_SECRET=your-jwt-secret-here
JWT_EXPIRY=7d

# Supabase
SUPABASE_URL=https://cxpojprgwgubzjyqzmoq.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-key
SUPABASE_TIMEOUT=3000  # 3 secondes

# Cache
USER_CACHE_TTL=300  # 5 minutes
SESSION_CACHE_TTL=1800  # 30 minutes
```

---

## ✅ Checklist de Validation

### Tests à Effectuer
- [ ] Login avec credentials valides
- [ ] Logout et vérification session détruite
- [ ] Accès page protégée après login
- [ ] Refresh page (désérialisation)
- [ ] Timeout Supabase simulé
- [ ] Cache Redis fonctionnel
- [ ] Mode dégradé activé si Supabase down

### Monitoring
- [ ] Logs de désérialisation
- [ ] Métriques Redis
- [ ] Métriques Supabase
- [ ] Alertes circuit breaker

---

## 📚 Ressources

- [Passport.js Sessions](http://www.passportjs.org/docs/configure/)
- [Express Session](https://github.com/expressjs/session)
- [Redis Store](https://github.com/tj/connect-redis)
- [Circuit Breaker Pattern](https://martinfowler.com/bliki/CircuitBreaker.html)
