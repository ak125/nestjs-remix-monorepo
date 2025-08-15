# API Commandes Étendue - Guide d'utilisation

## Vue d'ensemble

Ce module fournit une API complète pour la gestion des commandes avec des fonctionnalités avancées pour les fournisseurs et les tickets équivalents.

## Configuration

### 1. Importation du module

```typescript
import { OrdersExtendedModule } from './modules/orders';

@Module({
  imports: [
    // ... autres modules
    OrdersExtendedModule,
  ],
})
export class AppModule {}
```

### 2. Guards d'authentification

L'API utilise les guards existants :
- `AuthenticatedGuard` : pour les utilisateurs connectés
- `IsAdminGuard` : pour les permissions administrateur

## Endpoints disponibles

### Fournisseurs

#### Lister les fournisseurs
```
GET /api/orders/suppliers
Authorization: Bearer <token>
Rôle requis: Admin
```

#### Créer un fournisseur
```
POST /api/orders/suppliers
Authorization: Bearer <token>
Rôle requis: Admin

Body:
{
  "name": "Nom du fournisseur",
  "contactEmail": "contact@fournisseur.com",
  "contactPhone": "+33123456789",
  "address": "Adresse complète",
  "isActive": true
}
```

#### Mettre à jour un fournisseur
```
PUT /api/orders/suppliers/:id
Authorization: Bearer <token>
Rôle requis: Admin

Body: (champs partiels autorisés)
{
  "name": "Nouveau nom"
}
```

#### Lier un fournisseur à une marque
```
POST /api/orders/suppliers/link-brand
Authorization: Bearer <token>
Rôle requis: Admin

Body:
{
  "supplierId": 1,
  "brandId": 5,
  "isPreferred": true,
  "discountRate": 0.15,
  "deliveryDelay": 7
}
```

#### Statistiques d'un fournisseur
```
GET /api/orders/suppliers/:id/stats
Authorization: Bearer <token>
Rôle requis: Admin
```

### Tickets Équivalents

#### Créer un ticket
```
POST /api/orders/tickets
Authorization: Bearer <token>
Rôle requis: Admin

Body:
{
  "orderLineId": 123,
  "ticketValue": 25.50,
  "ticketReference": "CUSTOM-REF" // optionnel
}
```

#### Consulter un ticket
```
GET /api/orders/tickets/:reference
Authorization: Bearer <token>
```

#### Valider un ticket
```
POST /api/orders/tickets/:reference/validate
Authorization: Bearer <token>
Rôle requis: Admin
```

#### Utiliser un ticket
```
POST /api/orders/tickets/:reference/use
Authorization: Bearer <token>

Body:
{
  "amountToUse": 10.00
}
```

#### Vérifier la validité d'un ticket
```
GET /api/orders/tickets/:reference/validity
Authorization: Bearer <token>

Response:
{
  "isValid": true,
  "reason": "Ticket valide",
  "remainingAmount": 15.50,
  "ticket": { ... }
}
```

#### Étendre la validité d'un ticket
```
POST /api/orders/tickets/:reference/extend
Authorization: Bearer <token>
Rôle requis: Admin

Body:
{
  "expiryDate": "2024-12-31T23:59:59Z"
}
```

### Gestion des commandes

#### Tickets d'une commande
```
GET /api/orders/:orderId/tickets
Authorization: Bearer <token>
```

#### Appliquer un ticket à une commande
```
POST /api/orders/:orderId/apply-ticket
Authorization: Bearer <token>

Body:
{
  "ticketReference": "TICKET-123",
  "amountToUse": 15.00 // optionnel, utilise tout le ticket par défaut
}
```

## Exemples d'utilisation

### Workflow complet de ticket

```typescript
// 1. Créer un ticket
const ticket = await fetch('/api/orders/tickets', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + token,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    orderLineId: 456,
    ticketValue: 50.00,
  }),
});

// 2. Vérifier la validité
const validity = await fetch('/api/orders/tickets/TICKET-REF/validity');
const validityData = await validity.json();

if (validityData.isValid) {
  // 3. Utiliser partiellement le ticket
  const usage = await fetch('/api/orders/tickets/TICKET-REF/use', {
    method: 'POST',
    body: JSON.stringify({ amountToUse: 25.00 }),
  });
}
```

### Gestion des fournisseurs

```typescript
// 1. Créer un fournisseur
const supplier = await fetch('/api/orders/suppliers', {
  method: 'POST',
  body: JSON.stringify({
    name: 'Fournisseur Premium',
    contactEmail: 'contact@premium.com',
    isActive: true,
  }),
});

// 2. Lier à une marque avec préférence
const link = await fetch('/api/orders/suppliers/link-brand', {
  method: 'POST',
  body: JSON.stringify({
    supplierId: 1,
    brandId: 3,
    isPreferred: true,
    discountRate: 0.10,
  }),
});
```

## Validation des données

Toutes les données sont validées avec Zod. Les erreurs de validation retournent un code 400 avec des détails sur les champs invalides.

## Logs et audit

Toutes les opérations importantes sont loggées :
- Création/modification de tickets
- Validation/invalidation de tickets
- Utilisation de tickets
- Gestion des fournisseurs

## Gestion d'erreurs

- `400 Bad Request` : Données invalides ou ticket inexistant
- `401 Unauthorized` : Token manquant ou invalide
- `403 Forbidden` : Permissions insuffisantes
- `500 Internal Server Error` : Erreur serveur

## Tests

Exécutez les tests avec :
```bash
npm test orders-extended.controller.spec.ts
```
