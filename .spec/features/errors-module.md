---
title: "errors module"
status: draft
version: 1.0.0
---

# Feature 17/18: Errors Module

## 1. Objectif Métier

**Module de gestion complète des erreurs** avec logging centralisé, redirections intelligentes, filtres globaux, et analyse des erreurs fréquentes.

**Problèmes résolus**:
- 404 intelligentes avec suggestions automatiques
- 410 (Gone) pour contenus supprimés définitivement
- 412 (Precondition Failed) pour validation conditionnelle
- 451 (Legal Reasons) pour blocages légaux
- Redirections automatiques (301/302/307/308)
- Détection d'anciens formats d'URLs
- Logging structuré avec métadonnées enrichies
- Analyse des erreurs fréquentes et métriques

## 2. Architecture Services

### ErrorService (722L)
**Rôle**: Orchestration de la gestion des erreurs, recherche de suggestions, logging enrichi

**Méthodes principales**:
```typescript
// Gestion HTTP spécialisée
handle404(request): { shouldRedirect, redirectUrl?, suggestions?, context? }
handle410(request): { shouldRedirect, redirectUrl?, message? }
handle412(request, condition?): { shouldRetry, message, retryAfter? }

// Logging structuré
log404Error(request, context?): void
log410Error(request): void
log412Error(request, condition?): void
logError(error, request?, context?): void

// Suggestions intelligentes
findSuggestions(path): string[] (privé)
  → findSimilarPaths(keywords): string[]
  → findSimilarProducts(keywords): string[]

// Métriques et analyse
getErrors(options): { data: ErrorLog[], total: number }
getErrorMetrics(period): ErrorMetrics
getFrequentErrorsReport(): { frequent_404s, frequent_errors }
resolveError(errorId, resolvedBy): boolean

// Utilitaires de sécurité
sanitizeHeaders(headers): Record<string, any>
sanitizeBody(body): any
determineSeverity(error): 'low' | 'medium' | 'high' | 'critical'
```

**Logique de suggestion 404**:
1. Analyser le chemin (segments, mots-clés)
2. Chercher chemins similaires dans logs de succès
3. Si produit détecté (ID numérique) → suggestions produits similaires
4. Limiter à 5 suggestions max

**Severity determination**:
- **critical**: database, connection, timeout, uncaughtexception
- **high**: validation, authentication, authorization
- **medium**: not found, invalid, BadRequest
- **low**: autres cas

### ErrorLogService (533L)
**Rôle**: Persistence des logs d'erreur dans `___xtr_msg`, métriques, statistiques

**Interface dual** (compatibilité):
```typescript
// Format utilisateur original
interface ErrorLogEntry {
  code: number;
  url: string;
  userAgent?: string;
  ipAddress?: string;
  referrer?: string;
  userId?: string;
  sessionId?: string;
  metadata?: any;
}

// Format avancé
interface ErrorLog {
  msg_id: string;
  msg_cst_id?: string;
  msg_subject: string; // 'ERROR_404', 'ERROR_410', 'ERROR_STATISTICS'
  msg_content: string; // JSON stringifié
  msg_date: Date;
  msg_open: '0' | '1'; // 0=résolu, 1=ouvert
  msg_close: '0' | '1'; // 0=actif, 1=archivé
  errorMetadata?: {
    error_code: string;
    error_message: string;
    stack_trace?: string;
    request_url?: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    correlation_id: string;
    additional_context?: any;
  };
}
```

**Méthodes**:
```typescript
// Logging (dual signature)
logError(entry: ErrorLogEntry): void
logError(errorData: Partial<ErrorLog>): ErrorLog | null

// Queries
getErrors(options: { page?, limit?, severity?, resolved?, startDate?, endDate? })
getRecentErrors(limit): ErrorLog[]
getErrorStatistics(startDate, endDate): any[]

// Actions
resolveError(errorId, resolvedBy): boolean
cleanupOldLogs(retentionDays): number

// Métriques
getErrorMetrics(period): {
  total_errors: number;
  errors_by_severity: Record<string, number>;
  errors_by_service: Record<string, number>;
  error_rate_24h: number;
  most_common_errors: Array<{ code, message, count }>;
}
```

### RedirectService (574L)
**Rôle**: Gestion des règles de redirection avec cache, patterns regex, wildcards

