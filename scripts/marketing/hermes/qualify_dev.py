"""Run with installed Hermes Python: qualify_dev.py OUTPUT [CHECK ...].

Select failed checks without overwriting or repeating earlier evidence.
"""
import json
from pathlib import Path
import sys

sys.path.insert(0, '/home/hermes/.hermes/hermes-agent')
import hermes_bootstrap  # noqa: F401
from marketing_dev import execute

destination = Path(sys.argv[1])
assert not destination.exists(), 'Preserve existing evidence'
cli = 'node node_modules/tsx/dist/cli.mjs --tsconfig scripts/marketing/tsconfig.json scripts/marketing/run-reactivation-pilot.ts '
checks = [
    ('reactivation', cli + '--inactive-days 180'),
    ('segment', cli + '--segment'),
    ('scenarios', cli + '--all-scenarios'),
    ('report', cli + '--report'),
    ('typecheck', 'node node_modules/typescript/bin/tsc -p scripts/marketing/tsconfig.json --pretty false'),
    ('tests', 'TSX_TSCONFIG_PATH=scripts/marketing/tsconfig.json node --import tsx --test scripts/marketing/reactivation-pilot.test.ts scripts/marketing/marketing-workbench.test.ts scripts/marketing/marketing-operations.test.ts scripts/marketing/marketing-measurement.test.ts scripts/marketing/reactivation-runtime.test.mjs'),
]
records = []
selected = sys.argv[2:]
assert not set(selected) - {name for name, _ in checks}, 'Unknown check'
for name, command in checks:
    if selected and name not in selected:
        continue
    result = json.loads(execute({'command': command, 'timeout': 180}))
    records.append({'check': name, 'command': command, **result})
    destination.write_text(json.dumps(records, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'check': name, 'success': result['success'], 'returncode': result.get('returncode'),
                      'output_tail': result.get('output', '')[-1100:] if name == 'tests' or not result['success'] else ''}), flush=True)
    assert result['success'], 'Check failed; evidence preserved'
    if name not in {'tests', 'typecheck'}:
        json.loads(result['output'])
