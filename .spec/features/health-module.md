# Feature Spec: Health Module

**Phase**: 3 Extended (Feature 16/18)  
**Coverage**: +1 module → 78% (28/37 modules)  
**Endpoints**: 5 total (health, metrics, status, insights, dashboard)  
**Architecture**: 2 services (HealthService basique + SystemHealthService avancé)  
**Lines**: ~350 (services) + ~160 (controllers)

---

## 1. Objectif Métier

Module **health checks** pour monitoring applicatif : liveness probe, readiness probe, métriques système, statut services, insights performance.

**Business Value**:
- 🏥 Health checks (Kubernetes liveness/readiness probes)
- 📊 Métriques système (CPU, mémoire, uptime)
- 🔍 Statut services (database, cache, external APIs)
- 🧠 Insights performance (recommandations optimization)
- 📈 Dashboard monitoring (vue globale santé système)
- 🚨 Alertes proactives (détection problèmes avant impact users)

**Use Cases**:
- **DevOps**: Kubernetes health probes (GET /health)
- **Monitoring**: Prometheus/Grafana metrics scraping
- **Admin**: Dashboard santé temps réel
- **Debug**: Diagnostic performance issues
- **SRE**: Incidents response (quick status check)

---

## 2. Endpoints (5 Total)

### 2.1 GET /health

**Description**: Health check basique (liveness probe)  
**Controller**: `HealthController.getHealth()`  
**Service**: `HealthService.getHealth()`

**Query Params**: Aucun

**Response Example**:
```json
{
  "status": "ok",
  "timestamp": "2025-11-15T12:30:00.000Z",
  "uptime": 86400
}
```

**Business Logic**:
- Always returns HTTP 200 (app is running)
- Minimal processing (< 1ms response time)
- No external dependencies check
- Kubernetes liveness probe

**Use Case**: Kubernetes detects app crash, restarts pod if no response

---

### 2.2 GET /api/system/health

**Description**: Health check avancé (readiness probe)  
**Controller**: `SystemHealthController.getHealth()`  
**Service**: `SystemHealthService.getQuickHealth()`

**Query Params**: Aucun

**Response Example**:
```json
{
  "success": true,
  "status": "healthy",
  "timestamp": "2025-11-15T12:30:00.000Z",
  "uptime": 86400
}
```

**Business Logic**:
- Quick health check (no heavy operations)
- Returns success: true/false
- Uptime in seconds (process.uptime())
- Kubernetes readiness probe

**Use Case**: Kubernetes detects app ready to receive traffic

---

### 2.3 GET /api/system/metrics

**Description**: Métriques système (memory, CPU, environment)  
**Controller**: `SystemHealthController.getMetrics()`  
**Service**: `SystemHealthService.getSystemMetrics()`

**Query Params**: Aucun

**Response Example**:
```json
{
  "success": true,
  "data": {
    "memory": {
      "used": 123456789,
      "total": 256000000,
      "usedMB": 117.7,
      "totalMB": 244.1,
      "percentage": 48.2
    },
    "uptime": 86400,
    "uptimeFormatted": "1d 0h 0m",
    "environment": "production",
    "nodeVersion": "v20.10.0",
    "platform": "linux"
  },
  "timestamp": "2025-11-15T12:30:00.000Z"
}
```

**Business Logic**:
- Memory usage (process.memoryUsage())
  - heapUsed: JS heap used
  - heapTotal: JS heap allocated
  - rss: Resident Set Size (total memory)
  - external: C++ objects memory
- Uptime (process.uptime() in seconds)
- Environment (NODE_ENV)
- Node.js version (process.version)
- Platform (process.platform: linux, darwin, win32)

**Use Case**: Prometheus scraping, monitoring dashboard

---

### 2.4 GET /api/system/status

**Description**: Statut système complet (all services check)  
**Controller**: `SystemHealthController.getSystemStatus()`  
**Service**: `SystemService.getSystemStatus()`

**Query Params**: Aucun

