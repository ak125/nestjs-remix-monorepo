# Module Support - Documentation

## Vue d'ensemble

Le module Support est un système complet de gestion du support client pour Automecanik. Il centralise toutes les fonctionnalités liées au service client, aux avis, aux demandes de devis, aux réclamations, à la FAQ et aux documents légaux.

## Fonctionnalités

### 🎫 Système de Contact et Tickets
- Formulaire de contact avec validation
- Gestion des tickets avec statuts et priorités
- Assignation automatique et manuelle
- Historique des interactions
- Notifications temps réel

### ⭐ Gestion des Avis
- Soumission d'avis clients avec notes
- Système de modération
- Vérification des avis
- Analytics des avis
- Gestion des avis utiles/inutiles

### 💰 Demandes de Devis
- Soumission de demandes de devis
- Création et envoi de devis
- Suivi du statut (accepté/rejeté)
- Conversion tracking
- Gestion des produits demandés

### ❓ FAQ Dynamique
- Catégories personnalisables
- Recherche dans la FAQ
- Statistiques de consultation
- Gestion des tags
- Système de vote (utile/inutile)

### 📋 Réclamations
- Système de réclamations complet
- Timeline des actions
- Escalade automatique
- Résolutions multiples
- Suivi de satisfaction

### 📄 Documents Légaux
- Gestion des CGV, politique de confidentialité
- Versioning des documents
- Acceptation tracking
- Restauration de versions
- Multi-langues

### 📊 Analytics et Rapports
- Dashboard de performance
- KPIs en temps réel
- Rapports détaillés
- Tendances et insights
- Performance des agents

## Architecture

### Services

#### `SupportConfigService`
Configuration centralisée du module avec :
- Heures d'ouverture
- Paramètres de notification
- SLA de réponse
- Configuration des fichiers
- Paramètres des avis

#### `NotificationService`
Système de notifications unifié :
- Templates de notification
- Multi-canaux (email, push, webhook)
- Notifications contextuelles
- Gestion des priorités

#### `ContactService`
Gestion des tickets de contact :
- Création et suivi des tickets
- Gestion des réponses
- Calcul des statistiques
- Auto-tagging intelligent

#### `ReviewService`
Gestion des avis clients :
- Validation et modération
- Statistiques détaillées
- Filtrage avancé
- Vérification des avis

#### `QuoteService`
Gestion des devis :
- Workflow complet de devis
- Suivi des conversions
- Gestion des produits
- Analytics de performance

#### `FaqService`
FAQ dynamique :
- Catégories hiérarchiques
- Recherche full-text
- Analytics de consultation
- Gestion des votes

#### `ClaimService`
Gestion des réclamations :
- Timeline détaillée
- Escalade intelligente
- Résolutions multiples
- Suivi satisfaction

#### `LegalService`
Documents légaux :
- Versioning complet
- Multi-langues
- Tracking des acceptations
- Restauration de versions

#### `SupportAnalyticsService`
Analytics et rapports :
- KPIs temps réel
- Rapports automatiques
- Insights et recommandations
- Performance des équipes

### Contrôleurs

Chaque service a son contrôleur REST correspondant avec les endpoints standards :
- `ContactController` - `/api/support/contact`
- `ReviewController` - `/api/support/reviews`
- `QuoteController` - `/api/support/quotes`
- `FaqController` - `/api/support/faq`
- `LegalController` - `/api/support/legal`
- `ClaimController` - `/api/support/claims`
- `SupportAnalyticsController` - `/api/support/analytics`

## Configuration

### Variables d'environnement

```env
# Support Configuration
SUPPORT_EMAIL=support@automecanik.com
SUPPORT_PHONE=+33 1 23 45 67 89

# Business Hours
BUSINESS_HOURS_START=09:00
BUSINESS_HOURS_END=17:00
BUSINESS_TIMEZONE=Europe/Paris
BUSINESS_WORKDAYS=monday,tuesday,wednesday,thursday,friday

# Notifications
NOTIFICATIONS_EMAIL_ENABLED=true
NOTIFICATIONS_SMS_ENABLED=false
NOTIFICATIONS_PUSH_ENABLED=true
SUPPORT_WEBHOOK_URL=https://hooks.automecanik.com/support

# Response Times (minutes)
RESPONSE_TIME_URGENT=15
RESPONSE_TIME_HIGH=60
RESPONSE_TIME_NORMAL=240
RESPONSE_TIME_LOW=1440

# File Upload
FILE_UPLOAD_MAX_SIZE=10485760
FILE_UPLOAD_ALLOWED_TYPES=image/jpeg,image/png,application/pdf,text/plain
FILE_UPLOAD_MAX_FILES=5

# Reviews
REVIEWS_MODERATION_ENABLED=true
REVIEWS_AUTO_PUBLISH=false
REVIEWS_MIN_RATING=1
REVIEWS_MAX_RATING=5
```

## Utilisation

### Soumettre un ticket de contact

```typescript
const ticket = await contactService.submitContactForm({
  name: 'Jean Dupont',
  email: 'jean@example.com',
  subject: 'Problème de livraison',
  message: 'Ma commande n\'est pas arrivée...',
  priority: 'normal',
  category: 'delivery'
});
```

### Créer un avis

```typescript
const review = await reviewService.submitReview({
  customerId: 'customer-123',
  customerName: 'Marie Martin',
  customerEmail: 'marie@example.com',
  productId: 'product-456',
  rating: 5,
  title: 'Excellent produit',
  comment: 'Très satisfaite de mon achat...',
  verified: true
});
```

### Demander un devis

```typescript
const quoteRequest = await quoteService.submitQuoteRequest({
  customerName: 'Pierre Durand',
  customerEmail: 'pierre@example.com',
  projectDescription: 'Rénovation complète',
  requiredProducts: [
    { name: 'Pièce A', quantity: 2 },
    { name: 'Pièce B', quantity: 1 }
  ],
  priority: 'normal'
});
```

## Intégrations

### Base de données
Le module utilise `DatabaseModule` pour l'accès aux données Supabase.

### Notifications
Intégration avec `NotificationsModule` pour les notifications temps réel.

### Configuration
Utilise `ConfigModule` pour la gestion centralisée de la configuration.

## Sécurité

- Validation stricte des données d'entrée
- Sanitization des contenus
- Rate limiting sur les soumissions
- Logs d'audit complets
- Chiffrement des données sensibles

## Performance

- Cache intelligent des FAQ
- Pagination automatique
- Indexation optimisée
- Compression des réponses
- CDN pour les fichiers statiques

## Tests

```bash
# Tests unitaires
npm run test:unit support

# Tests d'intégration
npm run test:integration support

# Tests E2E
npm run test:e2e support
```

## Monitoring

- Métriques temps réel
- Alertes automatiques
- Logs structurés
- Dashboards Grafana
- Health checks

## Roadmap

### Phase 1 ✅ (Actuelle)
- Services de base
- API REST complète
- Analytics basiques

### Phase 2 🚧 (En cours)
- Interface d'administration
- Notifications push
- Intégration CRM

### Phase 3 📋 (Planifiée)
- IA pour réponses automatiques
- Chat en temps réel
- Intégration téléphonie

## Support

Pour toute question sur le module Support :
- 📧 Email : dev@automecanik.com
- 📚 Documentation : [docs.automecanik.com](https://docs.automecanik.com)
- 🐛 Issues : [GitHub Issues](https://github.com/automecanik/support/issues)
