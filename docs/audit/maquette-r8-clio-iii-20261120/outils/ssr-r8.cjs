// Complément n° 13 au mandat DS : relevé du HTML servi d'une page R8 (GET simple, aucun navigateur, aucune écriture).
// - title, meta description, robots (balise + en-tête X-Robots-Tag), canonical, H1, plan des titres H2/H3 dans l'ordre,
//   blocs data-section dans l'ordre, données structurées (@type de chaque JSON-LD).
// - Liens sortants classés par rôle d'après le chemin (R1 /pieces/<gamme>.html, R2 /pieces/<g>/<m>/<mo>/<t>.html,
//   R3 /blog-pieces-auto/conseils/, R4 /reference-auto/, R5 /diagnostic-auto/, R6 /blog-pieces-auto/guide-achat/,
//   R7 /constructeurs/<marque>.html, R8 /constructeurs/<m>/<mo>/<t>.html, ancre interne, autre).
// - Termes interdits du rôle présents dans le texte visible du HTML serveur, selon les deux listes du dépôt :
//   backend/src/config/r8-keyword-plan.constants.ts (R8_ALL_FORBIDDEN_TERMS) et
//   packages/seo-roles/src/forbidden-overlap.ts (RoleId.R8_VEHICLE). Les listes sont lues dans le dépôt, pas recopiées.
// - Texte visible par bloc (pour la comparaison entre deux pages R8, faite par compare-r8.cjs).
// Usage : URL_PATH=/constructeurs/… REPO=<racine du dépôt> node ssr-r8.cjs <base> <label> <dossier>
const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");
const URL_PATH = process.env.URL_PATH;
const REPO = process.env.REPO || path.resolve(__dirname, "../../../..");
const [, , base, label, outDir] = process.argv;
const SLUG = URL_PATH.replace(/^\/constructeurs\//, "").replace(/\.html$/, "").replace(/\//g, "_");

const norm = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[’']/g, "'");
const arr = (src, name) => {
  const m = src.match(new RegExp(`export const ${name} = \\[([\\s\\S]*?)\\] as const`));
  return m ? [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]) : [];
};
const back = fs.readFileSync(path.join(REPO, "backend/src/config/r8-keyword-plan.constants.ts"), "utf8");
const LISTES = Object.fromEntries(["R8_FORBIDDEN_DIAGNOSTIC", "R8_FORBIDDEN_REPARATION", "R8_FORBIDDEN_GLOSSAIRE", "R8_FORBIDDEN_COMPARATIF", "R8_FORBIDDEN_PROMESSES"].map((n) => [n, arr(back, n)]));
const fo = fs.readFileSync(path.join(REPO, "packages/seo-roles/src/forbidden-overlap.ts"), "utf8");
const foR8 = (fo.match(/\[RoleId\.R8_VEHICLE\]: Object\.freeze\(\[([\s\S]*?)\]\)/) || [])[1] || "";
LISTES["seo-roles R8_VEHICLE"] = [...foR8.matchAll(/"([^"]+)"/g)].map((x) => x[1]);

const role = (h) => {
  if (/^#/.test(h)) return "ancre";
  let p; try { p = new URL(h, "https://www.automecanik.com"); } catch { return "autre"; }
  if (!/automecanik\.com$|^127\.0\.0\.1$|^localhost$/.test(p.hostname)) return "externe";
  const s = p.pathname;
  if (/^\/pieces\/[^/]+\/[^/]+\/[^/]+\/[^/]+\.html$/.test(s)) return "R2";
  if (/^\/pieces\/[^/]+\.html$/.test(s)) return "R1";
  if (/^\/blog-pieces-auto\/conseils\//.test(s)) return "R3";
  if (/^\/reference-auto\//.test(s)) return "R4";
  if (/^\/diagnostic-auto\//.test(s)) return "R5";
  if (/^\/blog-pieces-auto\/guide-achat\//.test(s)) return "R6";
  if (/^\/constructeurs\/[^/]+\/[^/]+\/[^/]+\.html$/.test(s)) return "R8";
  if (/^\/constructeurs\/[^/]+\.html$/.test(s)) return "R7";
  if (/^\/constructeurs\/[^/]+\/[^/]+\.html$/.test(s)) return "modèle";
  return "autre";
};
const txt = (h) => h.replace(/<script\b[\s\S]*?<\/script>/g, " ").replace(/<style\b[\s\S]*?<\/style>/g, " ").replace(/<!-- -->/g, "").replace(/<[^>]+>/g, " ")
  .replace(/&nbsp;|&#160;/g, " ").replace(/&amp;/g, "&").replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ").trim();

(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const r = await fetch(base + URL_PATH, { headers: { "user-agent": "ssr-r8 (audit local)" }, redirect: "manual" });
  const html = await r.text();
  const head = (html.match(/<head\b[\s\S]*?<\/head>/) || [""])[0];
  const body = (html.match(/<body\b[\s\S]*<\/body>/) || [html])[0];
  const metaN = (n) => ((head.match(new RegExp(`<meta[^>]+name="${n}"[^>]*>`)) || [""])[0].match(/content="([^"]*)"/) || [])[1] || null;
  const jsonld = [...html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/g)].map((m) => {
    try { const j = JSON.parse(m[1]); const g = j["@graph"] || [j]; return g.map((x) => x["@type"]); } catch { return ["(JSON invalide)"]; }
  });
  const titres = [...body.matchAll(/<(h[1-3])\b[^>]*>([\s\S]*?)<\/\1>/g)].map((m) => `${m[1].toUpperCase()} ${txt(m[2])}`);
  // blocs data-section dans l'ordre, avec leur texte (jusqu'au bloc suivant)
  const marques = [...body.matchAll(/data-section="([^"]+)"/g)].map((m) => ({ id: m[1], at: body.lastIndexOf("<", m.index) }));
  const blocs = marques.map((b, i) => ({ id: b.id, texte: txt(body.slice(b.at, i + 1 < marques.length ? marques[i + 1].at : body.length)) }));
  const liens = [...body.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)].map((m) => ({ href: ((m[1].match(/\bhref="([^"]*)"/) || [])[1] || "").replace(/&amp;/g, "&"), texte: txt(m[2]).slice(0, 80) })).filter((l) => l.href);
  liens.forEach((l) => (l.role = role(l.href)));
  const parRole = {}; for (const l of liens) parRole[l.role] = (parRole[l.role] || 0) + 1;
  const visible = norm(txt(body));
  const interdits = {};
  for (const [n, termes] of Object.entries(LISTES)) {
    const hits = termes.map((t) => ({ t, n: (visible.match(new RegExp(`(?<![a-z])${norm(t).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![a-z])`, "g")) || []).length })).filter((x) => x.n);
    if (hits.length) interdits[n] = hits;
  }
  const res = {
    url: base + URL_PATH, label, at: new Date().toISOString(), statut: r.status, location: r.headers.get("location"),
    xRobotsTag: r.headers.get("x-robots-tag"), cacheControl: r.headers.get("cache-control"),
    tailleHtml: { octets: Buffer.byteLength(html), gzip: zlib.gzipSync(html).length },
    title: txt((head.match(/<title>([\s\S]*?)<\/title>/) || [, ""])[1]), description: metaN("description"), robots: metaN("robots"),
    canonical: ((head.match(/<link[^>]+rel="canonical"[^>]*>/) || [""])[0].match(/href="([^"]*)"/) || [])[1] || null,
    h1: titres.filter((t) => t.startsWith("H1")).map((t) => t.slice(3)), jsonld,
    blocs: blocs.map((b) => b.id), titres, liensParRole: parRole,
    liens: liens.filter((l) => !["ancre"].includes(l.role)), interdits, texteParBloc: Object.fromEntries(blocs.map((b) => [b.id, b.texte])),
    listesInterdits: Object.fromEntries(Object.entries(LISTES).map(([k, v]) => [k, v.length])),
  };
  fs.writeFileSync(path.join(outDir, `${label}-${SLUG}-ssr.json`), JSON.stringify(res, null, 2));
  console.log(`== ${label} ${URL_PATH} HTTP ${r.status} | X-Robots-Tag ${res.xRobotsTag} | robots ${res.robots} | HTML ${res.tailleHtml.octets} o (gzip ${res.tailleHtml.gzip})`);
  console.log(`   title « ${res.title} »\n   H1 ${JSON.stringify(res.h1)}\n   description « ${res.description} »\n   canonical ${res.canonical}\n   JSON-LD ${JSON.stringify(jsonld)}`);
  console.log(`   blocs ${res.blocs.join(" > ")}\n   liens ${JSON.stringify(parRole)}\n   interdits ${JSON.stringify(interdits)}`);
})().catch((e) => { console.error(e); process.exit(1); });
