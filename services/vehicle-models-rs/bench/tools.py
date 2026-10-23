#!/usr/bin/env python3
"""Outils du banc d'essai vehicle-models-rs (hors production), appelés par bench.sh.

envexec <fichier_env> <commande…>
    exécute la commande avec les seules variables de connexion lues dans le fichier,
    sans écraser l'environnement existant (aucune valeur n'est affichée).
sample <sortie.json> <durée_s> <nom=pid>…
    CPU (utime+stime) et VmRSS à 1 Hz de chaque processus, VmHWM en fin, CPU et
    memory.peak du cgroup du premier processus ; durée 0 = un seul relevé de RSS.
    Variables facultatives (campagne v3) : SAMPLE_CPUS (CPU des cibles : temps
    occupé lu dans /proc/stat, part étrangère au cgroup) ; SAMPLE_WATCH (fichier de
    progression du générateur : conditions d'arrêt de PROTOCOL-v3.md, arrêt du
    générateur par <fichier>.stop) ; SAMPLE_PLATEAU=<début_s>:<fenêtre_s>:<seuil>
    (arrêt quand la pente RSS de chaque processus et du total reste, en valeur
    absolue, sous <seuil> Mo/min sur la fenêtre ; vérifié chaque minute après <début_s>).
    Campagne v4 (PROTOCOL-v4.md) : SAMPLE_SERIES=<fichier.jsonl> (une ligne par relevé,
    écrite aussitôt : RSS et CPU des processus, memory.current et CPU du cgroup ; toutes
    les 10 s en plus memory.stat, memory.events, memory.events.local, memory.swap.current,
    processus du cgroup, MemAvailable, charge et occupation de chaque CPU de la VM) ;
    SAMPLE_LOAD_STOP=0 (sans arrêt sur erreurs ni sur absence de requêtes : la passe
    continue et ces faits sont des résultats ; les autres conditions restent).
cgsnap <sortie.json> <pid>
    instantané du cgroup du processus : memory.* (current, max, peak, stat, events,
    events.local, swap.*), cpu.stat, processus (pid, nom, ligne de commande), sous-cgroups.
upstreams <dossier_passe> <amont_attendu>
    amont de chaque requête de la route dans le journal Caddy de la passe,
    fichiers tournés compris ; échec si une requête de la route a un autre amont.
brief <result.json> <nom>
    une ligne de résumé de la passe ; échec si la destination est erronée.
foreign-ok <result.json>
    échec si la CPU des voisins sur les CPU cibles dépasse NEIGHBOUR_CPU_MAX_PCT.
compare <dossierA> <dossierB>
    statuts et corps identiques, hors champ `timestamp` des erreurs génériques.
stats-ok
    compteurs du rejeu lus sur l'entrée standard : échec si une clé manque ou si
    un en-tête diffère.
run <dossier_passe> <config> <latence_ms> <répétition>
    ligne JSON de résultats d'une passe de charge.
summary <results.jsonl>
    médianes et min–max par configuration et latence, puis dérive.
run4 <dossier_passe> <config> <latence_ms> <répétition>
    ligne JSON d'une passe v4 (PROTOCOL-v4.md) : comptes du générateur, fenêtres de
    10 min, CPU par requête réussie, mémoire du cgroup et RSS séparés, sonde Node,
    contrôles de collecte, issue (banc, application ou essai complet).
brief4 <result.json> <nom>
    une ligne de résumé d'une passe v4 ; échec si l'issue est un défaut du banc.
summary4 <results.jsonl>
    tableau et décision de la campagne v4 selon PROTOCOL-v4.md.
"""
import gzip
import hashlib
import json
import os
import pathlib
import re
import shutil
import subprocess
import statistics
import sys
import time

ENV_KEYS = (
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'SUPABASE_ANON_KEY',
    'READ_ONLY',
    'DEV_KILL_SWITCH',
    'DEV_SUPABASE_KEY',
)
CLK_TCK = os.sysconf('SC_CLK_TCK')
TIMESTAMP = re.compile(rb'"timestamp":"[^"]*"')
# Seuils d'arrêt d'une passe surveillée (PROTOCOL-v3.md).
STOP_ERROR_RATE = 0.01
STOP_WINDOW_S = 10
STOP_MEM_AVAILABLE_KB = 1024 * 1024
STOP_DISK_FREE_B = 2 * 2**30
# CPU des voisins (hors cgroup des cibles et hors fils noyau des CPU cibles) : au-delà, une passe
# est rejouée une fois puis écartée. Double du maximum relevé banc arrêté (PROTOCOL-v3.md).
NEIGHBOUR_CPU_MAX_PCT = 10.0
# Dispersion (max−min)/médiane au-delà de laquelle des plages qui se recouvrent rendent la
# comparaison inconclusive (PROTOCOL-v3.md, « Décision ») ; tirées de la campagne v2.
SPREAD_MAX_PCT = {key: 15.0 for key in ('cpu_ms_per_ok', 'idle_rss_mb', 'rss_mb_median', 'rss_mb_max',
                                         'cgroup_memory_peak_mb')}
MIN_VALID_RUNS = 3
# Route servie par l'amont choisi dans le Caddy du banc (même motif que Caddyfile.route).
ROUTE_PATH = re.compile(r'^/api/vehicles/brands/[^/]+/models/?$')

# Campagne v4 (PROTOCOL-v4.md, « Issues » et « Décision ») : seuils figés avant la première passe.
WINDOW_S = 600
STEADY_FROM_S = 600
MEMORY_FROM_S = 3600
SLOPE_TAIL_S = 1800
SLOPE_MAX_MB_PER_MIN = 1.0
SERVED_MIN = 0.99
SERVED_WINDOW_MIN = 0.95
LAG_P99_MAX_MS = 10.0
GAP_MAX_S = {'sample': 5.0, 'loadgen': 30.0, 'memprobe': 30.0}
# Écart minimal entre r2 et la référence Node : relatif et absolu, selon l'indicateur.
DIFF_MIN = {'memory_current_mb': (0.10, 10.0), 'memory_peak_mb': (0.10, 10.0), 'cpu_ms_per_ok': (0.10, 0.0),
            'p95_ms': (0.10, 1.0), 'p99_ms': (0.10, 1.0)}
# Diagnostic du limiteur 6.5.0 sur la passe a2 « diag » : D1 (cardinalité) et D2 (effet).
# La garde s'exécute deux fois par requête de la route en Node (catch-all Remix puis
# VehiclesController : deux clés et deux minuteries par palier), trace du 2026-10-22.
GUARD_RUNS_PER_REQUEST = 2
D1_MIN_RATIO = 0.9
D1_AT_S = 3500
D2_BEFORE = (2400, 3600)
D2_AFTER = (3700, 5400)
D2_CPU_RATIO = 1.15
D2_GC_RATIO = 2.0
# Amendement 2 : acceptation d'un limiteur corrigé par le test isolé (throttler-expiry-repro.js),
# fixée avant sa mesure. Pour chaque plafond de tas essayé : aucun écart entre relevés au-delà de
# 2 s, au moins 90 % des nouveaux coups prévus traités, 60 s observées après le début des expirations.
REPRO_GAP_MAX_MS = 2000
REPRO_DONE_MIN = 0.9
REPRO_AFTER_MIN_S = 60
# Seuls processus admis dans le cgroup des cibles pendant la mesure.
CGROUP_ALLOWED = (re.compile(r'^bash \S*/route\.sh _targets (a2|r2)$'), re.compile(r'^sleep 1$'),
                  re.compile(r'^node dist/main$'), re.compile(r'^\S*/vehicle-models-route$'))
# Amendement 3 : processus relevé pendant sa sortie, ligne de commande vide, identifié par son nom
# noyau (15 caractères au plus). Admis seulement si ce nom est celui d'un composant déclaré.
CGROUP_EXITING = re.compile(r'^(bash|sleep|MainThread|vehicle-models-) \(en sortie\)$')


def envexec(env_file, *command):
    env = dict(os.environ)
    for line in pathlib.Path(env_file).read_text().splitlines():
        line = line.strip()
        if not line or line.startswith('#'):
            continue
        if line.startswith('export '):
            line = line[len('export '):]
        key, sep, value = line.partition('=')
        key, value = key.strip(), value.strip()
        if not sep or key not in ENV_KEYS or key in env:
            continue
        if len(value) >= 2 and value[0] == value[-1] and value[0] in '"\'':
            value = value[1:-1]
        else:
            value = value.split(' #', 1)[0].strip()
        env[key] = value
    os.execvpe(command[0], list(command), env)


def ticks(pid):
    # Champs 14 et 15 de /proc/<pid>/stat, comptés après le nom entre parenthèses.
    fields = pathlib.Path(f'/proc/{pid}/stat').read_text().rsplit(')', 1)[1].split()
    return int(fields[11]) + int(fields[12])


def status_kb(pid):
    values = {}
    for line in pathlib.Path(f'/proc/{pid}/status').read_text().splitlines():
        name, _, rest = line.partition(':')
        if name in ('VmRSS', 'VmHWM'):
            values[name] = int(rest.split()[0])
    return values


def cpus_allowed(pid):
    for line in pathlib.Path(f'/proc/{pid}/status').read_text().splitlines():
        if line.startswith('Cpus_allowed_list:'):
            return line.split(':', 1)[1].strip()
    return None


def busy_jiffies(cpus):
    """Temps occupé des CPU listés (user nice system irq softirq steal), en jiffies."""
    total = 0
    for line in pathlib.Path('/proc/stat').read_text().splitlines():
        name, *values = line.split()
        if name.startswith('cpu') and name[3:].isdigit() and int(name[3:]) in cpus:
            v = [int(x) for x in values]
            total += v[0] + v[1] + v[2] + v[5] + v[6] + v[7]
    return total


