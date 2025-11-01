# 📁 Configuration - Guide d'Utilisation

Ce dossier contient les fichiers de configuration centralisés de l'application.

## 🗂️ Fichiers de Configuration

### `payment.config.ts` - Configuration des Paiements

Configuration type-safe pour l'intégration avec Cyberplus/SystemPay (BNP Paribas).

**Variables requises** :
- `CYBERPLUS_SITE_ID` : ID du site marchand
- `CYBERPLUS_CERTIFICAT` : Certificat de production (secret)
- `CYBERPLUS_MODE` : `TEST` ou `PRODUCTION`
- `CYBERPLUS_PAYMENT_URL` : URL du gateway de paiement (optionnel)
- `APP_URL` : URL de base de votre application

**Utilisation** :

```typescript
import { ConfigService } from '@nestjs/config';
import { PaymentConfig } from '@config/payment.config';

@Injectable()
export class MyService {
  private readonly paymentConfig: PaymentConfig;
  
  constructor(private configService: ConfigService) {
    this.paymentConfig = this.configService.get<PaymentConfig>('payment')!;
    
    // Accès type-safe
    const siteId = this.paymentConfig.cyberplus.siteId;
    const mode = this.paymentConfig.cyberplus.mode; // 'TEST' | 'PRODUCTION'
  }
}
```

**Validation automatique** :
- ✅ Vérification des variables requises au démarrage
- ✅ Validation du mode (TEST/PRODUCTION uniquement)
- ✅ Erreur explicite si configuration manquante

## 🔐 Sécurité

### ⚠️ À RESPECTER ABSOLUMENT

1. **Ne JAMAIS commiter les fichiers `.env` réels**
2. **Ne JAMAIS logger les certificats ou secrets**
3. **Utiliser des secrets managers en production**
4. **Séparer les certificats TEST et PRODUCTION**

### ✅ Bonnes Pratiques

```typescript
// ✅ BON - Utilisation sécurisée
this.logger.log(`Payment mode: ${this.paymentConfig.cyberplus.mode}`);

// ❌ MAUVAIS - Ne jamais logger le certificat
this.logger.log(`Certificate: ${this.paymentConfig.cyberplus.certificat}`);
```

## 📝 Exemple de Configuration

### Développement Local

```bash
# backend/.env
CYBERPLUS_SITE_ID=43962882
CYBERPLUS_CERTIFICAT=9816635272016068
CYBERPLUS_MODE=TEST
APP_URL=http://localhost:3000
```

### Production (avec secrets manager)

```typescript
// Exemple avec AWS Secrets Manager
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

export async function loadPaymentSecrets() {
  const client = new SecretsManagerClient({ region: 'eu-west-1' });
  const command = new GetSecretValueCommand({
    SecretId: 'prod/payment/cyberplus'
  });
  
  const response = await client.send(command);
  const secrets = JSON.parse(response.SecretString);
  
  process.env.CYBERPLUS_CERTIFICAT = secrets.certificat;
  process.env.CYBERPLUS_SITE_ID = secrets.siteId;
}
```

## 🧪 Tests

### Vérifier la Configuration

```bash
# Tester la configuration au démarrage
npm run start:dev

# Vous devriez voir dans les logs :
# [PaymentConfig] Payment configuration loaded in TEST mode
```

### Tests Unitaires

```typescript
import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import paymentConfig from './payment.config';

describe('Payment Configuration', () => {
  it('should load payment config', async () => {
    const module = await Test.createTestingModule({
      imports: [ConfigModule.forFeature(paymentConfig)],
    }).compile();

    const config = module.get(ConfigService);
    const payment = config.get('payment');

    expect(payment.cyberplus.mode).toBeDefined();
    expect(['TEST', 'PRODUCTION']).toContain(payment.cyberplus.mode);
  });
});
```

## 🔄 Ajout d'une Nouvelle Configuration

### 1. Créer le fichier de configuration

```typescript
// src/config/my-feature.config.ts
import { registerAs } from '@nestjs/config';

export interface MyFeatureConfig {
  apiKey: string;
  endpoint: string;
  timeout: number;
}

export default registerAs('myFeature', (): MyFeatureConfig => {
  return {
    apiKey: process.env.MY_FEATURE_API_KEY!,
    endpoint: process.env.MY_FEATURE_ENDPOINT || 'https://api.example.com',
    timeout: parseInt(process.env.MY_FEATURE_TIMEOUT || '5000', 10),
  };
});
```

### 2. Ajouter les variables dans `.env.example`

```bash
# === MY FEATURE ===
MY_FEATURE_API_KEY=your-api-key
MY_FEATURE_ENDPOINT=https://api.example.com
MY_FEATURE_TIMEOUT=5000
```

### 3. Importer dans le module

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import myFeatureConfig from '@config/my-feature.config';

@Module({
  imports: [
    ConfigModule.forFeature(myFeatureConfig),
  ],
})
export class MyFeatureModule {}
```

## 📚 Ressources

- [NestJS Configuration](https://docs.nestjs.com/techniques/configuration)
- [Guide de Sécurité Paiement](../../PAYMENT-SECURITY-GUIDE.md)
- [12-Factor App Configuration](https://12factor.net/config)

---

**Dernière mise à jour** : 28 octobre 2025
