---
title: "webhooks"
status: draft
version: 1.0.0
---

# 🪝 Guide Webhooks

## Vue d'Ensemble

Les webhooks permettent aux systèmes externes d'envoyer des **notifications en temps réel** vers notre API. Ce guide couvre la sécurisation, l'idempotence, et les best practices.

:::tip Architecture
L'API reçoit ~500 callbacks/jour en production (Paybox, transporteurs, TecDoc, n8n).
:::

---

## 🎯 Webhooks Disponibles

### Tableau Récapitulatif

| Webhook | URL | Méthode | Sécurité | Fréquence |
|---------|-----|---------|----------|-----------|
| **Paybox IPN** | `/api/paybox/callback` | POST | HMAC-SHA512 | ~300/jour |
| **CyberPlus** | `/api/payments/callback/cyberplus` | POST | HMAC-SHA256 | ~50/jour (legacy) |
| **TecDoc** | `/api/integrations/tecdoc/webhook` | POST | IP Whitelist | ~20/jour |
| **Carriers** | `/api/tracking/webhook` | POST | API Key | ~100/jour |
| **n8n Automation** | `/api/webhooks/n8n/{id}` | POST | Secret Query Param | Variable |

---

## 🔐 Sécurité HMAC

### Concept

**HMAC** (Hash-based Message Authentication Code) garantit :
- **Authenticité** : Le message vient bien de l'expéditeur déclaré
- **Intégrité** : Le message n'a pas été modifié en transit
- **Non-répudiation** : L'expéditeur ne peut nier avoir envoyé le message

### Algorithmes Utilisés

- **Paybox** : HMAC-SHA512 (128 caractères hex)
- **CyberPlus** : HMAC-SHA256 (64 caractères hex)
- **n8n** : Secret simple (query param)

---

## 🛡️ Implémenter HMAC-SHA512 (Paybox)

### 1. Configuration

```typescript
// backend/src/config/paybox.config.ts
export const payboxConfig = {
  hmacKey: process.env.PAYBOX_HMAC_KEY, // 128 chars hex
  site: process.env.PAYBOX_SITE,         // 7 digits
  rang: process.env.PAYBOX_RANG,         // 2-3 digits
  identifiant: process.env.PAYBOX_IDENTIFIANT, // 9 digits
};
```

**.env** :
```bash
PAYBOX_HMAC_KEY=0123456789ABCDEF... # 128 caractères hex
PAYBOX_SITE=1999888
PAYBOX_RANG=001
PAYBOX_IDENTIFIANT=123456789
```

### 2. Générer Signature (Envoi Paiement)

```typescript
import * as crypto from 'crypto';

function generatePayboxSignature(
  params: Record<string, string>,
  hmacKey: string
): string {
  // 1. Construire string à signer (ORDRE EXACT)
  const orderedKeys = [
    'PBX_SITE', 'PBX_RANG', 'PBX_IDENTIFIANT',
    'PBX_TOTAL', 'PBX_DEVISE', 'PBX_CMD',
    'PBX_PORTEUR', 'PBX_RETOUR', 'PBX_HASH',
    'PBX_TIME', 'PBX_EFFECTUE', 'PBX_REFUSE',
    'PBX_ANNULE', 'PBX_REPONDRE_A'
  ];
  
  const signatureString = orderedKeys
    .filter(key => params[key] !== undefined)
    .map(key => `${key}=${params[key]}`)
    .join('&');
  
  // 2. Convertir clé hex en buffer
  const keyBuffer = Buffer.from(hmacKey, 'hex');
  
  // 3. Calculer HMAC-SHA512
  const hmac = crypto.createHmac('sha512', keyBuffer);
  hmac.update(signatureString, 'utf8');
  const signature = hmac.digest('hex').toUpperCase();
  
  return signature;
}
```

**Exemple Usage** :
```typescript
const params = {
  PBX_SITE: '1999888',
  PBX_RANG: '001',
  PBX_IDENTIFIANT: '123456789',
  PBX_TOTAL: '1000', // 10.00€
  PBX_DEVISE: '978',  // EUR
  PBX_CMD: 'ORD-2024-001',
  PBX_PORTEUR: 'client@example.com',
  PBX_RETOUR: 'Mt:M;Ref:R;Auto:A;Erreur:E;Signature:K',
  PBX_HASH: 'SHA512',
  PBX_TIME: '2024-11-15T10:30:00+01:00',
};

const signature = generatePayboxSignature(params, HMAC_KEY);
// Signature: 3F2504E0C9F01... (128 chars)

// Envoyer au client pour soumission formulaire
formData = { ...params, PBX_HMAC: signature };
```

