#!/usr/bin/env python3
"""
diagnostic-from-db-generator.py — Génère les fiches RAW diagnostic à la maille SYSTÈME
depuis les tables __diag_* (couche FAITS, DB-first — plan « RAW Encyclopédie » PR-D.0/PR-D.1).

⚠️ ADR-033 : maille = SYSTÈME (13 fiches max, table __diag_system) couvrant les
symptômes EN INTERNE (symptoms[]/probable_causes[] dans la fiche système).
JAMAIS de fichier par symptôme.

Sens unique DB → RAW (ADR-031) : ce script ne fait QUE des SELECT (REST GET).
Aucune écriture DB. Aucun consommateur runtime ne lit RAW.

Frontmatter aligné schéma wiki diagnostic v1.0.0 (system / symptoms / probable_causes /
severity / audience) — enrichi en RAW par les champs DB structurés (slug, signal_mode,
urgency, verification_method, provenance champ par champ).

Dérivations déterministes (documentées, zéro LLM) :
  - likelihood (probable_causes) : projection de __diag_cause.urgency
    (haute→high, moyenne→medium, basse→low) ; workshop_priority conservé tel quel
    comme signal complémentaire.
  - severity (fiche) : max des urgency des symptômes du système
    (≥1 'haute'→high, sinon ≥1 'moyenne'→medium, sinon low).
  - related_gammes par cause : ops d'entretien du même système dont le slug partage
    le préfixe 2-tokens du slug de cause (ex. brake_pads_worn ↔ brake_pads_replacement)
    → __diag_maintenance_operation.related_gamme_slug. Pas de match → [] + validation_note.

AXE MOTORISATION (raffinement owner 2026-06-13) — dimension carburant CIBLÉE :
  La motorisation est un axe transverse, MAIS seulement là où elle est réelle.
  - `fuel_aware: true`  → SYSTÈMES MOTEUR (symptômes/causes fuel-dépendants) :
    injection (= « Injection et alimentation » en DB, couvre l'alimentation),
    distribution, refroidissement. La fiche structure ses sections éditoriales
    (TODO PR-C.2) PAR CARBURANT (diesel/essence/électrique/hybride/gpl).
  - `fuel_aware: false` → SYSTÈMES CHÂSSIS / SÉCURITÉ (fuel-agnostiques) :
    freinage, direction, suspension, eclairage, transmission, embrayage,
    echappement, filtration, climatisation, demarrage_charge. Un frein reste un
    frein → pas de dimension carburant (ce dry-run = freinage = fuel-agnostic).
  Source de la liste fuel-aware = slug `__diag_system` (ENGINE_SYSTEM_SLUGS).
  Provenance des entrées éditoriales scrapées (PR-C.2, hors dry-run) : chaque
  cause/conseil portera applies_to.{make,model_generation,fuel,engine_family,market}
  + source.{type,source_market: FR|EU|DE|UK|US|unknown,lang_original,confidence,
  evidence_id} ; clé moteur normalisée `engine_family:<code minuscule>` ; FR-only,
  reformulé non-verbatim ; valeurs prescriptives (couples…) = fail-closed.

Deux modes (jamais d'écrasement de l'éditorial humain) :
  - défaut (--create-missing implicite) : crée uniquement les fiches absentes.
  - --merge-managed-blocks : réécrit UNIQUEMENT les blocs frontmatter délimités
    `db_profile` / `symptoms` / `probable_causes` / `maintenance_db` / `validation_notes`.
    Toute autre clé + body restent intouchés byte-à-byte.

Configurable via env :
  AUTOMECANIK_RAW_PATH       (default /opt/automecanik/automecanik-raw)
  SUPABASE_URL               (default projet canonique)
  SUPABASE_SERVICE_ROLE_KEY  (requis — sinon chargé depuis backend/.env)
  BACKEND_ENV_FILE           (optionnel — chemin .env alternatif)

Usage :
  python3 scripts/wiki-generators/diagnostic-from-db-generator.py --system freinage --dry-run --out-dir /tmp/prd0-dryrun
  python3 scripts/wiki-generators/diagnostic-from-db-generator.py --all --create-missing
  python3 scripts/wiki-generators/diagnostic-from-db-generator.py --all --merge-managed-blocks

Refs :
  - Plan : ~/.claude/plans/verifier-je-comprends-steady-parrot.md
  - Schéma cible WIKI : automecanik-wiki/_meta/schema/entity-data/diagnostic.schema.json (v1.0.0)
  - Convention fiche : automecanik-raw/recycled/rag-knowledge/diagnostic/*.md
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
import uuid
from datetime import datetime, timezone
from pathlib import Path

try:
    import yaml
except ImportError:
    sys.stderr.write("Manque : pip install pyyaml\n")
    sys.exit(1)

SCRIPT_ID = "script:diagnostic-from-db-generator@v1"
RAW_REPO = Path(os.environ.get("AUTOMECANIK_RAW_PATH", "/opt/automecanik/automecanik-raw"))
DIAG_SUBDIR = Path("recycled") / "rag-knowledge" / "diagnostic"
TIMEOUT = 30
PAGE_SIZE = 1000

MANAGED_KEYS = ("db_profile", "symptoms", "probable_causes", "maintenance_db", "validation_notes")

URGENCY_TO_LIKELIHOOD = {"haute": "high", "moyenne": "medium", "basse": "low"}

# Enum du schéma wiki diagnostic v1.0.0 — les slugs __diag_system hors enum sont
# signalés en validation_notes (alignement schéma à traiter avant promotion WIKI).
WIKI_SCHEMA_SYSTEM_ENUM = {
    "freinage", "alimentation", "transmission", "moteur", "suspension", "direction",
    "electricite", "echappement", "refroidissement", "climatisation", "eclairage",
    "carrosserie", "habitacle",
}

# Systèmes MOTEUR (slugs __diag_system) dont les symptômes/causes sont
# fuel-dépendants → fiche fuel_aware=true, sections éditoriales par carburant
# (owner 2026-06-13). Liste = systèmes nommés par l'owner mappés sur les slugs DB
# réels : « injection, alimentation, distribution, refroidissement ». En DB,
# l'alimentation est fusionnée dans `injection` (label « Injection et alimentation »).
# Tous les autres systèmes (freinage, direction, suspension, eclairage, transmission,
# embrayage, echappement, filtration, climatisation, demarrage_charge) sont
# fuel-agnostiques → fuel_aware=false.
ENGINE_SYSTEM_SLUGS = {"injection", "distribution", "refroidissement"}

# Carburants canoniques pour structurer les sections éditoriales fuel-aware
# (clés/sous-titres déterministes — jamais de connaissance inventée en BRONZE).
FUEL_AXIS_CLASSES = ("diesel", "essence", "electrique", "hybride", "gpl")
FUEL_AXIS_LABELS = {
    "diesel": "Diesel", "essence": "Essence", "electrique": "Électrique",
    "hybride": "Hybride", "gpl": "GPL / Gaz",
}


# ==========================================================================
# ENV + SUPABASE REST (lecture SEULE — GET uniquement)
# ==========================================================================


def load_backend_env() -> None:
    """Charge SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY depuis backend/.env si absents."""
    if os.environ.get("SUPABASE_SERVICE_ROLE_KEY"):
        return
    candidates = []
    if os.environ.get("BACKEND_ENV_FILE"):
        candidates.append(Path(os.environ["BACKEND_ENV_FILE"]))
    candidates.append(Path(__file__).resolve().parents[2] / "backend" / ".env")
    for env_file in candidates:
        if not env_file.is_file():
            continue
        for line in env_file.read_text(encoding="utf-8").splitlines():
            m = re.match(r"^(SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY)=(.*)$", line.strip())
            if m and not os.environ.get(m.group(1)):
                os.environ[m.group(1)] = m.group(2).strip().strip('"').strip("'")
        break


load_backend_env()
SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://cxpojprgwgubzjyqzmoq.supabase.co")
SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")


def sb_select(table: str, params: dict[str, str]) -> list[dict]:
    """SELECT REST paginé (Range headers) — lecture seule, GET uniquement."""
    if not SERVICE_ROLE_KEY:
        sys.stderr.write("ERREUR : SUPABASE_SERVICE_ROLE_KEY absent (voir backend/.env)\n")
        sys.exit(2)
    rows: list[dict] = []
    offset = 0
    query = urllib.parse.urlencode(params)
    while True:
        req = urllib.request.Request(
            f"{SUPABASE_URL}/rest/v1/{table}?{query}",
            headers={
                "apikey": SERVICE_ROLE_KEY,
                "Authorization": f"Bearer {SERVICE_ROLE_KEY}",
                "Range-Unit": "items",
                "Range": f"{offset}-{offset + PAGE_SIZE - 1}",
            },
            method="GET",
        )
        try:
            with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
                page = json.load(resp)
        except urllib.error.HTTPError as e:
            sys.stderr.write(f"ERREUR REST {table}: HTTP {e.code} — {e.read()[:300]!r}\n")
            sys.exit(2)
        rows.extend(page)
        if len(page) < PAGE_SIZE:
            return rows
        offset += PAGE_SIZE


# ==========================================================================
# HELPERS
# ==========================================================================


def doc_id_for(slug: str) -> str:
    return str(uuid.uuid5(uuid.NAMESPACE_URL, f"automecanik-raw/{DIAG_SUBDIR}/{slug}.md"))


def content_hash_for(body: str) -> str:
    return "sha256:" + hashlib.sha256(body.encode("utf-8")).hexdigest()[:16]


def dump_yaml(data) -> str:
    return yaml.safe_dump(data, sort_keys=False, allow_unicode=True, width=110, default_flow_style=False)


def derive_likelihood(urgency: str | None, notes: list[str], cause_slug: str) -> str:
    likelihood = URGENCY_TO_LIKELIHOOD.get((urgency or "").strip().lower())
    if likelihood is None:
        notes.append(
            f"cause {cause_slug}: urgency DB inattendue ({urgency!r}) — likelihood fallback 'low' "
            "(projection déterministe haute/moyenne/basse uniquement)."
        )
        return "low"
    return likelihood


def derive_severity(symptoms: list[dict]) -> str:
    urgencies = {(s.get("urgency") or "").strip().lower() for s in symptoms}
    if "haute" in urgencies:
        return "high"
    if "moyenne" in urgencies:
        return "medium"
    return "low"


def cause_related_gammes(cause_slug: str, ops: list[dict]) -> list[str]:
    """Match déterministe cause ↔ ops par préfixe 2-tokens du slug (documenté en docstring module)."""
    prefix = "_".join(cause_slug.split("_")[:2])
    return sorted({
        op["related_gamme_slug"] for op in ops
        if op.get("related_gamme_slug") and (op.get("slug") or "").startswith(prefix)
    })


# ==========================================================================
# FETCH __diag_*
# ==========================================================================


def fetch_systems(slugs: list[str] | None) -> list[dict]:
    params = {"select": "id,slug,label,description", "order": "id.asc"}
    if slugs:
        params["slug"] = f"in.({','.join(slugs)})"
    return sb_select("__diag_system", params)


def fetch_symptoms(system_id: int) -> list[dict]:
    return sb_select("__diag_symptom", {
        "select": "id,slug,label,description,signal_mode,urgency",
        "system_id": f"eq.{system_id}",
        "order": "id.asc",
    })


def fetch_causes(system_id: int) -> list[dict]:
    return sb_select("__diag_cause", {
        "select": ("id,slug,label,cause_type,description,verification_method,urgency,"
                   "plausible_km_min,plausible_km_max,plausible_age_min,plausible_age_max,"
                   "workshop_priority"),
        "system_id": f"eq.{system_id}",
        "order": "id.asc",
    })


def fetch_maintenance_ops(system_id: int) -> list[dict]:
    return sb_select("__diag_maintenance_operation", {
        "select": ("id,slug,label,description,interval_km_min,interval_km_max,"
                   "interval_months_min,interval_months_max,severity_if_overdue,"
                   "normal_wear_km_min,normal_wear_km_max,related_gamme_slug,related_pg_id"),
        "system_id": f"eq.{system_id}",
        "order": "id.asc",
    })


# ==========================================================================
# CONSTRUCTION FICHE SYSTÈME
# ==========================================================================


def build_fiche(system: dict, generated_at: str) -> dict:
    slug = system["slug"]
    notes: list[str] = []
    symptoms_db = fetch_symptoms(system["id"])
    causes_db = fetch_causes(system["id"])
    ops_db = fetch_maintenance_ops(system["id"])

    if slug not in WIKI_SCHEMA_SYSTEM_ENUM:
        notes.append(
            f"slug système DB '{slug}' absent de l'enum du schéma wiki diagnostic v1.0.0 — "
            "alignement schéma requis avant promotion WIKI (divergence __diag_system ↔ schéma)."
        )

    # Axe motorisation ciblé (owner 2026-06-13) : systèmes moteur = fuel-dépendants.
    fuel_aware = slug in ENGINE_SYSTEM_SLUGS

    symptoms = [
        {
            "slug": s.get("slug"),
            "label": s.get("label"),
            "signal_mode": s.get("signal_mode"),
            "urgency": s.get("urgency"),
            "source": {"type": "db", "table": "__diag_symptom", "confidence": "high"},
        }
        for s in symptoms_db
    ]

    probable_causes = []
    for c in causes_db:
        related = cause_related_gammes(c.get("slug") or "", ops_db)
        if not related:
            notes.append(
                f"cause {c.get('slug')}: aucune op d'entretien matchée (préfixe 2-tokens) — "
                "related_gammes vide, renvoi gamme à compléter éditorialement."
            )
        probable_causes.append({
            "cause": c.get("slug"),
            "label": c.get("label"),
            "cause_type": c.get("cause_type"),
            "likelihood": derive_likelihood(c.get("urgency"), notes, c.get("slug") or "?"),
            "urgency": c.get("urgency"),
            "workshop_priority": c.get("workshop_priority"),
            "related_gammes": related,
            "source": {"type": "db", "table": "__diag_cause", "confidence": "high"},
        })

    maintenance_db = [
        {
            "slug": op.get("slug"),
            "label": op.get("label"),
            "related_gamme_slug": op.get("related_gamme_slug"),
            "related_pg_id": op.get("related_pg_id"),
            "interval_km": [op.get("interval_km_min"), op.get("interval_km_max")],
            "interval_months": [op.get("interval_months_min"), op.get("interval_months_max")],
            "normal_wear_km": [op.get("normal_wear_km_min"), op.get("normal_wear_km_max")],
            "severity_if_overdue": op.get("severity_if_overdue"),
            "source": {"type": "db", "table": "__diag_maintenance_operation", "confidence": "high"},
        }
        for op in ops_db
    ]

    stable_fm = {
        "category": slug,
        "doc_family": "diagnostic",
        "site_section": "diagnostic",
        "source_type": "diagnostic",
        "title": f"Diagnostic - {system.get('label') or slug}",
        "truth_level": "L1",
        "updated_at": generated_at[:10],
        "verification_status": "verified",
        "doc_id": doc_id_for(slug),
        "lang": "fr",
        # Clés alignées schéma wiki diagnostic v1.0.0
        "system": slug,
        "severity": derive_severity(symptoms_db),
        "audience": "client",
        # Axe motorisation ciblé (owner 2026-06-13) : true = système moteur
        # (symptômes/causes fuel-dépendants) → sections éditoriales par carburant ;
        # false = système châssis/sécurité fuel-agnostique (un frein reste un frein).
        "fuel_aware": fuel_aware,
        "provenance": {
            "ingested_by": SCRIPT_ID,
            "generated_at": generated_at,
            "source_db": "supabase (SELECT only — __diag_system/__diag_symptom/__diag_cause/__diag_maintenance_operation)",
        },
    }

    db_profile = {
        "system_id": system["id"],
        "system_slug": slug,
        "system_label": system.get("label"),
        "symptom_count": len(symptoms_db),
        "cause_count": len(causes_db),
        "maintenance_operation_count": len(ops_db),
        "last_db_sync": generated_at,
        "source": {"type": "db", "table": "__diag_system", "confidence": "high"},
    }

    body = render_body(system, symptoms_db, causes_db, ops_db, fuel_aware)

    return {
        "slug": slug,
        "stable_fm": stable_fm,
        "managed": {
            "db_profile": db_profile,
            "symptoms": symptoms,
            "probable_causes": probable_causes,
            "maintenance_db": maintenance_db,
            "validation_notes": notes,
        },
        "body": body,
    }


def _fmt_range(lo, hi, unit: str) -> str:
    if lo is None and hi is None:
        return "—"
    if lo is not None and hi is not None:
        return f"{lo}–{hi} {unit}"
    return f"{lo if lo is not None else hi} {unit}"


def render_body(system: dict, symptoms: list[dict], causes: list[dict], ops: list[dict],
                fuel_aware: bool) -> str:
    label = system.get("label") or system["slug"]
    lines = [
        f"# {label} — Diagnostic (maille système)",
        "",
        (system.get("description") or "").strip() or f"Fiche diagnostic du système {label}.",
        "",
        "> Bloc FAITS générés depuis la DB interne (__diag_*). Source de vérité structurée :",
        "> frontmatter `symptoms` / `probable_causes` / `maintenance_db` (provenance champ par champ).",
        "",
        "## Symptômes",
        "",
        "| Symptôme | Slug | Urgence |",
        "|----------|------|---------|",
    ]
    for s in symptoms:
        lines.append(f"| {s.get('label') or '?'} | `{s.get('slug')}` | {s.get('urgency') or '—'} |")
    lines += ["", "## Causes possibles", ""]
    for c in causes:
        lines.append(f"### {c.get('label') or c.get('slug')}")
        lines.append("")
        if (c.get("description") or "").strip():
            lines.append(c["description"].strip())
        lines.append(f"- **Type** : {c.get('cause_type') or '—'}")
        lines.append(f"- **Urgence** : {c.get('urgency') or '—'} · **Priorité atelier** : {c.get('workshop_priority') or '—'}")
        km = _fmt_range(c.get("plausible_km_min"), c.get("plausible_km_max"), "km")
        age = _fmt_range(c.get("plausible_age_min"), c.get("plausible_age_max"), "ans")
        if km != "—" or age != "—":
            lines.append(f"- **Plage plausible** : {km} · {age}")
        lines.append("")
    lines += ["## Vérifications", ""]
    for c in causes:
        if (c.get("verification_method") or "").strip():
            lines.append(f"- **{c.get('label') or c.get('slug')}** : {c['verification_method'].strip()}")
    lines += [
        "",
        "## Renvoi vers gammes",
        "",
        "| Opération d'entretien | Gamme | pg_id | Intervalle | Sévérité si dépassé |",
        "|----------------------|-------|-------|------------|---------------------|",
    ]
    for op in ops:
        interval = _fmt_range(op.get("interval_km_min"), op.get("interval_km_max"), "km")
        months = _fmt_range(op.get("interval_months_min"), op.get("interval_months_max"), "mois")
        interval_label = " / ".join(x for x in (interval, months) if x != "—") or "—"
        lines.append(
            f"| {op.get('label') or '?'} | `{op.get('related_gamme_slug') or '—'}` | "
            f"{op.get('related_pg_id') or '—'} | {interval_label} | {op.get('severity_if_overdue') or '—'} |"
        )
    # Axe motorisation ciblé (owner 2026-06-13) :
    if fuel_aware:
        lines += [
            "",
            "## Spécificités par carburant",
            "",
            f"> Système MOTEUR (`fuel_aware: true`) : symptômes et causes du système {label}",
            "> sont fuel-dépendants → sections éditoriales structurées PAR CARBURANT. Squelette",
            "> BRONZE rempli au scraping PR-C.2 (jamais inventé) ; provenance par entrée :",
            "> applies_to.{make,model_generation,fuel,engine_family,market} + source.{source_market,",
            "> lang_original,confidence,evidence_id} ; clé moteur normalisée `engine_family:<code>`.",
            "",
        ]
        for fc in FUEL_AXIS_CLASSES:
            lines.append(f"### {FUEL_AXIS_LABELS[fc]}")
            lines.append("")
            lines.append(
                f"<!-- TODO éditorial PR-C.2 — pannes/causes spécifiques {fc} du système "
                f"{system['slug']} (clé `fuel:{fc}`) : symptômes propres au carburant, causes "
                "fuel-dépendantes, vérifications. FR-only, reformulé non-verbatim ; valeurs "
                "prescriptives (couples…) = fail-closed sans source constructeur/OEM. -->"
            )
            lines.append("")
    else:
        lines += [
            "",
            "> Système châssis/sécurité (`fuel_aware: false`) : fuel-agnostique — pas de dimension",
            f"> carburant (le système {label} ne dépend pas de la motorisation). Le contenu",
            "> éditorial (PR-C.2) reste commun à toutes les motorisations.",
            "",
        ]

    lines += [
        "",
        "## Conseils sécurité",
        "",
        "<!-- TODO éditorial — safety_advisory : squelette à remplir avec validation humaine.",
        "     Fail-closed : aucune valeur technique critique (couples de serrage, etc.) sans",
        "     source constructeur/OEM identifiée — sinon validation_notes, jamais exportable. -->",
        "",
    ]
    return "\n".join(lines)


# ==========================================================================
# RENDU FICHIER + MODES (identique vehicle-from-db-generator)
# ==========================================================================


def render_managed_block(key: str, value) -> str:
    return (
        f"# >>> DB-MANAGED BLOCK: {key} — {SCRIPT_ID} (ne pas éditer à la main)\n"
        + dump_yaml({key: value})
        + f"# <<< END DB-MANAGED BLOCK: {key}\n"
    )


def render_full_file(fiche: dict) -> str:
    fm_text = dump_yaml({**fiche["stable_fm"], "content_hash": content_hash_for(fiche["body"])})
    managed_text = "".join(render_managed_block(k, fiche["managed"][k]) for k in MANAGED_KEYS)
    return f"---\n{fm_text}{managed_text}---\n\n{fiche['body']}\n"


def merge_managed_blocks(existing: str, fiche: dict) -> str:
    """Remplace UNIQUEMENT les blocs managed délimités ; tout le reste byte-à-byte."""
    if not existing.startswith("---\n"):
        raise ValueError("fichier sans frontmatter YAML — merge refusé (pas d'écrasement aveugle)")
    if existing.find("\n---", 4) == -1:
        raise ValueError("frontmatter non fermé — merge refusé")

    content = existing
    for key in MANAGED_KEYS:
        new_block = render_managed_block(key, fiche["managed"][key])
        pattern = re.compile(
            rf"^# >>> DB-MANAGED BLOCK: {re.escape(key)} .*?\n.*?^# <<< END DB-MANAGED BLOCK: {re.escape(key)}\n",
            re.DOTALL | re.MULTILINE,
        )
        if pattern.search(content):
            content = pattern.sub(lambda _m: new_block, content, count=1)
        else:
            fm_end = content.find("\n---", 4)
            insert_at = fm_end + 1
            content = content[:insert_at] + new_block + content[insert_at:]
    return content


# ==========================================================================
# MAIN
# ==========================================================================


def main() -> int:
    parser = argparse.ArgumentParser(description="Génère les fiches RAW diagnostic DB-first (maille SYSTÈME, ADR-033).")
    parser.add_argument("--system", action="append", default=None,
                        help="Slug __diag_system à générer (répétable). Ex: --system freinage")
    parser.add_argument("--all", action="store_true", help="Génère les 13 systèmes")
    parser.add_argument("--create-missing", action="store_true",
                        help="Crée uniquement les fiches absentes (mode par défaut, flag explicite)")
    parser.add_argument("--merge-managed-blocks", action="store_true",
                        help="Met à jour UNIQUEMENT les blocs DB-managed des fiches existantes")
    parser.add_argument("--dry-run", action="store_true", help="Écrit dans --out-dir au lieu du RAW")
    parser.add_argument("--out-dir", type=str, default=None, help="Répertoire de sortie pour --dry-run")
    parser.add_argument("--verbose", action="store_true")
    args = parser.parse_args()

    if not args.system and not args.all:
        parser.error("préciser --system <slug> (répétable) ou --all")
    if args.dry_run and not args.out_dir:
        parser.error("--dry-run requiert --out-dir (aucune écriture dans le RAW en dry-run)")

    out_dir = Path(args.out_dir) / "diagnostic" if args.dry_run else RAW_REPO / DIAG_SUBDIR
    out_dir.mkdir(parents=True, exist_ok=True)

    generated_at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    systems = fetch_systems(None if args.all else args.system)
    if not systems:
        print("Aucun système trouvé pour cette sélection — abandon.", file=sys.stderr)
        return 1

    created, merged, skipped = 0, 0, 0
    for system in systems:
        fiche = build_fiche(system, generated_at)
        target = out_dir / f"{fiche['slug']}.md"
        raw_target = RAW_REPO / DIAG_SUBDIR / f"{fiche['slug']}.md"

        if args.merge_managed_blocks and raw_target.exists():
            merged_content = merge_managed_blocks(raw_target.read_text(encoding="utf-8"), fiche)
            target.write_text(merged_content, encoding="utf-8")
            merged += 1
            print(f"[merge ] {target} (blocs: {', '.join(MANAGED_KEYS)})")
        elif not args.merge_managed_blocks and not args.dry_run and target.exists():
            skipped += 1
            print(f"[skip  ] {target} existe déjà (mode create-missing — jamais d'écrasement)")
        else:
            target.write_text(render_full_file(fiche), encoding="utf-8")
            created += 1
            print(f"[create] {target} ({fiche['managed']['db_profile']['symptom_count']} symptômes, "
                  f"{fiche['managed']['db_profile']['cause_count']} causes, "
                  f"{fiche['managed']['db_profile']['maintenance_operation_count']} ops)")

    print(f"\nRésumé : {created} créée(s), {merged} mergée(s), {skipped} skippée(s) — sortie {out_dir}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