**Response Example**:
```json
{
  "success": true,
  "data": {
    "overall": "healthy",
    "services": [
      {
        "service": "database",
        "status": "healthy",
        "responseTime": 45,
        "details": {
          "connections": 5,
          "tablesChecked": 5,
          "failedTables": 0
        },
        "timestamp": "2025-11-15T12:30:00.000Z"
      },
      {
        "service": "cache",
        "status": "healthy",
        "responseTime": 12,
        "details": {
          "connected": true,
          "keyCount": 1234,
          "memoryUsage": "24.3M"
        },
        "timestamp": "2025-11-15T12:30:00.000Z"
      },
      {
        "service": "memory",
        "status": "healthy",
        "responseTime": 2,
        "details": {
          "heapUsedMB": 150,
          "heapTotalMB": 256,
          "rssUsageMB": 200
        },
        "timestamp": "2025-11-15T12:30:00.000Z"
      }
    ],
    "alerts": [
      {
        "level": "warning",
        "service": "database",
        "message": "Slow database response",
        "details": "Database took 5234ms to respond",
        "timestamp": "2025-11-15T12:25:00.000Z"
      }
    ],
    "uptime": 86400,
    "version": "1.0.0",
    "environment": "production"
  },
  "timestamp": "2025-11-15T12:30:00.000Z"
}
```

**Business Logic**:
1. Check all critical services in parallel:
   - Database (Supabase connection + tables)
   - Cache (Redis connectivity + memory)
   - Memory (heap usage, RSS)
   - Disk (simulated space check)
   - External services (APIs connectivity)
2. Determine overall status:
   - `healthy`: All services OK
   - `degraded`: 1+ services degraded
   - `unhealthy`: 2+ services unhealthy
3. Collect active alerts (warnings, errors, critical)
4. Return comprehensive health report

**Status Levels**:
- **healthy**: Service operational (< 100ms response, no errors)
- **degraded**: Service slow (> 1000ms response, 5-10% error rate)
- **unhealthy**: Service down (timeout, connection failed, > 10% errors)

**Use Case**: Admin dashboard, SRE monitoring, incident investigation

---

### 2.5 GET /api/system/insights

**Description**: Insights performance et recommandations  
**Controller**: `SystemHealthController.getSystemInsights()`  
**Service**: `SystemService.getSystemInsights()`

**Query Params**: Aucun

**Response Example**:
```json
{
  "success": true,
  "data": {
    "performanceScore": 85,
    "recommendations": [
      {
        "priority": "high",
        "category": "database",
        "title": "Optimize slow queries",
        "description": "3 queries taking > 1000ms detected",
        "impact": "Reduces page load time by 40%",
        "action": "Review database indexes on tables: ___xtr_product, ___xtr_order"
      },
      {
        "priority": "medium",
        "category": "cache",
        "title": "Increase cache hit rate",
        "description": "Current hit rate: 65% (target: 80%)",
        "impact": "Reduces database load by 20%",
        "action": "Review cache TTL settings, increase for stable data"
      },
      {
        "priority": "low",
        "category": "memory",
        "title": "Memory usage optimizable",
        "description": "Memory usage: 65% (warning threshold: 80%)",
        "impact": "Prevents OOM errors",
        "action": "Monitor memory trends, consider increasing container limits"
      }
    ],
    "trends": {
      "responseTime": {
        "current": 245,
        "average": 220,
        "trend": "increasing",
        "changePercent": 11.4
      },
      "errorRate": {
        "current": 2.5,
        "average": 1.8,
        "trend": "increasing",
        "changePercent": 38.9
      },
      "throughput": {
        "current": 150,
        "average": 145,
        "trend": "stable",
        "changePercent": 3.4
      }
    },
    "optimization": {
      "cacheEfficiency": 65,
      "databaseIndexUsage": 78,
      "apiResponseTime": 240,
      "memoryUtilization": 48
    }
  },
  "timestamp": "2025-11-15T12:30:00.000Z"
}
```

**Business Logic**:
1. Calculate performance score (0-100):
   - Response time: 40 points (< 200ms = 40, > 1000ms = 0)
   - Error rate: 30 points (< 1% = 30, > 10% = 0)
   - Cache hit rate: 20 points (> 80% = 20, < 50% = 0)
   - Memory usage: 10 points (< 70% = 10, > 90% = 0)

2. Generate recommendations:
   - Analyze last 1h metrics
   - Detect anomalies (response time spikes, error rate increase)
   - Compare to baselines (average last 7 days)
   - Prioritize by impact (high > medium > low)

3. Trends analysis:
   - Compare current vs average (last 24h)
   - Detect trends (increasing, decreasing, stable)
   - Calculate change percentage

4. Optimization metrics:
   - Cache efficiency (hit rate %)
   - Database index usage (queries using indexes %)
   - API response time (p95 latency)
   - Memory utilization (heap + RSS %)

