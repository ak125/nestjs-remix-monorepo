# 🖼️ Guide : Ajout des images des articles conseils

## ✅ Configuration actuelle

Le code est **déjà prêt** ! Il charge automatiquement les images depuis :
```
/gammes-produits/catalogue/{pg_alias}.webp
```

## 📂 Où placer les images ?

Les images doivent être placées dans :
```
frontend/public/gammes-produits/catalogue/
```

## 📋 Liste des pg_alias (noms de fichiers attendus)

Voici les 85 fichiers d'images à créer (format `.webp` recommandé) :

```
agregat-de-freinage.webp
alternateur.webp
amortisseur.webp
arbre-a-came.webp
bagues-d-etancheite-moteur.webp
balais-d-essuie-glace.webp
bobine-d-allumage.webp
boitier-de-prechauffage.webp
bougie-d-allumage.webp
bougie-de-prechauffage.webp
bras-de-suspension.webp
butee-d-embrayage.webp
cable-d-embrayage.webp
cable-de-frein-a-main.webp
capteur-abs.webp
cardan.webp
carter-d-huile.webp
catalyseur.webp
colonne-de-direction.webp
commande-d-eclairage.webp
... (et 65 autres)
```

## 🔧 Script pour lister tous les noms de fichiers

Exécutez cette commande pour obtenir la liste complète :

```bash
curl -s "http://localhost:3000/api/blog/advice-hierarchy" | \
  jq -r '.data.families[].articles[].pg_alias' | \
  sort | uniq | \
  awk '{print $1".webp"}' > images-requises.txt

cat images-requises.txt
```

## 📥 Options pour obtenir les images

### Option 1 : Images depuis la base de données existante
Si vous avez des images dans votre ancienne base PHP :
```sql
SELECT ba_pg_id, ba_image 
FROM __blog_advice 
WHERE ba_image IS NOT NULL;
```

### Option 2 : Images depuis un CDN externe
Si vous utilisez un CDN pour stocker les images :
```typescript
// Modifier dans le composant ArticleImage
const imageUrl = pgAlias 
  ? `https://votre-cdn.com/images/gammes/${pgAlias}.webp`
  : null;
```

### Option 3 : Images depuis les gammes produits
Utiliser les images des gammes produits correspondantes :
```bash
# Copier depuis un dossier existant
cp /chemin/ancien/images/gammes/*.webp \
   frontend/public/gammes-produits/catalogue/
```

### Option 4 : Génération d'images placeholder
Pour tester rapidement, créer des placeholders colorés :
```bash
cd frontend/public/gammes-produits/catalogue

# Créer une image de test (nécessite ImageMagick)
for name in alternateur disque-de-frein plaquette-de-frein; do
  convert -size 400x300 \
    -background "#3B82F6" \
    -fill white \
    -gravity center \
    -pointsize 24 \
    label:"$name" \
    "$name.webp"
done
```

## 🎨 Comportement actuel

### Si l'image existe :
✅ L'image est affichée dans la carte (160px de hauteur)
✅ Effet zoom au survol
✅ Overlay gradient subtil

### Si l'image n'existe pas :
✅ Fallback automatique avec :
- Fond dégradé coloré selon la famille
- Icône emoji de la famille
- Pas d'erreur affichée

## 📊 Exemple de structure finale

```
frontend/public/gammes-produits/catalogue/
├── agregat-de-freinage.webp        (exemple: bloc ABS)
├── alternateur.webp                 (exemple: alternateur)
├── cable-de-frein-a-main.webp     (exemple: câble frein)
├── disque-de-frein.webp           (exemple: disque de frein)
├── kit-de-chaine-de-distribution.webp
└── ... (82 autres images)
```

## 🚀 Test rapide

1. **Placez quelques images** dans le dossier :
   ```bash
   cd frontend/public/gammes-produits/catalogue
   # Copiez vos images ici
   ```

2. **Rafraîchissez la page** :
   ```
   http://localhost:5173/blog-pieces-auto/conseils
   ```

3. **Vérifiez** :
   - Les images apparaissent dans les cartes
   - Le fallback fonctionne pour les images manquantes

## 📝 Format recommandé

- **Extension** : `.webp` (meilleure compression)
- **Dimensions** : 400x300px ou 800x600px
- **Poids** : < 50KB par image
- **Qualité** : 80-85%

## 🔄 Migration depuis l'ancien système

Si vous avez un ancien dossier d'images :

```bash
#!/bin/bash
# Script de migration des images

OLD_DIR="/chemin/ancien/images"
NEW_DIR="frontend/public/gammes-produits/catalogue"

# Créer le dossier si nécessaire
mkdir -p "$NEW_DIR"

# Copier et renommer les images
# Exemple si les anciennes images sont nommées par ID
curl -s "http://localhost:3000/api/blog/advice-hierarchy" | \
  jq -r '.data.families[].articles[] | "\(.ba_pg_id)|\(.pg_alias)"' | \
  while IFS='|' read -r id alias; do
    if [ -f "$OLD_DIR/piece_$id.jpg" ]; then
      convert "$OLD_DIR/piece_$id.jpg" \
        -resize 800x600^ \
        -gravity center \
        -extent 800x600 \
        -quality 85 \
        "$NEW_DIR/$alias.webp"
      echo "✅ Converti: $alias.webp"
    fi
  done
```

## ✨ Résultat attendu

Une fois les images en place, chaque carte d'article affichera :
- 🖼️ L'image du produit correspondant
- 📦 Badge de catégorie avec icône
- 📊 Nombre de vues
- 📅 Date de publication
- 🔗 Lien vers l'article complet

Le système fonctionne **automatiquement** dès que vous placez les images dans le bon dossier !
