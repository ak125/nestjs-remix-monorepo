#!/usr/bin/env python3
"""
Recalcul V-Level - Version PROPRE depuis __seo_keywords_clean

Source: CSV Google Keyword Planner (pas de pollution)
Destination: __seo_type_vlevel (V-Level sur type_id)

Usage:
    python recalculate_vlevel.py <pg_id> [--dry-run]
"""
from __future__ import annotations
from typing import Dict, List, Set, Tuple
import pandas as pd
from datetime import datetime
import os
import sys
from dotenv import load_dotenv
from supabase import create_client

# Charger .env depuis backend
env_path = '/opt/automecanik/app/backend/.env'
if os.path.exists(env_path):
    load_dotenv(env_path)
else:
    load_dotenv()


def get_supabase_client():
    """Créer le client Supabase"""
    url = os.environ.get('SUPABASE_URL')
    key = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')
    if not url or not key:
        print("ERROR: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not found")
        sys.exit(1)
    return create_client(url, key)


def recalculate_vlevel_clean(pg_id: int, supabase, dry_run: bool = False) -> dict:
    """
    Recalcul V-Level depuis table propre __seo_keywords_clean

    1. Appel RPC match_keywords_batch_clean(pg_id)
    2. Grouper par (model, energy), trier par volume DESC
    3. Premier = V2, autres volume>0 = V3
    4. Catalogue non couvert = V4
    5. Écrire dans __seo_type_vlevel
    """
    print(f"\n[BATCH] Appel RPC match_keywords_batch_clean({pg_id})...")

    # 1. Matcher keywords → type_id
    try:
        resp = supabase.rpc("match_keywords_batch_clean", {"p_pg_id": pg_id}).execute()
        matches = resp.data or []
    except Exception as e:
        print(f"  ERROR: {e}")
        return {"pg_id": pg_id, "stats": {"error": str(e)}}

    print(f"  → {len(matches)} keywords matchés avec type_id")

    if not matches:
        print("  ⚠️ Aucun match trouvé")
        return {"pg_id": pg_id, "stats": {"count_total": 0, "count_v2": 0, "count_v3": 0, "count_v4": 0}}

    # 2. DataFrame pour traitement
    df = pd.DataFrame(matches)
    df["volume"] = pd.to_numeric(df.get("volume", 0), errors="coerce").fillna(0).astype(int)

    assignments: List[dict] = []
    matched_type_ids: Set[int] = set()
    v2_by_group: Dict[Tuple[str, str], int] = {}  # (model, energy) → type_id du V2

    # 3. Grouper par (model, energy)
    print(f"\n[VLEVEL] Attribution V2/V3...")

    for (model, energy), group in df.groupby(["model", "energy"], dropna=True):
        if pd.isna(model):
            continue

        # Trier par volume DESC
        group_sorted = group.sort_values("volume", ascending=False)

        for idx, row in group_sorted.iterrows():
            type_id = int(row["type_id"])
            volume = int(row["volume"])
            confidence = row.get("confidence")

            # Skip si déjà traité
            if type_id in matched_type_ids:
                continue

            matched_type_ids.add(type_id)

            # Déterminer V-Level
            group_key = (model, energy if pd.notna(energy) else "unknown")

            if group_key not in v2_by_group:
                # Premier du groupe → V2
                v_level = "V2"
                source = "champion"
                v2_by_group[group_key] = type_id
            elif volume > 0:
                # Variante avec volume → V3
                v_level = "V3"
                source = "variant"
            else:
                # Ne devrait pas arriver (on filtre volume > 0 dans la RPC)
                continue

            assignments.append({
                "pg_id": pg_id,
                "type_id": type_id,
                "v_level": v_level,
                "source": source,
                "model": model,
                "energy": energy if pd.notna(energy) else None,
                "confidence": float(confidence) if confidence else None,
                "updated_at": datetime.utcnow().isoformat(),
            })

    v2_count = sum(1 for a in assignments if a["v_level"] == "V2")
    v3_count = sum(1 for a in assignments if a["v_level"] == "V3")
    print(f"  → V2: {v2_count} champions")
    print(f"  → V3: {v3_count} variantes")

    # 4. V4: catalogue non couvert
    print(f"\n[CATALOG] Récupération type_ids catalogue...")
    catalog_type_ids = get_catalog_type_ids_for_gamme(pg_id, supabase)
    catalog_only = catalog_type_ids - matched_type_ids
    print(f"  → {len(catalog_only)} type_ids catalogue non matchés → V4")

    for type_id in catalog_only:
        assignments.append({
            "pg_id": pg_id,
            "type_id": int(type_id),
            "v_level": "V4",
            "source": "catalog",
            "model": None,
            "energy": None,
            "confidence": None,
            "updated_at": datetime.utcnow().isoformat(),
        })

    # 5. Upsert
    if not dry_run:
        print(f"\n[UPSERT] Écriture de {len(assignments)} assignments...")
        upsert_type_vlevels(assignments, supabase)
    else:
        print(f"\n[DRY RUN] {len(assignments)} assignments (non écrits)")

    # Stats
    stats = {
        "pg_id": pg_id,
        "count_total": len(assignments),
        "count_v2": v2_count,
        "count_v3": v3_count,
        "count_v4": len(catalog_only),
    }

    return {"pg_id": pg_id, "assignments": assignments, "stats": stats}