### 3. Vérifier Signature (Callback IPN)

```typescript
function verifyPayboxSignature(
  queryParams: Record<string, string>,
  receivedSignature: string,
  hmacKey: string
): boolean {
  // 1. Extraire paramètres (sauf signature)
  const { K, Signature, PBX_HMAC, ...paramsToSign } = queryParams;
  
  // 2. Reconstruire string à signer
  const signatureString = Object.keys(paramsToSign)
    .sort() // Ordre alphabétique pour callback
    .map(key => `${key}=${paramsToSign[key]}`)
    .join('&');
  
  // 3. Calculer signature attendue
  const keyBuffer = Buffer.from(hmacKey, 'hex');
  const hmac = crypto.createHmac('sha512', keyBuffer);
  hmac.update(signatureString, 'utf8');
  const expectedSignature = hmac.digest('hex').toUpperCase();
  
  // 4. Comparer (timing-safe)
  return crypto.timingSafeEqual(
    Buffer.from(expectedSignature),
    Buffer.from(receivedSignature.toUpperCase())
  );
}
```

**Exemple Callback** :
```typescript
// Controller
@Post('api/paybox/callback')
async handlePayboxCallback(
  @Query() query: Record<string, string>,
  @Res() res: Response
) {
  const signature = query.K || query.Signature;
  
  // Vérifier signature
  const isValid = verifyPayboxSignature(
    query,
    signature,
    process.env.PAYBOX_HMAC_KEY
  );
  
  if (!isValid) {
    this.logger.error('❌ Signature Paybox invalide !');
    return res.status(403).send('Signature invalide');
  }
  
  // Traiter paiement
  const errorCode = query.Erreur || query.E;
  if (errorCode === '00000') {
    await this.processSuccessfulPayment(query);
  } else {
    await this.processFailedPayment(query, errorCode);
  }
  
  // TOUJOURS retourner 200 OK
  return res.status(200).send('OK');
}
```

---

## 🔄 Idempotence

### Problème

Un webhook peut être appelé **plusieurs fois** pour la même transaction :
- Retry automatique (timeout réseau)
- Replay attaque
- Erreur temporaire côté receveur

### Solution : Deduplication

```typescript
import { Injectable } from '@nestjs/common';
import { Redis } from 'ioredis';

@Injectable()
export class WebhookDeduplicationService {
  constructor(private readonly redis: Redis) {}
  
  /**
   * Vérifie si le webhook a déjà été traité
   * Utilise Redis avec TTL 24h
   */
  async isDuplicate(webhookId: string): Promise<boolean> {
    const key = `webhook:processed:${webhookId}`;
    const exists = await this.redis.get(key);
    
    if (exists) {
      return true; // Déjà traité
    }
    
    // Marquer comme traité (TTL 24h)
    await this.redis.set(key, '1', 'EX', 86400);
    return false;
  }
}
```

**Usage dans Controller** :
```typescript
@Post('api/paybox/callback')
async handlePayboxCallback(@Query() query: Record<string, string>) {
  const transactionId = query.Ref; // ID unique transaction
  
  // Vérifier duplication
  const isDuplicate = await this.deduplication.isDuplicate(transactionId);
  if (isDuplicate) {
    this.logger.warn(`Webhook déjà traité : ${transactionId}`);
    return { success: true, message: 'Already processed' };
  }
  
  // Traiter webhook...
}
```

---

## 🔁 Retry Logic

### Stratégie Paybox

Paybox retente automatiquement les callbacks :
- **Intervalle** : 30 secondes
- **Tentatives** : 3 maximum
- **Timeout** : 30 secondes par requête

### Backend Response

```typescript
@Post('api/paybox/callback')
async handlePayboxCallback(@Query() query: Record<string, string>) {
  try {
    // Traitement rapide (&lt;10s idéalement)
    await this.processPayment(query);
    
    // Toujours retourner 200 OK rapidement
    return { success: true };
    
  } catch (error) {
    this.logger.error('Erreur traitement webhook:', error);
    
    // ⚠️ Retourner 200 quand même si erreur non-critique
    // Paybox retentera et on loguera l'erreur
    
    // ❌ Retourner 5xx SEULEMENT si erreur serveur grave
    if (this.isCriticalError(error)) {
      throw new InternalServerErrorException();
    }
    
    return { success: false, error: error.message };
  }
}
```

### Async Processing

