#!/usr/bin/env python3
"""Exercise generated PREPROD routes with local fixtures and no network access."""
import json
import pathlib
import re
import subprocess
import tempfile
import time
import uuid


def main():
    root = pathlib.Path(__file__).resolve().parents[2]
    name = 'amk-preprod-images-' + uuid.uuid4().hex[:10]
    image = subprocess.check_output(['docker', 'image', 'inspect', 'caddy:2.11-alpine', '--format', '{{.Id}}'], text=True).strip()
    results = []
    with tempfile.TemporaryDirectory(prefix=name) as directory:
        path = pathlib.Path(directory)
        path.chmod(0o755)
        subprocess.run(['node', str(root / 'scripts/ci/build-preprod-image-proxy.mjs'), directory], check=True)
        config = (path / 'Caddyfile.preprod').read_text()
        config = config.replace('reverse_proxy imgproxy:8080', 'reverse_proxy 127.0.0.1:8081').replace('reverse_proxy monorepo_preprod:3000', 'reverse_proxy 127.0.0.1:8082').replace('reverse_proxy https://cxpojprgwgubzjyqzmoq.supabase.co', 'reverse_proxy 127.0.0.1:8083')
        config += '\n:8081 {\n header Cache-Control immutable\n' + '\n'.join(f' @s{s} header X-Test-Status {s}\n respond @s{s} "image fixture" {s}' for s in (200, 404, 500, 503, 504)) + '\n}\n'
        config += ':8082 {\n respond "APP {host} {header.CF-Connecting-IP} {header.X-Real-IP}"\n}\n:8083 {\n respond "STORAGE {uri}"\n}\n'
        (path / 'Caddyfile.preprod').write_text(config)
        (path / 'Caddyfile.preprod').chmod(0o644)
        try:
            subprocess.run(['docker', 'run', '-d', '--pull=never', '--name', name, '--network=none', '--memory=128m', '--cpus=0.5', '--pids-limit=64', '--read-only', '--cap-drop=ALL', '--cap-add=NET_BIND_SERVICE', '--user=65534:65534', '--tmpfs=/data:rw,size=8m', '--tmpfs=/config:rw,size=8m', '--mount', f'type=bind,src={path / "Caddyfile.preprod"},dst=/etc/caddy/Caddyfile,readonly', image], check=True, capture_output=True)
            for _ in range(50):
                if subprocess.run(['docker', 'exec', name, 'wget', '-qO-', 'http://127.0.0.1:8082'], capture_output=True).returncode == 0:
                    break
                time.sleep(0.1)
            else:
                raise RuntimeError(subprocess.run(['docker', 'logs', name], capture_output=True, text=True).stderr)

            def request(url, status, body=None, headers='', method='GET', cache=None):
                raw = f'{method} {url} HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n{headers}\r\n'
                response = subprocess.run(['docker', 'exec', '-i', name, 'busybox', 'nc', '-w', '3', '127.0.0.1', '3000'], input=raw, capture_output=True, text=True, check=True).stdout
                assert response.startswith(f'HTTP/1.1 {status}'), response
                if body: assert body in response, response + '\nCONFIG:\n' + config
                if cache: assert re.findall(r'(?im)^Cache-Control:\s*(.+)$', response) == [cache], response
                results.append({'method': method, 'path': url, 'status': status, 'passed': True})

            request('/img/uploads/articles/familles-produits/Freinage.webp', 200, 'STORAGE /storage/v1/object/public/uploads/articles/familles-produits/Freinage.webp')
            request('/img/uploads/example.webp?width=400', 410)
            request('/img/uploads/example.webp?quality=80', 410)
            for route in ['/img/uploads/x', '/imgproxy/x', '/images/gammes/x.webp', '/rack/x', '/upload/x']:
                for method in ['POST', 'PUT', 'PATCH', 'DELETE']:
                    request(route, 405, method=method)
            request('/rack/260/example.jpg', 301, '/imgproxy/rs:fit:800/q:85/plain/https://cxpojprgwgubzjyqzmoq.supabase.co/storage/v1/object/public/rack-images/260/example.jpg')
            for status in (200, 404, 500, 503, 504):
                cache = 'no-store' if status >= 500 else ('public, max-age=300, must-revalidate' if status == 404 else 'public, max-age=31536000, immutable')
                request('/imgproxy/rs:fit:400/plain/fixture@webp', status, headers=f'X-Test-Status: {status}\r\n', cache=cache)
            request('/pieces/example.html.data', 200, 'APP monorepo_preprod 127.0.0.1 127.0.0.1', headers='CF-Connecting-IP: 1.2.3.4\r\nX-Real-IP: 1.2.3.4\r\nX-Forwarded-For: 1.2.3.4\r\n')
        finally:
            subprocess.run(['docker', 'rm', '-f', name], capture_output=True)
    print(json.dumps({'image': image, 'network': 'none', 'results': results}, indent=2))


if __name__ == '__main__':
    main()