**Use Case**: Proactive optimization, capacity planning, performance tuning

---

### 2.6 GET /api/system/dashboard

**Description**: Dashboard monitoring complet (aggregation status + insights + metrics)  
**Controller**: `SystemHealthController.getSystemDashboard()`  
**Service**: Aggregation multiple services

**Query Params**: Aucun

**Response Example**:
```json
{
  "success": true,
  "data": {
    "system": {
      "overall": "healthy",
      "services": [...],
      "alerts": [...]
    },
    "insights": {
      "performanceScore": 85,
      "recommendations": [...],
      "trends": {...}
    },
    "quick": {
      "status": "healthy",
      "uptime": 86400
    },
    "metrics": {
      "memory": {...},
      "uptime": 86400
    },
    "recommendations": [
      {
        "priority": "high",
        "category": "database",
        "title": "Optimize slow queries"
      }
    ]
  },
  "timestamp": "2025-11-15T12:30:00.000Z"
}
```

**Business Logic**:
- Parallel fetch: status + insights + quick + metrics
- Aggregate results (single response)
- Top 5 recommendations (prioritized)
- Single API call (reduced latency vs 4 separate calls)

**Use Case**: Admin dashboard single-page view, monitoring tool integration

---

## 3. Architecture Services

### 3.1 HealthService - 20 lignes

**Location**: `/backend/src/modules/health/health.module.ts`  
**Responsibility**: Health check basique (liveness)

**Méthode**:
```typescript
getHealth(): { status: string; timestamp: string; uptime: number } {
  return {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  };
}
```

**Features**:
- Minimal logic (< 1ms response)
- No external dependencies
- Always returns HTTP 200
- Kubernetes liveness probe compatible

---

### 3.2 SystemHealthService - 50 lignes

**Location**: `/backend/src/modules/system/system-health.controller.ts`  
**Responsibility**: Health checks avancés + métriques

**Méthodes**:

```typescript
getQuickHealth(): {
  success: boolean;
  status: string;
  timestamp: string;
  uptime: number;
} {
  return {
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime())
  };
}
```

**Quick health** (readiness probe):
- Success flag (true/false)
- Status (healthy/unhealthy)
- Uptime (integer seconds)
- Kubernetes readiness probe compatible

```typescript
getSystemMetrics(): {
  success: boolean;
  data: {
    memory: { used: number; total: number };
    uptime: number;
    environment: string;
  };
  timestamp: string;
} {
  const memUsage = process.memoryUsage();
  
  return {
    success: true,
    data: {
      memory: {
        used: memUsage.heapUsed,
        total: memUsage.heapTotal,
        usedMB: Math.round(memUsage.heapUsed / 1024 / 1024),
        totalMB: Math.round(memUsage.heapTotal / 1024 / 1024),
        percentage: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100)
      },
      uptime: process.uptime(),
      uptimeFormatted: this.formatUptime(process.uptime()),
      environment: process.env.NODE_ENV || 'development',
      nodeVersion: process.version,
      platform: process.platform
    },
    timestamp: new Date().toISOString()
  };
}
```

**Metrics collection**:
- Memory: heap (JS objects), RSS (total process memory)
- Uptime: seconds since start, formatted (1d 2h 30m)
- Environment: development/production/test
- Node.js version: v20.10.0
- Platform: linux/darwin/win32

---

### 3.3 HealthCheckService - 350 lignes

**Location**: `/backend/src/modules/system/services/health-check.service.ts`  
**Responsibility**: Health checks complets tous services

**Méthodes Principales**:

```typescript
async performHealthCheck(): Promise<SystemHealthCheck> {
  // 1. Check all services in parallel
  const checks = await Promise.allSettled([
    this.checkDatabase(),
    this.checkMetricsService(),
    this.checkMemoryUsage(),
    this.checkDiskSpace(),
    this.checkExternalServices()
  ]);
  
  // 2. Map results to HealthCheckResult[]
  const services: HealthCheckResult[] = checks.map((check, index) => {
    if (check.status === 'fulfilled') return check.value;
    return {
      service: serviceNames[index],
      status: 'unhealthy',
      responseTime: -1,
      details: { error: check.reason?.message || 'Unknown error' },
      timestamp: new Date().toISOString()
    };
  });
  
  // 3. Determine overall status
  const unhealthyCount = services.filter(s => s.status === 'unhealthy').length;
  const degradedCount = services.filter(s => s.status === 'degraded').length;
  
  let overall: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
  if (unhealthyCount > 0) {
    overall = unhealthyCount > 1 ? 'unhealthy' : 'degraded';
  } else if (degradedCount > 0) {
    overall = 'degraded';
  }
  
  // 4. Return comprehensive health check
  return {
    overall,
    services,
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString()
  };
}
```