**Interfaces**:
```typescript
// Format utilisateur original
interface RedirectEntry {
  old_path: string;
  new_path: string;
  redirect_type: number; // 301, 302, 307, 308
  reason?: string;
}

// Format avancé
interface RedirectRule {
  msg_id: string;
  msg_subject: 'REDIRECT_RULE';
  msg_content: string; // JSON stringifié
  msg_open: '0' | '1'; // 0=inactif, 1=actif
  redirectMetadata: {
    source_path: string;
    destination_path: string;
    status_code: number;
    is_active: boolean;
    is_regex: boolean; // Support patterns regex
    priority: number; // Ordre d'évaluation
    hit_count: number;
    last_hit?: Date;
  };
}
```

**Méthodes**:
```typescript
// Recherche (3 niveaux)
findRedirect(path): RedirectRule | RedirectEntry | null
  → 1. Recherche exacte dans cache (Map)
  → 2. Recherche regex (sorted by priority DESC)
  → 3. Recherche wildcard patterns (findPatternRedirect)

// CRUD
createRedirect(redirect: RedirectEntry): RedirectRule | null
createRedirectRule(rule: Partial<RedirectRule>): RedirectRule | null
updateRedirectRule(id, updates): boolean
deleteRedirectRule(id): boolean // Soft delete (msg_open='0', msg_close='1')

// Cache management
loadRedirectRules(): void (privé, refresh tous les 5min)
refreshCacheIfNeeded(): void (privé)

// Statistiques
getRedirectStats(): {
  total_rules: number;
  active_rules: number;
  total_hits: number;
  top_redirects: Array<{ source_path, destination_path, hit_count }>;
}
getAllRedirectRules(): RedirectRule[]
incrementHitCount(ruleId): void (privé, async non-blocking)

// Helpers
markAsGone(url, reason?): RedirectRule | null // Créer 410
```

**Cache strategy**:
- Expiration: 5 minutes
- Clés exactes: `Map<source_path, RedirectRule>`
- Clés regex: `Map<'regex_${id}', RedirectRule>`
- Refresh automatique si cache expiré

## 3. GlobalErrorFilter (398L)

**Rôle**: Exception filter global pour capture et transformation des erreurs HTTP

**Méthodes**:
```typescript
catch(exception, host): void
  → Routing par status code (404, 410, 412, 451, generic)

// Handlers spécialisés
handle404(request, response): void
  → 1. detectOldLinkPattern() → 410 si ancien format
  → 2. errorService.handle404() → redirection ou suggestions
  → 3. JSON API ou redirect frontend '/404'

handle410(request, response): void
  → errorService.handle410() → redirection ou message
  → JSON API ou redirect frontend '/gone'

handle412(request, response, exception): void
  → Extraction condition/requirement
  → JSON API { failedCondition, expectedCondition }

handle451(request, response): void
  → Blocage légal
  → JSON API ou redirect frontend '/legal-block'

handleGenericError(request, response, status, message, code, exception): void
  → errorService.logError() async (non-blocking)
  → JSON { statusCode, timestamp, path, method, message, error }

// Utilitaires
isApiRequest(request): boolean
  → Check '/api/' path OR 'application/json' headers
detectOldLinkPattern(path): boolean
  → 15+ regex patterns (old-format-, legacy-, .php, .asp, v1/, v2/, etc.)
```

**Old link patterns détectés** (→ 410):
```typescript
/^\/old-format-/i
/^\/legacy-/i
/^\/v1\//i, /^\/v2\//i
/\.php$/i, /\.asp$/i, /\.jsp$/i
/\/index\.html?$/i, /\/default\.html?$/i
/^\/app\//i, /^\/old\//i, /^\/archive\//i
/\/product-(\d+)\.html$/i
/\/category-(\d+)\.html$/i
/\?id=\d+/
```

## 4. ErrorController (203L)

**12 endpoints**:

### GET /api/errors
Récupère les erreurs avec pagination et filtres
```typescript
Query: { page?, limit?, severity?, resolved? }
Response: { data: ErrorLog[], total: number, page, limit }
```

