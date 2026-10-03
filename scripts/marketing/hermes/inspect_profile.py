"""Read native tool discovery for the current HERMES_HOME, without a model turn."""
import json
import os
from pathlib import Path
import sys

sys.path.insert(0, sys.argv[1])
import hermes_bootstrap  # noqa: F401
import hermes_yaml as yaml
from hermes_cli.plugins import discover_plugins
from model_tools import get_tool_definitions

profile = Path(os.environ["HERMES_HOME"])
config = yaml.safe_load((profile / "config.yaml").read_text())
discover_plugins()
result = {}
for surface, groups in (("default", config["toolsets"]), ("cli", config["platform_toolsets"]["cli"]), ("telegram", config["platform_toolsets"]["telegram"])):
    definitions = get_tool_definitions(enabled_toolsets=groups, disabled_toolsets=config["agent"]["disabled_toolsets"], quiet_mode=True)
    result[surface] = sorted(item["function"]["name"] for item in definitions)
Path(sys.argv[2]).write_text(json.dumps(result, indent=2) + "\n")
print(json.dumps(result))
