#!/usr/bin/env python3
"""Exercise the actual imgproxy Caddy route in a network-isolated container.

Run on DEV with the existing caddy:2.11-alpine image (never pulls an image).
No host ports, external upstream, secrets, or shared services are used.
"""
import json
import pathlib
import re
import subprocess
import tempfile
import time
import uuid


def main():
    root = pathlib.Path(__file__).resolve().parents[2]
    source = (root / "config/caddy/Caddyfile").read_text()
    start = source.index("    @imgproxy path /imgproxy/*")
    end = source.index("    # ===== BLOQUER TRANSFORMATIONS", start)
    route = source[start:end].replace("reverse_proxy imgproxy:8080", "reverse_proxy 127.0.0.1:8081")
    assert "reverse_proxy 127.0.0.1:8081" in route
    # The response-policy implementation is extracted, never duplicated here.
    mock = "\n".join(
        f'    @s{status} header X-Test-Status {status}\n    respond @s{status} "fixture" {status}'
        for status in (200, 404, 500, 503, 504)
    )
    config = "{\n admin off\n auto_https off\n}\n:8080 {\n" + route + "}\n:8081 {\n header Cache-Control immutable\n" + mock + "\n}\n"
    image = subprocess.check_output(["docker", "image", "inspect", "caddy:2.11-alpine", "--format", "{{.Id}}"], text=True).strip()
    name = "amk-image-cache-" + uuid.uuid4().hex[:10]
    results = []
    with tempfile.TemporaryDirectory(prefix="amk-imgproxy-test-") as directory:
        pathlib.Path(directory).chmod(0o755)
        path = pathlib.Path(directory, "Caddyfile")
        path.write_text(config)
        path.chmod(0o644)
        try:
            subprocess.run([
                "docker", "run", "--detach", "--pull=never", "--name", name,
                "--network=none", "--memory=128m", "--cpus=0.5", "--pids-limit=64",
                # The stock binary carries cap_net_bind_service; retain only
                # that capability so Linux permits executing it as non-root.
                "--read-only", "--cap-drop=ALL", "--cap-add=NET_BIND_SERVICE", "--user=65534:65534",
                "--tmpfs=/data:rw,size=8m", "--tmpfs=/config:rw,size=8m",
                "--mount", f"type=bind,src={path},dst=/etc/caddy/Caddyfile,readonly",
                image, "caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile",
            ], check=True, capture_output=True, text=True)
            for _ in range(30):
                ready = subprocess.run(["docker", "exec", name, "wget", "-q", "-O", "-", "--header=X-Test-Status: 200", "http://127.0.0.1:8081/"], capture_output=True)
                if ready.returncode == 0:
                    break
                time.sleep(0.1)
            else:
                logs = subprocess.run(["docker", "logs", name], capture_output=True, text=True)
                raise RuntimeError("Isolated Caddy fixture did not start: " + logs.stderr[-4000:] + ready.stderr.decode()[-500:])
            for status in (200, 404, 500, 503, 504):
                request = f"GET /imgproxy/rs:fit:400/plain/fixture@webp HTTP/1.1\r\nHost: localhost\r\nX-Test-Status: {status}\r\nConnection: close\r\n\r\n"
                probe = subprocess.run(["docker", "exec", "-i", name, "busybox", "nc", "-w", "3", "127.0.0.1", "8080"], input=request, capture_output=True, text=True, check=True)
                actual = re.findall(r"HTTP/1\.1 (\d+)", probe.stdout)
                cache = re.findall(r"(?im)^Cache-Control:\s*(.+)$", probe.stdout)
                expected = "no-store" if status >= 500 else ("public, max-age=300, must-revalidate" if status == 404 else "public, max-age=31536000, immutable")
                results.append({"status": status, "actual_status": actual, "cache_control": cache, "expected": expected, "passed": actual == [str(status)] and cache == [expected]})
        finally:
            subprocess.run(["docker", "rm", "--force", name], capture_output=True)
    print(json.dumps({"image_id": image, "results": results}, indent=2))
    return 0 if all(r["passed"] for r in results) else 1


if __name__ == "__main__":
    raise SystemExit(main())