def cpu_kthreads(cpus):
    """Fils noyau liés à un CPU listé (ksoftirqd/N, kworker/N:…, migration/N) : {pid: jiffies}."""
    found = {}
    for d in pathlib.Path('/proc').iterdir():
        if not d.name.isdigit():
            continue
        try:
            stat = (d / 'stat').read_text()
        except OSError:
            continue
        comm, fields = stat[stat.index('(') + 1:stat.rindex(')')], stat[stat.rindex(')') + 2:].split()
        bound = re.fullmatch(r'[a-z_]+/(\d+)(:.*)?', comm)
        if fields[1] == '2' and bound and int(bound.group(1)) in cpus:
            found[int(d.name)] = int(fields[11]) + int(fields[12])
    return found


def mem_available_kb():
    for line in pathlib.Path('/proc/meminfo').read_text().splitlines():
        if line.startswith('MemAvailable:'):
            return int(line.split()[1])
    raise SystemExit('MemAvailable absent de /proc/meminfo')


def oom_kills(directory):
    for line in (directory / 'memory.events').read_text().splitlines():
        name, value = line.split()
        if name == 'oom_kill':
            return int(value)
    return 0


def read_progress(path):
    try:
        p = json.loads(pathlib.Path(path).read_text())
        return [p['t'], p['done'], p['ok']]
    except (OSError, ValueError, KeyError):
        return None


def cgroup_dir(pid):
    for line in pathlib.Path(f'/proc/{pid}/cgroup').read_text().splitlines():
        if line.startswith('0::'):
            return pathlib.Path('/sys/fs/cgroup' + line[3:])
    raise SystemExit(f'cgroup v2 introuvable pour {pid}')


def cgroup_procs(directory):
    """Processus du cgroup : [pid, nom, ligne de commande tronquée] (jamais l'environnement)."""
    found = []
    for pid in (directory / 'cgroup.procs').read_text().split():
        try:
            comm = pathlib.Path(f'/proc/{pid}/comm').read_text().strip()
            cmdline = pathlib.Path(f'/proc/{pid}/cmdline').read_bytes().replace(b'\0', b' ').decode(errors='replace')
        except OSError:
            comm, cmdline = None, None
        found.append([int(pid), comm, None if cmdline is None else cmdline.strip()[:200]])
    return found


def keyed(text):
    return {name: int(value) for name, value in (line.split() for line in text.splitlines() if line.strip())}


# Champs de memory.stat relevés dans la série (le reste figure dans les instantanés cgsnap).
STAT_KEYS = ('anon', 'file', 'kernel', 'kernel_stack', 'pagetables', 'sock', 'shmem', 'file_mapped',
             'file_dirty', 'file_writeback', 'slab', 'percpu', 'anon_thp', 'active_anon', 'inactive_anon',
             'active_file', 'inactive_file', 'pgmajfault')


def vm_state():
    """Charge de la VM : loadavg, MemAvailable, jiffies occupés de chaque CPU."""
    busy = {}
    for line in pathlib.Path('/proc/stat').read_text().splitlines():
        name, *values = line.split()
        if name.startswith('cpu') and name[3:].isdigit():
            v = [int(x) for x in values]
            busy[name[3:]] = v[0] + v[1] + v[2] + v[5] + v[6] + v[7]
    return {'loadavg': pathlib.Path('/proc/loadavg').read_text().split()[:3],
            'mem_available_kb': mem_available_kb(), 'cpu_busy_jiffies': busy}


def cgsnap(out, pid):
    directory = cgroup_dir(int(pid))
    read = lambda name: (directory / name).read_text()
    snap = {'t': time.time(), 'path': str(directory)}
    for name in ('memory.current', 'memory.max', 'memory.peak', 'memory.high', 'memory.min', 'memory.low',
                 'memory.swap.current', 'memory.swap.max', 'memory.swap.peak', 'memory.oom.group'):
        try:
            snap[name] = read(name).strip()
        except OSError as error:
            snap[name] = f'illisible : {error.strerror}'
    for name in ('memory.stat', 'memory.events', 'memory.events.local', 'memory.swap.events', 'cpu.stat'):
        try:
            snap[name] = keyed(read(name))
        except OSError as error:
            snap[name] = f'illisible : {error.strerror}'
    snap['procs'] = cgroup_procs(directory)
    snap['children'] = sorted(p.name for p in directory.iterdir() if p.is_dir())
    pathlib.Path(out).write_text(json.dumps(snap, indent=1))


def cgroup_usage_us(directory):
    for line in (directory / 'cpu.stat').read_text().splitlines():
        name, value = line.split()
        if name == 'usage_usec':
            return int(value)
    raise SystemExit(f'usage_usec absent de {directory}')


def sample(out, duration, *specs):
    duration = int(duration)
    procs = {name: int(pid) for name, pid in (spec.split('=', 1) for spec in specs)}
    cgroup = cgroup_dir(next(iter(procs.values())))
    cpus = [int(c) for c in os.environ['SAMPLE_CPUS'].split(',')] if os.environ.get('SAMPLE_CPUS') else None
    watch = os.environ.get('SAMPLE_WATCH')
    load_stop = os.environ.get('SAMPLE_LOAD_STOP', '1') != '0'
    series = open(os.environ['SAMPLE_SERIES'], 'x', buffering=1) if os.environ.get('SAMPLE_SERIES') else None
    plateau = [float(x) for x in os.environ['SAMPLE_PLATEAU'].split(':')] if os.environ.get('SAMPLE_PLATEAU') else None
    start = time.monotonic()
    ticks0 = {name: ticks(pid) for name, pid in procs.items()}
    usage0 = cgroup_usage_us(cgroup)
    busy0 = busy_jiffies(cpus) if cpus else None
    kthreads0 = cpu_kthreads(cpus) if cpus else None
    oom0 = oom_kills(cgroup) if watch else None
    times, rss, current, progress = [], {name: [] for name in procs}, [], []
    reason = None
    k = 0
    while True:
        now = time.monotonic() - start
        times.append(round(now, 3))
        for name, pid in procs.items():
            try:
                rss[name].append(status_kb(pid)['VmRSS'])
            except (OSError, KeyError):
                rss[name].append(None)
                reason = reason or f'processus disparu : {name}'
        try:
            current.append(int((cgroup / 'memory.current').read_text()) if watch else None)
        except OSError:
            # Scope arrêté par systemd après un OOM : le répertoire du cgroup a disparu.
            current.append(None)
            reason = reason or 'cgroup des cibles disparu'
        if watch:
            progress.append(read_progress(watch))
            reason = reason or watch_reason(progress, cgroup, oom0, out, load_stop)
        if series:
            series.write(json.dumps(series_line(now, k, procs, rss, current, cgroup, progress)) + '\n')
            if plateau and not reason and now >= plateau[0] and k % 60 == 0 and plateau_reached(times, rss, *plateau[1:]):
                reason = 'plateau'
        if reason:
            if watch:
                pathlib.Path(watch + '.stop').touch()
            if series:
                series.write(json.dumps({'t': time.time(), 'stop_reason': reason}) + '\n')
            break
        k += 1
        if k > duration:
            break
        time.sleep(max(0.0, start + k - time.monotonic()))
    elapsed = time.monotonic() - start

    def safe(read, pid):
        try:
            return read(pid)
        except (OSError, KeyError):
            return None

    # Relevés de fin : None si le processus ou le cgroup a disparu (passe arrêtée, marquée invalide).
    usage = safe(cgroup_usage_us, cgroup)
    usage_ms = None if usage is None else (usage - usage0) / 1000
    read_cgroup = lambda name: safe(lambda c: (c / name).read_text().strip(), cgroup)
    peak = read_cgroup('memory.peak')
    result = {
        'duration_s': elapsed,
        't': times,
        'procs': {
            name: {
                'pid': pid,
                'cpu_ms': (lambda t: None if t is None else (t - ticks0[name]) * 1000 / CLK_TCK)(safe(ticks, pid)),
                'rss_kb': rss[name],
                'hwm_kb': (lambda v: None if v is None else v.get('VmHWM'))(safe(status_kb, pid)),
                'cpus_allowed': safe(cpus_allowed, pid),
            }
            for name, pid in procs.items()
        },
        'cgroup': {
            'path': str(cgroup),
            'cpu_ms': usage_ms,
            'memory_peak_b': None if peak is None else int(peak),
            'memory_max': read_cgroup('memory.max'),
            'memory_swap_max': read_cgroup('memory.swap.max'),
        },
    }
    if cpus and usage_ms is not None:
        busy_ms = (busy_jiffies(cpus) - busy0) * 1000 / CLK_TCK
        # Fils noyau des CPU cibles (réseau, files de travail) : part induite par la charge du banc,
        # séparée des voisins. Un fil disparu pendant la fenêtre n'est pas compté.
        kernel_ms = sum(j - kthreads0.get(pid, 0) for pid, j in cpu_kthreads(cpus).items()) * 1000 / CLK_TCK
        capacity_ms = len(cpus) * elapsed * 1000
        result['cpus'] = {
            'list': cpus,
            'busy_ms': busy_ms,
            'foreign_ms': busy_ms - usage_ms,
            'foreign_pct': 100 * (busy_ms - usage_ms) / capacity_ms,
            'kernel_threads_ms': kernel_ms,
            'neighbour_pct': 100 * (busy_ms - usage_ms - kernel_ms) / capacity_ms,
        }
    if watch:
        result['cgroup']['memory_current_b'] = current
        result['cgroup']['oom_kill'] = (lambda n: None if n is None else n - oom0)(safe(oom_kills, cgroup))
        result['progress'] = progress
        result['stop_reason'] = reason
    pathlib.Path(out).write_text(json.dumps(result))
    if series:
        series.close()


