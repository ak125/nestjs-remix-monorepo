# 🔐 Guide de Sécurité - Configuration Paiement

## 📋 Configuration des Variables d'Environnement

### ✅ Mode Développement Local

1. **Copier le fichier exemple** :
   ```bash
   cd backend
   cp .env.example .env
   # ou fusionner avec .env.cyberplus.example
   ```

2. **Remplir les variables de paiement** dans `.env` :
   ```bash
   # === PAYMENT GATEWAY (Cyberplus/SystemPay) ===
   CYBERPLUS_SITE_ID=votre-site-id-test
   CYBERPLUS_CERTIFICAT=votre-certificat-test
   CYBERPLUS_MODE=TEST
   CYBERPLUS_PAYMENT_URL=https://secure.systempay.fr/vads-payment/
   APP_URL=http://localhost:3000
   ```

3. **Vérifier que `.env` est dans `.gitignore`** ✅ (déjà configuré)

### 🚀 Mode Production

**⚠️ NE JAMAIS stocker les secrets de production dans `.env`**

#### Option 1 : Variables d'environnement système (Recommandé)
```bash
# Dans votre environnement de déploiement (Docker, Kubernetes, etc.)
export CYBERPLUS_SITE_ID=production-site-id
export CYBERPLUS_CERTIFICAT=production-certificate-secret
export CYBERPLUS_MODE=PRODUCTION
export CYBERPLUS_PAYMENT_URL=https://secure.systempay.fr/vads-payment/
export APP_URL=https://votre-domaine.com
```

#### Option 2 : Secrets Managers (Fortement recommandé pour la production)

**AWS Secrets Manager** :
```typescript
// backend/src/config/secrets.service.ts
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

export async function getPaymentSecrets() {
  const client = new SecretsManagerClient({ region: 'eu-west-1' });
  const command = new GetSecretValueCommand({
    SecretId: 'prod/payment/cyberplus'
  });
  const response = await client.send(command);
  return JSON.parse(response.SecretString);
}
```

**HashiCorp Vault** :
```bash
vault kv get -field=certificat secret/payment/cyberplus
```

**Kubernetes Secrets** :
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: payment-secrets
type: Opaque
stringData:
  CYBERPLUS_SITE_ID: "production-site-id"
  CYBERPLUS_CERTIFICAT: "production-certificate"
```

#### Option 3 : Fichiers de secrets chiffrés

```bash
# Chiffrer le fichier .env.production
gpg --symmetric --cipher-algo AES256 .env.production

# Déchiffrer au déploiement
gpg --decrypt .env.production.gpg > .env
```

## 🔒 Bonnes Pratiques de Sécurité

### ✅ À FAIRE

1. **Utiliser des certificats différents pour TEST et PRODUCTION**
2. **Rotation régulière des certificats** (tous les 3-6 mois)
3. **Valider TOUJOURS les signatures des callbacks**
4. **Logger les tentatives de paiement** (sans les données sensibles)
5. **Implémenter un rate limiting** sur les endpoints de paiement
6. **Utiliser HTTPS uniquement** en production
7. **Vérifier les montants côté serveur** (jamais faire confiance au client)
8. **Auditer régulièrement les logs de paiement**

### ❌ À NE JAMAIS FAIRE

1. ❌ **Commiter le fichier `.env` réel**
2. ❌ **Logger les certificats ou tokens de paiement**
3. ❌ **Exposer les clés API dans les réponses HTTP**
4. ❌ **Stocker les numéros de carte** (PCI-DSS)
5. ❌ **Utiliser les mêmes credentials en TEST et PRODUCTION**
6. ❌ **Partager les secrets par email ou Slack**
7. ❌ **Hardcoder les secrets dans le code**

## 🛡️ Validation de la Configuration

### Test de configuration au démarrage

Le fichier `payment.config.ts` valide automatiquement :
- ✅ Présence des variables requises
- ✅ Format du mode (TEST/PRODUCTION)
- ✅ Cohérence de l'URL de callback

### Test manuel

```bash
# Démarrer l'application
npm run dev

# Vérifier les logs au démarrage
# Vous devriez voir : "Payment configuration loaded in TEST mode"
# En production : "Payment configuration loaded in PRODUCTION mode"
```

## 📊 Monitoring et Alertes

### Métriques à surveiller

1. **Taux de succès des paiements** (devrait être > 95%)
2. **Temps de réponse du gateway** (< 3s)
3. **Tentatives de paiement échouées** (alerter si > 10%)
4. **Callbacks invalides** (possibles attaques)

### Alertes recommandées

```typescript
// Exemple d'alerte pour callbacks suspects
if (invalidCallbackCount > 5) {
  await alertService.send({
    level: 'critical',
    message: 'Multiple invalid payment callbacks detected',
    metadata: { ip, timestamp }
  });
}
```

## 🔄 Rotation des Secrets

### Processus de rotation

1. **Générer un nouveau certificat** sur le portail Cyberplus
2. **Tester avec le nouveau certificat** en mode TEST
3. **Mettre à jour le secret** dans votre secrets manager
4. **Déployer progressivement** (blue/green deployment)
5. **Vérifier les paiements** en production
6. **Révoquer l'ancien certificat** après 24h

## 📝 Checklist de Déploiement

Avant de déployer en production :

- [ ] Les secrets sont stockés dans un secrets manager
- [ ] `CYBERPLUS_MODE=PRODUCTION` est configuré
- [ ] L'URL de callback est en HTTPS
- [ ] Les certificats de TEST ne sont PAS en production
- [ ] Le monitoring est en place
- [ ] Les alertes sont configurées
- [ ] Un plan de rollback est prêt
- [ ] La rotation des secrets est planifiée
- [ ] Les logs sont filtrés (pas de données sensibles)
- [ ] Le rate limiting est actif

## 🆘 En cas de Compromission

Si vous suspectez une compromission :

1. **IMMÉDIATEMENT** : Révoquer le certificat compromis
2. Générer un nouveau certificat
3. Auditer les logs de paiement des 30 derniers jours
4. Identifier les transactions suspectes
5. Notifier l'équipe sécurité et le PSP
6. Documenter l'incident

## 📚 Ressources

- [Documentation Cyberplus/SystemPay](https://secure.systempay.fr/doc/)
- [PCI-DSS Compliance](https://www.pcisecuritystandards.org/)
- [OWASP Payment Security](https://owasp.org/www-community/vulnerabilities/Payment_Card_Industry_Data_Security_Standard)

---

**Dernière mise à jour** : 28 octobre 2025  
**Responsable** : Équipe DevOps & Sécurité