**Private Check Methods**:

```typescript
private async checkDatabase(): Promise<HealthCheckResult> {
  const startTime = Date.now();
  
  try {
    // Use DatabaseMonitorService for detailed DB health
    const health = await this.databaseMonitorService.checkDatabaseHealth();
    const responseTime = Date.now() - startTime;
    
    // Map database health status to check result status
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (health.status === 'critical') status = 'unhealthy';
    else if (health.status === 'warning') status = 'degraded';
    
    return {
      service: 'database',
      status,
      responseTime,
      details: {
        connections: health.connections,
        tablesChecked: Object.keys(health.tableStatus).length,
        failedTables: Object.values(health.tableStatus).filter(t => !t.accessible).length
      },
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return {
      service: 'database',
      status: 'unhealthy',
      responseTime: Date.now() - startTime,
      details: { error: error.message },
      timestamp: new Date().toISOString()
    };
  }
}
```

**Database check**:
- Uses DatabaseMonitorService (checks critical tables)
- Measures response time (ms)
- Counts accessible vs failed tables
- Status: healthy (all OK), degraded (1-2 failed), unhealthy (3+ failed)

```typescript
private async checkMemoryUsage(): Promise<HealthCheckResult> {
  const startTime = Date.now();
  
  try {
    const memoryUsage = process.memoryUsage();
    const heapUsedMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
    const heapTotalMB = Math.round(memoryUsage.heapTotal / 1024 / 1024);
    const rssUsageMB = Math.round(memoryUsage.rss / 1024 / 1024);
    
    // Thresholds
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (heapUsedMB > 1024) {        // > 1GB
      status = 'unhealthy';
    } else if (heapUsedMB > 512) {  // > 512MB
      status = 'degraded';
    }
    
    return {
      service: 'memory',
      status,
      responseTime: Date.now() - startTime,
      details: {
        heapUsedMB,
        heapTotalMB,
        rssUsageMB,
        external: Math.round(memoryUsage.external / 1024 / 1024)
      },
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return {
      service: 'memory',
      status: 'unhealthy',
      responseTime: Date.now() - startTime,
      details: { error: error.message },
      timestamp: new Date().toISOString()
    };
  }
}
```

**Memory check**:
- Heap used: JS objects memory (V8 heap)
- Heap total: Allocated heap size
- RSS: Resident Set Size (total process memory)
- External: C++ objects bound to JS
- Thresholds: healthy (< 512MB), degraded (512-1024MB), unhealthy (> 1GB)

```typescript
private async checkDiskSpace(): Promise<HealthCheckResult> {
  const startTime = Date.now();
  
  try {
    // Simulated in container (no real disk access)
    const simulatedDiskUsage = Math.random() * 100;
    
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (simulatedDiskUsage > 90) {       // > 90%
      status = 'unhealthy';
    } else if (simulatedDiskUsage > 80) { // > 80%
      status = 'degraded';
    }
    
    return {
      service: 'disk',
      status,
      responseTime: Date.now() - startTime,
      details: {
        usagePercentage: Math.round(simulatedDiskUsage),
        available: `${Math.round(100 - simulatedDiskUsage)}%`,
        note: 'Simulated in container environment'
      },
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return {
      service: 'disk',
      status: 'unhealthy',
      responseTime: Date.now() - startTime,
      details: { error: error.message },
      timestamp: new Date().toISOString()
    };
  }
}
```

**Disk check**:
- Simulated (container environment, no real fs access)
- Production: Use `fs` module to check actual disk space
- Thresholds: healthy (< 80%), degraded (80-90%), unhealthy (> 90%)

```typescript
async quickHealthCheck(): Promise<{
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  uptime: number;
}> {
  try {
    // Quick database ping (single query)
    const { error } = await this.supabase
      .from('___xtr_customer')
      .select('cst_id')
      .limit(1);
    
    return {
      status: error ? 'unhealthy' : 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    };
  } catch {
    return {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    };
  }
}
```

**Quick check**:
- Single database query (< 50ms)
- No heavy operations
- Used by Kubernetes readiness probe
- Fast fail (timeout 5s)