Pour webhooks lourds, utiliser une **queue** :

```typescript
import { Queue } from 'bull';

@Post('api/paybox/callback')
async handlePayboxCallback(@Query() query: Record<string, string>) {
  // Validation rapide
  const isValid = this.verifySignature(query);
  if (!isValid) {
    return res.status(403).send('Invalid signature');
  }
  
  // Envoyer dans queue (traitement asynchrone)
  await this.paymentQueue.add('process-payment', {
    transactionId: query.Ref,
    params: query,
  });
  
  // Retourner 200 OK immédiatement
  return { success: true, queued: true };
}
```

---

## 📝 Audit Logging

### Enregistrer Tous les Webhooks

```typescript
@Injectable()
export class WebhookAuditService {
  async logWebhook(data: {
    source: string;
    endpoint: string;
    params: Record<string, any>;
    signature: string;
    signatureValid: boolean;
    ip: string;
    timestamp: Date;
  }) {
    await this.db.query(`
      INSERT INTO ic_postback (
        source, endpoint, params, signature,
        signature_valid, ip_address, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [
      data.source,
      data.endpoint,
      JSON.stringify(data.params),
      data.signature,
      data.signatureValid,
      data.ip,
      data.timestamp,
    ]);
  }
}
```

**Usage** :
```typescript
@Post('api/paybox/callback')
async handlePayboxCallback(
  @Query() query: Record<string, string>,
  @Ip() ip: string
) {
  const signature = query.K;
  const isValid = this.verifySignature(query, signature);
  
  // Logger AVANT traitement
  await this.audit.logWebhook({
    source: 'paybox',
    endpoint: '/api/paybox/callback',
    params: query,
    signature,
    signatureValid: isValid,
    ip,
    timestamp: new Date(),
  });
  
  // Traiter...
}
```

---

## 🧪 Tests & Debugging

### Tester en Local

```bash
# 1. Lancer ngrok pour exposer localhost
ngrok http 3000

# URL: https://abc123.ngrok.io

# 2. Configurer Paybox Back-Office
# URL IPN: https://abc123.ngrok.io/api/paybox/callback

# 3. Faire un paiement test
# Consulter logs backend:
pm2 logs backend | grep -i paybox
```

### Simuler Callback Paybox

```bash
#!/bin/bash
# test-paybox-callback.sh

HMAC_KEY="0123456789ABCDEF..." # Votre clé de test

# Paramètres callback
PARAMS="Mt=1000&Ref=ORD-TEST-001&Auto=123456&Erreur=00000"

# Générer signature
SIGNATURE=$(echo -n "$PARAMS" | openssl dgst -sha512 -hmac $(echo -n "$HMAC_KEY" | xxd -r -p) | awk '{print toupper($2)}')

# Envoyer callback
curl -X POST "http://localhost:3000/api/paybox/callback?${PARAMS}&K=${SIGNATURE}"
```

### Vérifier Signature Manuellement

```typescript
// debug-signature.ts
import * as crypto from 'crypto';

const params = {
  Mt: '1000',
  Ref: 'ORD-TEST-001',
  Auto: '123456',
  Erreur: '00000',
};

const hmacKey = '0123456789ABCDEF...'; // 128 chars

// Construire string
const signatureString = Object.keys(params)
  .sort()
  .map(k => `${k}=${params[k]}`)
  .join('&');

console.log('String to sign:', signatureString);

// Calculer HMAC
const keyBuffer = Buffer.from(hmacKey, 'hex');
const hmac = crypto.createHmac('sha512', keyBuffer);
hmac.update(signatureString, 'utf8');
const signature = hmac.digest('hex').toUpperCase();

console.log('Expected signature:', signature);
console.log('Received signature:', receivedSignature);
console.log('Match:', signature === receivedSignature);
```

---

## 🚨 Erreurs Courantes

### 1. Signature Invalide

**Symptôme** : HTTP 403 "Signature invalide"

**Causes** :
- Clé HMAC incorrecte
- Ordre paramètres incorrect
- Encodage caractères (UTF-8 vs ISO-8859-1)
- Caractères spéciaux mal échappés

**Solution** :
```bash
# Vérifier clé HMAC dans .env
grep PAYBOX_HMAC_KEY .env

# Comparer avec Back-Office Paybox
# https://preprod-admin.paybox.com → Clés de sécurité

