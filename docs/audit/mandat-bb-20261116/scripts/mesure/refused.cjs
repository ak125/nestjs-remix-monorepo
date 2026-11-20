// Mandat BB — fichiers ajoutés par une PR que la porte des fichiers nouveaux refuse
// (même résolution que scripts/registry/check-new-files.js, arbre courant).
// Usage : node refused.cjs <racine du dépôt> <fichier TSV « branche<TAB>chemin ajouté »>
const path = require("node:path"), fs = require("node:fs");
const root = path.resolve(process.argv[2]);
const req = (m) => require(require.resolve(m, { paths: [root] }));
const yaml = req("js-yaml");
const g = require(path.join(root, "scripts/registry/check-new-files.js"));
const own = yaml.load(fs.readFileSync(path.join(root, ".spec/00-canon/repository-registry/ownership.yaml"), "utf8")).entries;
const by = {};
for (const l of fs.readFileSync(process.argv[3], "utf8").split("\n").filter(Boolean)) {
  const [b, f] = l.split("\t");
  (by[b] ||= []).push(f);
}
for (const [b, files] of Object.entries(by)) {
  const exc = files.filter((f) => g.isExceptionPath(f));
  const refused = files.filter((f) => !exc.includes(f) && !g.findOwnershipMatch(f, own));
  console.log(`${b}\tajoutés=${files.length}\trefusés=${refused.length}`);
  for (const f of refused) console.log(`\t${f}`);
}