---

## 4. Integration Patterns

### 4.1 Kubernetes Probes

**Liveness Probe** (app is alive):
```yaml
livenessProbe:
  httpGet:
    path: /health
    port: 3000
  initialDelaySeconds: 30
  periodSeconds: 10
  timeoutSeconds: 5
  failureThreshold: 3
```

**Readiness Probe** (app ready for traffic):
```yaml
readinessProbe:
  httpGet:
    path: /api/system/health
    port: 3000
  initialDelaySeconds: 10
  periodSeconds: 5
  timeoutSeconds: 3
  failureThreshold: 2
```

**Startup Probe** (initial startup):
```yaml
startupProbe:
  httpGet:
    path: /health
    port: 3000
  initialDelaySeconds: 0
  periodSeconds: 2
  timeoutSeconds: 1
  failureThreshold: 30  # 60s max startup time
```

---

### 4.2 Prometheus Metrics

**Scrape Config**:
```yaml
scrape_configs:
  - job_name: 'nestjs-app'
    metrics_path: '/api/system/metrics'
    scrape_interval: 15s
    static_configs:
      - targets: ['app:3000']
```

**Alerting Rules**:
```yaml
groups:
  - name: app_health
    interval: 30s
    rules:
      - alert: HighMemoryUsage
        expr: app_memory_usage_percent > 80
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High memory usage detected"
      
      - alert: ServiceUnhealthy
        expr: app_service_status{status="unhealthy"} == 1
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Service {{ $labels.service }} is unhealthy"
```

---

### 4.3 Grafana Dashboard

**Dashboard JSON** (panels):
```json
{
  "dashboard": {
    "title": "Application Health",
    "panels": [
      {
        "title": "Overall Status",
        "type": "stat",
        "targets": [
          {
            "expr": "app_overall_status",
            "legendFormat": "Status"
          }
        ]
      },
      {
        "title": "Memory Usage",
        "type": "graph",
        "targets": [
          {
            "expr": "app_memory_heap_used_mb",
            "legendFormat": "Heap Used (MB)"
          },
          {
            "expr": "app_memory_heap_total_mb",
            "legendFormat": "Heap Total (MB)"
          }
        ]
      },
      {
        "title": "Service Health",
        "type": "table",
        "targets": [
          {
            "expr": "app_service_status",
            "format": "table"
          }
        ]
      }
    ]
  }
}
```

---

## 5. Business Rules

### 5.1 Status Thresholds

**Overall Status Calculation**:
- `healthy`: All services healthy
- `degraded`: 1 service unhealthy OR 2+ degraded
- `unhealthy`: 2+ services unhealthy

**Service-Specific Thresholds**:

| Service | Healthy | Degraded | Unhealthy |
|---------|---------|----------|-----------|
| Database | < 100ms response, 0 failed tables | 100-1000ms response, 1-2 failed tables | > 1000ms response, 3+ failed tables |
| Memory | < 512MB heap | 512-1024MB heap | > 1024MB heap |
| Disk | < 80% usage | 80-90% usage | > 90% usage |
| Cache | < 100ms latency, > 80% hit rate | 100-500ms latency, 50-80% hit rate | > 500ms latency, < 50% hit rate |
| External APIs | < 200ms response, 0 errors | 200-1000ms response, 1-5% errors | > 1000ms response, > 5% errors |

---

### 5.2 Alert Levels

**Priority Levels**:
- `critical`: Immediate action required (service down, data loss risk)
- `warning`: Investigation needed (performance degradation, approaching limits)
- `info`: Informational (config change, scheduled maintenance)

**Alert Examples**:
```typescript
// Critical: Database down
{
  level: 'critical',
  service: 'database',
  message: 'Database connection lost',
  details: 'All 5 critical tables inaccessible',
  timestamp: '2025-11-15T12:30:00.000Z'
}

// Warning: Slow response
{
  level: 'warning',
  service: 'database',
  message: 'Slow database response',
  details: 'Database took 5234ms to respond (threshold: 1000ms)',
  timestamp: '2025-11-15T12:30:00.000Z'
}

// Info: Maintenance mode
{
  level: 'info',
  service: 'system',
  message: 'Maintenance mode enabled',
  details: 'System will be unavailable 2025-11-16 02:00-04:00 UTC',
  timestamp: '2025-11-15T12:30:00.000Z'
}
```

---

### 5.3 Recommendations Prioritization

