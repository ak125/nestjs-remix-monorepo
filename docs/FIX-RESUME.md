# ✅ RÉSOLU - Erreurs 404 images .webp

## 🎯 Problème
Backend retournait `"peugeot.webp"` au lieu de `"https://...supabase.co/.../peugeot.webp"`

## 💡 Solution (1 fichier modifié)

**`backend/src/modules/blog/services/blog.service.ts`**

### 1. Ajout méthode helper (ligne ~29-50)
```typescript
private readonly CDN_BASE_URL = `${process.env.SUPABASE_URL}/storage/v1/object/public/uploads`;

private buildImageUrl(filename: string | null, folder: string): string | null {
  if (!filename) return null;
  if (filename.startsWith('http')) return filename;
  return `${this.CDN_BASE_URL}/${folder}/${filename}`;
}
```

### 2. Utilisation dans getCompatibleVehicles() (ligne ~545-560)
```typescript
// AVANT
marque_logo: marque.marque_logo,      // "peugeot.webp"
modele_pic: modele.modele_pic,         // "206.webp"

// APRÈS
marque_logo: this.buildImageUrl(marque.marque_logo, 'constructeurs-automobiles/marques-logos'),
modele_pic: this.buildImageUrl(modele.modele_pic, 'constructeurs-automobiles/modeles-photos'),
```

## 🚀 Test

```bash
# Redémarrer backend
cd /workspaces/nestjs-remix-monorepo/backend
npm run dev
```

**Résultat** : Plus d'erreurs 404 pour `.webp` ! Images chargées depuis Supabase CDN directement.

---

**Docs complètes** : `/docs/SOLUTION-CDN-URLS.md`
