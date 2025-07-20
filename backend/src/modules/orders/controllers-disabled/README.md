# Contrôleurs Automobiles - TEMPORAIREMENT DÉSACTIVÉS

## Contrôleur déplacé
- `automotive-orders.controller.ts` - API REST pour commandes automobiles

## Raison de la désactivation
Le contrôleur dépend des services automobiles qui ont été temporairement désactivés pour résoudre les erreurs de compilation Prisma.

## Plan de réactivation
1. Attendre la refactorisation des services automobiles (voir `../services-disabled/README.md`)
2. Mettre à jour les imports du contrôleur
3. Réactiver dans `orders.module.ts`
4. Tests d'intégration

## Impact
- ❌ API `/api/automotive-orders/*` temporairement indisponible
- ✅ API générale `/api/orders/*` fonctionne normalement
- ✅ Interface intégrée Remix fonctionne parfaitement

## Priorité
🔥 **HAUTE** - Réactivation nécessaire après refactorisation des services.
