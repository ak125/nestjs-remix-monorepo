#!/usr/bin/env python3
"""Offline target-guard regression tests: no Docker command is executed."""
import copy
import importlib.util
import pathlib
import sys
import unittest

MODULE_PATH = pathlib.Path(__file__).with_name("docker-target-guard.py")
spec = importlib.util.spec_from_file_location("docker_target_guard_under_test", MODULE_PATH)
guard = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = guard
spec.loader.exec_module(guard)

A, B, C = "a" * 64, "b" * 64, "c" * 64
SECRET = "PRIVATE_VALUE_MUST_NOT_APPEAR_IN_DIAGNOSTICS"

def private(cid=A):
    return {
        "Id": cid, "Name": "/isolated-bench-" + cid[:8],
        "Image": "sha256:" + "d" * 64, "Labels": {"purpose": "isolated-test"},
        "HostConfig": {
            "NetworkMode": "none", "Privileged": False, "PublishAllPorts": False,
            "PortBindings": {}, "RestartPolicy": {"Name": "no", "MaximumRetryCount": 0},
            "CapAdd": None, "PidMode": "", "IpcMode": "private",
        },
        "Mounts": [
            {"Type": "bind", "Source": "/home/deploy/isolated-bench/data", "RW": True},
            {"Type": "bind", "Source": "/opt/automecanik/app/node_modules", "RW": False},
        ],
    }

class FakeInspector:
    def __init__(self, rows=None, daemon_error=None):
        self.rows = copy.deepcopy(rows if rows is not None else {A: private()})
        self.daemon_error = daemon_error
        self.daemon_checks = 0
        self.inspected = []

    def check_daemon(self):
        self.daemon_checks += 1
        if self.daemon_error is not None:
            raise self.daemon_error

    def inspect(self, full_id):
        self.inspected.append(full_id)
        if full_id not in self.rows:
            raise guard.GuardError("unknown target")
        return copy.deepcopy(self.rows[full_id])

class TargetGuardTests(unittest.TestCase):
    def allow(self, command, inspector=None):
        probe = inspector or FakeInspector()
        self.assertIsNone(guard.assess(command, inspector=probe))
        return probe

    def block(self, command, inspector=None):
        probe = inspector or FakeInspector()
        with self.assertRaises(guard.GuardError) as caught:
            guard.assess(command, inspector=probe)
        self.assertNotIn(SECRET, str(caught.exception))
        return probe

    def test_01_literal_dev_stop_qualifies_target_and_daemon(self):
        p = self.allow("docker stop " + A)
        self.assertGreater(p.daemon_checks, 0)
        self.assertIn(A, p.inspected)

    def test_02_documentation_is_inert_without_inspection(self):
        p = self.allow("printf '%s\\n' 'docker stop automecanik-prod'")
        self.assertEqual(p.inspected, [])

    def test_03_path_and_comment_are_not_target_identity(self):
        self.allow("cd /opt/automecanik/app; docker stop " + A + " # prod documentation")

    def test_04_all_multiple_targets_are_inspected(self):
        p = self.allow("docker stop " + A + " " + B,
                       FakeInspector({A: private(A), B: private(B)}))
        self.assertEqual(set(p.inspected), {A, B})

    def test_05_one_foreign_target_blocks_whole_command(self):
        bad = private(B)
        bad["Name"] = "/production-live"
        self.block("docker stop " + A + " " + B,
                   FakeInspector({A: private(A), B: bad}))

    def test_06_namespace_chain_is_qualified(self):
        a, b, c = private(A), private(B), private(C)
        a["HostConfig"]["NetworkMode"] = "container:" + B
        b["HostConfig"]["NetworkMode"] = "container:" + C
        p = self.allow("docker stop " + A, FakeInspector({A: a, B: b, C: c}))
        self.assertEqual(set(p.inspected), {A, B, C})

    def test_07_foreign_namespace_blocks_child(self):
        a, b = private(A), private(B)
        a["HostConfig"]["NetworkMode"] = "container:" + B
        b["Name"] = "/automecanik-live"
        self.block("docker stop " + A, FakeInspector({A: a, B: b}))

    def test_08_namespace_cycle_is_rejected(self):
        a, b = private(A), private(B)
        a["HostConfig"]["NetworkMode"] = "container:" + B
        b["HostConfig"]["NetworkMode"] = "container:" + A
        self.block("docker stop " + A, FakeInspector({A: a, B: b}))

    def test_09_unknown_namespace_is_rejected(self):
        a = private()
        a["HostConfig"]["NetworkMode"] = "container:" + B
        self.block("docker stop " + A, FakeInspector({A: a}))

    def test_10_daemon_failure_or_wrong_host_is_rejected(self):
        for reason in ("daemon unavailable", "unexpected host", "nonlocal endpoint"):
            with self.subTest(reason=reason):
                self.block("docker stop " + A,
                           FakeInspector(daemon_error=guard.GuardError(reason)))

    def test_11_unknown_target_is_rejected(self):
        self.block("docker stop " + B)

    def test_12_inspection_id_must_match_requested_id(self):
        self.block("docker stop " + A, FakeInspector({A: private(B)}))

    def test_13_prod_markers_in_name_image_or_labels(self):
        for field, value in (
            ("Name", "/prod"), ("Name", "/nestjs-remix-live"),
            ("Name", "/AUTOMECANIK-live"), ("Image", "registry/project:production"),
            ("Labels", {"environment": "prod"}),
            ("Labels", {"automecanik.owner": "team"}),
        ):
            with self.subTest(field=field, value=value):
                row = private()
                row[field] = value
                self.block("docker stop " + A, FakeInspector({A: row}))

    def test_14_isolation_fields_fail_closed(self):
        changes = (
            ("NetworkMode", "host"), ("NetworkMode", "bridge"),
            ("Privileged", True), ("PublishAllPorts", True),
            ("PortBindings", {"3000/tcp": [{"HostPort": "3000"}]}),
            ("RestartPolicy", {"Name": "always"}),
            ("CapAdd", ["SYS_ADMIN"]), ("PidMode", "host"), ("IpcMode", "host"),
        )
        for key, value in changes:
            with self.subTest(key=key):
                row = private()
                row["HostConfig"][key] = value
                self.block("docker stop " + A, FakeInspector({A: row}))

    def test_15_missing_identity_or_isolation_metadata_is_rejected(self):
        for key in ("Id", "Name", "Image", "Labels", "HostConfig", "Mounts"):
            with self.subTest(key=key):
                row = private()
                del row[key]
                self.block("docker stop " + A, FakeInspector({A: row}))

    def test_16_writable_mount_outside_private_root_is_rejected(self):
        for source in ("/opt/automecanik/app", "/var/run/docker.sock",
                       "/home/deploy-other/data", "/home/deploy/../../etc"):
            with self.subTest(source=source):
                row = private()
                row["Mounts"] = [{"Type": "bind", "Source": source, "RW": True}]
                self.block("docker stop " + A, FakeInspector({A: row}))

    def test_17_unknown_mount_type_is_rejected(self):
        row = private()
        row["Mounts"] = [{"Type": "volume", "Source": "unqualified", "RW": True}]
        self.block("docker stop " + A, FakeInspector({A: row}))

    def test_18_refusal_does_not_dump_metadata(self):
        row = private()
        row["Labels"] = {"environment": "prod", "private": SECRET}
        self.block("docker stop " + A, FakeInspector({A: row}))

    def test_19_foreign_second_sequence_target_is_rejected(self):
        row = private(B)
        row["Name"] = "/prod-api"
        self.block("docker stop " + A + "; docker stop " + B,
                   FakeInspector({A: private(), B: row}))

    def test_46_printf_assignment_to_docker_host_is_rejected(self):
        self.block("printf -v DOCKER_HOST '%s' 'tcp://remote:2375'; docker stop " + A)

    def test_47_printf_attached_assignment_to_docker_host_is_rejected(self):
        self.block("printf -vDOCKER_HOST '%s' 'tcp://remote:2375'; docker stop " + A)

    def test_48_each_missing_host_config_field_is_rejected(self):
        for field in private()["HostConfig"]:
            with self.subTest(field=field):
                row = private()
                del row["HostConfig"][field]
                self.block("docker stop " + A, FakeInspector({A: row}))