### GET /api/errors/metrics
Métriques d'erreurs par période
```typescript
Query: { period?: '24h' | '7d' | '30d' }
Response: {
  total_errors: number;
  errors_by_severity: { low: 10, medium: 5, high: 2, critical: 1 };
  errors_by_service: { api: 15, frontend: 3 };
  error_rate_24h: 1.2; // erreurs/heure
  most_common_errors: Array<{ code, message, count }>;
}
```

### GET /api/errors/frequent
Rapport des erreurs fréquentes (top 20)
```typescript
Response: {
  frequent_404s: Array<{ path, count, last_occurrence }>;
  frequent_errors: Array<{ code, message, count, severity }>;
}
```

### PUT /api/errors/:id/resolve
Marque une erreur comme résolue
```typescript
Body: { resolved_by: string }
Response: { success: boolean }
```

### GET /api/errors/redirects
Liste toutes les redirections
```typescript
Response: RedirectRule[]
```

### POST /api/errors/redirects
Crée une nouvelle redirection
```typescript
Body: {
  source_path: string;
  destination_path: string;
  status_code: number; // 301, 302, 307, 308
  is_regex?: boolean;
  priority?: number;
  description?: string;
}
Response: RedirectRule
```

### PUT /api/errors/redirects/:id
Met à jour une redirection
```typescript
Body: Partial<RedirectRule>
Response: { success: boolean }
```

### DELETE /api/errors/redirects/:id
Supprime (soft delete) une redirection
```typescript
Response: { success: boolean }
```

### GET /api/errors/redirects/stats
Statistiques des redirections
```typescript
Response: {
  total_rules: number;
  active_rules: number;
  total_hits: number;
  top_redirects: Array<{ source_path, destination_path, hit_count }>;
}
```

### POST /api/errors/cleanup
Nettoie les anciens logs
```typescript
Body: { retention_days?: number } // Défaut: 90
Response: { deleted_count: number }
```

### POST /api/errors/redirects/test
Teste si un chemin a une redirection
```typescript
Body: { path: string }
Response: { has_redirect: boolean, redirect: RedirectRule | null }
```

### GET /api/errors/test/412
Endpoint de test pour 412
```typescript
Query: { condition?, requirement? }
Throws: PreconditionFailedException
```

## 5. Database Schema

**Table `___xtr_msg`** (réutilisée pour logs et redirections):

```sql
-- Logs d'erreur
msg_subject: 'ERROR_404' | 'ERROR_410' | 'ERROR_412' | 'ERROR_[CODE]' | 'ERROR_STATISTICS'
msg_content: JSON stringifié {
  error_code: string,
  error_message: string,
  request_url: string,
  severity: 'low' | 'medium' | 'high' | 'critical',
  correlation_id: string,
  stack_trace?: string,
  additional_context?: any
}
msg_open: '1' = non résolu, '0' = résolu
msg_close: '0' = actif, '1' = archivé

-- Règles de redirection
msg_subject: 'REDIRECT_RULE'
msg_content: JSON stringifié {
  source_path: string,
  destination_path: string,
  status_code: number,
  is_active: boolean,
  is_regex: boolean,
  priority: number,
  hit_count: number,
  last_hit?: Date
}
msg_open: '1' = actif, '0' = inactif
msg_close: '0' = ouvert, '1' = supprimé (soft delete)
```

## 6. Business Rules

### Severity Levels
- **low**: 404, autres requêtes invalides, codes < 400
- **medium**: 410, 412, validation errors, codes 300-399
- **high**: 401, 403, authentication/authorization, codes 400-499
- **critical**: 500+, database errors, timeout, uncaught exceptions

### Redirect Status Codes
- **301**: Permanent (cache navigateur + SEO)
- **302**: Temporary (pas de cache)
- **307**: Temporary (préserve méthode HTTP)
- **308**: Permanent (préserve méthode HTTP)

### Pattern Priority
1. Exact match (cache Map)
2. Regex rules (by priority DESC)
3. Wildcard patterns (*, $1, $2)

### Data Retention
- **Default**: 90 jours
- **Critical errors**: Conservation indéfinie (msg_close='0')
- **Statistics**: Agrégation quotidienne

## 7. Error Handling

### Filter Safety
```typescript
// Vérification immédiate headers
if (response.headersSent) {
  logger.warn('Headers already sent - Skipping');
  return;
}
```