# Tester avec script validate-paybox-hmac.sh
./backend/validate-paybox-hmac.sh
```

### 2. Timeout (30s)

**Symptôme** : Paybox retente 3 fois puis abandonne

**Causes** :
- Traitement trop long (>30s)
- Database lock
- API externe lente

**Solution** :
```typescript
// Utiliser queue asynchrone
@Post('api/paybox/callback')
async handleCallback(@Query() query) {
  // Validation rapide (&lt;1s)
  const isValid = this.verifySignature(query);
  if (!isValid) return res.status(403);
  
  // Envoyer dans queue
  await this.queue.add('process-payment', query);
  
  // Retourner 200 OK immédiatement
  return { success: true };
}
```

### 3. Duplication (Replay)

**Symptôme** : Même commande créée plusieurs fois

**Solution** : Implémenter deduplication (voir section Idempotence)

---

## 🔗 Webhooks par Type

### Paybox IPN

**URL** : `POST /api/paybox/callback`

**Paramètres** :
```typescript
{
  Mt: string;      // Montant (1000 = 10.00€)
  Ref: string;     // Référence commande
  Auto: string;    // Code autorisation
  Erreur: string;  // Code erreur (00000 = success)
  K: string;       // Signature HMAC-SHA512
}
```

**Codes Erreur** :
- `00000` : Success ✅
- `00001` : Insufficient funds
- `00002` : Invalid card
- `00003` : Expired card
- `00004` : 3DS authentication failed
- `00008` : Invalid CVV
- `00012` : Fraud detected
- `00017` : User cancelled
- `99999` : Timeout

**Documentation** : [AsyncAPI Spec](../../.spec/asyncapi.yaml)

---

### CyberPlus Callback (Legacy)

**URL** : `POST /api/payments/callback/cyberplus`

**Sécurité** : HMAC-SHA256 + IP Whitelisting

```typescript
function verifyCyberplusSignature(
  data: Record<string, any>,
  receivedSignature: string
): boolean {
  const secretKey = process.env.CYBERPLUS_SECRET_KEY;
  
  // Construire string à signer
  const signatureString = [
    data.vads_amount,
    data.vads_order_id,
    data.vads_trans_id,
    data.vads_trans_date,
  ].join('+');
  
  // Calculer HMAC-SHA256
  const hmac = crypto.createHmac('sha256', secretKey);
  hmac.update(signatureString);
  const expectedSignature = hmac.digest('hex');
  
  return expectedSignature === receivedSignature;
}
```

---

### TecDoc Webhook

**URL** : `POST /api/integrations/tecdoc/webhook`

**Sécurité** : IP Whitelisting (TecDoc servers only)

```typescript
const TECDOC_ALLOWED_IPS = [
  '185.60.112.0/24',   // TecDoc EU
  '185.60.113.0/24',
];

@Post('api/integrations/tecdoc/webhook')
async handleTecDocWebhook(@Ip() ip: string, @Body() data: any) {
  // Vérifier IP
  if (!this.isAllowedIP(ip, TECDOC_ALLOWED_IPS)) {
    throw new ForbiddenException('IP not whitelisted');
  }
  
  // Traiter mise à jour catalogue
  await this.tecdoc.processUpdate(data);
  
  return { success: true };
}
```

---

### n8n Automation

**URL** : `POST /api/webhooks/n8n/{id}?secret=xxx`

**Sécurité** : Secret query parameter

```typescript
@Post('api/webhooks/n8n/:id')
async handleN8nWebhook(
  @Param('id') id: string,
  @Query('secret') secret: string,
  @Body() data: any
) {
  // Vérifier secret
  const expectedSecret = await this.getWebhookSecret(id);
  if (secret !== expectedSecret) {
    throw new UnauthorizedException('Invalid secret');
  }
  
  // Traiter workflow
  await this.n8n.processWorkflow(id, data);
  
  return { success: true };
}
```

---

## 📊 Monitoring & Alertes

### Métriques Clés

```typescript
// Prometheus metrics
import { Counter, Histogram } from 'prom-client';

const webhookCounter = new Counter({
  name: 'webhooks_total',
  help: 'Total webhooks received',
  labelNames: ['source', 'status'],
});

const webhookDuration = new Histogram({
  name: 'webhook_processing_duration_seconds',
  help: 'Webhook processing time',
  labelNames: ['source'],
  buckets: [0.1, 0.5, 1, 2, 5, 10],
});

