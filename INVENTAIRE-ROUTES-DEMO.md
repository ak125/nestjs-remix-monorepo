# 🧪 Inventaire Routes Demo/Test - Phase 2

## 📋 Routes à protéger en production

### 🚗 Commercial Vehicles Demos (5 fichiers)
```
frontend/app/routes/commercial.vehicles.demo.tsx
frontend/app/routes/commercial.vehicles.model-selector-demo.tsx
frontend/app/routes/commercial.vehicles.system-test.tsx
frontend/app/routes/commercial.vehicles.type-selector-demo.tsx
frontend/app/routes/commercial.vehicles.year-selector-demo.tsx
```
**Action**: Ajouter guards production

### 🖼️ Images & Search Demos (3 fichiers)
```
frontend/app/routes/demo-images.tsx
frontend/app/routes/search-demo.tsx
frontend/app/routes/search.demo.tsx
```
**Action**: Ajouter guards production

### 🧪 Test Routes (2 fichiers)
```
frontend/app/routes/test-route.tsx
frontend/app/routes/test-simple.tsx
```
**Action**: Ajouter guards production

### 🎨 Ultimate Demo (1 fichier)
```
frontend/app/routes/v5-ultimate-demo.tsx
```
**Action**: Ajouter guards production

### 💾 Fichiers Backup (3 fichiers)
```
frontend/app/routes/admin.orders._index.tsx.backup
frontend/app/routes/admin.users.$id.tsx.backup
frontend/app/routes/admin.users._index.tsx.backup
```
**Action**: Supprimer (backups inutiles, code déjà versionné git)

### 📁 Tests TypeScript (1 dossier)
```
frontend/app/routes/tests/
frontend/app/routes/tests/commercial.products.catalog.test.ts
```
**Action**: Vérifier si utilisé, sinon déplacer vers __tests__

---

## 📊 Totaux

- **11 routes demo/test** à protéger avec guards
- **3 fichiers backup** à supprimer
- **1 dossier tests** à vérifier

---

## 🛡️ Guard Pattern à implémenter

```typescript
export async function loader({ context }: LoaderFunctionArgs) {
  // Guard production
  if (process.env.NODE_ENV === 'production') {
    throw new Response('Not Found', { status: 404 });
  }
  
  // ... reste du code demo
}
```

---

## ✅ Actions recommandées

1. **Supprimer backups** (3 fichiers)
   ```bash
   rm frontend/app/routes/*.backup
   ```

2. **Ajouter guards** sur 11 routes demo/test

3. **Déplacer tests** TypeScript vers __tests__/ si non utilisés

4. **Commit** Phase 2 documentation + guards
