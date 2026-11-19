// Complément n° 5 au mandat DS : proxy de mesure, même rôle que img-proxy.mjs (GET seulement vers le DEV :3000),
// plus une SUBSTITUTION déclarée : si SUBST=1, dans la réponse GET /api/gamme-rest/{7|402}/page-data-rpc-v2,
// motorisations.items[].description et .content sont remplacés par la phrase calculée par la méthode du builder
// patché (fichier apres.json, par type_id). Raison : le service DEV partagé tourne sur main et ne doit être ni
// redémarré ni doublé (un backend isolé partagerait son cache Redis). Rien d'autre n'est modifié.
import http from "node:http";
import fs from "node:fs";
const LISTEN = Number(process.env.LISTEN || 3017);
const APP = Number(process.env.APP || 3018);
const SUBST = process.env.SUBST === "1";
const EMPTY = process.env.EMPTY === "1"; // cas « aucun fragment admis » : description vide sur toutes les cartes
const apres = JSON.parse(fs.readFileSync(process.env.APRES, "utf8"));
const TELEMETRY = ["/api/seo/cwv/beacon", "/api/attribution/landing", "/api/seo/runtime-event"];
const READ = ["GET", "HEAD"];
const RE = /^\/api\/gamme-rest\/(7|402)\/page-data-rpc-v2$/;
let substituted = 0;
http.createServer((req, res) => {
  const p = req.url.split("?")[0];
  const toDev = p.startsWith("/img/") || p.startsWith("/api/");
  if (toDev && !READ.includes(req.method)) {
    req.resume();
    if (TELEMETRY.includes(p)) { res.writeHead(204); return res.end(); }
    res.writeHead(405); return res.end();
  }
  const port = toDev ? 3000 : APP;
  const m = SUBST && req.method === "GET" && p.match(RE);
  const headers = { ...req.headers, host: `127.0.0.1:${port}` };
  if (m) delete headers["accept-encoding"];
  const up = http.request({ host: "127.0.0.1", port, path: req.url, method: req.method, headers }, (r) => {
    if (!m) { res.writeHead(r.statusCode, r.headers); return r.pipe(res); }
    const chunks = []; r.on("data", (c) => chunks.push(c)); r.on("end", () => {
      const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      const byType = new Map(apres[m[1]].cards.map((c) => [String(c.type_id), c.apres]));
      for (const it of body.motorisations?.items || []) {
        if (byType.has(String(it.cgc_type_id))) { it.description = EMPTY ? "" : byType.get(String(it.cgc_type_id)); it.content = it.description; substituted++; }
      }
      const out = Buffer.from(JSON.stringify(body));
      const h = { ...r.headers, "content-length": out.length, "x-mandat-ds-c5": "substitution-description" };
      delete h["content-encoding"]; delete h["transfer-encoding"];
      res.writeHead(r.statusCode, h); res.end(out);
      console.log(`substitution pg ${m[1]} : total cartes substituées ${substituted}`);
    });
  });
  up.on("error", () => { res.writeHead(502); res.end(); });
  req.pipe(up);
}).listen(LISTEN, "127.0.0.1", () => console.log(`proxy-c5 :${LISTEN} -> app :${APP}; SUBST=${SUBST} EMPTY=${EMPTY}`));
