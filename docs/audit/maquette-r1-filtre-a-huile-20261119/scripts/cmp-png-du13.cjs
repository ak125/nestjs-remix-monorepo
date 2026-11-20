// cmp-png-du13.cjs — compare deux captures PNG pixel par pixel. Usage : PW=<node_modules>/playwright node cmp-png-du13.cjs a.png b.png
const fs = require("node:fs");
const { PNG } = require(require.resolve("pngjs", { paths: [process.env.PW] }));
const [a, b] = process.argv.slice(2).map((f) => PNG.sync.read(fs.readFileSync(f)));
const r = { a: [a.width, a.height], b: [b.width, b.height], memeTaille: a.width === b.width && a.height === b.height };
if (r.memeTaille) { let d = 0; for (let i = 0; i < a.data.length; i += 4) if (a.data[i] !== b.data[i] || a.data[i + 1] !== b.data[i + 1] || a.data[i + 2] !== b.data[i + 2]) d++; r.pixelsDifferents = d; r.total = a.width * a.height; }
console.log(JSON.stringify(r));
