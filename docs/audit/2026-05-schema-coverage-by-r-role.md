# Schema coverage by R-role — audit 2026-05-23

Source : `backend/src/modules/seo/dynamic-seo-v4-ultimate.service.ts`

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
