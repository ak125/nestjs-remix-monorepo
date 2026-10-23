// Sonde mémoire du Node testé (campagne v4, PROTOCOL-v4.md), chargée par
// NODE_OPTIONS=--require dans le processus A2 lui-même. Toutes les 10 s, une ligne
// JSON : process.memoryUsage(), statistiques du tas V8 et de ses espaces, temps de GC
// par type, retard de la boucle d'événements, CPU du processus, handles libuv par type
// (sockets, serveurs), et taille des tables
// du limiteur (@nestjs/throttler) : minuteries par palier (6.5.0) ou échéances par
// palier (6.7.x), nombre de clés.
//
// Écriture par un descripteur ouvert une fois sur MEMPROBE_OUT (une FIFO lue hors du
// cgroup des cibles) : chaque ligne quitte le processus aussitôt, même s'il est tué
// ensuite. Sans MEMPROBE_OUT, la sonde ne fait rien ; la variable est retirée de
// l'environnement pour que les processus fils ne l'héritent pas.
'use strict';

const out = process.env.MEMPROBE_OUT;
delete process.env.MEMPROBE_OUT;
if (out) {
  const fs = require('node:fs');
  const v8 = require('node:v8');
  const { PerformanceObserver, monitorEventLoopDelay, constants } = require('node:perf_hooks');

  const fd = fs.openSync(out, 'w');
  const gcKinds = {
    [constants.NODE_PERFORMANCE_GC_MINOR]: 'minor',
    [constants.NODE_PERFORMANCE_GC_MAJOR]: 'major',
    [constants.NODE_PERFORMANCE_GC_INCREMENTAL]: 'incremental',
    [constants.NODE_PERFORMANCE_GC_WEAKCB]: 'weakcb',
  };
  let gc = {};
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      const kind = gcKinds[entry.detail?.kind] ?? String(entry.detail?.kind);
      const g = (gc[kind] ??= { n: 0, ms: 0, max_ms: 0 });
      g.n += 1;
      g.ms += entry.duration;
      g.max_ms = Math.max(g.max_ms, entry.duration);
    }
  }).observe({ entryTypes: ['gc'] });
  const loop = monitorEventLoopDelay({ resolution: 20 });
  loop.enable();

  // Instance du stockage du limiteur : capturée au premier appel d'increment, puis
  // la méthode d'origine est remise en place.
  let storage = null;
  let hooked = false;
  const hook = () => {
    if (hooked) return;
    const file = Object.keys(require.cache).find((f) =>
      f.endsWith('/@nestjs/throttler/dist/throttler.service.js'),
    );
    if (!file) return;
    const proto = require.cache[file].exports.ThrottlerStorageService?.prototype;
    if (!proto) return;
    hooked = true;
    const original = proto.increment;
    proto.increment = function (...args) {
      storage = this;
      proto.increment = original;
      return original.apply(this, args);
    };
  };
  const throttler = () => {
    if (!storage) return null;
    const result = { keys: storage._storage?.size ?? null };
    if (storage.timeoutIds instanceof Map) {
      // 6.5.0 : une minuterie par coup, tableau par palier.
      result.timers = Object.fromEntries([...storage.timeoutIds].map(([k, v]) => [k, v.length]));
    }
    if (storage.hitExpirations instanceof Map) {
      // 6.7.x : échéances par clé et par palier.
      const hits = {};
      for (const perKey of storage.hitExpirations.values()) {
        for (const [name, list] of perKey) hits[name] = (hits[name] ?? 0) + list.length;
      }
      result.hit_expirations = hits;
      result.expiration_keys = storage.hitExpirations.size;
    }
    return result;
  };

  // Handles libuv par type (sockets, serveurs…) ; les minuteries JS n'y figurent pas une à une.
  const handles = () => {
    try {
      return process._getActiveHandles().reduce((acc, h) => {
        const name = h?.constructor?.name ?? typeof h;
        acc[name] = (acc[name] ?? 0) + 1;
        return acc;
      }, {});
    } catch {
      return null;
    }
  };
  let cpu = process.cpuUsage();
  const write = (line) => {
    try {
      fs.writeSync(fd, JSON.stringify(line) + '\n');
    } catch (error) {
      clearInterval(timer);
      process.emitWarning(`memprobe : écriture impossible (${error.code}), sonde arrêtée`);
    }
  };
  const timer = setInterval(() => {
    hook();
    const now = process.cpuUsage();
    const line = {
      t: Date.now() / 1000,
      uptime_s: process.uptime(),
      pid: process.pid,
      memory: process.memoryUsage(),
      heap: v8.getHeapStatistics(),
      spaces: Object.fromEntries(
        v8.getHeapSpaceStatistics().map((s) => [s.space_name, { size: s.space_size, used: s.space_used_size }]),
      ),
      cpu_us: { user: now.user - cpu.user, system: now.system - cpu.system },
      gc,
      loop_ms: {
        mean: loop.mean / 1e6,
        p99: loop.percentile(99) / 1e6,
        max: loop.max / 1e6,
      },
      handles: handles(),
      throttler: throttler(),
    };
    cpu = now;
    gc = {};
    loop.reset();
    write(line);
  }, 10_000);
  timer.unref();
  write({ t: Date.now() / 1000, start: true, pid: process.pid, node: process.version, argv: process.execArgv });
}
