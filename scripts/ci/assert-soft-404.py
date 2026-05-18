#!/usr/bin/env python3
"""
Assertions soft-404 R2 page.

Usage:
  curl -s -i "http://localhost:3000/pieces/.../...html" | python3 scripts/ci/assert-soft-404.py

Critères :
  - HTTP 200
  - <meta name="robots" content="noindex, follow">
  - JSON-LD avec @type ItemList
  - Au moins 1 lien profond /pieces/<a>/<b>/<c>.html (alternatives véhicules)
"""
import json
import re
import sys


def main() -> int:
    raw = sys.stdin.buffer.read().decode("utf-8", errors="replace")

    if "\r\n\r\n" in raw:
        header, body = raw.split("\r\n\r\n", 1)
    elif "\n\n" in raw:
        header, body = raw.split("\n\n", 1)
    else:
        header, body = "", raw

    errors: list[str] = []

    status_match = re.search(r"HTTP/[\d.]+\s+(\d+)", header) if header else None
    status = int(status_match.group(1)) if status_match else 200
    if status != 200:
        errors.append(f"HTTP status {status} != 200")

    robots = re.search(
        r'<meta[^>]+name=["\']robots["\'][^>]+content=["\']([^"\']+)["\']',
        body, re.I,
    )
    if not robots:
        errors.append("meta robots manquant")
    else:
        content = robots.group(1).lower()
        if "noindex" not in content or "follow" not in content:
            errors.append(f"meta robots != noindex,follow (got {robots.group(1)!r})")

    ld_match = re.search(
        r'<script[^>]+type=["\']application/ld\+json["\'][^>]*>(.*?)</script>',
        body, re.S | re.I,
    )
    if not ld_match:
        errors.append("JSON-LD absent")
    else:
        ld_payload = ld_match.group(1).strip()
        try:
            ld = json.loads(ld_payload)
            if isinstance(ld, list):
                has_itemlist = any(
                    isinstance(item, dict) and item.get("@type") == "ItemList"
                    for item in ld
                )
            elif isinstance(ld, dict):
                has_itemlist = ld.get("@type") == "ItemList"
            else:
                has_itemlist = False
            if not has_itemlist:
                preview = json.dumps(ld)[:120]
                errors.append(f"JSON-LD présent mais @type != ItemList (preview: {preview})")
        except json.JSONDecodeError as exc:
            errors.append(f"JSON-LD invalide: {exc}")

    deep_links = re.findall(
        r'href=["\'](/pieces/[^"\']*?/[^"\']*?/[^"\']*?\.html)["\']',
        body,
    )
    if not deep_links:
        errors.append("Aucun lien profond /pieces/.../.../...html (alternatives véhicules absentes)")

    if errors:
        print("FAIL")
        for err in errors:
            print(f"  - {err}")
        return 1
    print("PASS")
    return 0


if __name__ == "__main__":
    sys.exit(main())
