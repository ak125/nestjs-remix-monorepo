# 💳 Configuration Paiement - Récapitulatif

## 📊 Vue d'ensemble

```
┌─────────────────────────────────────────────────────────────┐
│                    CONFIGURATION PAIEMENT                    │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  .env (local, jamais commité)                               │
│  └─> payment.config.ts (type-safe, validation)              │
│       └─> CyberplusService (utilisation)                    │
│            └─> PaymentService (logique métier)              │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## ✅ Implémentation Complète

### 1️⃣ Variables d'environnement (`.env`)

```bash
# === PAYMENT GATEWAY (Cyberplus/SystemPay) ===
CYBERPLUS_SITE_ID=your-site-id
CYBERPLUS_CERTIFICAT=your-certificate-secret
CYBERPLUS_MODE=TEST
CYBERPLUS_PAYMENT_URL=https://secure.systempay.fr/vads-payment/
APP_URL=http://localhost:3000
```

**Fichiers** :
- ✅ `backend/.env.example` : Template mis à jour
- ✅ `backend/.env.cyberplus.example` : Exemple dédié existant
- ⚠️ `backend/.env` : À créer localement (jamais commité)

### 2️⃣ Configuration Type-Safe

**Fichier** : `backend/src/config/payment.config.ts`

```typescript
export interface PaymentConfig {
  cyberplus: {
    siteId: string;
    certificat: string;
    mode: 'TEST' | 'PRODUCTION';
    paymentUrl: string;
  };
  app: {
    url: string;
    callbackPath: string;
  };
}
```

**Validation automatique** :
- ✅ Variables requises vérifiées au démarrage
- ✅ Mode validé (TEST/PRODUCTION uniquement)
- ✅ Erreur explicite si configuration manquante

### 3️⃣ Intégration dans le Module

**Fichier** : `backend/src/modules/payments/payments.module.ts`

```typescript
@Module({
  imports: [
    ConfigModule.forFeature(paymentConfig), // ✅ Ajouté
  ],
  // ...
})
export class PaymentsModule {}
```

### 4️⃣ Utilisation dans les Services

**Fichier** : `backend/src/modules/payments/services/cyberplus.service.ts`

```typescript
export class CyberplusService {
  private readonly paymentConfig: PaymentConfig;

  constructor(private configService: ConfigService) {
    this.paymentConfig = this.configService.get<PaymentConfig>('payment')!;
  }

  // Accès type-safe :
  // this.paymentConfig.cyberplus.siteId
  // this.paymentConfig.cyberplus.certificat
  // this.paymentConfig.cyberplus.mode
}
```

## 🔐 Sécurité - 3 Niveaux

### Niveau 1 : Développement Local ✅
```bash
# Copier le template
cp backend/.env.example backend/.env

# Remplir avec vos credentials de TEST
nano backend/.env
```

**✅ Avantages** :
- Simple et rapide
- Fichier `.env` dans `.gitignore`
- Parfait pour le développement

**⚠️ Limites** :
- Ne pas utiliser en production
- Secrets en clair sur le disque

### Niveau 2 : Variables d'Environnement (Production) 🚀
```bash
# Dans votre serveur/container
export CYBERPLUS_SITE_ID=production-id
export CYBERPLUS_CERTIFICAT=production-cert
export CYBERPLUS_MODE=PRODUCTION
```

**✅ Avantages** :
- Pas de fichier à gérer
- Intégration native Docker/K8s

**⚠️ Limites** :
- Visible dans `ps aux` ou `/proc`
- Pas de rotation automatique

### Niveau 3 : Secrets Manager (Production Recommandée) 🏆

**AWS Secrets Manager** :
```bash
aws secretsmanager create-secret \
  --name prod/payment/cyberplus \
  --secret-string '{"siteId":"xxx","certificat":"yyy"}'
```

**HashiCorp Vault** :
```bash
vault kv put secret/payment/cyberplus \
  siteId=xxx \
  certificat=yyy
```

**Kubernetes Secrets** :
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: payment-secrets
type: Opaque
data:
  CYBERPLUS_CERTIFICAT: base64-encoded-value
```

**✅ Avantages** :
- Rotation automatique
- Audit trail complet
- Chiffrement au repos
- Accès contrôlé par IAM

## 📋 Checklist Déploiement

### Développement
- [x] Fichier `.env.example` mis à jour
- [x] Configuration type-safe créée (`payment.config.ts`)
- [x] Module mis à jour (`PaymentsModule`)
- [x] Service mis à jour (`CyberplusService`)
- [x] Documentation créée (`PAYMENT-SECURITY-GUIDE.md`)
- [x] `.gitignore` vérifié (`.env` ignoré)

### Production
- [ ] Secrets stockés dans un secrets manager
- [ ] `CYBERPLUS_MODE=PRODUCTION` configuré
- [ ] Certificat de PRODUCTION (différent du TEST)
- [ ] URL de callback en HTTPS
- [ ] Monitoring actif
- [ ] Alertes configurées
- [ ] Plan de rotation des secrets

## 🧪 Test de Validation

```bash
# 1. Créer votre fichier .env
cd backend
cp .env.example .env
nano .env  # Remplir CYBERPLUS_*

# 2. Démarrer l'application
npm run dev

# 3. Vérifier les logs
# Vous devriez voir :
# [Nest] INFO [PaymentConfig] Payment configuration loaded
# [Nest] INFO [CyberplusService] Cyberplus initialized in TEST mode
```

## 📚 Documentation Complète

- 📖 [Guide de Sécurité](../../PAYMENT-SECURITY-GUIDE.md)
- 📖 [README Config](../src/config/README.md)
- 📖 [Documentation Cyberplus](https://secure.systempay.fr/doc/)

## 🆘 Dépannage

### Erreur : "Missing required environment variable: CYBERPLUS_SITE_ID"
➡️ Vous n'avez pas créé le fichier `.env` ou il est incomplet

**Solution** :
```bash
cd backend
cp .env.example .env
# Remplir les valeurs CYBERPLUS_*
```

### Erreur : "Invalid CYBERPLUS_MODE: XXX"
➡️ Le mode doit être exactement `TEST` ou `PRODUCTION`

**Solution** :
```bash
# Dans .env
CYBERPLUS_MODE=TEST  # ou PRODUCTION
```

### Les paiements ne fonctionnent pas
➡️ Vérifier la configuration

**Debug** :
```typescript
// Ajouter temporairement dans CyberplusService
this.logger.log(`Site ID: ${this.paymentConfig.cyberplus.siteId}`);
this.logger.log(`Mode: ${this.paymentConfig.cyberplus.mode}`);
this.logger.log(`Payment URL: ${this.paymentConfig.cyberplus.paymentUrl}`);
// ⚠️ NE JAMAIS logger le certificat !
```

## 🎯 Recommandation Finale

### Pour le développement local :
✅ **Utiliser `.env` avec credentials de TEST**

### Pour la production :
✅ **Utiliser un secrets manager (AWS/Vault/K8s)**

### Ne JAMAIS :
❌ Commiter le fichier `.env` réel  
❌ Logger les certificats ou tokens  
❌ Utiliser les mêmes credentials TEST et PRODUCTION  
❌ Hardcoder les secrets dans le code

---

**Fait le** : 28 octobre 2025  
**Statut** : ✅ Configuration complète et sécurisée
