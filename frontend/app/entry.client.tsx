/**
 * By default, Remix will handle hydrating your app on the client for you.
 * You are free to delete this file if you'd like to, but if you ever want it revealed again, you can run `npx remix reveal` ✨
 * For more information, see https://remix.run/file-conventions/entry.client
 */

import { RemixBrowser } from "@remix-run/react";
import { startTransition } from "react";
import { hydrateRoot } from "react-dom/client";
import { logger } from "~/utils/logger";

// Nettoyage des service workers existants
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistrations().then(function (registrations) {
    for (let registration of registrations) {
      registration.unregister().then(function (boolean) {
        logger.log("Service Worker désenregistré:", boolean);
      });
    }
  });
}

startTransition(() => {
  hydrateRoot(document, <RemixBrowser />, {
    onRecoverableError(error) {
      // Ignorer les erreurs d'hydratation mineures (extensions navigateur, etc.)
      if (error instanceof Error && error.message.includes("Hydration")) {
        return;
      }
      console.error("Recoverable error:", error);
    },
  });
});
