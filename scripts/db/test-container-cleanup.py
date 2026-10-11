#!/usr/bin/env python3
"""Exercise real test-script cleanup, before any SQL, against local Docker.

Opt in: RUN_DOCKER_CLEANUP_TESTS=1 python3 scripts/db/test-container-cleanup.py
Requires an already-present postgres:17-alpine image. No pull or shared DB.
The DEBUG hook ends the real script at its first docker exec; its EXIT trap
still runs normally. Check Docker resources, not shell source spelling.
"""
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest
import uuid


SCRIPTS = [
    "test-cancel-order-atomic-refuse-paid.sh",
    "test-cwv-daily-rum-exact-p75.sh",
    "test-cwv-trend-detector-vacancy.sh",
    "test-diag-capture-maintenance-schema.sh",
    "test-diag-link-provenance.sh",
    "test-kg-maintenance-schedule-fuel-filter.sh",
    "test-seo-gsc-page-totals-migrations.sh",
    "test-tecdoc-api-surface-lockdown.sh",
    "test-vehicle-cache-trigger-observable.sh",
]
HOOK = r'''
set -T
probe_boundary() {
    case "$1" in
        *docker\ run*)
            if [[ -n "$PROBE_COLLISION" ]]; then CT="$PROBE_COLLISION"; fi
            ;;
        docker\ exec*)
            command docker inspect --format '{{.Id}}' "$CT" > "$PROBE_DIR/id"
            command docker inspect --format '{{json .Mounts}}' "$CT" > "$PROBE_DIR/mounts"
            exit "$PROBE_EXIT"
            ;;
    esac
}
trap 'probe_boundary "$BASH_COMMAND"' DEBUG
source "$PROBE_SCRIPT"
'''


def docker(*args, check=True):
    return subprocess.run(["docker", *args], capture_output=True, text=True,
                          check=check, timeout=30)


@unittest.skipUnless(os.environ.get("RUN_DOCKER_CLEANUP_TESTS") == "1",
                     "explicit Docker test opt-in required")
class ContainerCleanup(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Resolve once; tests must not pull or follow a moving image tag.
        cls.image = json.loads(docker("image", "inspect", "postgres:17-alpine").stdout)[0]["Id"]

    def run_case(self, filename, status, collision=False):
        sentinel = None
        volumes = []
        owned_id = None
        with tempfile.TemporaryDirectory(prefix="db-cleanup-probe-") as tmp:
            try:
                if collision:
                    sentinel = "db-cleanup-sentinel-" + uuid.uuid4().hex
                    owned_id = docker("run", "-d", "--network", "none", "--memory", "128m",
                                      "--name", sentinel, "--entrypoint", "/bin/sh",
                                      self.image, "-c", "sleep 120").stdout.strip()
                    mounts = json.loads(docker("inspect", "--format", "{{json .Mounts}}", owned_id).stdout)
                    volumes = [m["Name"] for m in mounts if m["Type"] == "volume"]
                env = dict(os.environ, PGIMAGE=self.image, PROBE_DIR=tmp,
                           PROBE_SCRIPT=str(Path(__file__).with_name(filename)),
                           PROBE_EXIT=str(status), PROBE_COLLISION=sentinel or "")
                result = subprocess.run(["bash", "-c", HOOK], env=env,
                                        capture_output=True, text=True, timeout=35)
                if collision:
                    self.assertEqual(result.returncode, 2, result.stderr)
                    self.assertEqual(docker("inspect", owned_id, check=False).returncode, 0,
                                     "failed creation deleted a pre-existing container")
                else:
                    self.assertTrue(Path(tmp, "id").exists(), result.stdout + result.stderr)
                    owned_id = Path(tmp, "id").read_text().strip()
                    mounts = json.loads(Path(tmp, "mounts").read_text())
                    volumes = [m["Name"] for m in mounts if m["Type"] == "volume"]
                    self.assertTrue(volumes, "probe must exercise an anonymous volume")
                    self.assertEqual(result.returncode, status, result.stderr)
                    self.assertNotEqual(docker("inspect", owned_id, check=False).returncode, 0,
                                        "test container leaked")
                    for volume in volumes:
                        self.assertNotEqual(docker("volume", "inspect", volume, check=False).returncode, 0,
                                            "anonymous volume leaked: " + volume)
            finally:
                # Only resources created by this test; never prune global state.
                if owned_id:
                    docker("rm", "-fv", owned_id, check=False)
                for volume in volumes:
                    docker("volume", "rm", volume, check=False)

    def test_exit_removes_owned_container_and_anonymous_data(self):
        for filename in SCRIPTS:
            for status in (0, 37):
                with self.subTest(script=filename, exit=status):
                    self.run_case(filename, status)

    def test_failed_creation_preserves_preexisting_container(self):
        for filename in SCRIPTS:
            with self.subTest(script=filename):
                self.run_case(filename, 2, collision=True)


if __name__ == "__main__":
    unittest.main(verbosity=2)
