// Proxy local de mesure (mandat DS) : reproduit le rôle de Caddy/NestJS devant react-router-serve.
// - /img/* et GET /api/* -> DEV 127.0.0.1:3000 (lecture seule)
// - POST de télémétrie (/api/seo/cwv/beacon, /api/attribution/landing, /api/seo/runtime-event) -> 204 local, NON transmis
// - toute autre écriture /api -> 405 (aucune écriture sur le DEV partagé)
// - reste -> react-router-serve :APP
import http from "node:http";
const LISTEN = Number(process.env.LISTEN || 3017);
const APP = Number(process.env.APP || 3018);
const TELEMETRY = ["/api/seo/cwv/beacon", "/api/attribution/landing", "/api/seo/runtime-event"];
const READ = ["GET", "HEAD"];
http.createServer((req, res) => {
  const p = req.url.split("?")[0];
  const toDev = p.startsWith("/img/") || p.startsWith("/api/");
  if (toDev && !READ.includes(req.method)) {
    req.resume();
    if (TELEMETRY.includes(p)) { res.writeHead(204); return res.end(); }
    res.writeHead(405); return res.end();
  }
  const port = toDev ? 3000 : APP;
  const up = http.request({ host: "127.0.0.1", port, path: req.url, method: req.method,
    headers: { ...req.headers, host: `127.0.0.1:${port}` } }, (r) => { res.writeHead(r.statusCode, r.headers); r.pipe(res); });
  up.on("error", () => { res.writeHead(502); res.end(); });
  req.pipe(up);
}).listen(LISTEN, "127.0.0.1", () => console.log(`proxy :${LISTEN} -> app :${APP}; /img + GET /api -> :3000; telemetry POST -> 204 local`));
