#!/usr/bin/env node
// PREPROD projects the canonical image routes; never copies PROD hosts/TLS/mounts.
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { load as parse } from 'js-yaml';

export function buildCaddy(source) {
  const start = '    # ===== IMGPROXY - TRANSFORMATION IMAGES GRATUITE =====';
  const end = '    # ===== SITEMAPS V10';
  if (source.split(start).length !== 2 || source.split(end).length !== 2) {
    throw new Error('Canonical image section missing or ambiguous');
  }
  const routes = source.slice(source.indexOf(start), source.indexOf(end));
  for (const marker of ['@imgproxy path', '@img_proxy path_regexp', '@gamme_images path_regexp', '@rack_legacy', '@upload_legacy']) {
    if (!routes.includes(marker)) throw new Error(`Missing image route: ${marker}`);
  }
  const retry = source.match(/^\(attente_remplacement\) \{\n[^}]+\n\}/m)?.[0];
  if (!retry) throw new Error('Canonical retry snippet missing');
  return `# Generated from config/caddy/Caddyfile; regenerate, do not edit.
{
    admin off
    auto_https off
}
${retry}
:3000 {
    route {
        # Public image reads only, including legacy redirects.
        @image_write {
            path /img/* /imgproxy/* /images/gammes/* /rack/* /upload/*
            not method GET HEAD
        }
        respond @image_write "Method Not Allowed" 405
${routes}
        handle {
            reverse_proxy monorepo_preprod:3000 {
                # SSR internal fetches must use the application's authority.
                header_up Host monorepo_preprod:3000
                header_up -X-Forwarded-Host
                # Direct, loopback-only ingress: discard supplied visitor IPs.
                header_up X-Forwarded-For {remote_host}
                header_up X-Real-IP {remote_host}
                header_up CF-Connecting-IP {remote_host}
            }
        }
    }
}
`;
}

export function buildImageEnv(source) {
  const env = parse(source).services.imgproxy.environment;
  if (!env.IMGPROXY_ALLOWED_SOURCES || env.IMGPROXY_FALLBACK_IMAGE_HTTP_CODE !== '404') {
    throw new Error('Canonical source allowlist and explicit fallback status required');
  }
  return Object.entries(env).map(([key, value]) => {
    if (!/^IMGPROXY_[A-Z_]+$/.test(key) || /[\r\n$]/.test(String(value))) throw new Error('Unsafe imgproxy env entry');
    return `${key}=${value}`;
  }).join('\n') + '\n';
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
  const output = resolve(process.argv[2] || '');
  if (!process.argv[2]) throw new Error('Usage: build-preprod-image-proxy.mjs OUTPUT_DIRECTORY');
  const source = readFileSync(resolve(root, 'config/caddy/Caddyfile'), 'utf8');
  const images = readFileSync(resolve(root, 'docker-compose.imgproxy.yml'), 'utf8');
  const preprod = parse(readFileSync(resolve(root, 'docker-compose.preprod.yml'), 'utf8'));
  if (preprod.services.imgproxy_preprod.image !== parse(images).services.imgproxy.image) throw new Error('PREPROD imgproxy version differs from canonical version');
  mkdirSync(output, { recursive: true });
  writeFileSync(resolve(output, 'Caddyfile.preprod'), buildCaddy(source));
  writeFileSync(resolve(output, 'imgproxy.preprod.env'), buildImageEnv(images));
}
