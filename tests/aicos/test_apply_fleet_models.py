from unittest.mock import MagicMock
from scripts.aicos.apply_fleet_models import build_patches, plan_changes


SAMPLE_CONFIG = {
    "models": {
        "opus_4_7": "claude-opus-4-7",
        "sonnet_4_6": "claude-sonnet-4-6",
    },
    "agents": [
        {"name": "CEO", "aicos_id": "id-ceo", "target_model": "opus_4_7", "budget_monthly_cents": 200000},
        {"name": "CMO", "aicos_id": "id-cmo", "target_model": "sonnet_4_6", "budget_monthly_cents": 30000},
        {"name": "Advisor", "aicos_id": None, "target_model": "opus_4_7", "budget_monthly_cents": 500000},
    ],
}


def test_build_patches_resolves_model_alias():
    patches = build_patches(SAMPLE_CONFIG)
    ceo = next(p for p in patches if p["aicos_id"] == "id-ceo")
    assert ceo["body"]["adapterConfig"]["model"] == "claude-opus-4-7"
    assert ceo["body"]["budgetMonthlyCents"] == 200000


def test_build_patches_skips_null_aicos_id():
    patches = build_patches(SAMPLE_CONFIG)
    advisor = next((p for p in patches if p["name"] == "Advisor"), None)
    assert advisor is None


def test_plan_changes_is_idempotent():
    client = MagicMock()
    client.get.side_effect = lambda path: {
        "id": path.rsplit("/", 1)[-1],
        "adapterConfig": {"model": "claude-opus-4-7", "cwd": "/x"},
        "budgetMonthlyCents": 200000,
    }
    plan = plan_changes(client, SAMPLE_CONFIG)
    ceo = next(p for p in plan if p["aicos_id"] == "id-ceo")
    assert ceo["status"] == "noop"


def test_plan_changes_detects_drift():
    client = MagicMock()
    client.get.side_effect = lambda path: {
        "id": path.rsplit("/", 1)[-1],
        "adapterConfig": {"model": "claude-haiku-4-5-20251001", "cwd": "/x"},
        "budgetMonthlyCents": 200000,
    }
    plan = plan_changes(client, SAMPLE_CONFIG)
    ceo = next(p for p in plan if p["aicos_id"] == "id-ceo")
    assert ceo["status"] == "patch"