def series_line(now, k, procs, rss, current, cgroup, progress):
    """Relevé de la seconde k pour SAMPLE_SERIES ; détail du cgroup et de la VM toutes les 10 s."""
    def safe(read):
        try:
            return read()
        except (OSError, KeyError, ValueError) as error:
            return f'illisible : {error}'

    line = {
        't': time.time(), 'mono_s': round(now, 3),
        'rss_kb': {name: values[-1] for name, values in rss.items()},
        'cpu_ticks': {name: safe(lambda pid=pid: ticks(pid)) for name, pid in procs.items()},
        'memory_current_b': current[-1],
        'cgroup_cpu_us': safe(lambda: cgroup_usage_us(cgroup)),
        'progress': progress[-1] if progress else None,
    }
    if k % 10 == 0:
        line['memory_stat'] = safe(lambda: {key: value for key, value in keyed((cgroup / 'memory.stat').read_text()).items()
                                            if key in STAT_KEYS})
        for name in ('memory.events', 'memory.events.local'):
            line[name] = safe(lambda name=name: keyed((cgroup / name).read_text()))
        line['memory_swap_current_b'] = safe(lambda: int((cgroup / 'memory.swap.current').read_text()))
        line['memory_peak_b'] = safe(lambda: int((cgroup / 'memory.peak').read_text()))
        line['procs'] = safe(lambda: cgroup_procs(cgroup))
        line['vm'] = safe(vm_state)
    return line


def watch_reason(progress, cgroup, oom0, out, load_stop=True):
    """Première condition d'arrêt de PROTOCOL-v3.md atteinte, sinon None ; sans load_stop
    (v4), ni le taux d'erreur ni l'absence de requêtes n'arrêtent la passe."""
    try:
        if oom_kills(cgroup) > oom0:
            return 'OOM dans le cgroup des cibles'
    except OSError:
        return 'cgroup des cibles disparu'
    if mem_available_kb() < STOP_MEM_AVAILABLE_KB:
        return 'MemAvailable < 1 Gio'
    if shutil.disk_usage(pathlib.Path(out).parent).free < STOP_DISK_FREE_B:
        return 'disque libre < 2 Gio'
    if load_stop and len(progress) > STOP_WINDOW_S and progress[-1] and progress[-1 - STOP_WINDOW_S]:
        (_, done1, ok1), (_, done0, ok0) = progress[-1], progress[-1 - STOP_WINDOW_S]
        if done1 == done0:
            return f'0 requête en {STOP_WINDOW_S} s'
        if (done1 - done0 - (ok1 - ok0)) / (done1 - done0) > STOP_ERROR_RATE:
            return f'erreurs > 1 % sur {STOP_WINDOW_S} s'
    return None


def plateau_reached(times, rss, window, threshold):
    tail = [i for i, x in enumerate(times) if x >= times[-1] - window]
    series = list(rss.values()) + [[sum(v) for v in zip(*rss.values())]]
    return all(
        abs(slope_mb_per_min([times[i] for i in tail], [kb[i] for i in tail])) <= threshold
        for kb in series
    )


def upstreams(directory, expected):
    d = pathlib.Path(directory)
    # Fichiers tournés : un fichier non encore compressé remplace son .gz éventuellement partiel.
    rolled = {f.name.removesuffix('.gz'): f for f in sorted(d.glob('caddy-requests-*.log.gz'))}
    rolled.update({f.name: f for f in d.glob('caddy-requests-*.log')})
    # Fichier courant : en clair pendant la passe, compressé ensuite par « route.sh compress4 ».
    current = d / 'caddy-requests.log'
    files = [rolled[k] for k in sorted(rolled)] + [current if current.exists() else d / 'caddy-requests.log.gz']
    route, other, lines = {}, {}, 0
    for f in files:
        opener = gzip.open if f.suffix == '.gz' else open
        with opener(f, 'rt') as handle:
            for line in handle:
                j = json.loads(line)
                lines += 1
                req = j['request']
                path = req['uri'].split('?', 1)[0]
                bucket = route if req['method'] in ('GET', 'HEAD') and ROUTE_PATH.match(path) else other
                key = f"{j.get('upstream') or 'aucun'} {j['status']}"
                bucket[key] = bucket.get(key, 0) + 1
    wrong = {k: n for k, n in route.items() if k.split(' ', 1)[0] != expected}
    result = {'expected': expected, 'files': [f.name for f in files], 'lines': lines,
              'route': route, 'route_total': sum(route.values()), 'route_wrong': wrong, 'other': other}
    print(json.dumps(result))
    sys.exit(1 if wrong or not route else 0)


def compare(dir_a, dir_b):
    def index(directory):
        lines = (pathlib.Path(directory) / 'index.txt').read_text().splitlines()
        return {parts[0]: parts for parts in (line.split(' ', 2) for line in lines)}

    a, b = index(dir_a), index(dir_b)
    same = 0
    for key in sorted(a):
        code_a, path = a[key][1], a[key][2]
        code_b = b.get(key, [key, 'absent'])[1]
        body_a = (pathlib.Path(dir_a) / f'{key}.body').read_bytes()
        body_b_path = pathlib.Path(dir_b) / f'{key}.body'
        body_b = body_b_path.read_bytes() if body_b_path.exists() else b''
        normalize = lambda body: TIMESTAMP.sub(b'"timestamp":"T"', body)
        if code_a == code_b and normalize(body_a) == normalize(body_b):
            same += 1
        else:
            print(f'DIFF {key} {code_a}/{code_b} {path} ({len(body_a)}/{len(body_b)} octets)')
    print(f'identiques={same} différents={len(a) - same} total={len(a)}')
    sys.exit(0 if same == len(a) == len(b) else 1)


def stats_ok():
    stats = json.load(sys.stdin)
    print(json.dumps({k: stats[k] for k in ('hits', 'misses', 'header_mismatches', 'exchanges')}))
    sys.exit(0 if stats['misses'] == 0 and stats['header_mismatches'] == 0 else 1)


def run(directory, config, latency, rep):
    d = pathlib.Path(directory)
    load = json.loads((d / 'load.json').read_text())
    measured = json.loads((d / 'run.json').read_text())
    idle = json.loads((d / 'idle.json').read_text())
    replay = json.loads((d / 'replay.json').read_text())
    procs = measured['procs']
    # Un relevé vaut None si le processus a disparu (passe v3 arrêtée, marquée invalide).
    known = lambda values: [v for v in values if v is not None]
    total = lambda values: None if None in values else sum(values)
    total_kb = [sum(v) for v in zip(*(p['rss_kb'] for p in procs.values())) if None not in v]
    requests = load['requests'] or 1
    cpu_ms = total([p['cpu_ms'] for p in procs.values()])
    hwm_kb = total([p['hwm_kb'] for p in procs.values()])
    line = {
        'config': config,
        'latency_ms': int(latency),
        'rep': rep,
        **{k: load[k] for k in ('requests', 'errors', 'statuses', 'rps', 'p50_ms', 'p95_ms', 'p99_ms', 'max_ms')},
        'cpu_ms_per_req': None if cpu_ms is None else cpu_ms / requests,
        'cpu_ms_per_req_by_proc': {n: None if p['cpu_ms'] is None else p['cpu_ms'] / requests for n, p in procs.items()},
        'cgroup_cpu_ms_per_req': None if measured['cgroup']['cpu_ms'] is None else measured['cgroup']['cpu_ms'] / requests,
        'rss_mb_median': statistics.median(total_kb) / 1024,
        'rss_mb_max': max(total_kb) / 1024,
        'rss_mb_median_by_proc': {n: statistics.median(known(p['rss_kb'])) / 1024 for n, p in procs.items()},
        'hwm_mb': None if hwm_kb is None else hwm_kb / 1024,
        'hwm_mb_by_proc': {n: None if p['hwm_kb'] is None else p['hwm_kb'] / 1024 for n, p in procs.items()},
        'idle_rss_mb': sum(p['rss_kb'][0] for p in idle['procs'].values()) / 1024,
        'idle_rss_mb_by_proc': {n: p['rss_kb'][0] / 1024 for n, p in idle['procs'].items()},
        'cgroup_memory_peak_mb': None if measured['cgroup']['memory_peak_b'] is None else measured['cgroup']['memory_peak_b'] / 2**20,
        'replay': {k: replay[k] for k in ('hits', 'misses', 'header_mismatches')},
    }
    if 'progress' in measured:
        line.update(run_v3(d, load, idle, measured, procs, total_kb))
    if rep in ('drift', 'long'):
        line['t'] = measured['t']
        line['rss_kb_by_proc'] = {n: p['rss_kb'] for n, p in procs.items()}
    print(json.dumps(line))


def run_v3(d, load, idle, measured, procs, total_kb):
    """Champs de la campagne v3 : CPU par requête réussie, CPU étrangère, arrêt, destination."""
    marks = [p for p in measured['progress'] if p]
    # Progression figée (loadgen arrêté) : pas de débit mesurable, CPU par requête réussie absente.
    span = marks[-1][0] - marks[0][0] if len(marks) > 1 else 0
    ok_rate = (marks[-1][2] - marks[0][2]) / span if span > 0 else 0
    cpu = {n: p['cpu_ms'] for n, p in procs.items()}
    per_ok = lambda ms: None if ms is None or not ok_rate else ms / measured['duration_s'] / ok_rate
    destination = json.loads((d / 'destination.json').read_text())
    # Chaque réponse reçue par loadgen (chauffe comprise) doit figurer dans le journal Caddy.
    sent = json.loads((d / 'progress.json').read_text())['done']
    reason = measured.get('stop_reason')
    return {
        'version': 3,
        'ok': load['statuses'].get('200', 0),
        'stopped': load.get('stopped'),
        'stop_reason': reason,
        'valid': reason in (None, 'plateau') and not destination['route_wrong'] and destination['route_total'] == sent,
        'sent_requests': sent,
        'duration_s': measured['duration_s'],
        'cpu_ms_per_ok': per_ok(None if None in cpu.values() else sum(cpu.values())),
        'cpu_ms_per_ok_by_proc': {n: per_ok(ms) for n, ms in cpu.items()},
        'cgroup_cpu_ms_per_ok': per_ok(measured['cgroup']['cpu_ms']),
        'foreign_cpu_pct': measured.get('cpus', {}).get('foreign_pct'),
        'kernel_threads_cpu_ms': measured.get('cpus', {}).get('kernel_threads_ms'),
        'neighbour_cpu_pct': measured.get('cpus', {}).get('neighbour_pct'),
        'cpus_allowed': {n: p.get('cpus_allowed') for n, p in procs.items()},
        'oom_kill': measured['cgroup'].get('oom_kill'),
        'cgroup_memory_max_mb': max(v for v in measured['cgroup']['memory_current_b'] if v is not None) / 2**20,
        'destination': {k: destination[k] for k in ('expected', 'route', 'route_total', 'route_wrong', 'other')},
    }


