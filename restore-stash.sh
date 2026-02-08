#!/bin/bash
# Reset conflicting files to HEAD, then pop stash
set -e

echo "=== Resetting conflicting files to HEAD ==="
git checkout HEAD -- \
  backend/src/modules/admin/services/admin-gammes-seo.service.ts \
  backend/src/modules/blog/services/constructeur.service.ts \
  backend/src/modules/messages/messages.controller.ts \
  backend/src/modules/orders/controllers/orders.controller.ts \
  backend/src/modules/orders/services/orders.service.ts \
  backend/src/modules/products/controllers/products-core.controller.ts \
  backend/src/modules/search/services/search-simple.service.ts \
  backend/tsconfig.tsbuildinfo \
  frontend/app/auth/unified.server.ts \
  frontend/app/components/admin/QuickNoteDialog.tsx \
  frontend/app/contexts/CartContext.tsx \
  frontend/app/entry.client.tsx \
  frontend/app/entry.server.tsx \
  frontend/app/root.tsx

echo "=== Files reset. Attempting stash pop ==="
git stash pop 'stash@{0}' 2>&1

echo "=== Stash pop result: $? ==="
echo "=== Done ==="
