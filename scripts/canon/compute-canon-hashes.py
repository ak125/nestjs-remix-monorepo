#!/usr/bin/env python3
"""
compute-canon-hashes.py — manifeste et copies des canons distribués.

Source de la règle : AEC §« Distribution canonique »
(.spec/00-canon/canon-distribution/rules-agent-exit-contract.md).

Porté de `ak125/governance-vault` (main b2e712791bee), en un seul outil :
`_scripts/compute-canon-hashes.py` (manifeste) et `_scripts/sync_canon_mirrors.py`
(copies du monorepo). Étape 1 du plan de sortie du vault (décisions 72 et 73).

Pour chaque canon du registre CANONS :
  canon_sha256        — SHA-256 du fichier source entier (frontmatter compris) ;
  distribution_sha256 — SHA-256 du texte privé de son frontmatter YAML. C'est le
                        contenu exact de chaque copie, et la valeur que comparent
                        les dépôts consommateurs.

Modes :
  --check   recalcule, puis échoue (code 1) si le manifeste ou une copie du monorepo
            diffère du calcul. N'écrit rien, ne lit pas le réseau.
  --write   réécrit le manifeste et les copies du monorepo. Les copies des autres
            dépôts (wiki, raw) se mettent à jour par une PR dans leur dépôt.
  --print   imprime le manifeste calculé, sans rien écrire.
  --dispatch-plan
            imprime, en JSON, les annonces `canon-updated` à envoyer aux dépôts
            consommateurs autres que le monorepo. Lit le manifeste écrit, pas le
            réseau. Avec `--before <ancien manifeste>` : les couples (canon, dépôt)
            dont le `distribution_sha256` a changé, ou qui sont nouveaux. Avec
            `--canon <clé>` : tous les dépôts de ce canon. Appelé par
            `.github/workflows/canon-publish.yml`.

Gate de statut, fail-closed : un canon n'est distribué que si le statut déclaré dans
son frontmatter figure dans `publishable_when` de son entrée. Refus si
`publishable_when` est absent, si le document ne déclare aucun statut, ou si le statut
est hors liste.

Non porté ici : le mode `json_jcs` et son vecteur de parité
(`99-meta/jcs-parity-vector.json`). Aucun canon enregistré ne l'utilise ; son sort se
décide à l'étape 7 du plan. Un `hash_mode` autre que `text_sha256` est refusé.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
CANON_DIR = ".spec/00-canon/canon-distribution"
MANIFEST_PATH = f"{CANON_DIR}/canon-hashes.json"
MONOREPO = "ak125/nestjs-remix-monorepo"
SELF = "scripts/canon/compute-canon-hashes.py"

# Registre des canons distribués. La version et la liste des consommateurs se
# déclarent ici (AEC §« Distribution canonique », point 1).
#
# publishable_when : liste fermée des statuts qui autorisent la distribution.
#                    Obligatoire : son absence est un refus.
CANONS: dict[str, dict] = {
    "aec": {
        "name": "Agent Exit Contract",
        "canon_path": f"{CANON_DIR}/rules-agent-exit-contract.md",
        "version": "1.3.0",
        "hash_mode": "text_sha256",
        "publishable_when": ["canon"],
        "consumers": [
            {"repo": "ak125/automecanik-wiki", "path": "_meta/agent-exit-contract.md"},
            {"repo": "ak125/automecanik-raw", "path": "agent-exit-contract.md"},
            {"repo": MONOREPO, "path": ".claude/canon-mirrors/agent-exit-contract.md"},
            {"repo": MONOREPO, "path": "workspaces/seo-batch/.claude/canon-mirrors/agent-exit-contract.md"},
            {"repo": MONOREPO, "path": "workspaces/marketing/.claude/canon-mirrors/agent-exit-contract.md"},
        ],
    },
    "marketing_voice": {
        "name": "Marketing Brand Voice",
        "canon_path": f"{CANON_DIR}/rules-marketing-voice.md",
        "version": "1.0.1",
        "hash_mode": "text_sha256",
        "publishable_when": ["canon"],
        "consumers": [
            {"repo": MONOREPO, "path": ".claude/canon-mirrors/marketing-voice.md"},
            {"repo": MONOREPO, "path": "workspaces/marketing/.claude/canon-mirrors/marketing-voice.md"},
        ],
    },
}

FRONTMATTER_RE = re.compile(r"^---\n.*?\n---\n*", re.DOTALL)
STATUS_RE = re.compile(r"^status:\s*(\S+)\s*$", re.M)


def strip_frontmatter(text: str) -> str:
    return FRONTMATTER_RE.sub("", text, count=1)


def sha256_text(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def read_exact(path: Path) -> str:
    """Lit sans traduction des fins de ligne : un CRLF doit changer l'empreinte."""
    return path.read_bytes().decode("utf-8")