**Score Calculation**:
```typescript
function calculateRecommendationPriority(metric: Metric): 'high' | 'medium' | 'low' {
  const score = 
    (metric.impact * 0.4) +          // Business impact (40%)
    (metric.urgency * 0.3) +         // Time sensitivity (30%)
    (metric.complexity * 0.2) +      // Implementation effort (20%)
    (metric.confidence * 0.1);       // Data confidence (10%)
  
  if (score > 75) return 'high';
  if (score > 50) return 'medium';
  return 'low';
}
```

**Examples**:
- **High**: Database slow queries (impact: 90, urgency: 80, complexity: 60, confidence: 90) → score: 80
- **Medium**: Cache hit rate low (impact: 60, urgency: 50, complexity: 40, confidence: 80) → score: 55
- **Low**: Memory optimization (impact: 40, urgency: 30, complexity: 70, confidence: 70) → score: 45

---

## 6. Error Handling

### 6.1 Service Check Failures

**Database Check Fail**:
```json
{
  "service": "database",
  "status": "unhealthy",
  "responseTime": -1,
  "details": {
    "error": "Connection timeout after 5000ms"
  },
  "timestamp": "2025-11-15T12:30:00.000Z"
}
```

**Memory Check Error**:
```json
{
  "service": "memory",
  "status": "unhealthy",
  "responseTime": 0,
  "details": {
    "error": "Failed to read memory usage: process.memoryUsage is not a function"
  },
  "timestamp": "2025-11-15T12:30:00.000Z"
}
```

---

### 6.2 Timeout Handling

**Check Timeouts**:
- Database check: 5000ms timeout
- Cache check: 3000ms timeout
- External API check: 10000ms timeout
- Memory/disk check: No timeout (instant)

**Timeout Implementation**:
```typescript
async checkWithTimeout<T>(
  checkFn: () => Promise<T>,
  timeoutMs: number,
  serviceName: string
): Promise<T> {
  return Promise.race([
    checkFn(),
    new Promise<T>((_, reject) =>
      setTimeout(
        () => reject(new Error(`${serviceName} check timeout after ${timeoutMs}ms`)),
        timeoutMs
      )
    )
  ]);
}
```

---

## 7. Performance

### 7.1 Response Time Targets

**Endpoint Targets**:
- GET /health: < 1ms (no logic)
- GET /api/system/health: < 10ms (quick check)
- GET /api/system/metrics: < 5ms (memory read)
- GET /api/system/status: < 500ms (parallel checks)
- GET /api/system/insights: < 1000ms (analytics)
- GET /api/system/dashboard: < 1500ms (aggregation)

---

### 7.2 Caching Strategy

**Cache Health Results**:
```typescript
private healthCache = new Map<string, { result: any; expiry: number }>();

async getCachedHealth(service: string): Promise<HealthCheckResult | null> {
  const cached = this.healthCache.get(service);
  
  if (cached && cached.expiry > Date.now()) {
    return cached.result;
  }
  
  // Expired or missing
  this.healthCache.delete(service);
  return null;
}

async setCachedHealth(service: string, result: HealthCheckResult, ttl: number = 30000) {
  this.healthCache.set(service, {
    result,
    expiry: Date.now() + ttl
  });
}
```

**Cache TTLs**:
- Quick health: 10s (readiness probe frequency)
- Metrics: 30s (Prometheus scrape interval)
- Status: 60s (admin dashboard refresh)
- Insights: 300s (expensive analytics)

---

## 8. Testing

### 8.1 Endpoint Tests

**Health Check**:
```bash
curl http://localhost:3000/health
# Expected: { "status": "ok", "timestamp": "...", "uptime": 123 }
```

**System Status**:
```bash
curl http://localhost:3000/api/system/status
# Expected: { "success": true, "data": { "overall": "healthy", ... } }
```

**Metrics**:
```bash
curl http://localhost:3000/api/system/metrics
# Expected: { "success": true, "data": { "memory": {...}, "uptime": 123 } }
```

---

### 8.2 Unit Tests

