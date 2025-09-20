# 📱 SETUP PWA - PROGRESSIVE WEB APP

## 1. Manifest.json

### frontend/public/manifest.json
```json
{
  "name": "NestJS Remix Monorepo",
  "short_name": "Monorepo App",
  "description": "Application e-commerce moderne",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#3b82f6",
  "orientation": "portrait-primary",
  "icons": [
    {
      "src": "pwa-192x192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "maskable"
    },
    {
      "src": "pwa-512x512.png", 
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "maskable"
    }
  ]
}
```

## 2. Service Worker basique

### frontend/public/sw.js
```javascript
const CACHE_NAME = 'monorepo-v1';
const urlsToCache = [
  '/',
  '/build/client/assets/root-*.css',
  '/build/client/assets/root-*.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => response || fetch(event.request))
  );
});
```

## 3. Integration Remix

### frontend/app/root.tsx - Ajouter dans <head>
```tsx
<link rel="manifest" href="/manifest.json" />
<meta name="theme-color" content="#3b82f6" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="default" />
```

### frontend/app/entry.client.tsx - Après Sentry
```typescript
// Register service worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('SW registered: ', registration);
      })
      .catch((registrationError) => {
        console.log('SW registration failed: ', registrationError);
      });
  });
}
```

## 4. Icônes PWA
Créer les icônes 192x192 et 512x512 dans `/public/`

## 5. Test PWA
1. Build production : `npm run build`
2. Ouvrir Chrome DevTools > Lighthouse
3. Audit PWA score
4. Test installation mobile

**Durée estimée : 4h**  
**Impact : Installation mobile + offline basique**