def declared_status(text: str) -> str | None:
    """Statut déclaré dans le frontmatter du document. None s'il est absent."""
    if text.startswith("---"):
        head = text.split("---", 2)
        if len(head) >= 2:
            found = STATUS_RE.search(head[1])
            return found.group(1) if found else None
    return None


def enforce_publishable(key: str, meta: dict, text: str) -> None:
    allowed = meta.get("publishable_when")
    if not allowed:
        sys.exit(
            f"ERREUR : le canon '{key}' n'a pas de `publishable_when`. Chaque entrée "
            f"déclare les statuts qui autorisent sa distribution (voir {SELF})."
        )
    status = declared_status(text)
    if status is None:
        sys.exit(
            f"ERREUR : le canon '{key}' ne déclare aucun statut ({meta['canon_path']}). "
            f"Un canon sans statut n'est pas distribuable."
        )
    if status not in allowed:
        sys.exit(
            f"ERREUR : le canon '{key}' a status='{status}', hors de "
            f"publishable_when={allowed}. Le passage de statut est un acte distinct."
        )


def compute(root: Path = REPO_ROOT, canons: dict[str, dict] | None = None) -> dict:
    """Manifeste calculé depuis les sources. `updated` est fixé par l'appelant."""
    canons = CANONS if canons is None else canons
    out: dict[str, dict] = {}
    for key, meta in canons.items():
        source = root / meta["canon_path"]
        if not source.is_file():
            sys.exit(f"ERREUR : source du canon '{key}' absente : {meta['canon_path']}")
        if not meta.get("consumers"):
            sys.exit(
                f"ERREUR : le canon '{key}' ne déclare aucun consommateur. Un canon "
                f"distribué en déclare au moins un (dépôt et chemin) dans CANONS."
            )
        mode = meta.get("hash_mode", "text_sha256")
        if mode != "text_sha256":
            sys.exit(f"ERREUR : canon '{key}', hash_mode non pris en charge : {mode!r}")
        text = read_exact(source)
        enforce_publishable(key, meta, text)
        out[key] = {
            "name": meta["name"],
            "canon_path": meta["canon_path"],
            "canon_sha256": sha256_text(text),
            "distribution_sha256": sha256_text(strip_frontmatter(text)),
            "hash_mode": mode,
            "version": meta["version"],
            "consumers": meta["consumers"],
        }
    return {
        "$comment": f"Generated by {SELF} — do not edit by hand.",
        "version": "1.0.0",
        "updated": None,
        "canons": out,
    }


def without_date(manifest: dict) -> dict:
    return {k: v for k, v in manifest.items() if k != "updated"}


def load_manifest(root: Path) -> dict | None:
    path = root / MANIFEST_PATH
    if not path.is_file():
        return None
    return json.loads(read_exact(path))


def mirror_states(root: Path, canons: dict[str, dict]) -> list[dict]:
    """État de chaque copie déclarée dans ce dépôt : ok | differs | missing."""
    states = []
    for key, meta in canons.items():
        body = strip_frontmatter(read_exact(root / meta["canon_path"]))
        for consumer in meta["consumers"]:
            if consumer["repo"] != MONOREPO:
                continue
            target = root / consumer["path"]
            if not target.is_file():
                state = "missing"
            elif read_exact(target) == body:
                state = "ok"
            else:
                state = "differs"
            states.append({"canon": key, "path": consumer["path"], "state": state, "body": body})
    return states


def check(root: Path = REPO_ROOT, canons: dict[str, dict] | None = None) -> int:
    canons = CANONS if canons is None else canons
    computed = compute(root, canons)
    drift: list[str] = []

    on_disk = load_manifest(root)
    if on_disk is None:
        drift.append(f"manifeste absent : {MANIFEST_PATH}")
    elif without_date(on_disk) != without_date(computed):
        disk_canons = on_disk.get("canons", {})
        for key in sorted(set(disk_canons) | set(computed["canons"])):
            disk, calc = disk_canons.get(key), computed["canons"].get(key)
            if disk is None or calc is None:
                drift.append(f"manifeste, canon '{key}' : {'absent' if disk is None else 'en trop'}")
                continue
            for field in sorted(set(disk) | set(calc)):
                if disk.get(field) != calc.get(field):
                    drift.append(
                        f"manifeste, {key}.{field} : écrit={disk.get(field)!r} calculé={calc.get(field)!r}"
                    )
        if not drift:
            drift.append("manifeste : en-tête différent du calcul")

    for st in mirror_states(root, canons):
        if st["state"] == "missing":
            drift.append(f"copie absente : {st['path']} (canon '{st['canon']}')")
        elif st["state"] == "differs":
            drift.append(f"copie différente de sa source : {st['path']} (canon '{st['canon']}')")

    if drift:
        print(f"ÉCART — corriger la source, puis relancer `python3 {SELF} --write` :")
        for line in drift:
            print(f"  ! {line}")
        return 1
    print("OK — manifeste et copies du monorepo conformes aux sources")
    return 0


