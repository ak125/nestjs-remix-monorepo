import { logger } from "~/utils/logger";

// Fire-and-forget POST of a JSON payload, optimised for analytics beacons that
// must survive page unloads.
//
// Why sendBeacon: when the user navigates away or closes the tab, plain
// `fetch()` is aborted by the browser. The server's body parser (`raw-body`)
// then throws `BadRequestError: request aborted`, which used to pollute
// Sentry on `POST /api/seo/track-impression`. `navigator.sendBeacon`
// guarantees best-effort delivery without blocking navigation. If it is
// unavailable or refuses the payload (queue full / oversize), we fall back
// to `fetch` with `keepalive: true` so the request can still survive the
// document unload.
export function postJsonBeacon(url: string, payload: unknown): void {
  if (typeof navigator === "undefined") return;

  const body = JSON.stringify(payload);

  if (typeof navigator.sendBeacon === "function") {
    const blob = new Blob([body], { type: "application/json" });
    if (navigator.sendBeacon(url, blob)) return;
  }

  fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch((err) =>
    logger.debug("[postJsonBeacon] fallback fetch failed:", err),
  );
}
