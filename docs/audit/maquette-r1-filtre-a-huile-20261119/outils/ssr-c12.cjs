// Complément n° 12 au mandat DS : cartes véhicule R1 dans le HTML servi, sans JavaScript (GET simple, aucun navigateur).
// - Cartes que la page connaît : liens véhicule « /pieces/<gamme>/<marque>/<modele>/<type>.html » présents dans les
//   données du loader (flux React Router dans les <script>), dans l'ordre, sans doublon.
// - Cartes rendues : <a href> de la section des motorisations contenant un <h3> et « Voir les pièces ».
//   Chaque carte rendue est classée « visible » ou « dépliable » (la carte porte la classe hidden, jeton exact).
// - Taille du HTML (octets, brut et gzip).
// Usage : URL_PATH=/pieces/… node ssr-c12.cjs <base> <label> <dossier>
const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");
const URL_PATH = process.env.URL_PATH || "/pieces/filtre-a-huile-7.html";
const SLUG = URL_PATH.replace(/^\/pieces\//, "").replace(/\.html$/, "");
const [, , base, label, outDir] = process.argv;

(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const r = await fetch(base + URL_PATH, { headers: { "user-agent": "ssr-c12 (audit local)" } });
  const html = await r.text();
  const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]).join("\n");
  const veh = new RegExp(`/pieces/${SLUG.replace(/[-]/g, "\\-")}/[a-z0-9-]+/[a-z0-9-]+/[a-z0-9-]+\\.html`, "g");
  const connues = [...new Set(scripts.match(veh) || [])];
  // cartes rendues : <a ... href="..."> ... </a> contenant <h3> et « Voir les pièces »
  const cartes = [];
  for (const m of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)) {
    const href = (m[1].match(/\bhref="([^"]+)"/) || [])[1];
    if (!href || !/<h3\b/.test(m[2]) || !/Voir les pièces/.test(m[2])) continue;
    const titre = (m[2].match(/<h3\b[^>]*>([\s\S]*?)<\/h3>/) || [])[1].replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").trim();
    const fab = (m[2].match(/>([^<]*abrication)(?:<!-- -->)?\u00a0?:(?:<!-- -->)? <span[^>]*>([^<]*)</) || []).slice(1).join(" : ") || null;
    // dépliable : la carte porte elle-même la classe « hidden » (jeton exact, pas « overflow-hidden »)
    const cls = (m[1].match(/\bclass="([^"]*)"/) || [])[1] || "";
    const depliable = cls.split(/\s+/).includes("hidden");
    cartes.push({ href, titre, fabrication: fab, etat: depliable ? "dépliable" : "visible" });
  }
  const hrefs = new Set(cartes.map((c) => c.href));
  const sansLien = connues.filter((u) => !hrefs.has(u));
  const bouton = (html.match(/Voir les <!-- -->(\d+)<!-- --> autres compatibilités/) || html.match(/Voir les (\d+) autres compatibilités/) || [])[1] || null;
  const res = {
    url: base + URL_PATH, label, at: new Date().toISOString(), statut: r.status,
    tailleHtml: { octets: Buffer.byteLength(html), gzip: zlib.gzipSync(html).length },
    cartesConnues: connues.length, cartesAvecAHref: cartes.length,
    visibles: cartes.filter((c) => c.etat === "visible").length, depliables: cartes.filter((c) => c.etat === "dépliable").length,
    boutonVoirPlus: bouton, sansLienDansLeHtml: sansLien, cartes, connues,
  };
  fs.writeFileSync(path.join(outDir, `${label}-${SLUG}-ssr.json`), JSON.stringify(res, null, 2));
  console.log(`== ${label} ${SLUG} HTTP ${r.status} | HTML ${res.tailleHtml.octets} o (gzip ${res.tailleHtml.gzip}) | connues ${connues.length} | <a href> ${cartes.length} (visibles ${res.visibles}, dépliables ${res.depliables}) | bouton « Voir les ${bouton} autres » | sans lien ${sansLien.length}`);
  for (const u of sansLien) console.log(`   sans <a href> : ${u}`);
})().catch((e) => { console.error(e); process.exit(1); });
