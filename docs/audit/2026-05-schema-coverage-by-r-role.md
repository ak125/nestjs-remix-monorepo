# Schema coverage by R-role — audit 2026-05-23

Source : `backend/src/modules/seo/dynamic-seo-v4-ultimate.service.ts`

> ⚠️ **Limitation V1 reconnue** : ce script scanne UNIQUEMENT le facade `dynamic-seo-v4-ultimate.service.ts` (393 lignes). Ce fichier ne contient PAS de génération `@type` inline — il délègue au pipeline chain (`SeoChainModule`) + composers per-role + `@repo/seo-roles`. Conséquence : le "Missing" 100% ci-dessous **NE signifie PAS** que les schemas sont absents du runtime SEO ; il signifie que cette analyse statique étroite n'a rien capté **dans ce fichier précis**.
>
> **Next iteration recommandée** : étendre l'audit à `backend/src/modules/seo/**` et à `@repo/seo-roles`, en clé sur `surfaceKey` enum values (`R2_PRODUCT`, `R5_*`, `R8_VEHICLE`, etc.) au lieu du token litéral `R2/R3/...`. Le présent rapport reste utile comme **signal de départ** : la facade n'est pas le lieu de génération.

> Static analysis. Heuristique : fenêtre de ±1000 chars autour de chaque mention du rôle.
> Note : faux positifs possibles si un `@type` apparaît dans un commentaire ou est partagé entre rôles.

## R2
- **Expected** : Product
- **Found**    : (aucun)
- **Missing**  : ⚠️ **Product**

## R5
- **Expected** : FAQPage
- **Found**    : (aucun)
- **Missing**  : ⚠️ **FAQPage**

## R3
- **Expected** : HowTo, FAQPage
- **Found**    : (aucun)
- **Missing**  : ⚠️ **HowTo, FAQPage**

## R8
- **Expected** : Vehicle, FAQPage
- **Found**    : (aucun)
- **Missing**  : ⚠️ **Vehicle, FAQPage**

## Local
- **Expected** : LocalBusiness
- **Found**    : (aucun)
- **Missing**  : ⚠️ **LocalBusiness**

## Comparatif
- **Expected** : ItemList
- **Found**    : (aucun)
- **Missing**  : ⚠️ **ItemList**

## Next steps (pour chaque Missing)
- Ouvrir une PR fill schema séparée par R-role (out-of-scope de ce plan).
- Respecter `feedback_no_touch_meta_h1_if_optimized` : ne pas toucher les meta optimisées existantes.