### Non-blocking Logging
```typescript
// Logging async sans bloquer la réponse
errorService.logError(error, request)
  .catch(err => logger.error('Failed to log:', err.message));
```

### Fallback Responses
```typescript
// Si service échoue, réponse basique
catch (error) {
  response.status(status).json({
    statusCode: status,
    message: 'Erreur générique',
    error: 'Error'
  });
}
```

## 8. Performance

### Caching
- **Redirections**: 5 min en mémoire (Map)
- **Refresh**: Automatique si expiré
- **Hit count**: Async non-blocking

### Response Times
- **Exact redirect**: < 5ms (cache lookup)
- **Regex redirect**: < 20ms (sorted iteration)
- **Error logging**: < 50ms (async Supabase insert)
- **Metrics calculation**: < 500ms (1000 dernières erreurs)

### Database Optimization
```typescript
// Index Supabase
CREATE INDEX idx_msg_subject ON ___xtr_msg(msg_subject);
CREATE INDEX idx_msg_date ON ___xtr_msg(msg_date DESC);
CREATE INDEX idx_msg_open ON ___xtr_msg(msg_open);

// Queries optimisées
.eq('msg_subject', 'ERROR_404')
.order('msg_date', { ascending: false })
.limit(100)
```

## 9. Testing

### Unit Tests
```typescript
describe('ErrorService', () => {
  it('should find suggestions for 404 URL');
  it('should determine correct severity');
  it('should sanitize sensitive data');
  it('should handle redirect compatibility');
});

describe('RedirectService', () => {
  it('should match exact path');
  it('should match regex pattern');
  it('should match wildcard pattern');
  it('should respect priority order');
  it('should increment hit count');
});

describe('GlobalErrorFilter', () => {
  it('should detect old link patterns');
  it('should route by status code');
  it('should prevent double header send');
  it('should handle API vs frontend requests');
});
```

### Integration Tests
```bash
# Test 404 avec suggestions
curl -X GET http://localhost:3000/invalid-product-123
# → { suggestions: ['/products/search?q=product', '/products/popular'] }

# Test redirection
curl -I http://localhost:3000/old-url
# → 301 Moved Permanently, Location: /new-url

# Test ancien format → 410
curl -I http://localhost:3000/product-123.html
# → 410 Gone

# Test métriques
curl http://localhost:3000/api/errors/metrics?period=24h
```

## 10. Migration Notes

### Compatibilité Dual
```typescript
// Support ancien format ErrorLogEntry
logError(entry: ErrorLogEntry): void

// Support nouveau format ErrorLog
logError(errorData: Partial<ErrorLog>): ErrorLog | null

// Détection automatique
private isErrorLogEntry(entry): boolean {
  return 'code' in entry && 'url' in entry;
}
```

### Migration Redirections
```typescript
// Ancien système (fichier JSON)
{ source: "/old", destination: "/new", permanent: true }

// Nouveau système (___xtr_msg)
{
  msg_subject: "REDIRECT_RULE",
  msg_content: JSON.stringify({
    source_path: "/old",
    destination_path: "/new",
    status_code: 301,
    is_regex: false,
    priority: 0
  })
}
```

## 11. Summary

**Module complet de gestion d'erreurs** avec:
- **3 services** (ErrorService 722L, ErrorLogService 533L, RedirectService 574L)
- **1 filtre global** (GlobalErrorFilter 398L)
- **1 contrôleur** (ErrorController 203L, 12 endpoints)
- **Total**: 2430 lignes

**Fonctionnalités clés**:
- Gestion HTTP intelligente (404, 410, 412, 451)
- Suggestions automatiques pour 404
- Redirections (exact, regex, wildcard)
- Logging structuré avec métadonnées enrichies
- Métriques temps réel (par severity, service, période)
- Détection anciens formats URL
- Cache 5min pour redirections
- Sanitization données sensibles
- Compatibilité dual (ancien/nouveau format)
- Soft delete (pas de perte de données)

**Business value**:
- SEO optimisé (redirections 301 permanentes)
- UX améliorée (suggestions intelligentes 404)
- Monitoring proactif (métriques, erreurs fréquentes)
- Compliance légale (blocage 451)
- Performance (cache, async logging)
- Auditabilité complète (tous logs persistés)
- Maintenance facilitée (analyse erreurs fréquentes)