def brief(result, name):
    r = json.loads(pathlib.Path(result).read_text())
    num = lambda v, spec: 'absent' if v is None else format(v, spec)
    print(f"route: {name} valide={r['valid']} arrêt={r['stop_reason']} ok={r['ok']} erreurs={r['errors']} "
          f"rps={num(r['rps'], '.0f')} cpu_ms/ok={num(r['cpu_ms_per_ok'], '.3f')} "
          f"étrangère={num(r['foreign_cpu_pct'], '.1f')} % (fils noyau {num(r['kernel_threads_cpu_ms'], '.0f')} ms, "
          f"voisins {num(r['neighbour_cpu_pct'], '.1f')} %) "
          f"amont={r['destination']['route']} envoyées={r['sent_requests']}")
    sys.exit(1 if r['destination']['route_wrong'] else 0)


def neighbours_ok(line):
    return line.get('neighbour_cpu_pct') is not None and line['neighbour_cpu_pct'] <= NEIGHBOUR_CPU_MAX_PCT


def foreign_ok(result):
    """Code 1 = passe à rejouer : voisins au-delà du seuil. Une passe arrêtée par une condition d'arrêt
    compte contre sa configuration et n'est pas rejouée (PROTOCOL-v3.md)."""
    r = json.loads(pathlib.Path(result).read_text())
    sys.exit(0 if r['stop_reason'] not in (None, 'plateau') or neighbours_ok(r) else 1)


def slope_mb_per_min(t, kb):
    mean_t, mean_v = statistics.fmean(t), statistics.fmean(kb)
    num = sum((x - mean_t) * (y - mean_v) for x, y in zip(t, kb))
    den = sum((x - mean_t) ** 2 for x in t)
    return num / den * 60 / 1024


def summary(results):
    lines = [json.loads(l) for l in pathlib.Path(results).read_text().splitlines() if l.strip()]
    if any(l.get('version') == 3 for l in lines):
        return summary_v3(lines)
    metrics = (
        ('rps', 'débit req/s', 0),
        ('p95_ms', 'p95 ms', 1),
        ('p99_ms', 'p99 ms', 1),
        ('errors', 'erreurs', 0),
        ('cpu_ms_per_req', 'CPU ms/req (/proc)', 3),
        ('cgroup_cpu_ms_per_req', 'CPU ms/req (cgroup)', 3),
        ('rss_mb_median', 'RSS stable Mo', 1),
        ('rss_mb_max', 'RSS crête Mo', 1),
        ('hwm_mb', 'VmHWM Mo', 1),
        ('idle_rss_mb', 'RSS repos Mo', 1),
    )
    groups = {}
    for line in lines:
        if line['rep'] != 'drift':
            groups.setdefault((line['latency_ms'], line['config']), []).append(line)
    print('| latence | config | n | ' + ' | '.join(label for _, label, _ in metrics) + ' |')
    print('|' + '---|' * (3 + len(metrics)))
    for (latency, config), runs in sorted(groups.items()):
        cells = []
        for key, _, digits in metrics:
            values = [r[key] for r in runs]
            cells.append(
                f'{statistics.median(values):.{digits}f} [{min(values):.{digits}f}–{max(values):.{digits}f}]'
            )
        print(f'| L{latency} | {config} | {len(runs)} | ' + ' | '.join(cells) + ' |')
    print()
    print('| détail par processus (médianes) | config | latence | CPU ms/req | RSS stable Mo | VmHWM Mo | RSS repos Mo |')
    print('|---|---|---|---|---|---|---|')
    for (latency, config), runs in sorted(groups.items()):
        for proc in runs[0]['cpu_ms_per_req_by_proc']:
            med = lambda key: statistics.median(r[key][proc] for r in runs)
            print(
                f'| {proc} | {config} | L{latency} | {med("cpu_ms_per_req_by_proc"):.3f} | '
                f'{med("rss_mb_median_by_proc"):.1f} | {med("hwm_mb_by_proc"):.1f} | {med("idle_rss_mb_by_proc"):.1f} |'
            )
    drifts = [l for l in lines if l['rep'] == 'drift']
    if drifts:
        print()
        print('| dérive | config | latence | req | erreurs | p95 ms | pente RSS Mo/min (240 s finales) | RSS 1re min → dernière min Mo |')
        print('|---|---|---|---|---|---|---|---|')
        for line in drifts:
            t = line['t']
            for proc, kb in line['rss_kb_by_proc'].items():
                tail = [i for i, x in enumerate(t) if x >= t[-1] - 240]
                first = statistics.median(kb[:60]) / 1024
                last = statistics.median(kb[-60:]) / 1024
                print(
                    f'| {proc} | {line["config"]} | L{line["latency_ms"]} | {line["requests"]} | {line["errors"]} | '
                    f'{line["p95_ms"]:.1f} | {slope_mb_per_min([t[i] for i in tail], [kb[i] for i in tail]):+.2f} | '
                    f'{first:.1f} → {last:.1f} |'
                )


def summary_v3(lines):
    """Campagne v3 : médiane [min–max] et dispersion (max−min)/médiane des passes valides."""
    metrics = (
        ('rps', 'débit req/s', 0),
        ('errors', 'erreurs', 0),
        ('p50_ms', 'p50 ms', 1),
        ('p95_ms', 'p95 ms', 1),
        ('p99_ms', 'p99 ms', 1),
        ('cpu_ms_per_ok', 'CPU ms/req OK', 3),
        ('cgroup_cpu_ms_per_ok', 'CPU ms/req OK (cgroup cibles)', 3),
        ('idle_rss_mb', 'RSS initial Mo', 1),
        ('rss_mb_median', 'RSS en charge Mo', 1),
        ('rss_mb_max', 'RSS pic Mo', 1),
        ('hwm_mb', 'VmHWM Mo', 1),
        ('cgroup_memory_peak_mb', 'pic cgroup cibles Mo', 1),
        ('foreign_cpu_pct', 'CPU étrangère %', 1),
        ('neighbour_cpu_pct', 'CPU des voisins %', 1),
    )
    spread_keys = ('cpu_ms_per_ok', 'idle_rss_mb', 'rss_mb_median', 'rss_mb_max')
    short = [l for l in lines if l['rep'] not in ('drift', 'long')]
    kept = lambda l: l.get('valid') and neighbours_ok(l)
    invalid = [l for l in short if not kept(l)]
    groups = {}
    for line in short:
        if kept(line):
            groups.setdefault((line['latency_ms'], line['config']), []).append(line)
    print('| latence | config | passes | ' + ' | '.join(label for _, label, _ in metrics) + ' |')
    print('|' + '---|' * (3 + len(metrics)))
    for (latency, config), runs in sorted(groups.items()):
        cells = []
        for key, _, digits in metrics:
            values = [r[key] for r in runs if r.get(key) is not None]
            cells.append(f'{statistics.median(values):.{digits}f} [{min(values):.{digits}f}–{max(values):.{digits}f}]'
                         if values else 'n/d')
        print(f'| L{latency} | {config} | {",".join(r["rep"] for r in runs)} | ' + ' | '.join(cells) + ' |')
    print()
    print('| dispersion (max−min)/médiane | config | latence | ' + ' | '.join(spread_keys) + ' |')
    print('|---|---|---|' + '---|' * len(spread_keys))
    for (latency, config), runs in sorted(groups.items()):
        cells = []
        for key in spread_keys:
            values = [r[key] for r in runs if r.get(key) is not None]
            cells.append(f'{100 * (max(values) - min(values)) / statistics.median(values):.1f} %' if values else 'n/d')
        print(f'| | {config} | L{latency} | ' + ' | '.join(cells) + ' |')
    print()
    print('| détail par processus (médianes) | config | latence | CPU ms/req OK | RSS en charge Mo | VmHWM Mo | RSS initial Mo | CPU autorisés |')
    print('|---|---|---|---|---|---|---|---|')
    for (latency, config), runs in sorted(groups.items()):
        for proc in runs[0]['cpu_ms_per_ok_by_proc']:
            med = lambda key: statistics.median(r[key][proc] for r in runs)
            print(f'| {proc} | {config} | L{latency} | {med("cpu_ms_per_ok_by_proc"):.3f} | '
                  f'{med("rss_mb_median_by_proc"):.1f} | {med("hwm_mb_by_proc"):.1f} | '
                  f'{med("idle_rss_mb_by_proc"):.1f} | {runs[0]["cpus_allowed"][proc]} |')
    print()
    print('| décision | latence | a2 [min–max] | r2 [min–max] | r2/a2 (médianes) | verdict |')
    print('|---|---|---|---|---|---|')
    for latency in sorted({lat for lat, _ in groups}):
        a2, r2 = groups.get((latency, 'a2'), []), groups.get((latency, 'r2'), [])
        for key, label, digits in metrics:
            if key not in SPREAD_MAX_PCT and key not in ('rps', 'errors', 'p95_ms', 'p99_ms'):
                continue
            va, vr = ([r[key] for r in runs if r.get(key) is not None] for runs in (a2, r2))
            if len(a2) < MIN_VALID_RUNS or len(r2) < MIN_VALID_RUNS or not va or not vr:
                print(f'| {label} | L{latency} | | | | inconclusif : {len(a2)} et {len(r2)} passes valides |')
                continue
            spread = max(100 * (max(v) - min(v)) / statistics.median(v) if statistics.median(v) else 0 for v in (va, vr))
            if key == 'errors':
                verdict = 'aucune erreur' if max(va + vr) == 0 else 'erreurs présentes'
            elif max(vr) < min(va):
                verdict = 'r2 inférieur, plages disjointes'
            elif min(vr) > max(va):
                verdict = 'r2 supérieur, plages disjointes'
            elif key in SPREAD_MAX_PCT and spread > SPREAD_MAX_PCT[key]:
                verdict = f'inconclusif : dispersion {spread:.1f} % > {SPREAD_MAX_PCT[key]:.0f} %'
            else:
                verdict = 'plages recouvrantes'
            ratio = (f'{statistics.median(vr) / statistics.median(va):.3f}' if statistics.median(va) else 'n/d')
            print(f'| {label} | L{latency} | {statistics.median(va):.{digits}f} [{min(va):.{digits}f}–{max(va):.{digits}f}] | '
                  f'{statistics.median(vr):.{digits}f} [{min(vr):.{digits}f}–{max(vr):.{digits}f}] | {ratio} | {verdict} |')
    if invalid:
        print()
        for line in invalid:
            print(f'passe écartée : {line["config"]} L{line["latency_ms"]} {line["rep"]} : arrêt '
                  f'{line.get("stop_reason")} ; CPU des voisins {line.get("neighbour_cpu_pct")} % ; '
                  f'amonts erronés {line["destination"]["route_wrong"]}')
    longs = [l for l in lines if l['rep'] == 'long']
    if longs:
        print()
        print('| suivi long | config | latence | durée s | arrêt | valide | voisins % | req OK | erreurs | p95 ms | '
              'CPU ms/req OK | pente RSS Mo/min (900 s finales) | RSS 1re min → dernière min Mo | '
              'RSS [min–max] 900 s finales Mo | RSS max Mo |')
        print('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|')
        final = {}
        for line in longs:
            t = line['t']
            tail = [i for i, x in enumerate(t) if x >= t[-1] - 900]
            series = dict(line['rss_kb_by_proc'])
            series['total'] = [sum(v) for v in zip(*series.values()) if None not in v]
            num = lambda v, spec: 'n/d' if v is None else format(v, spec)
            for proc, kb in series.items():
                kb = [v for v in kb if v is not None]
                ti = [i for i in tail if i < len(kb)]
                last = [kb[i] / 1024 for i in ti]
                if proc == 'total':
                    final[line['config']] = (line, min(last), max(last))
                print(f'| {proc} | {line["config"]} | L{line["latency_ms"]} | {line["duration_s"]:.0f} | '
                      f'{line.get("stop_reason") or "durée max"} | {line["valid"]} | {num(line["neighbour_cpu_pct"], ".1f")} | '
                      f'{line["ok"]} | {line["errors"]} | {num(line["p95_ms"], ".1f")} | '
                      f'{num(line["cpu_ms_per_ok"], ".3f")} | {slope_mb_per_min([t[i] for i in ti], [kb[i] for i in ti]):+.2f} | '
                      f'{statistics.median(kb[:60]) / 1024:.1f} → {statistics.median(kb[-60:]) / 1024:.1f} | '
                      f'{min(last):.1f}–{max(last):.1f} | {max(kb) / 1024:.1f} |')
        if 'a2' in final and 'r2' in final:
            (la, a_min, a_max), (lr, r_min, r_max) = final['a2'], final['r2']
            if lr['stop_reason'] != 'plateau' or not (la['valid'] and lr['valid']):
                verdict = (f'inconclusif : r2 arrêt {lr["stop_reason"] or "durée max"}, '
                           f'valide a2={la["valid"]} r2={lr["valid"]}')
            elif r_max < a_min:
                verdict = 'r2 inférieur, plages disjointes'
            elif r_min > a_max:
                verdict = 'r2 supérieur, plages disjointes'
            else:
                verdict = 'plages recouvrantes'
            print()
            print(f'décision suivi long (RSS total, 900 s finales) : a2 {a_min:.1f}–{a_max:.1f} Mo '
                  f'(arrêt {la["stop_reason"] or "durée max"}), r2 {r_min:.1f}–{r_max:.1f} Mo '
                  f'(arrêt {lr["stop_reason"] or "durée max"}) : {verdict}')


