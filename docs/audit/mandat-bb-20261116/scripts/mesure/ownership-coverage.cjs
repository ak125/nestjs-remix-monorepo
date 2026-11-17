// Mandat BB-2 point 4 — couverture d'ownership.yaml sur l'arbre suivi (lecture seule).
// Usage : node ownership-coverage.cjs <racine-du-dépôt>
const path = require("path"), fs = require("fs"), { execFileSync } = require("child_process");
const root = path.resolve(process.argv[2]);
const req = (m) => require(require.resolve(m, { paths: [root] }));
const micromatch = req("micromatch"), yaml = req("js-yaml");
const dir = path.join(root, ".spec/00-canon/repository-registry");
const own = yaml.load(fs.readFileSync(path.join(dir, "ownership.yaml"), "utf8")).entries;
const dom = yaml.load(fs.readFileSync(path.join(dir, "domains.yaml"), "utf8"));
const domains = dom.domains || dom.entries || dom;
const EXC = ["audit/registry/**", "**/*.test.ts", "**/*.spec.ts", "**/__tests__/**", ".changeset/**"];
const matchers = own.map((e) => ({ e, m: micromatch.matcher(e.glob) }));
const dmatch = (Array.isArray(domains) ? domains : []).flatMap((d) => (d.globs || []).map((g) => micromatch.matcher(g)));
const files = execFileSync("git", ["-C", root, "ls-files"], { encoding: "utf8", maxBuffer: 1 << 28 }).split("\n").filter(Boolean);
const by = {};
let tot = { n: 0, exc: 0, owned: 0, domOnly: 0, none: 0 };
for (const f of files) {
  const seg = f.split("/");
  const key = seg.length === 1 ? "(racine)" : seg.slice(0, seg[0] === "backend" || seg[0] === "frontend" || seg[0] === "packages" || seg[0] === "scripts" ? 3 : 2).join("/");
  const b = (by[key] ||= { n: 0, exc: 0, owned: 0, domOnly: 0, none: 0, owners: {} });
  b.n++; tot.n++;
  if (micromatch.isMatch(f, EXC)) { b.exc++; tot.exc++; continue; }
  let best = null;
  for (const x of matchers) if (x.m(f) && (!best || x.e.glob.length > best.glob.length)) best = x.e;
  if (best) { b.owned++; tot.owned++; b.owners[best.owner + "/" + best.domain + "/" + best.risk] = (b.owners[best.owner + "/" + best.domain + "/" + best.risk] || 0) + 1; }
  else if (dmatch.some((m) => m(f))) { b.domOnly++; tot.domOnly++; }
  else { b.none++; tot.none++; }
}
console.log("fichiers suivis", tot);
console.log("dossiers où un fichier nouveau (hors tests) serait refusé — tri par fichiers non couverts :");
Object.entries(by).filter(([, b]) => b.domOnly + b.none > 0).sort((a, b) => (b[1].domOnly + b[1].none) - (a[1].domOnly + a[1].none)).slice(0, 28)
  .forEach(([k, b]) => console.log(String(b.domOnly + b.none).padStart(6), "non couverts /", String(b.n).padStart(5), " couverts", String(b.owned).padStart(5), " ", k, Object.keys(b.owners).slice(0, 3).join(" | ")));
