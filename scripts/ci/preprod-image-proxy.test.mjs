import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { load as parse } from 'js-yaml';
import { buildCaddy, buildImageEnv } from './build-preprod-image-proxy.mjs';
const read = path => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
const source = read('config/caddy/Caddyfile');

test('projects every canonical image route verbatim and fails closed on marker drift', () => {
  const actual = buildCaddy(source);
  const routes = source.slice(source.indexOf('    # ===== IMGPROXY -'), source.indexOf('    # ===== SITEMAPS V10'));
  assert.ok(actual.includes(routes));
  assert.ok(actual.indexOf('respond @image_write') < actual.indexOf('@imgproxy path'));
  assert.ok(actual.indexOf('@upload_legacy') < actual.indexOf('reverse_proxy monorepo_preprod:3000'));
  assert.doesNotMatch(actual, /monorepo_prod|origin\.pem|trusted_proxies|tls /);
  assert.match(actual, /header_up CF-Connecting-IP \{remote_host\}/);
  assert.match(actual, /header_up Host monorepo_preprod:3000/);
  assert.throws(() => buildCaddy(source.replace('    # ===== SITEMAPS V10', 'changed marker')));
  assert.throws(() => buildCaddy(source.replace('@img_proxy path_regexp', '@removed path_regexp')));
});

test('projects existing imgproxy settings, including allowlist and non-success fallback', () => {
  const original = read('docker-compose.imgproxy.yml');
  const projected = Object.fromEntries(buildImageEnv(original).trim().split('\n').map(line => {
    const pos = line.indexOf('='); return [line.slice(0, pos), line.slice(pos + 1)];
  }));
  assert.deepEqual(projected, parse(original).services.imgproxy.environment);
  assert.throws(() => buildImageEnv(original.replace('IMGPROXY_FALLBACK_IMAGE_HTTP_CODE: "404"', 'IMGPROXY_FALLBACK_IMAGE_HTTP_CODE: "200"')));
});

test('only isolated PREPROD proxy publishes the loopback ingress', () => {
  const compose = parse(read('docker-compose.preprod.yml'));
  assert.equal(compose.services.monorepo_preprod.ports, undefined);
  assert.equal(compose.services.imgproxy_preprod.ports, undefined);
  assert.deepEqual(compose.services.caddy_preprod.ports, ['127.0.0.1:3200:3000']);
  assert.equal(compose.services.imgproxy_preprod.image, parse(read('docker-compose.imgproxy.yml')).services.imgproxy.image);
  assert.deepEqual(compose.services.imgproxy_preprod.networks, { 'automecanik-preprod': { aliases: ['imgproxy'] } });
  assert.doesNotMatch(read('docker-compose.preprod.yml'), /automecanik-prod|production\//);
});


test('PREPROD application cannot bypass the read-only database gateway', () => {
  const compose = parse(read('docker-compose.preprod.yml'));
  const app = compose.services.monorepo_preprod;
  assert.deepEqual(app.networks, ['preprod-readonly']);
  assert.equal(compose.networks['preprod-readonly'].internal, true);
  assert.ok(app.environment.includes('DATABASE_URL='));
  assert.ok(app.environment.includes('SUPABASE_SERVICE_ROLE_KEY='));
  assert.ok(app.environment.includes('SUPABASE_URL=http://readonly_preprod:3000'));
  assert.ok(app.environment.includes('SUPABASE_ANON_KEY=preprod-isolated-gateway-only'));
  assert.ok(app.environment.includes('READ_ONLY=true'));
  assert.deepEqual(compose.services.redis_preprod.networks, ['preprod-readonly']);
  const gateway = compose.services.readonly_preprod;
  assert.equal(gateway.ports, undefined);
  assert.equal(gateway.env_file, undefined);
  assert.equal(gateway.read_only, true);
  assert.deepEqual(gateway.networks, ['preprod-readonly', 'automecanik-preprod']);
  assert.ok(gateway.volumes.includes('./readonly-upstream.json:/run/preprod-readonly/upstream.json:ro'));
  for (const [name, service] of Object.entries(compose.services)) {
    if (name !== 'readonly_preprod') assert.doesNotMatch(JSON.stringify(service.volumes || []), /readonly-upstream/);
  }
});
