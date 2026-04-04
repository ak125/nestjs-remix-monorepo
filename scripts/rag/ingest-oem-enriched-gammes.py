#!/usr/bin/env python3
"""
ingest-oem-enriched-gammes.py — Pousse les données OEM phase5_enrichment vers __rag_knowledge.

Pour chaque gamme avec _validation_status: oem_verified, extrait le bloc technique
(types, normes, matériaux, valeurs) et l'ingeste via POST /api/rag/internal/ingest/manual
avec authentification machine-to-machine (X-Internal-Key).

Usage:
  python3 scripts/rag/ingest-oem-enriched-gammes.py [--dry-run] [--gamme disque-de-frein]
"""

import os
import re
import sys
import json
import time
import argparse
import urllib.request
import urllib.error

GAMMES_DIR   = "/opt/automecanik/rag/knowledge/gammes"
API_BASE     = "http://localhost:3000"
INGEST_URL   = f"{API_BASE}/api/rag/internal/ingest/manual"
INTERNAL_KEY = os.environ.get('INTERNAL_API_KEY', '')

RETRYABLE = {429, 500, 502, 503, "timeout"}


def parse_frontmatter(filepath: str) -> dict:
    with open(filepath) as f:
        raw = f.read()
    parts = raw.split("---", 2)
    if len(parts) < 3:
        return {}
    fm = {}
    for line in parts[1].split("\n"):
        if ":" in line:
            k, v = line.split(":", 1)
            key = k.strip()
            if key not in fm:  # première occurrence uniquement
                fm[key] = v.strip().strip("'\"")
    return fm


def extract_phase5_block(filepath: str) -> dict | None:
    """Extrait le bloc phase5_enrichment du frontmatter."""
    with open(filepath) as f:
        raw = f.read()
    if "phase5_enrichment:" not in raw:
        return None
    # Extraire le bloc YAML phase5
    start = raw.index("phase5_enrichment:")
    rest  = raw[start:]
    lines = rest.split("\n")
    block_lines = [lines[0]]
    for line in lines[1:]:
        if line and not line.startswith(" ") and not line.startswith("#") and line != "---":
            break
        block_lines.append(line)

    block_text = "\n".join(block_lines)

    # Parser les champs clés
    result = {
        "source":       re.search(r"_source:\s*(.+)", block_text),
        "status":       re.search(r"_validation_status:\s*(.+)", block_text),
        "file_count":   re.search(r"_web_files_count:\s*(\d+)", block_text),
        "types":        re.findall(r"- type:\s*'([^']+)'", block_text),
        "norms":        re.findall(r"norme_[^:]+:\s*'([^']+)'", block_text),
        "materials":    re.findall(r"materiau:\s*'([^']+)'", block_text),
        "values":       re.findall(r"val_[^:]+:\s*'([^']+)'", block_text),
    }

    return {
        "source":     result["source"].group(1).strip() if result["source"] else "",
        "status":     result["status"].group(1).strip() if result["status"] else "",
        "file_count": int(result["file_count"].group(1)) if result["file_count"] else 0,
        "types":      result["types"],
        "norms":      result["norms"],
        "materials":  result["materials"],
        "values":     result["values"],
    }


def build_content(slug: str, title: str, p5: dict) -> str:
    """Construit le texte de connaissance technique à ingérer dans le RAG."""
    lines = [
        f"# Données techniques OEM — {title}",
        f"Source : {p5['source']} ({p5['file_count']} fichiers OEM analysés)",
        f"Validation : {p5['status']}",
        "",
    ]

    if p5["types"]:
        lines.append("## Variantes et types")
        for t in p5["types"]:
            lines.append(f"- {t}")
        lines.append("")

    if p5["norms"]:
        lines.append("## Normes applicables")
        for n in p5["norms"]:
            lines.append(f"- {n}")
        lines.append("")

    if p5["materials"]:
        lines.append("## Matériaux")
        for m in p5["materials"]:
            lines.append(f"- {m}")
        lines.append("")

    if p5["values"]:
        # Filtrer les valeurs pertinentes (mm, Nm, °C, bars) uniquement
        clean_vals = [v for v in p5["values"] if any(u in v for u in ["mm", "Nm", "°C", "bars", "bar", "%", "kg"])]
        if clean_vals:
            lines.append("## Valeurs techniques de référence")
            for v in clean_vals[:15]:
                lines.append(f"- {v}")
            lines.append("")

    return "\n".join(lines)