def jsonl(path):
    """Lignes d'une série ; une ligne illisible (écriture interrompue par une mort) est comptée."""
    lines, broken = [], 0
    try:
        with open(path) as handle:
            for raw in handle:
                try:
                    lines.append(json.loads(raw))
                except ValueError:
                    broken += 1
    except OSError:
        return None, 0
    return lines, broken


def last_at(lines, key, value):
    """Dernière ligne dont lines[key] ≤ value (série croissante), sinon la première."""
    best = lines[0] if lines else None
    for line in lines:
        if line[key] > value:
            break
        best = line
    return best


def number(value):
    return value if isinstance(value, (int, float)) and not isinstance(value, bool) else None


def delta(a, b):
    return None if number(a) is None or number(b) is None else b - a


def max_gap(times):
    return max((b - a for a, b in zip(times, times[1:])), default=None)


def versions_field(d, name):
    for line in (d / 'versions.txt').read_text().splitlines():
        if line.startswith(name + ' '):
            return line.split(' ', 1)[1]
    return None


def run4(directory, config, latency, rep):
    d = pathlib.Path(directory)
    read = lambda name: json.loads((d / name).read_text())
    load, measured, idle, replay = read('load.json'), read('run.json'), read('idle.json'), read('replay.json')
    destination = read('destination.json')
    snaps = {}
    for name in ('pre', 'post', 'end'):
        try:
            snaps[name] = read(f'cgroup-{name}.json')
        except (OSError, ValueError):
            snaps[name] = None
    ss, ss_broken = jsonl(d / 'sample-series.jsonl')
    lg, lg_broken = jsonl(d / 'loadgen-series.jsonl')
    mp, mp_broken = jsonl(d / 'memprobe.jsonl')
    ss = [l for l in ss or [] if 'mono_s' in l]
    lg = lg or []
    probe = [l for l in mp or [] if 'uptime_s' in l]
    t0 = ss[0]['t'] if ss else None
    end_s = ss[-1]['mono_s'] if ss else 0
    procs = list(measured['procs'])
    clk = 1000 / CLK_TCK

    def cpu_ms(a, b):
        """CPU des cibles (cgroup), de Caddy et de Redis entre deux relevés de la série, en ms."""
        out = {'cgroup': None if delta(a['cgroup_cpu_us'], b['cgroup_cpu_us']) is None
               else delta(a['cgroup_cpu_us'], b['cgroup_cpu_us']) / 1000}
        for name in procs:
            v = delta(a['cpu_ticks'].get(name), b['cpu_ticks'].get(name))
            out[name] = None if v is None else v * clk
        parts = [out['cgroup'], out.get('caddy'), out.get('redis')]
        out['total'] = None if None in parts else sum(parts)
        return out

    target_cpus = [str(c) for c in measured.get('cpus', {}).get('list', [])]
    vm = [l for l in ss if isinstance(l.get('vm'), dict) and isinstance(l.get('cgroup_cpu_us'), int)]

    def foreign_pct(a_s, b_s):
        """CPU cibles hors cgroup des cibles sur la plage, relevés de 10 s : voisins et fils noyau
        induits, donc borne haute des voisins (le total de la passe les sépare)."""
        inside = [l for l in vm if a_s <= l['mono_s'] <= b_s]
        if len(inside) < 2 or not target_cpus:
            return None
        a, b = inside[0], inside[-1]
        busy = sum(b['vm']['cpu_busy_jiffies'][c] - a['vm']['cpu_busy_jiffies'][c] for c in target_cpus) * clk
        used = (b['cgroup_cpu_us'] - a['cgroup_cpu_us']) / 1000
        return 100 * (busy - used) / (len(target_cpus) * (b['mono_s'] - a['mono_s']) * 1000)

    def counts(a_s, b_s):
        a, b = last_at(lg, 't', t0 + a_s), last_at(lg, 't', t0 + b_s)
        return {k: b[k] - a[k] for k in ('planned', 'emitted', 'completed', 'ok', 'abandoned')}

    def span(a_s, b_s):
        """Agrégats de la plage [a_s, b_s[ (secondes depuis le début de la mesure)."""
        sa, sb = last_at(ss, 'mono_s', a_s), last_at(ss, 'mono_s', b_s)
        c, n = cpu_ms(sa, sb), counts(a_s, b_s)
        inside = [l for l in ss if a_s <= l['mono_s'] < b_s]
        current = [l['memory_current_b'] for l in inside if number(l['memory_current_b']) is not None]
        rss = [sum(l['rss_kb'].values()) for l in inside if None not in l['rss_kb'].values()]
        lat = [l for l in lg if t0 + a_s < l['t'] <= t0 + b_s and l['n']]
        mem = [l for l in probe if t0 + a_s <= l['t'] < t0 + b_s]
        seconds = sb['mono_s'] - sa['mono_s']
        per_ok = lambda ms: None if ms is None or not n['ok'] else ms / n['ok']
        return {
            'from_s': a_s, 'to_s': b_s, 'complete': end_s >= b_s - 1, **n,
            'served': n['ok'] / n['planned'] if n['planned'] else None,
            'cpu_ms_per_ok': per_ok(c['total']), 'cgroup_cpu_ms_per_ok': per_ok(c['cgroup']),
            'cpu_ms_per_ok_by_proc': {name: per_ok(c.get(name)) for name in procs},
            'memory_current_mb': statistics.median(current) / 2**20 if current else None,
            'memory_current_max_mb': max(current) / 2**20 if current else None,
            'rss_mb': statistics.median(rss) / 1024 if rss else None,
            'p95_ms': statistics.median(l['p95_ms'] for l in lat) if lat else None,
            'p99_ms': statistics.median(l['p99_ms'] for l in lat) if lat else None,
            'max_ms': max((l['max_ms'] for l in lat), default=None),
            'gc_ms_per_s': (sum(g['ms'] for l in mem for g in l['gc'].values()) / seconds
                            if mem and seconds > 0 else None),
            'heap_used_mb': mem[-1]['heap']['used_heap_size'] / 2**20 if mem else None,
            'foreign_cpu_pct': foreign_pct(a_s, b_s),
        }

    windows = [span(a, a + WINDOW_S) for a in range(0, int(end_s) + 1, WINDOW_S) if a < end_s] if ss else []
    steady = span(STEADY_FROM_S, end_s + 1) if end_s > STEADY_FROM_S else None
    tail = [l for l in ss if l['mono_s'] >= end_s - SLOPE_TAIL_S]
    slope = lambda pts: slope_mb_per_min([p[0] for p in pts], [p[1] for p in pts]) if len(pts) > 2 else None
    memory_tail = [l['memory_current_b'] / 1024 for l in tail if number(l['memory_current_b']) is not None]
    memory_late = [l['memory_current_b'] for l in ss if l['mono_s'] >= MEMORY_FROM_S and number(l['memory_current_b']) is not None]
    rss_late = [sum(l['rss_kb'].values()) for l in ss if l['mono_s'] >= MEMORY_FROM_S and None not in l['rss_kb'].values()]
    events = lambda snap, name: snap.get(name) if snap and isinstance(snap.get(name), dict) else {}
    pre, post = snaps['pre'], snaps['post']
    events_delta = {name: {k: v - events(pre, name).get(k, 0) for k, v in events(post, name).items()}
                    for name in ('memory.events', 'memory.events.local')}
    oom_kill = events_delta['memory.events'].get('oom_kill', 0) if post else None

    # Processus du cgroup pendant la mesure (relevés de 10 s) et à l'instantané pré.
    seen = {}
    for snap_procs in [l['procs'] for l in ss if isinstance(l.get('procs'), list)] + [(pre or {}).get('procs', [])]:
        for _, comm, cmdline in snap_procs:
            # Processus achevé entre la lecture de cgroup.procs et celle de /proc : rien à identifier.
            if cmdline or comm:
                key = cmdline or f'{comm} (en sortie)'
                seen[key] = seen.get(key, 0) + 1
    foreign = sorted(c for c in seen if not any(p.match(c) for p in CGROUP_ALLOWED + (CGROUP_EXITING,)))

    # Mort d'une cible : première seconde où son RSS manque.
    died = {name: next((l['mono_s'] for l in ss if l['rss_kb'].get(name) is None), None) for name in procs}
    node_end = died.get('node') if died.get('node') is not None else end_s
    gaps = {'sample': max_gap([l['mono_s'] for l in ss]), 'loadgen': max_gap([l['t'] for l in lg]),
            'memprobe': max_gap([l['t'] for l in probe])}
    collection = []
    if not ss or not lg:
        collection.append('série absente')
    for name, gap in gaps.items():
        if gap is not None and gap > GAP_MAX_S[name]:
            collection.append(f'série {name} : trou de {gap:.1f} s')
    if not probe or t0 is None or probe[-1]['t'] < t0 + node_end - GAP_MAX_S['memprobe']:
        collection.append('sonde Node absente ou interrompue avant la fin de Node')
    if lg and not lg[-1]['planned']:
        collection.append('générateur : aucune requête prévue')
    for name in ('pre', 'post', 'end'):
        if snaps[name] is None or any(str(v).startswith('illisible') for v in snaps[name].values()
                                      if isinstance(v, str)):
            collection.append(f'instantané cgroup {name} absent ou illisible')
    log_name = 'r2.log' if 'rust' in procs else 'a2.log'
    for name in ('a2.log', log_name):
        if not (d / name).exists() or not (d / name).stat().st_size:
            collection.append(f'{name} absent ou vide')

    ok_total = lg[-1]['ok'] if lg else 0
    emitted_total = lg[-1]['emitted'] if lg else 0
    bench = list(collection)
    if destination['route_wrong']:
        bench.append(f'amont erroné : {destination["route_wrong"]}')
    if not ok_total <= destination['route_total'] <= emitted_total:
        bench.append(f'journal Caddy : {destination["route_total"]} requêtes journalisées, '
                     f'{ok_total} réussies et {emitted_total} émises')
    if replay['misses'] or replay['header_mismatches']:
        bench.append('rejeu : clé absente ou en-tête différent')
    if foreign:
        bench.append(f'processus étrangers dans le cgroup : {foreign}')
    reason = measured.get('stop_reason')
    if reason in ('MemAvailable < 1 Gio', 'disque libre < 2 Gio', 'cgroup des cibles disparu') or (
            reason or '').startswith('processus disparu : ') and reason.split(': ', 1)[1] in ('caddy', 'redis'):
        bench.append(f'arrêt : {reason}')
    # Défauts qui faussent les performances sans invalider une défaillance constatée.
    perf_bench = []
    if load['lag_p99_ms'] > LAG_P99_MAX_MS:
        perf_bench.append(f'générateur en retard : p99 {load["lag_p99_ms"]:.1f} ms')
    neighbour = measured.get('cpus', {}).get('neighbour_pct')
    if neighbour is None or neighbour > NEIGHBOUR_CPU_MAX_PCT:
        perf_bench.append(f'CPU des voisins {neighbour} %')

    ok = load['statuses'].get('200', 0)
    served = ok / load['planned'] if load['planned'] else 0
    failure = []
    if oom_kill:
        failure.append(f'OOM : {oom_kill} processus tué(s) dans le cgroup des cibles')
    for name in ('node', 'rust'):
        if died.get(name) is not None:
            failure.append(f'{name} disparu à {died[name]:.0f} s')
    if served < SERVED_MIN:
        failure.append(f'charge non servie : {100 * served:.2f} % des requêtes prévues en 200')
    for w in windows:
        if w['complete'] and w['served'] is not None and w['served'] < SERVED_WINDOW_MIN:
            failure.append(f'charge non servie dans [{w["from_s"]}, {w["to_s"]}[ : {100 * w["served"]:.2f} %')
    fatal = bool(oom_kill) or any(died.get(n) is not None for n in ('node', 'rust'))
    if bench or (perf_bench and not fatal):
        issue = 'banc'
    elif failure:
        issue = 'application'
    else:
        issue = 'complet'

    line = {
        'version': 4, 'config': config, 'latency_ms': int(latency), 'rep': rep,
        'throttler': versions_field(d, 'throttler'), 'a2_dist': versions_field(d, 'a2_dist'),
        'issue': issue, 'bench_defects': bench + perf_bench, 'failures': failure,
        'stop_reason': reason, 'duration_s': measured['duration_s'],
        **{k: load[k] for k in ('rate', 'max_inflight', 'planned', 'emitted', 'completed', 'abandoned', 'unfinished',
                                'inflight_max', 'errors', 'statuses', 'window_s', 'rps', 'served_rps', 'p50_ms',
                                'p95_ms', 'p99_ms', 'max_ms', 'service_p50_ms', 'service_p95_ms', 'service_p99_ms',
                                'lag_p99_ms', 'lag_max_ms', 'stopped')},
        'ok': ok, 'served': served,
        'steady': steady, 'windows': windows,
        'memory_current_mb': statistics.median(memory_late) / 2**20 if memory_late else None,
        'memory_peak_mb': (int(post['memory.peak']) / 2**20 if post and str(post.get('memory.peak', '')).isdigit()
                           else None),
        'memory_slope_mb_per_min': slope([(l['mono_s'], l['memory_current_b'] / 1024) for l in tail
                                          if number(l['memory_current_b']) is not None]),
        'memory_tail_s': (tail[-1]['mono_s'] - tail[0]['mono_s']) if tail else 0,
        'rss_mb': statistics.median(rss_late) / 1024 if rss_late else None,
        'rss_slope_mb_per_min': slope([(l['mono_s'], sum(l['rss_kb'].values())) for l in tail
                                       if None not in l['rss_kb'].values()]),
        'rss_mb_by_proc': {name: (lambda v: statistics.median(v) / 1024 if v else None)(
            [l['rss_kb'][name] for l in ss if l['mono_s'] >= MEMORY_FROM_S and l['rss_kb'].get(name) is not None])
            for name in procs},
        'idle_rss_mb_by_proc': {n: p['rss_kb'][0] / 1024 for n, p in idle['procs'].items()},
        'memory_stat_last': next((l['memory_stat'] for l in reversed(ss) if isinstance(l.get('memory_stat'), dict)), None),
        'events_delta': events_delta, 'oom_kill': oom_kill,
        'neighbour_cpu_pct': neighbour, 'foreign_cpu_pct': measured.get('cpus', {}).get('foreign_pct'),
        'foreign_cpu_pct_max_window': max((w['foreign_cpu_pct'] for w in windows if w['foreign_cpu_pct'] is not None),
                                          default=None),
        'died_s': died, 'gaps_s': gaps, 'broken_lines': {'sample': ss_broken, 'loadgen': lg_broken, 'memprobe': mp_broken},
        'cgroup_procs_seen': seen,
        'probe': probe_summary(probe, t0, lg),
        'replay': {k: replay[k] for k in ('hits', 'misses', 'header_mismatches')},
        'destination': {k: destination[k] for k in ('expected', 'route', 'route_total', 'route_wrong', 'other')},
        'redis_dbsize': (d / 'redis-end.txt').read_text().splitlines()[0] if (d / 'redis-end.txt').exists() else None,
    }
    line['diag'] = diag4(line, ss, lg, probe, t0)
    print(json.dumps(line))


