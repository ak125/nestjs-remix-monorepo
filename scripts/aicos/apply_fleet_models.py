"""Idempotent PATCH of agent models per fleet_config.yaml. Dry-run supported."""
import argparse
import sys
import yaml
from scripts.aicos.aicos_client import AicosClient


def load_config(path: str) -> dict:
    with open(path) as f:
        return yaml.safe_load(f)


def build_patches(config: dict) -> list[dict]:
    """For each agent with an aicos_id, build a PATCH body. Skip null IDs."""
    models = config["models"]
    out = []
    for a in config["agents"]:
        if not a.get("aicos_id"):
            continue
        model_id = models[a["target_model"]]
        out.append(
            {
                "name": a["name"],
                "aicos_id": a["aicos_id"],
                "body": {
                    "adapterConfig": {"model": model_id},
                    "budgetMonthlyCents": a["budget_monthly_cents"],
                },
            }
        )
    return out


def plan_changes(client: AicosClient, config: dict) -> list[dict]:
    """Compare desired vs current. Returns plan with status (noop|patch|missing)."""
    out = []
    for p in build_patches(config):
        try:
            current = client.get(f"/api/agents/{p['aicos_id']}")
        except Exception as e:
            out.append({**p, "status": "missing", "error": str(e)})
            continue
        cur_model = (current.get("adapterConfig") or {}).get("model")
        cur_budget = current.get("budgetMonthlyCents")
        desired_model = p["body"]["adapterConfig"]["model"]
        desired_budget = p["body"]["budgetMonthlyCents"]
        if cur_model == desired_model and cur_budget == desired_budget:
            out.append({**p, "status": "noop", "current_model": cur_model})
        else:
            out.append(
                {
                    **p,
                    "status": "patch",
                    "current_model": cur_model,
                    "current_budget": cur_budget,
                }
            )
    return out


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", default="scripts/aicos/fleet_config.yaml")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Apply PATCHes (otherwise plan-only)",
    )
    args = parser.parse_args()

    config = load_config(args.config)
    client = AicosClient(dry_run=args.dry_run)
    plan = plan_changes(client, config)

    print(f"\nFleet plan ({len(plan)} agents):")
    print(f"{'Name':<20} {'ID':<40} {'Status':<10} {'Current -> Desired'}")
    for p in plan:
        cur = p.get("current_model") or "?"
        des = p["body"]["adapterConfig"]["model"]
        print(f"{p['name']:<20} {p['aicos_id']:<40} {p['status']:<10} {cur} -> {des}")

    if not args.apply:
        print("\n(plan-only; pass --apply to PATCH)")
        return 0

    patched = 0
    for p in plan:
        if p["status"] != "patch":
            continue
        client.patch(f"/api/agents/{p['aicos_id']}", body=p["body"])
        patched += 1
    print(f"\nApplied {patched} PATCH(es).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
