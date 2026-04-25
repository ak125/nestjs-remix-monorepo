"""Submit a hire request for the Advisor agent on AI-COS.

The hire creates a draft agent + a `hire_agent` approval. A human board
operator must approve it on the AI-COS UI to finalize the hire.

CHECKPOINT: production state change. Run with --dry-run first; never run
without --dry-run unless an authorized operator has confirmed.
"""
import argparse
import sys
from scripts.aicos.aicos_client import AicosClient


CEO_ID = "993a4a02-b3b5-4414-9d5c-94b143ff1fe5"


HIRE_PAYLOAD = {
    "name": "Advisor",
    "role": "advisor",
    "title": "AI peer reviewer",
    "reportsTo": CEO_ID,
    "capabilities": (
        "Pre-canon review for code PRs, DB writes, deployments, governance changes. "
        "Read-only. Never decides — proposes verdict + scored axes for board operator."
    ),
    "budgetMonthlyCents": 500000,
    "adapterType": "claude_local",
    "adapterConfig": {
        "model": "claude-opus-4-7",
        "cwd": "/paperclip/instances/default/workspaces/advisor",
        "timeoutSec": 600,
        "graceSec": 30,
        "maxTurnsPerRun": 1000,
    },
    "instructionsBundleMode": "managed",
}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    client = AicosClient(dry_run=args.dry_run)
    print(
        f"Submitting hire request to {client.api_base} for company {client.company_id}"
    )
    result = client.post(
        f"/api/companies/{client.company_id}/agent-hires",
        body=HIRE_PAYLOAD,
    )
    if args.dry_run:
        print("(dry-run; nothing was sent)")
        return 0

    print(
        f"\nHire submitted. Approval ID: {result.get('approvalId') or result.get('id')}"
    )
    print(f"Draft agent ID: {result.get('agentId')}")
    print("\n=> Board operator must now approve at:")
    print(f"   {client.api_base}/approvals")
    print("\nOnce approved, run:")
    print("   python3 scripts/aicos/sync_agents_md.py --only Advisor")
    print("Then update fleet_config.yaml with the Advisor's full agent UUID and run:")
    print("   python3 scripts/aicos/apply_fleet_models.py --apply")
    return 0


if __name__ == "__main__":
    sys.exit(main())
