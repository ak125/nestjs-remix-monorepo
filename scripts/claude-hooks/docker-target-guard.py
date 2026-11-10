#!/usr/bin/env python3
"""Conservative Docker target check for the Bash hook; never executes input.

This is not a general shell parser or an authorization service. Only literal
simple commands are accepted. Ambiguous shell input remains blocked. Docker
inspection is read-only, excludes Env, and is restricted to the local DEV daemon.
"""
import json
import os
from pathlib import Path
import re
import shlex
import shutil
import socket
import subprocess
import sys
import time


class GuardError(Exception):
    pass


PROTECTED = re.compile(r"prod|nestjs-remix|automecanik", re.I)
FULL_ID = re.compile(r"[0-9a-f]{64}\Z")
DOCKER = "/usr/bin/docker"
FORMAT = ('{"Id":{{json .Id}},"Name":{{json .Name}},'
          '"Image":{{json .Config.Image}},"Labels":{{json .Config.Labels}},'
          '"HostConfig":{"NetworkMode":{{json .HostConfig.NetworkMode}},'
          '"Privileged":{{json .HostConfig.Privileged}},'
          '"PublishAllPorts":{{json .HostConfig.PublishAllPorts}},'
          '"PortBindings":{{json .HostConfig.PortBindings}},'
          '"RestartPolicy":{{json .HostConfig.RestartPolicy}},'
          '"CapAdd":{{json .HostConfig.CapAdd}},'
          '"PidMode":{{json .HostConfig.PidMode}},'
          '"IpcMode":{{json .HostConfig.IpcMode}}},'
          '"Mounts":{{json .Mounts}}}')


class DockerInspector:
    def __init__(self):
        self.deadline = time.monotonic() + 12

    def read(self, args):
        remaining = self.deadline - time.monotonic()
        if remaining <= 0:
            raise GuardError("inspection Docker hors delai")
        try:
            result = subprocess.run([DOCKER, *args], capture_output=True,
                                    text=True, timeout=min(3, remaining), check=True)
        except (OSError, subprocess.SubprocessError):
            # Never copy daemon stderr or environment values into diagnostics.
            raise GuardError("inspection Docker indisponible") from None
        if len(result.stdout) > 262144:
            raise GuardError("inspection Docker trop volumineuse")
        return result.stdout.strip()

    def check_daemon(self):
        if shutil.which("docker") != DOCKER:
            raise GuardError("executable Docker non qualifiable")
        if any(os.environ.get(k) for k in ("DOCKER_CONFIG", "BASH_ENV", "ENV")) or any(k.startswith("BASH_FUNC_") for k in os.environ):
            raise GuardError("environnement Docker non qualifiable")
        if socket.gethostname() != "dev-automecanik":
            raise GuardError("hote hors DEV : intervention manuelle requise")
        if os.environ.get("DOCKER_HOST", "unix:///var/run/docker.sock") != "unix:///var/run/docker.sock":
            raise GuardError("endpoint Docker non local")
        if os.environ.get("DOCKER_CONTEXT", "default") != "default":
            raise GuardError("contexte Docker non local")
        if self.read(["context", "show"]) != "default":
            raise GuardError("contexte Docker non local")
        endpoint = self.read(["context", "inspect", "default", "--format", "{{.Endpoints.docker.Host}}"])
        if endpoint != "unix:///var/run/docker.sock":
            raise GuardError("endpoint Docker non local")
        if self.read(["info", "--format", "{{.Name}}"]) != "dev-automecanik":
            raise GuardError("identite du daemon hors DEV")

    def inspect(self, target):
        try:
            return json.loads(self.read(["inspect", "--type", "container", "--format", FORMAT, target]))
        except (ValueError, TypeError):
            raise GuardError("identite Docker illisible") from None


def literal_commands(command):
    # shlex tokenizes a deliberately small grammar; it does not validate Bash.
    # Reject expansion and metaprogramming before tokenization, even in quotes.
    if any(c in command for c in ("$", "`", "*", "?", "[", "]", "{", "}", "\x00")):
        raise GuardError("syntaxe Docker dynamique non qualifiable")
    lexer = shlex.shlex(command, posix=True, punctuation_chars=";&|<>()\n")
    lexer.whitespace = " \t\r"
    lexer.whitespace_split = True
    lexer.commenters = "#"
    try:
        tokens = list(lexer)
    except ValueError:
        raise GuardError("syntaxe Docker illisible") from None
    parts, part = [], []
    for token in tokens:
        if token in (";", "&&", "||", "\n") or token and set(token) == {"\n"}:
            if part:
                parts.append(part)
                part = []
        elif token in ("|", "&", "<", ">", "(", ")") or (token and set(token) <= set(";&|<>()\n")):
            raise GuardError("composition Docker non qualifiable")
        else:
            part.append(token)
    if part:
        parts.append(part)
    return parts


