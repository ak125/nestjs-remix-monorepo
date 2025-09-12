# 🧭 Guide d'Utilisation - Service Breadcrumb Optimisé

**Version :** 2.0 (Post-correction routes)  
**Statut :** ✅ Opérationnel (90% tests réussis)  
**Date :** 11 septembre 2025  

## 🚀 Démarrage Rapide

### Routes Principales
```bash
# Service Breadcrumb (NOUVEAU - route dédiée)
GET  /api/breadcrumb/{path}              # Récupérer breadcrumb
POST /api/breadcrumb/{path}              # Mettre à jour
GET  /api/breadcrumb/config              # Configuration
POST /api/breadcrumb/cache/clear         # Nettoyage cache

# Interface Admin
GET  /admin/breadcrumbs                  # Liste des breadcrumbs
GET  /admin/breadcrumbs/{id}             # Détails
POST /admin/breadcrumbs                  # Créer
PUT  /admin/breadcrumbs/{id}             # Modifier

# Métadonnées (inchangé)
GET  /api/metadata/{path}                # Métadonnées complètes
```

## 📖 Exemples d'Utilisation

### 1. Récupérer un Breadcrumb
```bash
curl -X GET "http://localhost:3000/api/breadcrumb/pieces/filtre-a-huile/audi/a3"
```

**Réponse :**
```json
{
  "success": true,
  "data": [
    {
      "label": "Accueil",
      "path": "/",
      "icon": "home",
      "isClickable": true,
      "active": false
    },
    {
      "label": "Pièces",
      "path": "/pieces",
      "isClickable": true,
      "active": false
    },
    {
      "label": "Filtre à huile",
      "path": "/pieces/filtre-a-huile",
      "isClickable": true,
      "active": false
    },
    {
      "label": "Audi A3",
      "path": "/pieces/filtre-a-huile/audi/a3",
      "isClickable": false,
      "active": true
    }
  ]
}
```

### 2. Interface Admin - Liste
```bash
curl -X GET "http://localhost:3000/admin/breadcrumbs"
```

**Réponse :**
```json
{
  "success": true,
  "data": [
    {
      "id": "1757617219054",
      "url": "/pieces/filtre-a-huile-7/audi-22/a3-ii-22031/2-0-tdi-19966.html",
      "title": "Filtre à huile AUDI A3 II",
      "breadcrumbCount": 4,
      "lastModified": "2025-09-11T22:38:30.364Z",
      "status": "active"
    }
  ]
}
```

### 3. Création/Mise à jour
```bash
curl -X POST "http://localhost:3000/api/breadcrumb/products/brake-pads" \
  -H "Content-Type: application/json" \
  -d '{
    "breadcrumbs": [
      {"label": "Home", "path": "/"},
      {"label": "Products", "path": "/products"},
      {"label": "Brake Pads", "path": "/products/brake-pads"}
    ]
  }'
```

## 🔧 Configuration

### Options de Breadcrumb
```typescript
interface BreadcrumbConfig {
  showHome: boolean;      // Afficher "Accueil"
  homeLabel: string;      // Texte pour accueil
  separator: string;      // Séparateur (>, /, →)
  maxItems: number;       // Limite d'éléments
  ellipsis: string;       // Texte ellipse (...)
}
```

### Configuration par Défaut
```json
{
  "showHome": true,
  "homeLabel": "Accueil",
  "separator": " > ",
  "maxItems": 5,
  "ellipsis": "..."
}
```

## ⚡ Performance et Cache

### Cache Redis
- **TTL :** 1 heure (3600 secondes)
- **Pattern :** `breadcrumb:{path}:{lang}`
- **Performance :** 2ème appel plus rapide

### Nettoyage Cache
```bash
# Nettoyage global
curl -X POST "http://localhost:3000/api/breadcrumb/cache/clear"

# Nettoyage spécifique (dans le code)
await breadcrumbService.clearCache('/specific/path');
```

## 🎯 Intégration Frontend

### Composant React/Remix
```typescript
// Utilisation dans composant
import { useLoaderData } from '@remix-run/react';

export async function loader({ params }) {
  const response = await fetch(
    `http://localhost:3000/api/breadcrumb/${params.path}`
  );
  return response.json();
}

export default function Page() {
  const { data: breadcrumbs } = useLoaderData();
  
  return (
    <nav aria-label="Breadcrumb">
      <ol className="breadcrumb">
        {breadcrumbs.map((item, index) => (
          <li key={index} className={item.active ? 'active' : ''}>
            {item.isClickable ? (
              <a href={item.path}>{item.label}</a>
            ) : (
              <span>{item.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
```

## 🔍 Debugging et Tests

### Vérifier le Service
```bash
# Test de base
curl -X GET "http://localhost:3000/api/breadcrumb/test"

# Test avec metadata
curl -X GET "http://localhost:3000/api/metadata/test"

# Vérifier cache
curl -X GET "http://localhost:3000/api/breadcrumb/test" # 1er appel
curl -X GET "http://localhost:3000/api/breadcrumb/test" # 2ème appel (plus rapide)
```

### Script de Test Automatique
```bash
# Exécuter tous les tests
./test-breadcrumb-corrections.sh
```

## 📊 Monitoring

### Métriques Disponibles
- Nombre total de breadcrumbs
- Performance cache (hit/miss ratio)
- Temps de réponse moyen
- Erreurs par endpoint

### Logs à Surveiller
```bash
# Logs service breadcrumb
[OptimizedBreadcrumbService] 🧭 Récupération pour: /path

# Logs cache
[OptimizedBreadcrumbService] ♻️ Cache invalidé pour: /path

# Logs erreurs
[OptimizedBreadcrumbController] ❌ Erreur récupération breadcrumb
```

## ⚠️ Problèmes Connus

1. **Admin Stats (500)** : `/admin/breadcrumbs/stats` retourne erreur 500
   - **Solution :** À corriger dans prochaine itération
   - **Contournement :** Utiliser la liste admin standard

## 🚀 Prochaines Améliorations

1. **Corriger admin stats** : Débogger l'erreur 500
2. **Tests unitaires** : Ajouter coverage complète
3. **Interface web admin** : UI pour gestion visuelle
4. **Schema.org enrichi** : Métadonnées SEO avancées
5. **Multi-langue** : Support i18n complet

---

**Documentation mise à jour :** 11 septembre 2025  
**Version service :** 2.0 (Post-correction routes)  
**Statut :** ✅ Production Ready (90% tests réussis)