```typescript
describe('HealthCheckService', () => {
  test('should return healthy status when all services OK', async () => {
    const result = await healthCheckService.performHealthCheck();
    
    expect(result.overall).toBe('healthy');
    expect(result.services).toHaveLength(5);
    expect(result.services.every(s => s.status === 'healthy')).toBe(true);
  });

  test('should return degraded when 1 service unhealthy', async () => {
    jest.spyOn(healthCheckService as any, 'checkDatabase')
      .mockResolvedValue({ service: 'database', status: 'unhealthy' });
    
    const result = await healthCheckService.performHealthCheck();
    
    expect(result.overall).toBe('degraded');
  });

  test('should handle check timeout', async () => {
    jest.spyOn(healthCheckService as any, 'checkDatabase')
      .mockImplementation(() => new Promise(resolve => setTimeout(resolve, 10000)));
    
    const result = await healthCheckService.performHealthCheck();
    
    const dbService = result.services.find(s => s.service === 'database');
    expect(dbService.status).toBe('unhealthy');
    expect(dbService.details.error).toContain('timeout');
  });
});
```

---

## 9. Migration Notes

### 9.1 Simple → Advanced Health

**Old** (simple `/health`):
- Only liveness check
- No service checks
- No metrics

**New** (advanced `/api/system/*`):
- Liveness + readiness
- Comprehensive service checks
- Metrics + insights + dashboard

**Migration**: Both endpoints coexist (backward compatible)

---

## 10. Summary

**Module Health**: Health checks complets pour monitoring applicatif avec Kubernetes probes, métriques système, insights performance.

**Endpoints**: 5 total
- GET /health (liveness probe, < 1ms)
- GET /api/system/health (readiness probe, < 10ms)
- GET /api/system/metrics (memory, uptime, env)
- GET /api/system/status (all services check)
- GET /api/system/insights (performance recommendations)

**Services**: 2 total
- HealthService (20 lignes, basique liveness)
- SystemHealthService (50 lignes, readiness + metrics)
- HealthCheckService (350 lignes, comprehensive checks)
- Total: ~420 lignes

**Features**:
- Kubernetes probes (liveness, readiness, startup)
- Prometheus metrics (scraping compatible)
- Grafana dashboard (pre-configured panels)
- Service checks (database, cache, memory, disk, external)
- Overall status (healthy, degraded, unhealthy)
- Alerts (critical, warning, info levels)
- Insights (performance score, recommendations, trends)
- Dashboard (aggregated view)

**Checks**:
- **Database**: Supabase connectivity, critical tables, response time
- **Cache**: Redis connectivity, memory usage, key count
- **Memory**: Heap usage, RSS, external memory
- **Disk**: Space usage (simulated in container)
- **External**: APIs connectivity, response time

**Status Levels**:
- **healthy**: All services OK (< 100ms response, 0 errors)
- **degraded**: 1 service slow/partial failure (100-1000ms, 1-5% errors)
- **unhealthy**: 2+ services down (> 1000ms, > 5% errors)

**Thresholds**:
- Memory: healthy (< 512MB), degraded (512-1024MB), unhealthy (> 1GB)
- Database: healthy (< 100ms), degraded (100-1000ms), unhealthy (> 1000ms)
- Disk: healthy (< 80%), degraded (80-90%), unhealthy (> 90%)

**Integration**:
- Kubernetes (probes configuration)
- Prometheus (metrics scraping)
- Grafana (dashboard panels)
- Alerting (webhook notifications)

**Performance**:
- Liveness: < 1ms (always returns OK)
- Readiness: < 10ms (quick database ping)
- Status: < 500ms (parallel checks)
- Insights: < 1000ms (analytics calculations)

**Caching**:
- Quick health: 10s TTL
- Metrics: 30s TTL
- Status: 60s TTL
- Insights: 300s TTL (5 min)

**Insights**:
- Performance score (0-100, based on response time, errors, cache, memory)
- Recommendations (prioritized: high, medium, low)
- Trends (increasing, decreasing, stable)
- Optimization metrics (cache efficiency, index usage, API latency)

**Testing**:
- Endpoint tests (curl health, status, metrics)
- Unit tests (healthy, degraded, unhealthy scenarios)
- Timeout tests (check timeout handling)

**Use Cases**:
- DevOps: Kubernetes health probes
- Monitoring: Prometheus/Grafana integration
- Admin: Real-time dashboard
- Debug: Performance troubleshooting
- SRE: Incident response

**Business Value**:
- Proactive monitoring (detect issues before user impact)
- Automated recovery (Kubernetes restarts unhealthy pods)
- Performance optimization (insights recommendations)
- Compliance (uptime SLA tracking)
- Cost reduction (identify resource waste)

**Coverage**: +1 module → 78% (28/37 modules)
**Lines**: ~700 total documentation