def write(root: Path = REPO_ROOT, canons: dict[str, dict] | None = None) -> int:
    canons = CANONS if canons is None else canons
    computed = compute(root, canons)
    on_disk = load_manifest(root)
    if on_disk is not None and without_date(on_disk) == without_date(computed):
        # Rien n'a changé : la date du manifeste reste celle du dernier changement.
        print(f"inchangé  {MANIFEST_PATH}")
    else:
        computed["updated"] = datetime.now(timezone.utc).date().isoformat()
        path = root / MANIFEST_PATH
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes((json.dumps(computed, indent=2, ensure_ascii=False) + "\n").encode("utf-8"))
        print(f"écrit     {MANIFEST_PATH}")

    for st in mirror_states(root, canons):
        if st["state"] == "ok":
            print(f"inchangé  {st['path']}")
            continue
        target = root / st["path"]
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(st["body"].encode("utf-8"))
        print(f"écrit     {st['path']}")
    return 0


def external_targets(manifest: dict) -> dict[tuple[str, str], str]:
    """Couples (canon, dépôt hors monorepo) d'un manifeste, avec leur distribution_sha256."""
    targets: dict[tuple[str, str], str] = {}
    for key, entry in manifest.get("canons", {}).items():
        for consumer in entry.get("consumers", []):
            if consumer["repo"] != MONOREPO:
                targets[(key, consumer["repo"])] = entry["distribution_sha256"]
    return targets


def dispatch_plan(manifest: dict, before: dict | None = None, canon: str | None = None) -> list[dict]:
    """Annonces à envoyer : une par couple (canon, dépôt consommateur hors monorepo).

    canon  : tous les dépôts de ce canon (annonce forcée). Clé inconnue : refus.
    before : les couples dont le distribution_sha256 diffère de l'ancien manifeste,
             et ceux que l'ancien manifeste ne déclarait pas.
    Un seul des deux ; ni l'un ni l'autre : refus.
    """
    if (before is None) == (canon is None):
        sys.exit("ERREUR : --dispatch-plan demande soit --before, soit --canon")
    current = external_targets(manifest)
    if canon is not None:
        if canon not in manifest.get("canons", {}):
            known = ", ".join(sorted(manifest.get("canons", {})))
            sys.exit(f"ERREUR : canon inconnu : {canon!r} (connus : {known})")
        chosen = [pair for pair in current if pair[0] == canon]
    else:
        previous = external_targets(before)
        chosen = [pair for pair, digest in current.items() if previous.get(pair) != digest]
    return [{"canon": key, "repo": repo} for key, repo in chosen]


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0].strip())
    mode = ap.add_mutually_exclusive_group(required=True)
    mode.add_argument("--check", action="store_true", help="échoue si le manifeste ou une copie diffère")
    mode.add_argument("--write", action="store_true", help="réécrit le manifeste et les copies du monorepo")
    mode.add_argument("--print", action="store_true", help="imprime le manifeste calculé")
    mode.add_argument("--dispatch-plan", action="store_true", help="imprime les annonces à envoyer (JSON)")
    ap.add_argument("--before", type=Path, help="avec --dispatch-plan : ancien manifeste à comparer")
    ap.add_argument("--canon", help="avec --dispatch-plan : clé du canon à annoncer à tous ses dépôts")
    args = ap.parse_args()

    if not args.dispatch_plan and (args.before is not None or args.canon is not None):
        ap.error("--before et --canon ne s'emploient qu'avec --dispatch-plan")
    if args.dispatch_plan:
        manifest = load_manifest(REPO_ROOT)
        if manifest is None:
            sys.exit(f"ERREUR : manifeste absent : {MANIFEST_PATH}")
        before = None
        if args.before is not None:
            if not args.before.is_file():
                sys.exit(f"ERREUR : ancien manifeste absent : {args.before}")
            before = json.loads(read_exact(args.before))
        print(json.dumps(dispatch_plan(manifest, before, args.canon), separators=(",", ":")))
        return 0

    if args.print:
        computed = compute()
        on_disk = load_manifest(REPO_ROOT)
        if on_disk is not None and without_date(on_disk) == without_date(computed):
            computed["updated"] = on_disk.get("updated")
        print(json.dumps(computed, indent=2, ensure_ascii=False))
        return 0
    if args.write:
        return write()
    return check()


if __name__ == "__main__":
    sys.exit(main())
