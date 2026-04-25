import json
import pytest
from unittest.mock import patch, MagicMock
from scripts.aicos.aicos_client import AicosClient, AicosAuthError


def test_client_loads_context_from_paperclip_json(tmp_path):
    ctx = tmp_path / "context.json"
    ctx.write_text(json.dumps({
        "currentProfile": "aicos",
        "profiles": {"aicos": {"apiBase": "http://1.2.3.4:3100", "companyId": "abc"}},
    }))
    c = AicosClient(context_path=str(ctx), auth_token="dummy")
    assert c.api_base == "http://1.2.3.4:3100"
    assert c.company_id == "abc"


def test_client_raises_without_auth(tmp_path):
    ctx = tmp_path / "context.json"
    ctx.write_text(json.dumps({
        "currentProfile": "aicos",
        "profiles": {"aicos": {"apiBase": "http://1.2.3.4:3100", "companyId": "abc"}},
    }))
    with pytest.raises(AicosAuthError):
        AicosClient(context_path=str(ctx), auth_token=None)


def test_client_get_passes_auth_header(tmp_path):
    ctx = tmp_path / "context.json"
    ctx.write_text(json.dumps({
        "currentProfile": "aicos",
        "profiles": {"aicos": {"apiBase": "http://1.2.3.4:3100", "companyId": "abc"}},
    }))
    with patch("scripts.aicos.aicos_client.requests.request") as mock_req:
        mock_req.return_value = MagicMock(status_code=200, json=lambda: {"ok": True})
        c = AicosClient(context_path=str(ctx), auth_token="tok123")
        result = c.get("/api/health")
        assert result == {"ok": True}
        _, kwargs = mock_req.call_args
        assert kwargs["headers"]["Authorization"] == "Bearer tok123"


def test_client_dry_run_does_not_send_mutations(tmp_path, capsys):
    ctx = tmp_path / "context.json"
    ctx.write_text(json.dumps({
        "currentProfile": "aicos",
        "profiles": {"aicos": {"apiBase": "http://1.2.3.4:3100", "companyId": "abc"}},
    }))
    with patch("scripts.aicos.aicos_client.requests.request") as mock_req:
        c = AicosClient(context_path=str(ctx), auth_token="tok123", dry_run=True)
        c.patch("/api/agents/x", body={"adapterConfig": {"model": "y"}})
        mock_req.assert_not_called()
        captured = capsys.readouterr()
        assert "DRY-RUN PATCH" in captured.out
