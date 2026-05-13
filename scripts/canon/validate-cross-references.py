#!/usr/bin/env python3
"""
Vérifie la cohérence bidirectionnelle entre pipelines.registry.json et
projections.registry.json :

  - Pour chaque pipeline.kind == "runtime_projection" avec feeds_projection,
    la projection référencée doit exister dans projections.registry.json
  - Pour chaque projection.fed_by_pipeline, le pipeline référencé doit exister
    avec kind == "runtime_projection"

Exit 0 si cohérent, 1 sinon. Réf ADR-058.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

REGISTRY_DIR = Path(__file__).resolve().parents[2] / ".spec" / "00-canon" / "repository-registry"
PIPELINES = REGISTRY_DIR / "pipelines.registry.json"
PROJECTIONS = REGISTRY_DIR / "projections.registry.json"


def main() -> int:
    if not PIPELINES.exists():
        print(f"FAIL: {PIPELINES} introuvable", file=sys.stderr)
        return 1
    if not PROJECTIONS.exists():
        print(f"FAIL: {PROJECTIONS} introuvable", file=sys.stderr)
        return 1

    pipelines = json.loads(PIPELINES.read_text())["pipelines"]
    projections = json.loads(PROJECTIONS.read_text())["projections"]

    pipeline_ids = {p["id"] for p in pipelines}
    projection_ids = {p["projection_id"] for p in projections}

    errors: list[str] = []

    for pipeline in pipelines:
        feeds = pipeline.get("feeds_projection")
        if feeds:
            if pipeline.get("kind") != "runtime_projection":
                errors.append(
                    f"pipeline {pipeline['id']!r} has feeds_projection but kind="
                    f"{pipeline.get('kind')!r} (expected runtime_projection)"
                )
            if feeds not in projection_ids:
                errors.append(
                    f"pipeline {pipeline['id']!r} feeds_projection={feeds!r} "
                    f"but no matching projection_id in projections.registry.json"
                )

    for projection in projections:
        fed_by = projection["fed_by_pipeline"]
        if fed_by not in pipeline_ids:
            errors.append(
                f"projection {projection['projection_id']!r} fed_by_pipeline={fed_by!r} "
                f"but no matching pipeline.id in pipelines.registry.json"
            )
        matching = next((p for p in pipelines if p["id"] == fed_by), None)
        if matching and matching.get("kind") != "runtime_projection":
            errors.append(
                f"projection {projection['projection_id']!r} fed by "
                f"pipeline {fed_by!r} with kind={matching.get('kind')!r} "
                f"(expected runtime_projection)"
            )
        if matching and matching.get("feeds_projection") != projection["projection_id"]:
            errors.append(
                f"projection {projection['projection_id']!r} fed by {fed_by!r} but "
                f"pipeline.feeds_projection={matching.get('feeds_projection')!r} "
                f"(asymmetric cross-reference)"
            )

    if errors:
        print("FAIL: cross-references inconsistent:", file=sys.stderr)
        for err in errors:
            print(f"  - {err}", file=sys.stderr)
        return 1

    print(
        f"OK: {len(pipelines)} pipelines + {len(projections)} projections, "
        f"cross-references bidirectionnels coherents."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
