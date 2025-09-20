# 🚗 Guide de Maintenance - Sélecteur Véhicule Intelligent

## 📋 Vue d'Ensemble

Le sélecteur véhicule intelligent est un composant critique qui permet aux utilisateurs de naviguer dans le catalogue de pièces automobiles via une cascade : **Marque → Années → Modèles → Types**.

---

## 🏗️ Architecture

### Backend (NestJS)
```
📁 backend/src/modules/vehicles/
├── vehicles.controller.ts       # Endpoints API principaux
├── vehicles.service.ts          # Logique métier et requêtes DB
├── vehicles.module.ts           # Configuration du module
└── dto/
    └── vehicles.dto.ts          # Types et validation
```

### Frontend (Remix)
```
📁 frontend/app/
├── components/home/
│   └── VehicleSelectorHybrid.tsx     # Composant principal
├── services/api/
│   └── enhanced-vehicle.api.ts       # Client API
└── routes/
    └── _index.tsx                    # Page d'accueil avec sélecteur
```

---

## 🔌 Endpoints API

### Structure de Réponse Standard
```json
{
  "data": [...],
  "total": 123,
  "page": 0,
  "limit": 50
}
```

### Endpoints Disponibles
| Endpoint | Description | Exemple |
|----------|-------------|---------|
| `GET /api/vehicles/brands` | Liste des marques | `?limit=10&search=BMW` |
| `GET /api/vehicles/brands/:id/years` | Années par marque | `/api/vehicles/brands/22/years` |
| `GET /api/vehicles/brands/:id/models` | Modèles par marque | `/api/vehicles/brands/22/models` |
| `GET /api/vehicles/models/:id/types` | Types par modèle | `/api/vehicles/models/22003/types` |

---

## 🧪 Tests et Validation

### Script de Validation Automatique
```bash
# Exécuter le script de validation complet
./validate-vehicle-selector.sh

# Tests manuels rapides
curl "http://localhost:3000/api/vehicles/brands?limit=3"
curl "http://localhost:3000/api/vehicles/brands/22/years"
```

### Métriques à Surveiller
- **Temps de réponse** : < 100ms par endpoint
- **Disponibilité** : 99.9% uptime
- **Volumétrie** : 40 marques, 5745 modèles, 48918 types

---

## 🔧 Dépannage

### Problème : Marques ne s'affichent pas
**Symptômes** : Dropdown vide, message "Sélectionner une marque" sans options

**Solutions** :
1. Vérifier que le backend est démarré : `curl http://localhost:3000/api/vehicles/brands`
2. Vérifier les logs : Erreur de mapping dans `enhanced-vehicle.api.ts`
3. Vérifier la DB : Table `auto_marque` avec `marque_display = 1`

### Problème : Années ne se chargent pas
**Symptômes** : Après sélection marque, pas d'années disponibles

**Solutions** :
1. Tester l'endpoint : `curl http://localhost:3000/api/vehicles/brands/22/years`
2. Vérifier la table `auto_type` : Données `type_year_from` non nulles
3. Vérifier le service : Méthode `findYearsByBrand` fonctionnelle

### Problème : Erreur 500 sur les endpoints
**Symptômes** : Erreurs serveur, timeouts

**Solutions** :
1. Vérifier les logs NestJS dans le terminal
2. Vérifier la connexion Supabase dans `vehicles.service.ts`
3. Redémarrer le backend : `npm run start:dev`

---

## 🚀 Déploiement

### Avant le Déploiement
```bash
# 1. Tests automatiques
./validate-vehicle-selector.sh

# 2. Vérification build frontend
cd frontend && npm run build

# 3. Vérification build backend  
cd backend && npm run build
```

### Variables d'Environnement Requises
```env
# Backend
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_key
NODE_ENV=production

# Frontend  
API_BASE_URL=https://your-api-domain.com
```

---

## 📊 Base de Données

### Tables Principales
```sql
-- Marques automobiles (40 actives)
auto_marque
├── marque_id (PK)
├── marque_name (BMW, AUDI...)
├── marque_display (1 = active)
└── marque_logo (logo filename)

-- Modèles par marque (5745 total)
auto_modele
├── modele_id (PK)
├── modele_marque_id (FK → auto_marque)
├── modele_name (A3, A4, 308...)
└── modele_year_from/to (années production)

-- Types/Motorisations (48918 total)
auto_type
├── type_id (PK)
├── type_modele_id (FK → auto_modele)
├── type_marque_id (FK → auto_marque)
├── type_name (1.6 TDI, 2.0 TSI...)
├── type_fuel (Essence, Diesel...)
├── type_power_ps (puissance)
└── type_year_from/to (années production)
```

### Requêtes d'Optimisation
```sql
-- Index pour performance
CREATE INDEX idx_auto_type_marque ON auto_type(type_marque_id);
CREATE INDEX idx_auto_type_modele ON auto_type(type_modele_id);
CREATE INDEX idx_auto_modele_marque ON auto_modele(modele_marque_id);
```

---

## 🔄 Maintenance Régulière

### Quotidien
- [ ] Vérifier les logs d'erreur
- [ ] Monitorer les temps de réponse API
- [ ] Tester le sélecteur en production

### Hebdomadaire  
- [ ] Exécuter `./validate-vehicle-selector.sh`
- [ ] Vérifier l'intégrité des données DB
- [ ] Analyser les métriques d'utilisation

### Mensuel
- [ ] Mise à jour des données véhicules
- [ ] Optimisation des requêtes lentes
- [ ] Review des nouvelles marques/modèles

---

## 📞 Support

### Contacts Techniques
- **Backend NestJS** : Équipe API
- **Frontend Remix** : Équipe UI/UX  
- **Base de données** : Équipe DevOps

### Documentation Technique
- `/VEHICLE_SELECTOR_SUCCESS_REPORT.md` : Rapport complet
- `/validate-vehicle-selector.sh` : Script de validation
- **API Docs** : http://localhost:3000/api (Swagger si configuré)

---

## ✅ Checklist de Validation

Avant de signaler un problème résolu :

- [ ] Toutes les marques s'affichent
- [ ] Sélection marque → Années se chargent
- [ ] Sélection année → Modèles se chargent  
- [ ] Sélection modèle → Types se chargent
- [ ] Script `./validate-vehicle-selector.sh` passe
- [ ] Interface responsive sur mobile/desktop
- [ ] Temps de réponse < 100ms par étape

**🎯 Objectif** : Utilisateur peut sélectionner son véhicule en 4 clics maximum et accéder au catalogue de pièces correspondant.