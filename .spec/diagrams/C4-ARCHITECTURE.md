# C4 Architecture Diagrams - NestJS Remix Monorepo

Cette documentation présente l'architecture du système en utilisant le **modèle C4** (Context, Container, Component, Code) pour fournir différents niveaux de détail adaptés à chaque audience.

## Table des Matières

1. [Level 1 - System Context](#level-1---system-context)
2. [Level 2 - Container](#level-2---container)
3. [Level 3 - Component (Backend)](#level-3---component-backend)
4. [Level 4 - Code (Exemples)](#level-4---code-exemples)

---

## Level 1 - System Context

**Audience**: Business stakeholders, product managers, everyone  
**Vue d'ensemble**: Comment le système s'intègre dans son environnement

```mermaid
C4Context
    title System Context Diagram - Autoparts E-commerce Platform

    Person(customer, "Customer", "Client final achetant des pièces auto")
    Person(staff, "Staff", "Équipe administrative (support, commercial, admin)")
    
    System(platform, "Autoparts Platform", "Plateforme e-commerce spécialisée pièces auto (4M+ produits)")
    
    System_Ext(supabase, "Supabase", "PostgreSQL + Storage + Auth")
    System_Ext(keycloak, "Keycloak", "SSO & OAuth2 Enterprise")
    System_Ext(paybox, "Paybox", "Paiement sécurisé 3D Secure")
    System_Ext(meilisearch, "Meilisearch", "Moteur de recherche")
    System_Ext(redis, "Redis", "Cache distribué")
    System_Ext(email, "Email Provider", "SMTP transactionnel")
    System_Ext(carriers, "Carriers APIs", "DHL, UPS, Colissimo")
    System_Ext(vies, "EU VIES", "Validation TVA européenne")
    
    Rel(customer, platform, "Recherche, commande, suivi", "HTTPS")
    Rel(staff, platform, "Gestion commandes, support", "HTTPS")
    
    Rel(platform, supabase, "Données, fichiers, auth", "HTTPS/PostgREST")
    Rel(platform, keycloak, "SSO entreprise", "OAuth2")
    Rel(platform, paybox, "Paiements", "HTTPS")
    Rel(platform, meilisearch, "Recherche full-text", "HTTPS")
    Rel(platform, redis, "Cache sessions", "TCP")
    Rel(platform, email, "Emails transactionnels", "SMTP")
    Rel(platform, carriers, "Tracking, tarifs", "REST")
    Rel(platform, vies, "Validation VAT", "SOAP")

    UpdateLayoutConfig($c4ShapeInRow="4", $c4BoundaryInRow="2")
```

### Utilisateurs Principaux

| Acteur | Rôle | Interactions |
|--------|------|--------------|
| **Customer** | Client final B2C/B2B | Recherche produits, passe commandes, suivi livraison, factures |
| **Staff** | Équipe interne | Gestion commandes, support client, administration |

### Systèmes Externes

| Système | Criticité | Usage | Fallback |
|---------|-----------|-------|----------|
| **Supabase** | ⚠️ Critical | Base données, storage, auth | Aucun (requis) |
| **Redis** | ⚡ High | Cache sessions, performances | Mode dégradé sans cache |
| **Paybox** | ⚠️ Critical | Paiements 3D Secure | Paiement hors-ligne manuel |
| **Meilisearch** | ⚡ High | Recherche produits | PostgreSQL LIKE (lent) |
| **Keycloak** | 📊 Medium | SSO entreprise | Auth Supabase uniquement |
| **Email/SMS** | ⚡ High | Notifications clients | Queue retry automatique |
| **Carriers APIs** | 📊 Medium | Tracking livraison | Tracking manuel |
| **VIES API** | 📊 Medium | Validation TVA UE | Cache 24h, validation format |

---

## Level 2 - Container

**Audience**: Technical leads, architects, DevOps  
**Vue d'ensemble**: Containers (applications, services, data stores)

```mermaid
C4Container
    title Container Diagram - Autoparts Platform

    Person(customer, "Customer", "Client web/mobile")
    Person(staff, "Staff", "Équipe admin")

    Container_Boundary(platform, "Autoparts Platform") {
        Container(frontend, "Frontend SSR", "Remix + React 18", "Interface utilisateur responsive, SEO-optimisée")
        Container(backend, "Backend API", "NestJS 10 + TypeScript", "Business logic, REST API, 281 endpoints")
        Container(worker, "Background Worker", "NestJS + Bull", "Jobs asynchrones (exports, emails, sync)")
        
        ContainerDb(redis_cache, "Cache", "Redis 7.x", "Sessions, cache applicatif, queues")
        ContainerDb(meilisearch_search, "Search Engine", "Meilisearch 1.5", "Index 4M+ produits, autocomplete")
    }

    System_Ext(supabase_db, "PostgreSQL", "Supabase Database")
    System_Ext(supabase_storage, "Object Storage", "Supabase Storage")
    System_Ext(supabase_auth, "Auth Service", "Supabase Auth")
    System_Ext(keycloak_sso, "SSO Provider", "Keycloak OAuth2")
    System_Ext(paybox_gateway, "Payment Gateway", "Paybox")
    System_Ext(email_smtp, "Email Service", "SMTP Provider")

    Rel(customer, frontend, "Visite, navigue", "HTTPS")
    Rel(staff, frontend, "Administration", "HTTPS")
    
    Rel(frontend, backend, "API calls", "REST/JSON")
    Rel(backend, redis_cache, "Cache R/W, sessions", "Redis protocol")
    Rel(backend, meilisearch_search, "Recherche produits", "REST/JSON")
    Rel(backend, supabase_db, "CRUD données", "PostgREST")
    Rel(backend, supabase_storage, "Upload/download", "S3 API")
    Rel(backend, supabase_auth, "Passwordless auth", "REST")
    Rel(backend, keycloak_sso, "OAuth2 flow", "OAuth2")
    Rel(backend, paybox_gateway, "Process payments", "HTTPS")
    Rel(backend, email_smtp, "Send emails", "SMTP")
    
    Rel(worker, backend, "Délègue jobs", "Queue")
    Rel(worker, redis_cache, "Bull queues", "Redis protocol")
    Rel(worker, supabase_db, "Exports, reports", "PostgREST")

    UpdateLayoutConfig($c4ShapeInRow="3", $c4BoundaryInRow="1")
```

### Containers Details

#### Frontend SSR (Remix)
- **Technology**: Remix (React 18), Vite 5, TailwindCSS 3
- **Deployment**: Docker container, 3 replicas
- **Port**: 3001
- **Scaling**: Horizontal (3+ replicas)
- **Features**: 
  - Server-side rendering (SEO 95/100)
  - Progressive enhancement
  - Optimistic UI
  - Route-based code splitting

#### Backend API (NestJS)
- **Technology**: NestJS 10, TypeScript 5
- **Deployment**: Docker container, 3 replicas
- **Port**: 3000
- **Scaling**: Horizontal (3+ replicas)
- **Endpoints**: 281 REST endpoints
- **Modules**: 37 business modules
- **Features**:
  - JWT authentication
  - Role-based access control (RBAC)
  - Request validation (class-validator)
  - Rate limiting (10 req/s per IP)
  - Swagger documentation

#### Background Worker
- **Technology**: NestJS + Bull (Redis queues)
- **Deployment**: Docker container, 1-2 replicas
- **Jobs**:
  - **Exports**: CSV/Excel génération (orders, invoices)
  - **Emails**: Async sending (confirmations, notifications)
  - **Reports**: Daily/weekly/monthly business reports
  - **Sync**: Data synchronization (Meilisearch indexing)
  - **Cleanup**: Temp files, expired sessions

#### Redis Cache
- **Technology**: Redis 7.x
- **Deployment**: 1 master + 2 replicas (HA)
- **Memory**: 2GB allocated
- **Usage**:
  - Sessions (TTL 7 days)
  - API cache (TTL 5-30 min)
  - Bull queues
  - Rate limiting counters

#### Meilisearch
- **Technology**: Meilisearch 1.5+
- **Deployment**: Docker container, 1 replica
- **Index**: 4M+ products
- **Features**:
  - Typo-tolerance
  - Faceted search
  - Multi-language (FR, EN)
  - Autocomplete (<50ms)

---

## Level 3 - Component (Backend)

**Audience**: Software architects, senior developers  
**Vue d'ensemble**: Components (modules) au sein du Backend API

```mermaid
C4Component
    title Component Diagram - Backend API (NestJS)

    Container_Boundary(backend, "Backend API Container") {
        
        Component(api_gateway, "API Gateway", "NestJS Guards", "Authentication, rate limiting, logging")
        
        Component_Ext(auth_module, "Auth Module", "JWT + OAuth2", "Login, tokens, SSO")
        Component_Ext(users_module, "Users Module", "CRUD + profiles", "Customers, addresses, preferences")
        
        Component_Ext(products_module, "Products Module", "4M+ catalog", "CRUD, search, stock")
        Component_Ext(cart_module, "Cart Module", "Session-based", "Add/remove, calculations")
        Component_Ext(orders_module, "Orders Module", "State machine", "Creation, workflow, history")
        Component_Ext(payment_module, "Payment Module", "Paybox integration", "Transactions, 3DS, webhooks")
        Component_Ext(invoicing_module, "Invoicing Module", "PDF generation", "Invoices, credit notes")
        Component_Ext(taxes_module, "Taxes Module", "EU compliance", "VAT calculation, VIES, OSS")
        
        Component_Ext(shipping_module, "Shipping Module", "Multi-carriers", "Rates, tracking, labels")
        Component_Ext(tracking_module, "Tracking Module", "Real-time", "Status updates, notifications")
        
        Component_Ext(search_module, "Search Module", "Meilisearch", "Full-text, facets, autocomplete")
        Component_Ext(cache_module, "Cache Module", "Redis", "Distributed cache, invalidation")
        Component_Ext(upload_module, "Upload Module", "Supabase Storage", "Images, documents, virus scan")
        Component_Ext(config_module, "Config Module", "Multi-level", "App, payments, features, secrets")
        Component_Ext(health_module, "Health Module", "Monitoring", "Liveness, readiness, metrics")
        
        Component_Ext(database_module, "Database Module", "Supabase client", "Connection pool, retry, composition")
    }

    ContainerDb_Ext(redis, "Redis Cache")
    ContainerDb_Ext(meilisearch, "Meilisearch")
    ContainerDb_Ext(supabase, "Supabase PostgreSQL")
    System_Ext(paybox, "Paybox Gateway")
    System_Ext(vies, "VIES API")

    Rel(api_gateway, auth_module, "Validates tokens")
    
    Rel(products_module, search_module, "Index products")
    Rel(cart_module, products_module, "Get prices, stock")
    Rel(cart_module, taxes_module, "Calculate VAT")
    Rel(orders_module, cart_module, "Convert cart")
    Rel(orders_module, payment_module, "Process payment")
    Rel(orders_module, invoicing_module, "Generate invoice")
    Rel(orders_module, shipping_module, "Create shipment")
    Rel(payment_module, paybox, "3D Secure")
    Rel(taxes_module, vies, "Validate VAT")
    
    Rel(cache_module, redis, "Read/write cache")
    Rel(search_module, meilisearch, "Query index")
    Rel(database_module, supabase, "CRUD operations")
    
    Rel(auth_module, database_module, "User data")
    Rel(products_module, database_module, "Product data")
    Rel(orders_module, database_module, "Order data")

    UpdateLayoutConfig($c4ShapeInRow="4", $c4BoundaryInRow="1")
```

### Modules Architecture

#### 🛒 E-commerce Domain (9 modules, 100%)
- **Products**: 4M+ catalog, stock management, variants
- **Cart**: Session-based, calculations, persistence
- **Orders**: State machine (9 statuses), workflow, history
- **Customers**: B2C/B2B profiles, addresses, preferences
- **Payment**: Paybox integration, 3DS, fraud detection
- **Invoicing**: PDF generation, credit notes, accounting
- **Promo**: Coupons, discounts, rules engine
- **Équipementiers**: OEM suppliers, cross-reference
- **Taxes**: EU VAT, VIES validation, OSS reports

#### 🔐 Auth & Users Domain (3 modules, 100%)
- **Auth**: JWT + OAuth2, SSO Keycloak, passwordless
- **Supabase Auth**: Magic links, social login
- **Users/Staff**: CRUD, roles, permissions, RBAC

#### 📝 Content & Media Domain (4 modules, 100%)
- **News**: Blog, articles, SEO
- **SEO**: Meta tags, sitemap, redirections
- **Notifications**: Email, SMS, push (Firebase)
- **Media**: Upload, optimization, CDN

#### 🚚 Logistics Domain (3 modules, 100%)
- **Shipping**: Multi-carriers, rates, labels
- **Tracking**: Real-time status, webhooks
- **Vehicles**: Compatibility, 50K+ models

#### 🏗️ Infrastructure Domain (7 modules, 100%)
- **Database**: Supabase client, pooling, retry
- **Cache**: Redis distributed, TTL, invalidation
- **Search**: Meilisearch integration, indexing
- **Upload**: Storage, virus scan, optimization
- **Config**: Multi-level (app, payment, features, secrets)
- **Health**: Probes, metrics, monitoring
- **Errors**: Logging, redirections, retry

#### 📊 Analytics Domain (3 modules, 100%)
- **Dashboard**: KPIs, charts, real-time
- **Metrics**: Business metrics, tracking
- **Tracking**: Events, analytics

---

## Level 4 - Code (Exemples)

**Audience**: Developers working on the code  
**Vue d'ensemble**: Détails d'implémentation (classes, méthodes)

### Exemple 1: Architecture Modulaire - Database Module

```mermaid
classDiagram
    class DatabaseModule {
        +imports: ConfigModule, CacheModule
        +providers: DataServices[], CompositionService
        +exports: CompositionService, DataServices[]
    }

    class SupabaseBaseService {
        #client: SupabaseClient
        #logger: Logger
        +constructor(ConfigService)
        +getClient(): SupabaseClient
        #handleError(error): void
    }

    class CartDataService {
        -CACHE_PREFIX: string
        +findBySessionId(sessionId): Promise~Cart~
        +create(data): Promise~Cart~
        +update(id, data): Promise~Cart~
        +delete(id): Promise~void~
    }

    class UserDataService {
        -CACHE_PREFIX: string
        +findById(id): Promise~User~
        +findByEmail(email): Promise~User~
        +create(data): Promise~User~
        +update(id, data): Promise~User~
    }

    class OrderDataService {
        -CACHE_PREFIX: string
        +findById(id): Promise~Order~
        +findByUserId(userId): Promise~Order[]~
        +create(data): Promise~Order~
        +updateStatus(id, status): Promise~Order~
    }

    class DatabaseCompositionService {
        +cart: CartDataService
        +users: UserDataService
        +orders: OrderDataService
        +shipping: ShippingDataService
        +promo: PromoDataService
        +staff: StaffDataService
    }

    SupabaseBaseService <|-- CartDataService
    SupabaseBaseService <|-- UserDataService
    SupabaseBaseService <|-- OrderDataService
    
    DatabaseCompositionService o-- CartDataService
    DatabaseCompositionService o-- UserDataService
    DatabaseCompositionService o-- OrderDataService
    
    DatabaseModule ..> DatabaseCompositionService
```

**Avantages de l'architecture**:
- ✅ **Single Responsibility**: Chaque service 1 domaine métier
- ✅ **Testabilité**: Services isolés, mockable facilement
- ✅ **Scalabilité**: Ajout de nouveaux services sans impact
- ✅ **Composition**: DatabaseCompositionService agrège tout
- ✅ **Héritage**: SupabaseBaseService mutualise client + logging

---

### Exemple 2: Cache Strategy - Multi-Level Caching

```mermaid
sequenceDiagram
    participant Client
    participant Controller
    participant Service
    participant InMemory as In-Memory Cache
    participant Redis as Redis Cache
    participant DB as Supabase DB

    Client->>Controller: GET /api/products/123
    Controller->>Service: getProduct(123)
    
    Service->>InMemory: get('product:123')
    alt Cache hit (in-memory)
        InMemory-->>Service: Product data
        Service-->>Controller: Product
        Controller-->>Client: 200 OK (2ms)
    else Cache miss (in-memory)
        InMemory-->>Service: null
        Service->>Redis: get('product:123')
        
        alt Cache hit (Redis)
            Redis-->>Service: Product data
            Service->>InMemory: set('product:123', ttl=300s)
            Service-->>Controller: Product
            Controller-->>Client: 200 OK (15ms)
        else Cache miss (Redis)
            Redis-->>Service: null
            Service->>DB: SELECT * FROM products WHERE id=123
            DB-->>Service: Product data
            
            par Parallel cache population
                Service->>Redis: set('product:123', ttl=3600s)
                Service->>InMemory: set('product:123', ttl=300s)
            end
            
            Service-->>Controller: Product
            Controller-->>Client: 200 OK (120ms)
        end
    end
```

**Performance Metrics**:
- ✅ **In-Memory hit**: ~2ms (95% hit rate)
- ✅ **Redis hit**: ~15ms (90% hit rate L2)
- ✅ **Database query**: ~120ms (5% miss rate)
- ✅ **Overall avg**: ~10ms per request

**Cache Strategy**:
```typescript
// Config Module - Multi-level cache
class ConfigService {
  private inMemoryCache = new Map<string, any>();
  private readonly IN_MEMORY_TTL = 300; // 5 minutes
  private readonly REDIS_TTL = 3600; // 1 hour

  async get(key: string): Promise<any> {
    // L1: In-memory (fastest)
    const inMemory = this.inMemoryCache.get(key);
    if (inMemory && !this.isExpired(inMemory.expiry)) {
      return inMemory.value;
    }

    // L2: Redis (fast)
    const redisValue = await this.redis.get(`config:${key}`);
    if (redisValue) {
      this.setInMemory(key, redisValue);
      return redisValue;
    }

    // L3: Database (slow, but source of truth)
    const dbValue = await this.database.getConfig(key);
    
    // Populate cache layers
    await this.redis.setex(`config:${key}`, this.REDIS_TTL, dbValue);
    this.setInMemory(key, dbValue);

    return dbValue;
  }

  // Invalidate all cache levels
  async invalidate(key: string): Promise<void> {
    this.inMemoryCache.delete(key);
    await this.redis.del(`config:${key}`);
  }
}
```

---

### Exemple 3: Event-Driven Architecture - Order Workflow

```mermaid
sequenceDiagram
    participant Client
    participant OrderController
    participant OrderService
    participant PaymentService
    participant InvoicingService
    participant ShippingService
    participant NotificationService
    participant EventBus

    Client->>OrderController: POST /api/orders
    OrderController->>OrderService: createOrder(data)
    
    OrderService->>OrderService: validateOrder()
    OrderService->>OrderService: saveOrder(status=PENDING)
    OrderService->>EventBus: emit('order.created', order)
    
    EventBus-->>NotificationService: order.created
    NotificationService->>NotificationService: sendOrderConfirmation(email)
    
    OrderService->>PaymentService: processPayment(order)
    PaymentService->>PaymentService: payboxTransaction()
    PaymentService-->>OrderService: PaymentResult
    
    alt Payment Success
        OrderService->>OrderService: updateStatus(PAID)
        OrderService->>EventBus: emit('order.paid', order)
        
        par Parallel processing
            EventBus-->>InvoicingService: order.paid
            InvoicingService->>InvoicingService: generateInvoice(order)
            InvoicingService->>EventBus: emit('invoice.generated')
        and
            EventBus-->>ShippingService: order.paid
            ShippingService->>ShippingService: createShipment(order)
            ShippingService->>EventBus: emit('shipment.created')
        and
            EventBus-->>NotificationService: order.paid
            NotificationService->>NotificationService: sendPaymentConfirmation()
        end
        
        OrderService-->>OrderController: Order (PAID)
        OrderController-->>Client: 201 Created
    else Payment Failed
        OrderService->>OrderService: updateStatus(PAYMENT_FAILED)
        OrderService->>EventBus: emit('order.payment_failed', order)
        EventBus-->>NotificationService: order.payment_failed
        NotificationService->>NotificationService: sendPaymentFailedEmail()
        
        OrderService-->>OrderController: PaymentError
        OrderController-->>Client: 402 Payment Required
    end
```

**Event Patterns**:
```typescript
// Event-driven order workflow
@Injectable()
export class OrderService {
  constructor(
    private eventEmitter: EventEmitter2,
    private paymentService: PaymentService,
  ) {}

  async createOrder(data: CreateOrderDto): Promise<Order> {
    // 1. Validate and save order
    const order = await this.saveOrder(data);
    this.eventEmitter.emit('order.created', order);

    // 2. Process payment
    const paymentResult = await this.paymentService.process(order);

    if (paymentResult.success) {
      order.status = OrderStatus.PAID;
      await this.updateOrder(order);
      this.eventEmitter.emit('order.paid', order); // Triggers invoice + shipping
    } else {
      order.status = OrderStatus.PAYMENT_FAILED;
      await this.updateOrder(order);
      this.eventEmitter.emit('order.payment_failed', order);
    }

    return order;
  }
}

// Listener: Invoicing Service
@Injectable()
export class InvoicingService {
  @OnEvent('order.paid')
  async handleOrderPaid(order: Order): Promise<void> {
    const invoice = await this.generateInvoice(order);
    this.eventEmitter.emit('invoice.generated', { order, invoice });
  }
}

// Listener: Shipping Service
@Injectable()
export class ShippingService {
  @OnEvent('order.paid')
  async handleOrderPaid(order: Order): Promise<void> {
    const shipment = await this.createShipment(order);
    this.eventEmitter.emit('shipment.created', { order, shipment });
  }
}
```

---

## Deployment Architecture (Kubernetes)

### Production Cluster

```yaml
# Kubernetes Deployment
apiVersion: apps/v1
kind: Deployment
metadata:
  name: backend-api
  namespace: production
spec:
  replicas: 3  # Horizontal scaling
  selector:
    matchLabels:
      app: backend-api
  template:
    metadata:
      labels:
        app: backend-api
    spec:
      containers:
      - name: backend
        image: ghcr.io/ak125/nestjs-backend:v2.0.0
        ports:
        - containerPort: 3000
        env:
        - name: SUPABASE_URL
          valueFrom:
            secretKeyRef:
              name: supabase-secrets
              key: url
        - name: REDIS_HOST
          value: redis-master
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "2Gi"
            cpu: "2000m"
        livenessProbe:
          httpGet:
            path: /api/health/live
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /api/health/ready
            port: 3000
          initialDelaySeconds: 10
          periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: backend-api-service
spec:
  type: LoadBalancer
  selector:
    app: backend-api
  ports:
  - protocol: TCP
    port: 80
    targetPort: 3000
```

### Infrastructure Summary

| Component | Replicas | Resources | HA | Auto-scaling |
|-----------|----------|-----------|-----|--------------|
| **Backend API** | 3 | 512Mi-2Gi / 0.5-2 CPU | ✅ | Horizontal (3-10) |
| **Frontend SSR** | 3 | 256Mi-1Gi / 0.25-1 CPU | ✅ | Horizontal (3-10) |
| **Worker** | 1-2 | 512Mi-1Gi / 0.5-1 CPU | ⚠️ | Manual (1-3) |
| **Redis** | 3 (1M+2R) | 1Gi / 0.5 CPU | ✅ | Sentinel |
| **Meilisearch** | 1 | 2Gi / 1 CPU | ❌ | Manual |
| **PostgreSQL** | Managed | Supabase (multi-AZ) | ✅ | Automatic |

---

## Navigation

- 📖 [Retour INDEX.md](../INDEX.md)
- 📊 [GLOBAL-COVERAGE-REPORT.md](../GLOBAL-COVERAGE-REPORT.md)
- 📈 [PROJECT-STATS.md](../PROJECT-STATS.md)
- 🔄 [Sequence Diagrams](SEQUENCE-DIAGRAMS.md) (à créer)
- 📋 [OpenAPI Specification](../openapi.yaml) (à créer)

---

## Références

- **C4 Model**: https://c4model.com/
- **Mermaid Diagrams**: https://mermaid.js.org/
- **NestJS Architecture**: https://docs.nestjs.com/
- **Kubernetes**: https://kubernetes.io/docs/

---

**Version**: 1.0.0  
**Date**: 2025-01-15  
**Auteur**: Architecture Team  
**Status**: ✅ Production Ready
