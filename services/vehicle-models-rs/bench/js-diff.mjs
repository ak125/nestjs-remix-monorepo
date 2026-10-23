// Comparaison différentielle des portages JavaScript de la route R2 avec Node.
// Usage : node bench/js-diff.mjs <sonde js_probe> <fonction> [nombre] [graine]
// Génère un corpus pseudo-aléatoire reproductible, calcule le résultat Node,
// l'envoie à la sonde Rust et affiche les écarts (20 au plus) et un résumé JSON.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { createInterface } from 'node:readline';

// Modules réellement chargés par le backend A2 (qs d'Express, schémas zod compilés).
const repo = new URL('../../../', import.meta.url);
const require = createRequire(new URL('backend/package.json', repo));
const qs = require('qs');
const { VehiclesQuerySchema } = require('./dist/modules/vehicles/dto/vehicles-query.schema.js');
const { PositiveIntParamSchema } = require('./dist/common/schemas/numeric-param.schema.js');

const [probePath, fn, countArg = '20000', seedArg = '1'] = process.argv.slice(2);
if (!probePath || !fn) {
  console.error('usage: node bench/js-diff.mjs <probe> <fn> [count] [seed]');
  process.exit(2);
}

let seed = Number(seedArg) >>> 0 || 1;
const rand = () => {
  seed ^= seed << 13; seed >>>= 0;
  seed ^= seed >>> 17;
  seed ^= seed << 5; seed >>>= 0;
  return seed / 0x100000000;
};
const pick = (a) => a[Math.floor(rand() * a.length)];

const JSON_ATOMS = ['{', '}', '[', ']', ':', ',', '"', '\\', ' ', '\n', '\r', '\t',
  '0', '1', '9', '-', '+', '.', 'e', 'E', 't', 'r', 'u', 'f', 'a', 'l', 's', 'n',
  'x', 'u00', 'ud83d', 'é', '😀', '\u0001', 'ÿ', 'Ā', '/', 'b',
  'true', 'false', 'null', '"a"', '"__proto__"', '"1"', '"01"', '"4294967295"',
  '"4294967294"', '12345678901', '-0', '1e400', '0.1', '1.', '1e', '1e+', '01'];

function genJson() {
  if (rand() < 0.35) {
    const valid = genValue(3);
    const s = JSON.stringify(valid);
    if (rand() < 0.5) return s;
    const at = Math.floor(rand() * (s.length + 1));
    const cut = rand() < 0.5;
    return s.slice(0, at) + (cut ? '' : pick(JSON_ATOMS)) + s.slice(at + (cut ? 1 : 0));
  }
  const n = 1 + Math.floor(rand() * 30);
  let s = '';
  for (let i = 0; i < n; i++) s += pick(JSON_ATOMS);
  return s;
}

function genValue(depth) {
  const r = rand();
  if (depth <= 0 || r < 0.3) {
    return pick([null, true, false, 0, -1, 1.5, 1e21, 123456789012, 'a', 'é😀', '"\\\n\u0001', '']);
  }
  if (r < 0.6) {
    return Array.from({ length: Math.floor(rand() * 4) }, () => genValue(depth - 1));
  }
  const o = {};
  for (let i = Math.floor(rand() * 4); i > 0; i--) {
    o[pick(['a', 'b', '1', '0', '10', '01', '__proto__', '4294967294', '4294967295', 'é'])] =
      genValue(depth - 1);
  }
  return o;
}


const URI_ATOMS = ['a', 'Z', '0', '+', ' ', 'é', '😀', '/', '%', '%2', '%20', '%2B', '%2f', '%41',
  '%zz', '%Z1', '%7F', '%80', '%BF', '%C0', '%C3', '%A9', '%C3%A9', '%c3%a9', '%C0%80', '%C1%BF',
  '%C2%80', '%DF%BF', '%E0%80%80', '%E0%A0%80', '%E2%82%AC', '%ED%9F%BF', '%ED%A0%80', '%EF%BF%BF',
  '%F0%80%80%80', '%F0%90%80%80', '%F0%9F%98%80', '%F4%8F%BF%BF', '%F4%90%80%80', '%F5%80%80%80',
  '%F8%80%80%80%80', '%FF', '%E2%82', '%E2%41%AC', '%25', '%00'];

