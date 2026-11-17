// Mandat BB — répartition des entrées d'ownership.yaml par zone. Usage : node zones.cjs <racine> <préfixe>...
const path = require("node:path"), fs = require("node:fs");
const root = path.resolve(process.argv[2]);
const yaml = require(require.resolve("js-yaml", { paths: [root] }));
const own = yaml.load(fs.readFileSync(path.join(root, ".spec/00-canon/repository-registry/ownership.yaml"), "utf8")).entries;
for (const p of process.argv.slice(3)) {
  const c = {};
  for (const e of own.filter((e) => e.glob.startsWith(p))) { const k = `${e.domain}|${e.owner}|${e.risk}`; c[k] = (c[k] || 0) + 1; }
  console.log(p, JSON.stringify(c));
  const broad = own.filter((e) => e.glob.startsWith(p) && /\*\*/.test(e.glob)).map((e) => `${e.glob} (${e.domain}, ${e.owner}, ${e.risk})`);
  if (broad.length) console.log("   globs de dossier :", broad.slice(0, 8).join(" ; "));
}