def get_catalog_type_ids_for_gamme(pg_id: int, supabase) -> Set[int]:
    """
    RPC: retourne tous les type_id du catalogue concernés par pg_id
    """
    try:
        resp = supabase.rpc("get_catalog_type_ids_for_gamme", {"p_pg_id": pg_id}).execute()
        return set(int(r["type_id"]) for r in (resp.data or []))
    except Exception as e:
        print(f"  [WARN] get_catalog_type_ids_for_gamme error: {e}")
        return set()


def upsert_type_vlevels(rows: List[dict], supabase) -> None:
    """
    Upsert dans __seo_type_vlevel.
    Deduplique avant upsert pour éviter erreur ON CONFLICT.
    """
    if not rows:
        return

    # Deduplicate: garder le V-Level le plus prioritaire (V2 > V3 > V4)
    priority = {"V1": 1, "V2": 2, "V3": 3, "V4": 4, "V5": 5}
    deduped: Dict[Tuple[int, int], dict] = {}

    for row in rows:
        key = (row["pg_id"], row["type_id"])
        if key not in deduped:
            deduped[key] = row
        else:
            existing_priority = priority.get(deduped[key]["v_level"], 99)
            new_priority = priority.get(row["v_level"], 99)
            if new_priority < existing_priority:
                deduped[key] = row

    unique_rows = list(deduped.values())
    print(f"    Deduplicated: {len(rows)} → {len(unique_rows)} unique rows")

    BATCH_SIZE = 500
    for i in range(0, len(unique_rows), BATCH_SIZE):
        batch = unique_rows[i:i+BATCH_SIZE]
        supabase.table("__seo_type_vlevel").upsert(batch, on_conflict="pg_id,type_id").execute()
        print(f"    Upserted batch {i+len(batch)}/{len(unique_rows)}")


def main(pg_id: int, dry_run: bool = False):
    import time
    start = time.time()

    supabase = get_supabase_client()

    print(f"{'='*60}")
    print(f"V-Level Recalculation for pg_id={pg_id}")
    print(f"Source: __seo_keywords_clean (CSV Google propre)")
    print(f"{'='*60}")

    result = recalculate_vlevel_clean(pg_id, supabase, dry_run=dry_run)
    stats = result.get('stats', {})

    elapsed = time.time() - start

    print(f"\n{'='*60}")
    print(f"RÉSULTAT pg_id={pg_id}")
    print(f"{'='*60}")
    print(f"  V2 (champions):  {stats.get('count_v2', 0)}")
    print(f"  V3 (variantes):  {stats.get('count_v3', 0)}")
    print(f"  V4 (catalogue):  {stats.get('count_v4', 0)}")
    print(f"  TOTAL:           {stats.get('count_total', 0)}")
    print(f"\n⏱️  Temps d'exécution: {elapsed:.2f}s")

    return result


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python recalculate_vlevel.py <pg_id> [--dry-run]")
        sys.exit(1)

    pg_id = int(sys.argv[1])
    dry_run = '--dry-run' in sys.argv

    main(pg_id, dry_run=dry_run)