def probe_summary(probe, t0, lg):
    """Sonde Node : premier relevé, relevé à D1_AT_S, dernier relevé (mémoire, tas, limiteur, handles)."""
    def pick(line):
        if not line:
            return None
        return {'at_s': None if t0 is None else round(line['t'] - t0, 1), 'memory': line['memory'],
                'heap_used': line['heap']['used_heap_size'], 'heap_total': line['heap']['total_heap_size'],
                'heap_limit': line['heap']['heap_size_limit'], 'external': line['memory']['external'],
                'throttler': line['throttler'], 'handles': line['handles'], 'loop_ms': line['loop_ms']}
    if not probe or t0 is None:
        return None
    return {'lines': len(probe), 'first': pick(probe[0]), 'at_d1': pick(last_at(probe, 't', t0 + D1_AT_S)),
            'last': pick(probe[-1])}


def diag4(line, ss, lg, probe, t0):
    """Critères D1 et D2 (PROTOCOL-v4.md, « Diagnostic du limiteur »), calculés sur toute passe."""
    if not probe or not lg or t0 is None:
        return {'assessable': False}
    at = last_at(probe, 't', t0 + D1_AT_S)
    timers = ((at.get('throttler') or {}).get('timers') or {}).get('long')
    completed = last_at(lg, 't', t0 + D1_AT_S)['completed']
    reached = at['t'] >= t0 + D1_AT_S - GAP_MAX_S['memprobe']
    d1 = reached and timers is not None and timers >= D1_MIN_RATIO * GUARD_RUNS_PER_REQUEST * completed

    def rate(a_s, b_s):
        sa, sb = last_at(ss, 'mono_s', a_s), last_at(ss, 'mono_s', b_s)
        la, lb = last_at(lg, 't', t0 + a_s), last_at(lg, 't', t0 + b_s)
        cpu = delta(sa['cgroup_cpu_us'], sb['cgroup_cpu_us'])
        ok = lb['ok'] - la['ok']
        mem = [l for l in probe if t0 + a_s <= l['t'] < t0 + b_s]
        seconds = sb['mono_s'] - sa['mono_s']
        return {'cpu_ms_per_ok': None if cpu is None or not ok else cpu / 1000 / ok,
                'gc_ms_per_s': (sum(g['ms'] for l in mem for g in l['gc'].values()) / seconds
                                if mem and seconds > 0 else None),
                'seconds': seconds}

    end_s = ss[-1]['mono_s'] if ss else 0
    before = rate(*D2_BEFORE) if end_s >= D2_BEFORE[1] else None
    after = rate(D2_AFTER[0], min(D2_AFTER[1], end_s)) if end_s >= D2_AFTER[0] + WINDOW_S else None
    ratio = lambda key: (None if not before or not after or not before[key] or after[key] is None
                         else after[key] / before[key])
    cpu_ratio, gc_ratio = ratio('cpu_ms_per_ok'), ratio('gc_ms_per_s')
    death = line['died_s'].get('node')
    heap = [(l['t'] - t0, l['heap']['used_heap_size']) for l in probe]
    heap_at_limit_window = [h for s, h in heap if s <= D2_BEFORE[1]]
    oom_growth = bool(line['oom_kill']) and death is not None and death >= D2_BEFORE[1] and bool(
        heap_at_limit_window) and heap[-1][1] > heap_at_limit_window[-1]
    d2 = {'cpu': cpu_ratio is not None and cpu_ratio >= D2_CPU_RATIO,
          'gc': gc_ratio is not None and gc_ratio >= D2_GC_RATIO, 'oom_heap_growth': oom_growth}
    return {'assessable': True, 'timers_long_at_d1': timers, 'completed_at_d1': completed, 'd1_reached': reached,
            'D1': d1, 'before': before, 'after': after, 'cpu_ratio': cpu_ratio, 'gc_ratio': gc_ratio,
            'D2': d2, 'D2_any': any(d2.values()), 'defect': d1 and any(d2.values())}


