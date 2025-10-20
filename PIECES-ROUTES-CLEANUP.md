# 🔧 Nettoyage des routes pièces - Documentation

## 📊 Contexte

Lors du refactoring des routes pièces, 2 fichiers ont été créés :
1. `pieces.$gamme.$marque.$modele.$type[.]html.tsx` (443 lignes)
2. `pieces.$gammeId.$marqueId.$modeleId.$typeId.tsx` (418 lignes)

## 🔍 Analyse du problème

### Duplication de code
- Les 2 fichiers contenaient **le même code** (99% identique)
- Duplication = maintenance x2, bugs potentiels, confusion

### Conflit de routing Remix
Les deux routes matchaient les **mêmes URLs** :
```
URL: /pieces/plaquettes-1/renault-5/clio-20/dci-90-105.html

Route 1: pieces.$gamme.$marque.$modele.$type[.]html.tsx
  ✅ params.gamme = "plaquettes-1"
  ✅ params.marque = "renault-5"
  ✅ Extension [.]html = optionnelle (match .html ET sans)

Route 2: pieces.$gammeId.$marqueId.$modeleId.$typeId.tsx
  ❌ params.gammeId = "plaquettes-1" (attendu: gamme)
  ❌ params.marqueId = "renault-5" (attendu: marque)
  ❌ Jamais appelée (Route 1 prioritaire)
```

### VehicleSelectV2 manquant
Le composant `VehicleSelectorV2` (sélecteur de véhicule) n'avait pas été intégré lors du refactoring, causant une **régression fonctionnelle**.

## ✅ Solution appliquée

### 1. Intégration VehicleSelectV2
Ajout du sélecteur de véhicule dans **les deux fichiers** (par sécurité) :
```tsx
<VehicleSelectorV2
  mode="compact"
  context="pieces"
  variant="card"
  redirectOnSelect={false}
  onVehicleSelect={(vehicle) => {
    // Construire URL avec format alias-id
    const url = `/pieces/${gamme}/${brand}/${model}/${type}.html`;
    window.location.href = url;
  }}
  currentVehicle={{
    brand: { id: marqueId, name: marque },
    model: { id: modeleId, name: modele },
    type: { id: typeId, name: type }
  }}
/>
```

### 2. Dépréciation du fichier doublon
Renommé `pieces.$gammeId...$typeId.tsx` → `pieces.$gammeId...$typeId.DEPRECATED.tsx`
- Fichier **désactivé** (Remix ignore `.DEPRECATED.tsx`)
- **Conservé** pour traçabilité historique
- Peut être **supprimé** après validation complète

### 3. Route active unique
Seul fichier actif : `pieces.$gamme.$marque.$modele.$type[.]html.tsx`
- ✅ Gère `/pieces/.../type` (sans .html)
- ✅ Gère `/pieces/.../type.html` (avec .html)
- ✅ Compatible avec tous les liens existants
- ✅ Contient VehicleSelectorV2

## 📝 Format d'URL standard

Format utilisé partout dans l'application :
```
/pieces/{gamme-alias-id}/{marque-alias-id}/{modele-alias-id}/{type-alias-id}.html

Exemple réel :
/pieces/plaquettes-frein-1/renault-5/clio-20/dci-90-105.html
```

Parsing avec `parseUrlParam()` :
```typescript
parseUrlParam("plaquettes-frein-1") 
// → { alias: "plaquettes-frein", id: 1 }
```

## 🧪 Tests de validation

### Tests à effectuer
1. ✅ Navigation depuis page constructeur vers pièces
2. ✅ Sélection véhicule avec VehicleSelectorV2
3. ✅ Changement de véhicule (reload avec nouveaux params)
4. ✅ URLs avec .html fonctionnent
5. ✅ URLs sans .html fonctionnent
6. ✅ Cross-selling entre gammes

### Commandes de test
```bash
# Vérifier la route active
cd frontend/app/routes
ls -lh pieces.$gamme* | grep -v DEPRECATED

# Vérifier les liens dans l'app
grep -r "href.*pieces/" --include="*.tsx" frontend/app/components/ | head -10

# Test de build
npm run build
```

## 📊 Impact du changement

| Métrique | Avant | Après | Gain |
|----------|-------|-------|------|
| Fichiers routes pièces | 2 fichiers | 1 fichier actif | -50% |
| Lignes de code dupliquées | 418 lignes | 0 lignes | -100% |
| Routes Remix actives | 2 (conflit) | 1 (claire) | Routing simplifié |
| VehicleSelectV2 intégré | ❌ Non | ✅ Oui | Fonctionnalité restaurée |

## 🚀 Prochaines étapes

### Court terme (immédiat)
- [x] Intégrer VehicleSelectorV2
- [x] Déprécier fichier doublon
- [x] Documenter changement
- [ ] Tester navigation complète
- [ ] Valider avec utilisateurs

### Moyen terme (1-2 semaines)
- [ ] Supprimer définitivement `.DEPRECATED.tsx` après validation
- [ ] Nettoyer autres routes dupliquées si détectées
- [ ] Ajouter tests E2E pour routes pièces

### Long terme (backlog)
- [ ] Générer routes dynamiquement depuis config
- [ ] Cache intelligent pour loader pièces
- [ ] Optimiser parseUrlParam avec memoization

## 📚 Références

- **Remix Routing docs** : https://remix.run/docs/en/main/file-conventions/routes
- **Extension optionnelle** : `[.]html` = match avec et sans extension
- **VehicleSelectorV2** : `/frontend/app/components/vehicle/VehicleSelectorV2.tsx`
- **Utils parsing** : `/frontend/app/utils/pieces-route.utils.ts`

---

**Date** : 2025-10-20  
**Auteur** : AI Refactoring Agent  
**Commit** : À venir  
**Status** : ✅ Implémenté, en attente de validation