def call_api(payload: dict) -> dict:
    data = json.dumps(payload).encode()
    req = urllib.request.Request(
        INGEST_URL, data=data,
        headers={'Content-Type': 'application/json', 'X-Internal-Key': INTERNAL_KEY},
        method='POST'
    )
    try:
        res = urllib.request.urlopen(req, timeout=30)
        body = json.loads(res.read())
        return body if body else {"ok": True}
    except urllib.error.HTTPError as e:
        return {"error": e.code, "detail": e.read().decode()[:300]}
    except Exception as e:
        return {"error": "timeout", "detail": str(e)}


def ingest_with_retry(payload: dict) -> dict:
    for attempt in range(3):
        result = call_api(payload)
        if result.get("error") not in RETRYABLE:
            return result
        time.sleep(5 * (attempt + 1))
    return result


def main():
    parser = argparse.ArgumentParser(description="Ingeste gammes OEM enrichies vers RAG")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--gamme", type=str)
    args = parser.parse_args()

    gammes = sorted(
        f[:-3] for f in os.listdir(GAMMES_DIR)
        if f.endswith(".md") and
        open(os.path.join(GAMMES_DIR, f)).read().find("_validation_status: oem_verified") != -1
    )

    if args.gamme:
        gammes = [g for g in gammes if g == args.gamme]

    print(f"{len(gammes)} gammes oem_verified à ingérer")

    if not args.dry_run and not INTERNAL_KEY:
        print("ERREUR : INTERNAL_API_KEY non défini dans l'environnement")
        sys.exit(1)

    ok = already = skip = err = 0

    for slug in gammes:
        fp = os.path.join(GAMMES_DIR, f"{slug}.md")
        fm = parse_frontmatter(fp)
        p5 = extract_phase5_block(fp)

        if not p5 or p5["status"] != "oem_verified":
            skip += 1
            continue

        # Minimum 2 éléments de données pour justifier l'ingest
        data_count = len(p5["types"]) + len(p5["norms"]) + len(p5["materials"])
        if data_count < 2:
            print(f"  [SKIP] {slug} — trop peu de données ({data_count} éléments)")
            skip += 1
            continue

        title = fm.get("title", slug.replace("-", " ").title())
        content = build_content(slug, title, p5)

        payload = {
            "title":         f"Données techniques OEM — {title}",
            "content":       content,
            "gamme_aliases": [slug],
            "truth_level":   "L2",
            "category":      "knowledge/reference",
            "domain":        fm.get("category", "pieces-auto"),
        }

        if args.dry_run:
            print(f"  [DRY] {slug} — {data_count} éléments | {len(content)} chars")
            print(f"        types={p5['types'][:3]} normes={p5['norms'][:2]} mat={p5['materials'][:2]}")
            ok += 1
            continue

        res = ingest_with_retry(payload)
        if res.get("skipped"):
            already += 1
        elif res.get("error"):
            print(f"  [ERR] {slug} — {res['error']}: {res.get('detail','')[:100]}")
            err += 1
        elif res.get("id") or res.get("ok"):
            doc_id = res.get("id", "ok")
            print(f"  [OK]  {slug} — id={doc_id}")
            ok += 1
            time.sleep(0.5)  # Rate limiting
        else:
            print(f"  [WARN] {slug} — unexpected response: {res}")
            ok += 1

    print(f"\nRésultat : {ok} ingérés | {already} déjà présents | {skip} ignorés | {err} erreurs")


if __name__ == "__main__":
    main()
