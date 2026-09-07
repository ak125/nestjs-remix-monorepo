# Runbook : Re-import des images TecDoc fournisseur

> Derniere mise a jour : 2026-04-11

## Contexte

Les images produit dans Supabase Storage (`rack-images/{DLNR}/`) proviennent du flux
de donnees TecDoc. Chaque fournisseur (DLNR = Data Supplier Number) fournit ses images
dans un package media standardise.

En avril 2026, les images des produits inactifs ont ete supprimees pour reduire le
stockage Supabase. Ce runbook explique comment re-importer les images si un fournisseur
est reactive.

## Architecture du pipeline images

```
TecDoc Media Package (PNG/JPG par fournisseur)
    |
    v
tecdoc_doc.graphics_registry   (9.4M refs, 836 fournisseurs)
    |  colonnes : source_dlnr, bildname, bildtype, width, height
    |
    v
Script de projection : data/tecdoc/project-images.py
    |  log : data/tecdoc/logs/project-images.log
    |
    v
public.pieces_media_img         (refs fichier par piece)
    |  colonnes : pmi_piece_id, pmi_folder (= DLNR), pmi_name (= filename)
    |
    v
Supabase Storage bucket: rack-images/{DLNR}/{filename}
    |
    v
Caddy proxy /img/rack-images/{DLNR}/{filename}  (cache 1 an)
    |
    v
imgproxy /imgproxy/...  (conversion WebP a la volee, optionnel)
```

## Procedure de re-import pour un fournisseur

### Pre-requis

- Acces au package media TecDoc pour le fournisseur
- Acces service_role Supabase
- Le fournisseur doit avoir des pieces actives (`piece_display = true`)

### Etapes

1. **Verifier les pieces actives du fournisseur**

```sql
-- Remplacer XXX par le DLNR du fournisseur
SELECT count(*) as active_pieces
FROM pieces_media_img pmi
JOIN pieces p ON p.piece_id = pmi.pmi_piece_id::int
WHERE pmi.pmi_folder = 'XXX'
  AND p.piece_display = true;
```

2. **Lister les images manquantes**

```sql
-- Images referencees en DB mais absentes du Storage
SELECT pmi.pmi_name
FROM pieces_media_img pmi
JOIN pieces p ON p.piece_id = pmi.pmi_piece_id::int
WHERE pmi.pmi_folder = 'XXX'
  AND p.piece_display = true
  AND NOT EXISTS (
    SELECT 1 FROM storage.objects so
    WHERE so.bucket_id = 'rack-images'
      AND so.name = 'XXX/' || pmi.pmi_name
  );
```

3. **Extraire les images du package TecDoc**

```bash
# Les packages TecDoc sont distribues par fournisseur
# Format habituel : {DLNR}_{bildname}.{ext}
# Extraire les fichiers necessaires depuis le package media
```

4. **Convertir en WebP (format actuel)**

```bash
# Installer cwebp si necessaire : apt install webp
# Convertir chaque image
for f in *.PNG *.JPG *.png *.jpg; do
  cwebp -q 80 "$f" -o "${f%.*}.webp"
done
```

5. **Uploader vers Supabase Storage**

```python
from supabase import create_client

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

# Upload par batch
for filepath in webp_files:
    filename = os.path.basename(filepath)
    with open(filepath, 'rb') as f:
        supabase.storage.from_('rack-images').upload(
            f'{dlnr}/{filename}',
            f.read(),
            {'content-type': 'image/webp'}
        )
```

6. **Mettre a jour les references DB**

```sql
-- Mettre a jour pmi_name pour pointer vers le WebP
UPDATE pieces_media_img
SET pmi_name = regexp_replace(pmi_name, '\.(PNG|JPG|JPEG|png|jpg|jpeg)$', '.webp')
WHERE pmi_folder = 'XXX'
  AND pmi_name ~ '\.(PNG|JPG|JPEG|png|jpg|jpeg)$';
```

7. **Verifier**

```bash
# Tester une image sur le site
curl -I https://www.automecanik.com/img/rack-images/XXX/example.webp
# Doit retourner 200 avec content-type: image/webp
```

## Fournisseurs actifs (reference avril 2026)

62 folders actifs dans rack-images. Les principaux (par taille) :

| DLNR | Taille | Fichiers actifs | Fournisseur |
|------|--------|-----------------|-------------|
| 161  | 12 GB  | 25,165          | -           |
| 16   | 8.6 GB | 5,946           | -           |
| 123  | 7.8 GB | 35,313          | -           |
| 13   | 7.2 GB | 35,857          | -           |
| 65   | 5.2 GB | 16,719          | -           |
| 101  | 5.0 GB | 37,540          | -           |

Total images actives : ~586,690 fichiers.

## Format des images

- **Avant avril 2026** : PNG/JPG (format original TecDoc)
- **Apres avril 2026** : WebP (qualite 80)
- imgproxy est configure pour servir du WebP a la volee si necessaire
- Le code backend (`backend/src/modules/catalog/utils/image-urls.utils.ts`) gere les deux formats

## Scripts utiles

| Script | Description |
|--------|-------------|
| `scripts/cleanup-inactive-rack-images-v2.py` | Nettoyage images inactives (dry-run/commit) |
| `data/tecdoc/project-images.py` | Pipeline de projection TecDoc → pieces_media_img |
| `scripts/verify-supabase-images.js` | Verification images Supabase |

## Contact

Pour obtenir les packages media TecDoc, contacter le support TecDoc
ou utiliser le portail TecDoc Alliance.
