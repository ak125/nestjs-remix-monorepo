# 🧪 Tests cURL - Module de Paiements Legacy

Suite complète de tests pour le module de paiements basé sur les vraies tables legacy PostgreSQL.

## 📋 Vue d'ensemble

Ce dossier contient une suite complète de tests cURL pour valider tous les aspects du module de paiements :

- **Tests fonctionnels** : Validation de tous les endpoints
- **Tests de sécurité** : Injection SQL, XSS, validation des données
- **Tests de performance** : Charge, stress, temps de réponse
- **Tests de scénarios métier** : Workflows complets réels

## 🚀 Démarrage rapide

### Prérequis

```bash
# Serveur NestJS démarré
npm run dev

# Outils installés
curl --version    # Requis
jq --version      # Optionnel (formatage JSON)
bc --version      # Optionnel (calculs de performance)
```

### Exécution simple

```bash
# Tests fonctionnels de base
./test-payments-complete.sh

# Interface interactive
./test-payments-master.sh
```

## 📁 Scripts disponibles

### 🔧 `test-payments-complete.sh`
**Tests fonctionnels complets**
- ✅ Récupération des statistiques
- ✅ Création de paiements valides/invalides
- ✅ Récupération de statuts
- ✅ Initiation de paiements
- ✅ Tests de callbacks (CYBERPLUS, STRIPE, PAYPAL)
- ✅ Recherche par transaction
- ✅ Historique des callbacks
- ✅ Tests de cas limites

```bash
./test-payments-complete.sh
```

### 🔒 `test-payments-security.sh`
**Tests de sécurité et validation**
- 🛡️ Tests d'injection SQL
- 🛡️ Tests XSS et scripts malveillants
- 🛡️ Tests de dépassement de limites
- 🛡️ Validation stricte des données
- 🛡️ Manipulation d'identifiants
- 🛡️ Simulation d'attaques DDoS
- 🛡️ Headers malveillants
- 🛡️ Sécurité des callbacks

```bash
./test-payments-security.sh
```

### ⚡ `test-payments-performance.sh`
**Tests de performance et charge**
- 📊 Mesure des temps de réponse
- 📊 Tests de charge légère à intensive
- 📊 Tests de stress (créations/callbacks parallèles)
- 📊 Tests de consommation mémoire
- 📊 Benchmark comparatif des endpoints
- 📊 Tests de récupération après charge

```bash
./test-payments-performance.sh
```

### 🎬 `test-payments-scenarios.sh`
**Scénarios métier complets**
- 💳 Paiement carte bancaire complet (CYBERPLUS)
- 💳 Paiement Stripe avec échec
- 💳 Workflow PayPal avec remboursement
- 💳 Virement bancaire manuel
- 📊 Réconciliation et rapports
- 🔍 Vérification cohérence des données

```bash
./test-payments-scenarios.sh
```

### 🎯 `test-payments-master.sh`
**Interface interactive principale**
- 📋 Menu de sélection des tests
- 📋 Informations système
- 📋 Vérification des prérequis
- 📋 Exécution de tous les tests
- 📊 Rapport final consolidé

```bash
./test-payments-master.sh
```

## 🎯 Exemples d'utilisation

### Test rapide de l'API
```bash
# Vérifier que l'API répond
curl http://localhost:3000/api/payments/stats

# Créer un paiement test
curl -X POST http://localhost:3000/api/payments \
  -H "Content-Type: application/json" \
  -d '{
    "ord_cst_id": "81500",
    "ord_total_ttc": "99.99",
    "payment_gateway": "STRIPE"
  }'
```

### Tests ciblés
```bash
# Tests de sécurité uniquement
./test-payments-security.sh

# Tests de performance uniquement
./test-payments-performance.sh

# Tous les tests avec rapport final
./test-payments-master.sh
# Puis choisir option "5"
```

## 📊 Interprétation des résultats

### Codes de statut attendus
- **200** : Requête réussie
- **201** : Ressource créée avec succès
- **400** : Erreur de validation (attendu pour tests négatifs)
- **404** : Ressource non trouvée (attendu pour tests négatifs)
- **500** : Erreur serveur (à investiguer)

### Métriques de performance
- **Temps de réponse** : < 1s pour la plupart des endpoints
- **Req/sec** : Dépend de la configuration serveur
- **Taux de succès** : 100% pour les scénarios valides

### Indicateurs de sécurité
- ✅ Injection SQL bloquée (Status 400)
- ✅ XSS échappé dans la réponse
- ✅ Validation des types de données
- ✅ Limitation des payloads volumineux

## 🗃️ Tables legacy utilisées

### `___xtr_order`
**Table principale des commandes/paiements**
```sql
- ord_id (PK)           -- ID unique de la commande
- ord_cst_id            -- ID client
- ord_total_ttc         -- Montant TTC
- ord_is_pay           -- Statut ('0'=EN_ATTENTE, '1'=PAYÉ)
- ord_date             -- Date de création
- ord_info (JSON)      -- Métadonnées de paiement
```

### `ic_postback`
**Table des callbacks et audits**
```sql
- id (PK)              -- ID unique
- gateway              -- Gateway de paiement
- data (JSON)          -- Données du callback
- status               -- Statut du callback
- reference            -- Référence transaction
```

## 🐛 Dépannage

### Serveur non accessible
```bash
# Vérifier que le serveur est démarré
curl http://localhost:3000/health

# Démarrer le serveur si nécessaire
npm run dev
```

### Tests qui échouent
```bash
# Vérifier les logs détaillés
./test-payments-complete.sh 2>&1 | tee test-output.log

# Vérifier la base de données
# (connexion Supabase requise)
```

### Problèmes de performance
```bash
# Vérifier la charge système
top
htop

# Tester avec moins de concurrence
# Modifier les paramètres dans les scripts
```

## 🔧 Configuration avancée

### Variables d'environnement
```bash
export API_BASE="http://localhost:3000"      # URL de base
export PAYMENT_TIMEOUT="30"                  # Timeout en secondes
export MAX_CONCURRENT="20"                   # Requêtes parallèles max
```

### Personnalisation des tests
```bash
# Modifier les paramètres dans les scripts
nano test-payments-performance.sh

# Ajuster les métriques de charge
concurrent=10    # Requêtes simultanées
total_requests=50 # Total de requêtes
```

## 📈 Rapports et monitoring

### Génération de rapports
```bash
# Exporter les résultats
./test-payments-master.sh > rapport-tests-$(date +%Y%m%d).log

# Analyser les métriques de performance
grep "Req/sec" rapport-tests-*.log
```

### Monitoring continu
```bash
# Tests périodiques (exemple avec cron)
# */30 * * * * cd /path/to/project && ./test-payments-complete.sh >> /var/log/payment-tests.log
```

## 🤝 Contribution

### Ajouter de nouveaux tests
1. Créer un nouveau script `test-payments-custom.sh`
2. Suivre la structure des scripts existants
3. Ajouter l'option dans `test-payments-master.sh`

### Améliorer les tests existants
1. Identifier les cas non couverts
2. Ajouter les tests dans le script approprié
3. Mettre à jour cette documentation

## 📚 Références

- [Documentation API Paiements](../docs/api/payments.md)
- [Architecture Legacy](../docs/architecture/legacy-tables.md)
- [Guide NestJS](https://docs.nestjs.com/)
- [cURL Documentation](https://curl.se/docs/)

## 📄 Licence

Ces tests font partie du projet Template MCP Complete.

---

🎯 **Tests créés pour valider l'intégration complète du module de paiements avec les vraies tables legacy PostgreSQL.**