def brief4(result, name):
    r = json.loads(pathlib.Path(result).read_text())
    num = lambda v, spec: 'n/d' if v is None else format(v, spec)
    steady = r['steady'] or {}
    print(f"route: {name} issue={r['issue']} prévues={r['planned']} émises={r['emitted']} achevées={r['completed']} "
          f"abandonnées={r['abandoned']} inachevées={r['unfinished']} ok={r['ok']} servi={100 * r['served']:.2f} % "
          f"p95={num(r['p95_ms'], '.1f')} p99={num(r['p99_ms'], '.1f')} ms "
          f"cpu_ms/ok={num(steady.get('cpu_ms_per_ok'), '.3f')} cgroup_mo={num(r['memory_current_mb'], '.1f')} "
          f"pic={num(r['memory_peak_mb'], '.1f')} pente={num(r['memory_slope_mb_per_min'], '+.2f')} Mo/min "
          f"oom={r['oom_kill']} D1={r['diag'].get('D1')} D2={r['diag'].get('D2')}")
    for item in r['bench_defects'] + r['failures']:
        print(f'route:   {item}')
    sys.exit(1 if r['issue'] == 'banc' else 0)


def compare4(key, ref, r2):
    """Verdict d'un indicateur : écart minimal (DIFF_MIN), puis fenêtres de 10 min disjointes."""
    va, vr = ref.get(key), r2.get(key)
    if va is None or vr is None:
        return 'n/d'
    rel, floor = DIFF_MIN[key]
    if abs(vr - va) < max(rel * va, floor):
        return 'pas de différence démontrée'
    side = 'r2 inférieur' if vr < va else 'r2 supérieur'
    if key == 'memory_peak_mb':
        return side
    start = MEMORY_FROM_S if key == 'memory_current_mb' else STEADY_FROM_S
    wins = lambda r: [w[key] for w in r['windows'] if w['complete'] and w['from_s'] >= start and w.get(key) is not None]
    wa, wr = wins(ref), wins(r2)
    if wa and wr and (max(wr) < min(wa) if vr < va else min(wr) > max(wa)):
        return f'{side}, fenêtres disjointes'
    return 'inconclusif : écart au-delà du seuil, fenêtres recouvrantes'


