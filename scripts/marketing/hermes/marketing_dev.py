"""A1 marketing execution through Hermes' installed bounded terminal.

No new executor: reuse its OS sandbox, timeout, output collector and lock.
The fixed source export is an editable candidate, never an active skill release.
"""
import hashlib
import importlib.util
import json
from pathlib import Path

PROFILE = Path('/home/hermes/.hermes/profiles/orchestration-automecanik-pilot')
WORKSPACE = PROFILE / 'workspace/marketing-dev'
PROVIDER = Path('/opt/codex-project-tools/bounded-terminal-20260930/__init__.py')
PROVIDER_SHA256 = '6a544d1daf326be2e61c300613a63d351a56651cdff87a72149580091274e8ca'


def execute(arguments, **context):
    environment = None
    try:
        from hermes_constants import get_hermes_home
        if get_hermes_home().resolve() != PROFILE:
            raise ValueError('profile_denied')
        if not isinstance(arguments, dict) or set(arguments) - {'command', 'timeout'}:
            raise ValueError('invalid_arguments')
        command = arguments.get('command')
        timeout = arguments.get('timeout', 60)
        if not isinstance(command, str) or not command.strip() or len(command) > 16384 or '\0' in command:
            raise ValueError('invalid_command')
        if type(timeout) is not int or not 1 <= timeout <= 180:
            raise ValueError('invalid_timeout')
        for path in (WORKSPACE, WORKSPACE / 'SOURCE.json', WORKSPACE / '.git', PROVIDER):
            if path.is_symlink() or path.stat().st_uid != 0 or path.stat().st_mode & 0o022:
                raise ValueError('installation_permissions_changed')
        if hashlib.sha256(PROVIDER.read_bytes()).hexdigest() != PROVIDER_SHA256:
            raise ValueError('bounded_provider_changed')
        spec = importlib.util.spec_from_file_location('amk_bounded_terminal', PROVIDER)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        environment = module.BoundedEnvironment(WORKSPACE, timeout)
        # The prefix executes INSIDE the existing sandbox. No host shell, env or
        # credentials are inherited. Bash remains available for real A1 edits.
        result = environment.execute(
            'export PATH=/workspace/.runtime/bin:/usr/bin:/bin GIT_OPTIONAL_LOCKS=0;\n' + command,
            timeout=timeout,
        )
        return json.dumps({'success': result.get('returncode') == 0, **result,
                           'workspace': '/workspace', 'candidate': True,
                           'source_commit': json.loads((WORKSPACE / 'SOURCE.json').read_text())['source_commit'],
                           'active_skill_changed': False, 'commercial_execution': False}, ensure_ascii=False)
    except (OSError, ValueError, TypeError, ImportError, KeyError) as error:
        return json.dumps({'success': False, 'error': str(error), 'candidate': True})
    finally:
        if environment is not None:
            environment.cleanup()


DESCRIPTION = (
    'Execute A1 AutoMecanik marketing commands and edit/test candidates directly in the fixed DEV sandbox. '
    'Foreground only, max 180 seconds. No host files, credentials or network. '
    'Writable: scripts/marketing, the four candidate amk skill directories, artifacts/. '
    'Backend helpers, dependencies, SOURCE.json and Git baseline are read-only. '
    'Run the existing CLI with node node_modules/tsx/dist/cli.mjs --tsconfig scripts/marketing/tsconfig.json '
    'scripts/marketing/run-reactivation-pilot.ts --help. Fixed synthetic fixtures only. '
    'Use git diff and git show HEAD:path to inspect/restore candidates; preserve useful changes in artifacts/. '
    'A green candidate test is not approval or promotion. Use existing Codex contracts only when their scope fits.'
)


def guidance(info):
    from hermes_constants import get_hermes_home
    if get_hermes_home().resolve() != PROFILE:
        return ''
    return (
        'Marketing A1 is authorized: use automecanik_marketing_dev for calculations, simulations, candidate edits '
        'and tests; do not delegate a routine supported CLI command. Start with SOURCE.json, git status and the CLI help. '
        'The CLI source snapshot is separate from active skills. Follow the verified active skills and report any drift. '
        'Read result.returncode and output; command success alone is not a business validation. '
        'Save a review dossier with exclusions, variants, simulations, test evidence, missing data and approval limits '
        'using automecanik_marketing_workspace. Candidate tests and skill edits never promote themselves. '
        'For an integration outside these writable paths, prepare a precise handoff with diff and reproduction; '
        'a genuine new anomaly can use codex_automecanik_diagnostic when available; '
        'existing automecanik_dev requests require an eligible diagnostic case from its context. '
        'A new feature outside that contract needs a reviewable handoff, not a fabricated diagnostic. '
        'Never claim that saving a handoff '
        'started Codex. No new mission is needed for an already tracked case. No real send, publication or PROD.'
    )


def register(ctx):
    schema = {'name': 'automecanik_marketing_dev', 'description': DESCRIPTION,
              'parameters': {'type': 'object', 'additionalProperties': False,
                             'properties': {'command': {'type': 'string', 'maxLength': 16384},
                                            'timeout': {'type': 'integer', 'minimum': 1, 'maximum': 180}},
                             'required': ['command']}}
    ctx.register_tool(name=schema['name'], toolset='automecanik_marketing', schema=schema,
                      handler=execute, description=DESCRIPTION)
    ctx.register_system_prompt_section('automecanik-marketing-a1', guidance, position='after_memory', max_chars=2200)
