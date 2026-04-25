"""Tiny HTTP client for the AI-COS Paperclip API. Used by sync + smoke scripts."""
import json
import os
import sys
import requests
from typing import Any


class AicosAuthError(Exception):
    pass


class AicosClient:
    DEFAULT_CONTEXT = "/home/deploy/.paperclip/context.json"

    def __init__(
        self,
        context_path: str | None = None,
        auth_token: str | None = None,
        dry_run: bool = False,
    ):
        self.dry_run = dry_run
        path = context_path or self.DEFAULT_CONTEXT
        with open(path) as f:
            ctx = json.load(f)
        profile = ctx["profiles"][ctx["currentProfile"]]
        self.api_base = profile["apiBase"].rstrip("/")
        self.company_id = profile["companyId"]
        token = auth_token or os.environ.get("PAPERCLIP_BOARD_TOKEN")
        if not token:
            raise AicosAuthError(
                "No auth token. Set PAPERCLIP_BOARD_TOKEN env var or pass auth_token=."
            )
        self.auth_token = token

    def _request(self, method: str, path: str, body: Any = None) -> dict:
        url = f"{self.api_base}{path}"
        if self.dry_run and method.upper() not in ("GET", "HEAD"):
            print(f"DRY-RUN {method.upper()} {url}")
            if body is not None:
                print(json.dumps(body, indent=2))
            return {"dry_run": True}
        headers = {
            "Authorization": f"Bearer {self.auth_token}",
            "Content-Type": "application/json",
        }
        resp = requests.request(method, url, json=body, headers=headers, timeout=30)
        if resp.status_code >= 400:
            print(
                f"ERROR {method} {url} -> {resp.status_code} {resp.text}",
                file=sys.stderr,
            )
            resp.raise_for_status()
        return resp.json() if resp.text else {}

    def get(self, path: str) -> dict:
        return self._request("GET", path)

    def post(self, path: str, body: Any) -> dict:
        return self._request("POST", path, body)

    def patch(self, path: str, body: Any) -> dict:
        return self._request("PATCH", path, body)

    def put(self, path: str, body: Any) -> dict:
        return self._request("PUT", path, body)
