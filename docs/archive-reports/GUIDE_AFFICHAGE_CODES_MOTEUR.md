# 🔧 GUIDE - AFFICHAGE CODES MOTEUR VÉHICULES

## 📋 Comment Afficher les Codes Moteur

Notre système d'enrichissement cars_engine permet d'afficher les codes moteur des véhicules de plusieurs façons.

## 🎯 Méthodes d'Affichage

### 1. 🔍 Recherche par Code Moteur Spécifique

```bash
# Recherche par code moteur F4A
curl "http://localhost:3000/api/vehicles/search/engine/F4A"

# Résultat :
{
  "success": true,
  "total": 1,
  "engineInfo": {
    "searchCode": "F4A",
    "foundEngine": {
      "id": "10007",
      "mfaId": "36", 
      "code": "F4A"
    }
  },
  "data": [{
    "type_name": "2.5 V6 24V",
    "engineDetails": {
      "engineCode": "F4A",
      "enriched": true
    }
  }]
}
```

### 2. 🆔 Recherche par ID de Véhicule avec Enrichissement

```bash
# AUDI A1 1.0 TFSI (ID: 112018)
curl "http://localhost:3000/api/vehicles/search/engine/112018"

# Résultat :
{
  "engineInfo": {
    "foundEngine": {
      "code": "TFSI 1.0L TURBO",
      "mfaId": "AUDI"
    }
  },
  "data": [{
    "type_name": "1.0 TFSI",
    "engineDetails": {
      "engineCode": "TFSI 1.0L TURBO",
      "enriched": true
    }
  }]
}
```

### 3. 📊 Affichage Formaté avec jq

```bash
# Format lisible pour humains
curl -s "http://localhost:3000/api/vehicles/search/engine/112018" | jq '{
  vehicule: .data[0].type_name,
  code_moteur: .engineInfo.foundEngine.code,
  marque: .engineInfo.foundEngine.mfaId,
  enrichi: .data[0].engineDetails.enriched
}'

# Résultat :
{
  "vehicule": "1.0 TFSI",
  "code_moteur": "TFSI 1.0L TURBO", 
  "marque": "AUDI",
  "enrichi": true
}
```

## 🗂️ Codes Moteur Disponibles

### ✅ Codes Testés et Fonctionnels

| Code Moteur | ID | Marque | Véhicule Type |
|-------------|----|---------|-----------| 
| `F4A` | 10007 | 36 | 2.5 V6 24V |
| `TFSI 1.0L TURBO` | 112018 | AUDI | 1.0 TFSI |
| `TFSI 1.0L TURBO` | 112021 | AUDI | 1.0 TFSI |

### 📝 Codes dans le Mapping (à tester)

```bash
# Codes sans espaces (fonctionnent directement)
curl "http://localhost:3000/api/vehicles/search/engine/RTK"
curl "http://localhost:3000/api/vehicles/search/engine/RTJ" 
curl "http://localhost:3000/api/vehicles/search/engine/L1F"

# Codes avec espaces (nécessitent encodage URL)
curl "http://localhost:3000/api/vehicles/search/engine/AR%2031010"    # AR 31010
curl "http://localhost:3000/api/vehicles/search/engine/159%20A3.046"  # 159 A3.046
```

## 🎨 Exemples d'Affichage Pratiques

### Affichage Simple
```bash
echo "Code moteur pour véhicule 112018:"
curl -s "http://localhost:3000/api/vehicles/search/engine/112018" | \
  jq -r '.engineInfo.foundEngine.code'
# Résultat: TFSI 1.0L TURBO
```

### Affichage Détaillé
```bash
echo "=== Détails Moteur ==="
curl -s "http://localhost:3000/api/vehicles/search/engine/F4A" | jq '{
  "🔧 Code": .engineInfo.foundEngine.code,
  "🆔 ID": .engineInfo.foundEngine.id, 
  "🏭 MFA": .engineInfo.foundEngine.mfaId,
  "🚗 Véhicule": .data[0].type_name,
  "✅ Enrichi": .data[0].engineDetails.enriched
}'
```

### Vérification Enrichissement
```bash
# Vérifier si un véhicule a un code moteur enrichi
curl -s "http://localhost:3000/api/vehicles/search/engine/112018" | \
  jq '.data[0].engineDetails | if .enriched then "✅ ENRICHI: " + .engineCode else "❌ Non enrichi" end'
```

## 🔧 API Endpoints Disponibles

### 1. Recherche par Code Moteur
- **URL**: `GET /api/vehicles/search/engine/:engineCode`
- **Exemple**: `/api/vehicles/search/engine/F4A`
- **Retour**: Véhicule + informations moteur détaillées

### 2. Détails Véhicule Enrichi  
- **URL**: `GET /api/vehicles/types/:typeId`
- **Exemple**: `/api/vehicles/types/112018`
- **Retour**: Véhicule avec champ `engineDetails`

### 3. Recherche Générale Enrichie
- **URL**: `GET /api/vehicles/search/code?params`
- **Exemple**: `/api/vehicles/search/code?year=2015`
- **Retour**: Liste véhicules avec `engineDetails`

## 🎯 Cas d'Usage Typiques

### Développeur Frontend
```javascript
// Récupérer code moteur pour affichage
const response = await fetch('/api/vehicles/search/engine/112018');
const data = await response.json();
const codeMoteur = data.engineInfo.foundEngine.code;
console.log(`Code moteur: ${codeMoteur}`); // "TFSI 1.0L TURBO"
```

### Admin/Debug
```bash
# Lister tous les codes enrichis vs non-enrichis
curl -s "http://localhost:3000/api/vehicles/search/code?year=2015" | \
  jq '.data[] | select(.engineDetails.enriched == true) | .engineDetails.engineCode'
```

### Validation Données
```bash
# Compter véhicules avec codes moteur enrichis
curl -s "http://localhost:3000/api/vehicles/search/code?year=2015" | \
  jq '[.data[] | .engineDetails.enriched] | map(select(.)) | length'
```

---

## ✅ Résumé

**Notre système d'enrichissement cars_engine permet d'afficher les codes moteur de 3 façons principales :**

1. **🔍 Recherche directe** par code moteur → `/search/engine/:code`
2. **🆔 Enrichissement automatique** dans tous les endpoints véhicules
3. **📊 Formatage personnalisé** avec jq pour affichage lisible

**Tous les véhicules incluent maintenant le champ `engineDetails` avec le code moteur enrichi ou en fallback !**

---
*Guide mis à jour le 12 septembre 2025*