function genUri() {
  let s = '';
  for (let i = 1 + Math.floor(rand() * 8); i > 0; i--) s += pick(URI_ATOMS);
  return s;
}

const QS_BASES = ['a', 'b', 'year', 'page', 'limit', 'search', '0', '1', '20', '__proto__',
  'constructor', 'toString', 'é', '%ZZ', 'a b', ''];
const QS_GROUPS = ['[]', '[0]', '[1]', '[2]', '[19]', '[20]', '[21]', '[25]', '[a]', '[b]',
  '[__proto__]', '[01]', '[-1]', '[ 1]', '[1e1]', '[100000000000000000000]', '[4294967295]',
  '[[]]', '[[a]b]', '[', ']', '[]]', '%5B%5D', '%5b0%5d', '[%5D'];
const QS_VALUES = ['', '1', 'x', '2008', 'a=b', '%20', '+', '%ZZ', 'é', '%C3%A9', '[]', '&'];

function genKey() {
  let k = pick(QS_BASES);
  for (let i = Math.floor(rand() * 4); i > 0; i--) k += pick(QS_GROUPS);
  if (rand() < 0.1) for (let i = 0; i < 7; i++) k += pick(QS_GROUPS);
  return k;
}

function genQs() {
  const parts = [];
  const keys = Array.from({ length: 1 + Math.floor(rand() * 3) }, genKey);
  const n = rand() < 0.15 ? 18 + Math.floor(rand() * 8) : 1 + Math.floor(rand() * 8);
  for (let i = 0; i < n; i++) {
    const r = rand();
    const key = rand() < 0.7 ? pick(keys) : genKey();
    if (r < 0.1) parts.push(key);
    else if (r < 0.15) parts.push('');
    else parts.push(key + '=' + pick(QS_VALUES));
  }
  return parts.join(rand() < 0.95 ? '&' : '&&');
}

const ZOD_KEYS = ['search', 'brandId', 'modelId', 'typeId', 'year', 'limit', 'page', 'includeAll'];
const ZOD_VALUES = ['', ' ', '%09', '%C2%A0', '%E2%80%A8', '%EF%BB%BF', '%C2%85', '%E1%A0%8E',
  '2008', '1900', '2100', '1899', '2101', '02008', '0999', '20080', '0', '00', '01', '1', '10',
  '2147483647', '2147483648', '99999999999999999999', '1.0', '1e3', '-1', '+1', '%201',
  'true', 'false', 'TRUE', 'x', 'a'.repeat(200), 'a'.repeat(201),
  encodeURIComponent('😀'.repeat(100)), encodeURIComponent('😀'.repeat(101)),
  encodeURIComponent('é'.repeat(200)), encodeURIComponent('é'.repeat(201))];

function genZod() {
  const parts = [];
  for (let i = Math.floor(rand() * 4); i > 0; i--) {
    let key = rand() < 0.93 ? pick(ZOD_KEYS) : pick(['foo', 'constructor', '__proto__', 'Year']);
    if (rand() < 0.06) key += pick(['[]', '[a]', '[0]']);
    parts.push(rand() < 0.05 ? key : key + '=' + pick(ZOD_VALUES));
  }
  return parts.join('&');
}

const PARAM_VALUES = ['0', '1', '9', '10', '01', '140', '2147483647', '2147483648', '-1', '+1',
  '1.5', '1e3', ' 1', '1 ', '', '0x10', '١', '99999999999999999999'];
const genParam = () => (rand() < 0.5 ? pick(PARAM_VALUES)
  : String(Math.floor(rand() * 10 ** (1 + Math.floor(rand() * 11)))));

