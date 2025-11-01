# 🧪 Instructions pour tester le fil d'ariane dynamique

## ⚠️ Pré-requis

Le **frontend Remix doit être démarré** pour tester le fil d'ariane.

### Démarrer le frontend

```bash
cd frontend
npm run dev
```

Le frontend sera accessible sur **http://localhost:5173**

## 🧪 Scripts de test curl disponibles

### 1. Test rapide (recommandé)

```bash
./test-curl-quick.sh
```

**Ce qu'il teste :**
- ✅ SANS cookie : Pas de "Renault Avantime" dans la page
- ✅ AVEC cookie : "Renault Avantime" présent dans le breadcrumb

### 2. Test détaillé

```bash
./test-breadcrumb-simple.sh
```

**Ce qu'il teste :**
- Affiche le HTML du breadcrumb
- Compte les liens
- Compare avec/sans cookie

### 3. Test complet

```bash
./test-breadcrumb-curl.sh
```

**Ce qu'il teste :**
- Breadcrumb HTML
- JSON-LD Schema.org
- Badge de filtre véhicule
- Rapport détaillé

## 🎯 Résultats attendus

### SANS cookie de véhicule

**Breadcrumb visuel :**
```
Accueil → Pièces → Pompe de direction assistée
```

**JSON-LD Schema.org :**
```json
{
  "@type": "BreadcrumbList",
  "itemListElement": [
    { "position": 1, "name": "Accueil" },
    { "position": 2, "name": "Pièces" },
    { "position": 3, "name": "Pompe de direction assistée" }
  ]
}
```

**Badge de filtre :**
- ❌ Pas de badge affiché

---

### AVEC cookie de véhicule

**Breadcrumb visuel :**
```
Accueil → Pièces → Renault Avantime → Pompe de direction assistée
```

**JSON-LD Schema.org :**
```json
{
  "@type": "BreadcrumbList",
  "itemListElement": [
    { "position": 1, "name": "Accueil" },
    { "position": 2, "name": "Pièces" },
    { "position": 3, "name": "Pompe de direction assistée" }
  ]
}
```
*Note: Le JSON-LD reste à 3 niveaux (canonique, sans véhicule) pour le SEO*

**Badge de filtre :**
- ✅ Badge bleu affiché : "🚗 Filtré pour : Renault Avantime [× Retirer]"

---

## 🔧 Test manuel dans le navigateur

### Méthode 1 : Via VehicleSelector

1. Ouvrir http://localhost:5173/pieces/pompe-de-direction-assistee-18
2. Utiliser le VehicleSelector pour choisir :
   - Marque : **Renault**
   - Modèle : **Avantime**
   - Type : **2.0 16V**
3. La page se recharge avec le breadcrumb à 4 niveaux
4. Le badge bleu apparaît

### Méthode 2 : Via Console DevTools

1. Ouvrir http://localhost:5173/pieces/pompe-de-direction-assistee-18
2. Ouvrir Console DevTools (F12)
3. Coller ce code :

```javascript
document.cookie = 'selected_vehicle=' + encodeURIComponent(JSON.stringify({
  marque_id: 140,
  marque_name: "Renault",
  marque_alias: "renault",
  modele_id: 1234,
  modele_name: "Avantime",
  modele_alias: "avantime",
  type_id: 5678,
  type_name: "2.0 16V",
  type_alias: "2-0-16v",
  selected_at: new Date().toISOString()
})) + '; path=/; max-age=2592000';
location.reload();
```

4. La page se recharge avec le breadcrumb à 4 niveaux

---

## 📊 Vérifier les logs serveur

Les logs backend affichent :

```
🚗 Véhicule depuis cookie: Aucun véhicule sélectionné
🍞 Breadcrumb généré: Accueil → Pièces → Pompe de direction assistée
```

Avec cookie :

```
🚗 Véhicule depuis cookie: Renault Avantime
🍞 Breadcrumb généré: Accueil → Pièces → Renault Avantime → Pompe de direction assistée
```

---

## ❌ Dépannage

### Le test curl échoue

**Problème :** `ERREUR: Le serveur n'est pas accessible`

**Solution :**
```bash
cd frontend
npm run dev
```

Vérifier que le serveur écoute sur le port 5173 :
```bash
curl -I http://localhost:5173
```

### Le breadcrumb ne change pas

**Vérifications :**

1. Le cookie est-il bien défini ?
   ```javascript
   // Dans la console
   document.cookie
   ```

2. La page se recharge-t-elle après sélection du véhicule ?

3. Vérifier les logs serveur (backend) pour voir les messages de debug

### Le véhicule n'apparaît pas

**Causes possibles :**

1. **Cookie mal formaté** - Vérifier le JSON dans le cookie
2. **Domaine incorrect** - Le cookie doit être sur `path=/`
3. **Server-side rendering** - Vérifier que `getVehicleFromCookie()` est appelé dans le loader

---

## ✅ Checklist de validation

- [ ] Frontend Remix démarré (port 5173)
- [ ] Backend NestJS démarré (port 3000)
- [ ] Page `/pieces/pompe-de-direction-assistee-18` accessible
- [ ] SANS cookie : 3 niveaux de breadcrumb
- [ ] AVEC cookie : 4 niveaux de breadcrumb avec véhicule
- [ ] Badge de filtre affiché avec cookie
- [ ] JSON-LD reste à 3 niveaux (canonique)
- [ ] Logs serveur confirment la lecture du cookie

---

## 🚀 Commandes rapides

```bash
# Démarrer le frontend
cd frontend && npm run dev

# Dans un autre terminal : tester
./test-curl-quick.sh

# Ou test détaillé
./test-breadcrumb-simple.sh

# Ou test complet
./test-breadcrumb-curl.sh
```
