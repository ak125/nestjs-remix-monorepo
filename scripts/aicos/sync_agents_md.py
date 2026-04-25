"""Sync local agents/<name>/AGENTS.md to AI-COS via instructions-bundle/file PUT."""
import argparse
import sys
from pathlib import Path
import yaml
from scripts.aicos.aicos_client import AicosClient


REMOTE_PATH_TEMPLATE = (
    "/paperclip/instances/default/companies/{company_id}/agents/{agent_id}/instructions/AGENTS.md"
)

NAME_TO_FOLDER = {
    "CEO": "ceo",
    "CTO": "cto",
    "CMO": "cmo",
    "CPO": "cpo",
    "RAG-Ops": "rag-lead",
    "SEO-Content": "seo-content",
    "R4-Batch-Lead": "r4-batch-orchestrator",
    "SEO-QA": "seo-qa",
    "Advisor": "advisor",
}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", default="scripts/aicos/fleet_config.yaml")
    parser.add_argument(
        "--only",
        action="append",
        default=None,
        help="Sync only these agents (by name). Can be repeated.",
    )
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    with open(args.config) as f:
        config = yaml.safe_load(f)

    client = AicosClient(dry_run=args.dry_run)
    repo_root = Path(__file__).resolve().parents[2]

    synced = 0
    for a in config["agents"]:
        if not a.get("aicos_id"):
            print(f"  skip {a['name']} (no aicos_id)")
            continue
        if args.only and a["name"] not in args.only:
            continue
        folder = NAME_TO_FOLDER.get(a["name"])
        if not folder:
            print(f"  skip {a['name']} (no local folder mapping)")
            continue
        local = repo_root / "agents" / folder / "AGENTS.md"
        if not local.exists():
            print(f"  skip {a['name']} (local file missing: {local})")
            continue
        remote_path = REMOTE_PATH_TEMPLATE.format(
            company_id=client.company_id, agent_id=a["aicos_id"]
        )
        body = {"path": remote_path, "content": local.read_text()}
        client.put(f"/api/agents/{a['aicos_id']}/instructions-bundle/file", body=body)
        print(f"  synced {a['name']} ({len(body['content'])} chars) -> {remote_path}")
        synced += 1

    print(f"\nSynced {synced} agent(s).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