const FIXED = {
  'json.parse': ['', ' ', '{bad', 'not json', '[object Object]', 'undefined', 'NaN',
    'Infinity', '{"a":1}', '{"a"1}', '[1,]', '{"a":1,}', '"\\', '"\\u12', '"abc',
    '1 2', '{"b":1,"1":2,"0":3}', '0123', '-', '-a', '"\u0001"', 'tru', 'nul ',
    '\r\n\r\n x', '\n\r x', 'aaaaaaaaaaaaaaaaaaaa', 'aaaaaaaaaaaaaaaaaaaaa',
    '{"x": 1, "y": 2, "z": 3, "w": oops}', '😀', '"😀" x', '"\\u{1}"'],
  'qs.parse': ['', 'year=2008', 'year[]=2008', 'year[a]=1', '%ZZ=1', '=1', 'constructor=1',
    '__proto__=1', 'a=1&a=2', 'a[1]=x&a[0]=y', 'b=1&0=2', 'a+b=c+d%20e',
    Array.from({ length: 25 }, (_, i) => `a=${i}`).join('&'),
    Array.from({ length: 25 }, (_, i) => `a[]=${i}`).join('&'),
    Array.from({ length: 1001 }, (_, i) => `k${i}=1`).join('&')],
};

const nodeResult = {
  'json.parse': (input) => {
    try {
      return 'ok:' + JSON.stringify(JSON.parse(input));
    } catch (e) {
      return 'err:' + e.message;
    }
  },
  'uri.decode': (input) => {
    try {
      return 'ok:' + decodeURIComponent(input);
    } catch {
      return 'err';
    }
  },
  'qs.parse': (input) => JSON.stringify(qs.parse(input, { allowPrototypes: true })),
  'query.zod': (input) => {
    const r = VehiclesQuerySchema.safeParse(qs.parse(input, { allowPrototypes: true }));
    if (!r.success) return 'err';
    const params = { ...r.data };
    params.brandId = String(140);
    return `ok:models_by_brand:140:${JSON.stringify(params)}`;
  },
  'param.positive': (input) => {
    const r = PositiveIntParamSchema.safeParse(input);
    return r.success ? `ok:${r.data}` : 'err';
  },
}[fn];
const generator = {
  'json.parse': genJson,
  'uri.decode': genUri,
  'qs.parse': genQs,
  'query.zod': genZod,
  'param.positive': genParam,
}[fn];
if (!nodeResult) {
  console.error(`fonction inconnue : ${fn}`);
  process.exit(2);
}

const inputs = [...(FIXED[fn] ?? [])];
const count = Number(countArg);
while (inputs.length < count) inputs.push(generator());
if (process.env.JS_DIFF_DUMP) {
  (await import('node:fs')).writeFileSync(process.env.JS_DIFF_DUMP, inputs.join('\n') + '\n');
}

const child = spawn(probePath, [], { stdio: ['pipe', 'pipe', 'inherit'] });
const lines = createInterface({ input: child.stdout });
const outputs = [];
lines.on('line', (l) => outputs.push(JSON.parse(l)));
for (const input of inputs) child.stdin.write(JSON.stringify({ fn, input }) + '\n');
child.stdin.end();
await new Promise((resolve) => child.on('close', resolve));

// Une demi-paire UTF-16 isolée ne tient pas dans une `String` Rust : divergence
// documentée (U+FFFD), comptée à part ; JSON.stringify l'écrit `\udXXX`.
const LONE_SURROGATE = /[\uD800-\uDFFF]|\\ud[89a-f][0-9a-f]{2}/iu;
let diffs = 0;
let loneSurrogate = 0;
inputs.forEach((input, i) => {
  const expected = nodeResult(input);
  if (outputs[i] !== expected) {
    if (LONE_SURROGATE.test(input) || LONE_SURROGATE.test(expected)) {
      loneSurrogate++;
      return;
    }
    diffs++;
    if (diffs <= 20) {
      console.log(JSON.stringify({ input, node: expected, rust: outputs[i] }));
    }
  }
});
console.log(JSON.stringify({ fn, cases: inputs.length, outputs: outputs.length, diffs, loneSurrogate, seed: seedArg }));
process.exit(diffs === 0 && outputs.length === inputs.length ? 0 : 1);