def target_ids(args):
    if args and args[0] == "container":
        args = args[1:]
    if not args or args[0] not in ("stop", "rm"):
        raise GuardError("operation Docker non qualifiable : utiliser une cible explicite")
    operation, args = args[0], args[1:]
    targets, options = [], True
    while args:
        arg, args = args[0], args[1:]
        if arg == "--" and options:
            options = False
            continue
        if options and operation == "stop" and arg in ("-t", "--time"):
            if not args or not args[0].isdigit() or not 1 <= int(args[0]) <= 30:
                raise GuardError("delai Docker absent ou non borne")
            args = args[1:]
            continue
        if options and operation == "stop" and arg.startswith("--time="):
            value = arg.partition("=")[2]
            if not value.isdigit() or not 1 <= int(value) <= 30:
                raise GuardError("delai Docker non borne")
            continue
        if PROTECTED.search(arg):
            raise GuardError("cible PROD/protegee : intervention manuelle requise")
        if not FULL_ID.fullmatch(arg):
            raise GuardError("cible Docker non qualifiable : ID complet requis")
        targets.append(arg)
    if not targets or len(targets) > 16 or len(set(targets)) != len(targets):
        raise GuardError("liste de cibles Docker invalide")
    return targets


def isolated_target(target, inspector, checked, visiting):
    if target in checked:
        return
    if target in visiting or len(visiting) >= 4 or not FULL_ID.fullmatch(target):
        raise GuardError("namespace Docker non qualifiable")
    visiting.add(target)
    value = inspector.inspect(target)
    if not isinstance(value, dict) or value.get("Id") != target:
        raise GuardError("identite Docker differente ou inconnue")
    for key in ("Name", "Image"):
        if not isinstance(value.get(key), str) or not value[key]:
            raise GuardError("identite Docker incomplete")
    labels = value.get("Labels")
    if not isinstance(labels, dict):
        raise GuardError("labels Docker illisibles")
    if PROTECTED.search(json.dumps({k: value[k] for k in ("Name", "Image", "Labels")})):
        raise GuardError("cible PROD/protegee : intervention manuelle requise")
    config = value.get("HostConfig")
    if not isinstance(config, dict):
        raise GuardError("configuration Docker absente")
    required = ("NetworkMode", "Privileged", "PublishAllPorts", "PortBindings", "RestartPolicy", "CapAdd", "PidMode", "IpcMode")
    if any(key not in config for key in required):
        raise GuardError("configuration Docker incomplete")
    if config.get("Privileged") is not False or config.get("PublishAllPorts") is not False:
        raise GuardError("isolation Docker insuffisante")
    if config.get("PortBindings") not in ({}, None) or config.get("CapAdd") not in ([], None):
        raise GuardError("ports ou capacites Docker non isoles")
    if config.get("PidMode") not in ("", None) or config.get("IpcMode") not in ("", "private", "none"):
        raise GuardError("namespace hote non admissible")
    if config.get("RestartPolicy", {}).get("Name") not in ("no", ""):
        raise GuardError("redemarrage automatique non admissible")
    mounts = value.get("Mounts")
    if not isinstance(mounts, list):
        raise GuardError("montages Docker inconnus")
    for mount in mounts:
        if not isinstance(mount, dict) or type(mount.get("RW")) is not bool:
            raise GuardError("montage Docker illisible")
        source = mount.get("Source")
        if not isinstance(source, str) or not source.startswith("/"):
            raise GuardError("source de montage inconnue")
        path = Path(source).resolve()
        if str(path) in ("/var/run/docker.sock", "/run/docker.sock"):
            raise GuardError("socket Docker monte : isolation insuffisante")
        if mount["RW"] and (mount.get("Type") != "bind" or not path.is_relative_to("/home/deploy") or str(path) == "/home/deploy"):
            raise GuardError("montage ecrivable hors espace DEV prive")
    network = config.get("NetworkMode")
    if network == "none":
        pass
    elif isinstance(network, str) and network.startswith("container:"):
        isolated_target(network.partition(":")[2], inspector, checked, visiting)
    else:
        raise GuardError("reseau Docker non isole")
    visiting.remove(target)
    checked.add(target)


def assess(command, inspector=None):
    targets = []
    for args in literal_commands(command):
        if args[0] in ("printf", "echo", ":", "true", "pwd"):
            # Literal output is data, not a command. No eval, redirection or pipe.
            if args[0] == "printf" and len(args) > 1 and args[1].startswith("-v"):
                raise GuardError("affectation printf non admissible")
            continue
        if args[0] == "cd" and len(args) == 2 and args[1].startswith("/"):
            continue
        if args[0] not in ("docker", DOCKER):
            raise GuardError("commande composee ou interpreteur non qualifiable")
        targets.extend(target_ids(args[1:]))
    if targets:
        inspector = inspector or DockerInspector()
        inspector.check_daemon()
        checked = set()
        for target in targets:
            isolated_target(target, inspector, checked, set())


def main():
    try:
        command = json.load(sys.stdin)
        if not isinstance(command, str) or not command.strip():
            raise GuardError("commande absente")
        assess(command)
        return 0
    except GuardError as error:
        print("BLOCKED: " + str(error) + ".", file=sys.stderr)
    except Exception:
        print("BLOCKED: analyse Docker en erreur ; echec ferme.", file=sys.stderr)
    return 2


if __name__ == "__main__":
    sys.exit(main())