# Each row creates a named unittest case; malformed shell is never executed.
CASES = [
    ("20_container_stop", "docker container stop " + A, True),
    ("21_bounded_short_time", "docker stop -t 10 " + A, True),
    ("22_bounded_long_time", "docker stop --time 30 -- " + A, True),
    ("23_plain_rm", "docker rm " + A, True),
    ("24_container_rm", "docker container rm -- " + A, True),
    ("25_pure_echo_then_stop", "echo 'automecanik doc'; docker stop " + A, True),
    ("26_short_id", "docker stop " + A[:12], False),
    ("27_name_is_not_id", "docker stop isolated-bench", False),
    ("28_missing_target", "docker stop", False),
    ("29_force_rm", "docker rm -f " + A, False),
    ("30_volume_rm", "docker rm --volumes " + A, False),
    ("31_unbounded_stop_time", "docker stop -t 31 " + A, False),
    ("32_zero_stop_time", "docker stop --time 0 " + A, False),
    ("33_compose_down", "docker compose down", False),
    ("34_legacy_compose_down", "docker-compose down", False),
    ("35_variable_target", "docker stop $TARGET", False),
    ("36_command_substitution", "docker stop $(docker ps -q)", False),
    ("37_backticks", "docker stop `docker ps -q`", False),
    ("38_glob", "docker stop " + A + "*", False),
    ("39_pipe", "docker stop " + A + " | cat", False),
    ("40_redirect", "docker stop " + A + " > /tmp/out", False),
    ("41_heredoc", "docker stop " + A + " <<EOF\nx\nEOF", False),
    ("42_shell_wrapper", "sh -c 'docker stop " + A + "'", False),
    ("43_remote_endpoint", "docker -H tcp://remote:2375 stop " + A, False),
    ("44_malformed_quote", "docker stop '" + A, False),
    ("45_unknown_command_sequence", "unknown-command; docker stop " + A, False),
]

def make_case(command, allowed):
    def test(self):
        (self.allow if allowed else self.block)(command)
    return test

for name, command, allowed in CASES:
    setattr(TargetGuardTests, "test_" + name, make_case(command, allowed))

if __name__ == "__main__":
    unittest.main(verbosity=2)