// Usage
@Post('api/paybox/callback')
async handlePayboxCallback(@Query() query) {
  const timer = webhookDuration.startTimer({ source: 'paybox' });
  
  try {
    await this.processPayment(query);
    webhookCounter.inc({ source: 'paybox', status: 'success' });
  } catch (error) {
    webhookCounter.inc({ source: 'paybox', status: 'error' });
    throw error;
  } finally {
    timer();
  }
}
```

### Alertes Slack

```typescript
async notifySlackOnWebhookFailure(error: Error, webhook: string) {
  await fetch(process.env.SLACK_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: `🚨 Webhook failure: ${webhook}`,
      attachments: [{
        color: 'danger',
        fields: [
          { title: 'Error', value: error.message },
          { title: 'Timestamp', value: new Date().toISOString() },
        ],
      }],
    }),
  });
}
```

---

## 🔗 Ressources Complémentaires

- [AsyncAPI Specification](../../.spec/asyncapi.yaml)
- [API Reference (Swagger)](../api-reference)
- [Guide Authentication](./authentication)
- **Guide Error Handling** *(à venir)*

---

## ❓ FAQ

### Comment tester un webhook en production ?

Utiliser un **payload replay** depuis les logs :

```bash
# 1. Récupérer payload depuis ic_postback
SELECT params FROM ic_postback 
WHERE source = 'paybox' 
ORDER BY created_at DESC 
LIMIT 1;

# 2. Rejouer avec curl
curl -X POST "https://api.autoparts.com/api/paybox/callback?${PARAMS}"
```

### Quelle est la différence entre webhook et polling ?

| Aspect | Webhook (Push) | Polling (Pull) |
|--------|----------------|----------------|
| **Latence** | Temps réel (&lt;1s) | Dépend intervalle (30s-5min) |
| **Charge serveur** | Faible (événements) | Élevée (requêtes régulières) |
| **Complexité** | Endpoint + sécurité | Simple GET endpoint |
| **Idéal pour** | Paiements, notifications | Status checks |

### Comment gérer les webhooks pendant maintenance ?

```typescript
// Mode maintenance
const isMaintenanceMode = process.env.MAINTENANCE_MODE === 'true';

@Post('api/paybox/callback')
async handleCallback(@Query() query) {
  if (isMaintenanceMode) {
    // Retourner 503 pour retry automatique
    throw new ServiceUnavailableException('Maintenance en cours');
  }
  
  // Traitement normal
}
```

---

## 🛠️ Outils de Développement

### Ngrok (Tunnel Local)

```bash
# Installer ngrok
brew install ngrok  # macOS
# ou télécharger depuis https://ngrok.com

# Lancer tunnel
ngrok http 3000

# URL publique: https://abc123.ngrok.io
# Configurer dans Paybox Back-Office
```

### Webhook.site (Debugging)

1. Aller sur https://webhook.site
2. Copier URL unique (ex: https://webhook.site/xyz)
3. Configurer dans Paybox Back-Office
4. Faire un paiement test
5. Voir payload complet en temps réel

### Postman Collections

```json
{
  "name": "Paybox Webhook Test",
  "request": {
    "method": "POST",
    "url": "http://localhost:3000/api/paybox/callback",
    "params": {
      "Mt": "1000",
      "Ref": "ORD-TEST-001",
      "Auto": "123456",
      "Erreur": "00000",
      "K": "{{HMAC_SIGNATURE}}"
    }
  }
}
```

---

## 🎯 Checklist Go-Live

Avant de déployer en production :

- [ ] Clé HMAC production configurée (128 chars)
- [ ] URLs callback production dans Paybox Back-Office
- [ ] IP whitelisting configuré (si applicable)
- [ ] Deduplication Redis activée
- [ ] Audit logging fonctionnel (`ic_postback` table)
- [ ] Monitoring Prometheus/Grafana configuré
- [ ] Alertes Slack/PagerDuty configurées
- [ ] Tests de charge (100+ req/min)
- [ ] Plan de rollback documenté
- [ ] Documentation API à jour

---

## 🐛 Debug Mode

Activer logs détaillés pour troubleshooting :

```typescript
// .env
LOG_LEVEL=debug
WEBHOOK_DEBUG=true

// Logger dans controller
@Post('api/paybox/callback')
async handleCallback(@Query() query) {
  if (process.env.WEBHOOK_DEBUG === 'true') {
    console.log('=== PAYBOX CALLBACK DEBUG ===');
    console.log('Query params:', JSON.stringify(query, null, 2));
    console.log('Signature received:', query.K);
    console.log('Signature expected:', this.calculateSignature(query));
    console.log('Match:', query.K === this.calculateSignature(query));
    console.log('=============================');
  }
  
  // Traitement normal...
}
```