def summary4(results):
    lines = [json.loads(l) for l in pathlib.Path(results).read_text().splitlines() if l.strip()]
    lines = [l for l in lines if l.get('version') == 4]
    num = lambda v, spec: 'n/d' if v is None else format(v, spec)
    print('| passe | limiteur | plafond tas Mo | issue | prévues | émises | achevées | abandonnées | inachevées | ok | '
          'servi % | erreurs | p50 | p95 | p99 | max ms | CPU ms/ok (régime) | CPU cgroup ms/ok | '
          'cgroup Mo (≥3600 s) | pic cgroup Mo | pente Mo/min | RSS Mo | voisins % | OOM |')
    print('|' + '---|' * 24)
    heap_limit_mb = lambda l: (((l.get('probe') or {}).get('first') or {}).get('heap_limit') or 0) / 2**20 or None
    for l in lines:
        s = l['steady'] or {}
        print(f"| {l['config']}-L{l['latency_ms']}-{l['rep']} | {l['throttler']} | {num(heap_limit_mb(l), '.0f')} | "
              f"{l['issue']} | {l['planned']} | "
              f"{l['emitted']} | {l['completed']} | {l['abandoned']} | {l['unfinished']} | {l['ok']} | "
              f"{100 * l['served']:.2f} | {l['errors']} | {l['p50_ms']:.1f} | {l['p95_ms']:.1f} | {l['p99_ms']:.1f} | "
              f"{l['max_ms']:.0f} | {num(s.get('cpu_ms_per_ok'), '.3f')} | {num(s.get('cgroup_cpu_ms_per_ok'), '.3f')} | "
              f"{num(l['memory_current_mb'], '.1f')} | {num(l['memory_peak_mb'], '.1f')} | "
              f"{num(l['memory_slope_mb_per_min'], '+.2f')} | {num(l['rss_mb'], '.1f')} | "
              f"{num(l['neighbour_cpu_pct'], '.1f')} | {l['oom_kill']} |")
        for item in l['bench_defects'] + l['failures']:
            print(f'|  ↳ {item} |' + ' |' * 22)
    print()
    print('| fenêtres de 10 min | début s | servi % | CPU ms/ok | cgroup Mo (médiane) | RSS Mo | p95 médian (10 s) | '
          'p99 médian (10 s) | GC ms/s | tas Mo |')
    print('|---|---|---|---|---|---|---|---|---|---|')
    for l in lines:
        for w in l['windows']:
            print(f"| {l['config']}-{l['rep']}{'' if w['complete'] else ' (partielle)'} | {w['from_s']} | "
                  f"{num(None if w['served'] is None else 100 * w['served'], '.2f')} | {num(w['cpu_ms_per_ok'], '.3f')} | "
                  f"{num(w['memory_current_mb'], '.1f')} | {num(w['rss_mb'], '.1f')} | {num(w['p95_ms'], '.1f')} | "
                  f"{num(w['p99_ms'], '.1f')} | {num(w['gc_ms_per_s'], '.1f')} | {num(w['heap_used_mb'], '.1f')} |")

    # Référence Node : a2c, Node lancé comme l'image (amendement 1 au protocole), limiteur corrigé si
    # le diagnostic de la passe a2 « diag » établit D1 et D2. La passe diag n'est pas une référence.
    diag = [l for l in lines if l['config'] == 'a2' and l['rep'] == 'diag']
    print()
    if not diag:
        print('décision : passe a2 diag absente')
        return
    dg = diag[-1]['diag']
    print(f"diagnostic du limiteur (a2 diag, {diag[-1]['throttler']}) : D1={dg.get('D1')} "
          f"(minuteries long {dg.get('timers_long_at_d1')} pour {dg.get('completed_at_d1')} requêtes à {D1_AT_S} s) ; "
          f"D2={dg.get('D2')} (CPU ×{num(dg.get('cpu_ratio'), '.3f')}, GC ×{num(dg.get('gc_ratio'), '.3f')}) ; "
          f"défaut démontré={dg.get('defect')}")
    refs = [l for l in lines if l['config'] == 'a2c']
    # Amendement 2 : défaut démontré par le test isolé, D2 n'ayant pas pu l'observer. Limiteur attendu
    # pour a2c : celui que limiter-accept a accepté (limiter-acceptance.json à côté des résultats),
    # sinon celui de la passe diag, et la référence porte alors le défaut démontré, non corrigé.
    acc_path = pathlib.Path(results).with_name('limiter-acceptance.json')
    acc = json.loads(acc_path.read_text()) if acc_path.exists() else None
    fixed = bool(acc and acc['accepted'])
    expected = acc['throttler'] if fixed else diag[-1]['throttler']
    print(f"défaut du limiteur : D1∧D2 du protocole = {dg.get('defect')} ; démontré par le test isolé (amendement 2) ; "
          + (f'correction acceptée, a2c attendu avec {expected}' if fixed else
             f"correction {'refusée par le critère' if acc else 'non appliquée'}, a2c attendu avec {expected} "
             '(défaut démontré, non corrigé)'))
    wrong = [l['rep'] for l in refs if l['throttler'] != expected]
    if wrong:
        print(f"décision : limiteur d'a2c différent de celui attendu (passes {wrong})")
        return
    r2s = [l for l in lines if l['config'] == 'r2']
    # Node de r2 identique à celui d'a2c : limiteur, backend/dist et plafond du tas.
    node_id = lambda l: (l['throttler'], l['a2_dist'], heap_limit_mb(l))
    if len({node_id(l) for l in refs + r2s}) > 1:
        print(f"décision : Node différent entre a2c et r2 : {sorted({node_id(l) for l in refs + r2s}, key=str)}")
        return
    attempts = list(zip(refs, r2s))
    if not attempts:
        print('décision : paire incomplète')
        return
    chosen = None
    for k, (ref, r2) in enumerate(attempts[:2]):
        defect = [x for x in (ref, r2) if x['issue'] == 'banc']
        print(f"paire {k + 1} : {ref['config']}-{ref['rep']} ({ref['issue']}) / r2-{r2['rep']} ({r2['issue']})"
              + (f" ; défaut du banc : {[x['config'] + '-' + x['rep'] for x in defect]}" if defect else ''))
        chosen = (ref, r2)
        if not defect:
            break
    if len(attempts) > 2:
        print(f'passes au-delà de la reprise unique ignorées : {len(attempts) - 2} paire(s)')
    ref, r2 = chosen
    indicators = ('memory_current_mb', 'memory_peak_mb', 'cpu_ms_per_ok', 'p95_ms', 'p99_ms')
    get = lambda r, key: (r['steady'] or {}).get(key) if key == 'cpu_ms_per_ok' else r.get(key)
    verdicts = {}
    print()
    print('| indicateur | référence | r2 | r2/référence | verdict |')
    print('|---|---|---|---|---|')
    for key in indicators:
        a, b = get(ref, key), get(r2, key)
        flat = lambda r: {key: get(r, key), 'windows': r['windows']}
        verdicts[key] = compare4(key, flat(ref), flat(r2)) if ref['issue'] == r2['issue'] == 'complet' else 'n/d'
        print(f"| {key} | {num(a, '.3f')} | {num(b, '.3f')} | {num(b / a if a and b is not None else None, '.3f')} | "
              f"{verdicts[key]} |")
    plateau = r2['memory_slope_mb_per_min'] is not None and abs(r2['memory_slope_mb_per_min']) <= SLOPE_MAX_MB_PER_MIN
    print(f"pente memory.current r2 sur les {r2['memory_tail_s']:.0f} s finales : "
          f"{num(r2['memory_slope_mb_per_min'], '+.2f')} Mo/min (seuil {SLOPE_MAX_MB_PER_MIN}, fenêtre observée seulement)")
    if ref['issue'] == 'banc' or r2['issue'] == 'banc':
        conclusion = 'mesures inconclusives : défaut du banc après la reprise unique'
    elif r2['destination']['route_wrong'] or ref['destination']['route_wrong']:
        conclusion = 'R2 non validé : amont erroné'
    elif r2['issue'] == 'application':
        conclusion = 'R2 non validé : défaillance de r2 (' + '; '.join(r2['failures']) + ')'
    elif r2['errors'] and not ref['errors']:
        conclusion = 'R2 non validé : erreurs propres à r2'
    elif not plateau:
        conclusion = 'mesures inconclusives : r2 sans pente sous le seuil dans la fenêtre finale'
    elif ref['issue'] == 'application' and not fixed:
        conclusion = ('mesures inconclusives sur la capacité : la référence Node '
                      f"{ref['config']} ({ref['throttler']}) est défaillante et porte le défaut démontré du limiteur, "
                      'non corrigé (' + '; '.join(ref['failures']) + ')')
    elif ref['issue'] == 'application':
        conclusion = ('R2 validé, bénéfice de capacité démontré à ce débit et dans cette fenêtre : la référence Node '
                      f"{ref['config']} ({ref['throttler']}) est défaillante (" + '; '.join(ref['failures']) + ')')
    elif r2['errors'] and ref['errors']:
        conclusion = 'mesures inconclusives : erreurs dans les deux configurations'
    elif any(v.startswith('inconclusif') for v in verdicts.values()):
        conclusion = 'mesures inconclusives : indicateur de décision inconclusif'
    elif (verdicts['memory_current_mb'].startswith('r2 inférieur') and verdicts['memory_peak_mb'].startswith('r2 inférieur')
          and not any(verdicts[k].startswith('r2 supérieur') for k in ('cpu_ms_per_ok', 'p95_ms', 'p99_ms'))):
        conclusion = 'R2 validé et bénéfice démontré (route, périmètre, débit et fenêtre de cette campagne)'
    else:
        conclusion = 'R2 conforme mais bénéfice insuffisant'
    if not fixed and ref['issue'] != 'application':
        conclusion += ' ; référence portant le défaut démontré du limiteur, non corrigé'
    print(f'conclusion (sous réserve du contrat final) : {conclusion}')


def limiter_accept(pkg, out, *repros):
    """Amendement 2 : verdict du test isolé du limiteur (un fichier par plafond de tas) pour le paquet pkg."""
    tree = subprocess.run(['bash', '-c', 'cd "$1" && find . -type f -print0 | sort -z | xargs -0 sha256sum | sha256sum',
                           '_', pkg], capture_output=True, text=True, check=True).stdout.split()[0]
    version = json.loads((pathlib.Path(pkg) / 'package.json').read_text())['version']
    runs = []
    for path in repros:
        raw = pathlib.Path(path).read_bytes()
        rows = [json.loads(l) for l in raw.decode().splitlines() if l.strip()]
        head, samples = rows[0], [r for r in rows if 's' in r]
        reasons = []
        if head.get('version') != version:
            reasons.append(f"version mesurée {head.get('version')} au lieu de {version}")
        if head.get('live') != head.get('N'):
            reasons.append(f"remplissage incomplet ({head.get('live')} coups vivants pour {head.get('N')})")
        if not any(r.get('end') for r in rows) or not samples:
            reasons.append('test non terminé')
        # Depuis le début de la charge : somme des écarts entre relevés (le premier part de ce début).
        elapsed_s = sum(r['gap_ms'] for r in samples) / 1000
        planned = head['R'] * elapsed_s
        done = samples[-1]['done'] if samples else 0
        max_gap = max((r['gap_ms'] for r in samples), default=None)
        if samples and samples[-1]['s'] < REPRO_AFTER_MIN_S:
            reasons.append(f"{samples[-1]['s']} s observées après le début des expirations")
        if max_gap is None or max_gap > REPRO_GAP_MAX_MS:
            reasons.append(f'écart maximal entre relevés {max_gap} ms')
        if not planned or done < REPRO_DONE_MIN * planned:
            reasons.append(f'{done} coups traités pour {planned:.0f} prévus')
        runs.append({'file': path, 'sha256': hashlib.sha256(raw).hexdigest(), 'heap_limit': head.get('heap_limit'),
                     'max_gap_ms': max_gap, 'elapsed_s': elapsed_s, 'planned': planned, 'done': done,
                     'loop_max_ms': max((r['loop_max_ms'] for r in samples), default=None),
                     'rss_max_mb': max((r['rss_mb'] for r in samples), default=None),
                     'heap_used_max_mb': max((r['heap_used_mb'] for r in samples), default=None),
                     'live_first': samples[0]['live'] if samples else None,
                     'live_last': samples[-1]['live'] if samples else None,
                     'accepted': not reasons, 'reasons': reasons})
    heaps = {r['heap_limit'] for r in runs}
    general = [] if len(runs) >= 2 and len(heaps) == len(runs) else ['au moins deux plafonds de tas distincts exigés']
    r = {'throttler': f'{version} {tree}', 'accepted': not general and all(x['accepted'] for x in runs),
         'reasons': general, 'runs': runs}
    pathlib.Path(out).write_text(json.dumps(r, indent=1) + '\n')
    for x in runs:
        print(f"limiteur {version} tas {x['heap_limit']} : écart max {x['max_gap_ms']} ms, {x['done']} traités pour "
              f"{x['planned']:.0f} prévus en {x['elapsed_s']:.1f} s, RSS max {'n/d' if x['rss_max_mb'] is None else format(x['rss_max_mb'], '.0f')} Mo, "
              f"{'accepté' if x['accepted'] else 'refusé : ' + '; '.join(x['reasons'])}")
    print(f"limiteur {r['throttler']} : {'accepté' if r['accepted'] else 'refusé'}" + (f" ({'; '.join(general)})" if general else ''))
    sys.exit(0 if r['accepted'] else 1)


COMMANDS = {
    'envexec': envexec,
    'sample': sample,
    'cgsnap': cgsnap,
    'compare': compare,
    'stats-ok': stats_ok,
    'run': run,
    'summary': summary,
    'upstreams': upstreams,
    'brief': brief,
    'foreign-ok': foreign_ok,
    'run4': run4,
    'brief4': brief4,
    'summary4': summary4,
    'limiter-accept': limiter_accept,
}

if __name__ == '__main__':
    if len(sys.argv) < 2 or sys.argv[1] not in COMMANDS:
        raise SystemExit(__doc__)
    COMMANDS[sys.argv[1]](*sys.argv[2:])
