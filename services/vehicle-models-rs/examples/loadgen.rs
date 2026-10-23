//! Banc d'essai hors production : charge HTTP à concurrence fixe.
//!
//! `loadgen <base> <fichier_chemins> <concurrence> <chauffe_s> <mesure_s>` envoie des GET
//! en tournant sur les chemins du fichier (un par ligne) et écrit une ligne JSON :
//! requêtes et statuts mesurés après la chauffe, débit, latences p50/p95/p99/max.
//! Toute réponse non 200 ou tout échec de transport compte comme erreur.
//!
//! Variables facultatives (campagne v3, `bench/PROTOCOL-v3.md`) ; absentes, le
//! comportement des campagnes v1 et v2 est inchangé :
//! - `LOADGEN_HEADERS` : fichier de lignes « Nom: valeur », en-têtes de chaque requête ;
//! - `LOADGEN_IP_PREFIX` et `LOADGEN_IP_COUNT` : `Cf-Connecting-Ip` = préfixe suivi de
//!   1…n en hexadécimal, la n-ième requête prenant l'adresse n modulo le nombre ;
//! - `LOADGEN_PROGRESS` : fichier réécrit toutes les 250 ms avec les compteurs cumulés
//!   depuis le départ, chauffe comprise (`t` en secondes Unix, `done`, `ok`) ; la
//!   présence de `<fichier>.stop` arrête l'envoi (champ `stopped` de la sortie).
//!
//! Campagne v4 (`bench/PROTOCOL-v4.md`) :
//! - `LOADGEN_RATE` (requêtes par seconde) : boucle ouverte. La requête k est prévue à
//!   départ + k / débit, quel que soit l'état des réponses ; `<concurrence>` devient le
//!   plafond de requêtes en vol. Une requête prévue alors que le plafond est atteint est
//!   abandonnée (jamais émise). Latences mesurées depuis l'heure prévue (le retard
//!   d'émission y est compté) et, à part, depuis l'émission. Compteurs séparés : prévues,
//!   émises, achevées, abandonnées. Après l'arrêt, les requêtes en vol sont attendues
//!   jusqu'à 65 s ; celles qui restent sont comptées `unfinished` ;
//! - `LOADGEN_SERIES` : fichier JSONL complété toutes les 10 s (écriture immédiate) avec
//!   les compteurs cumulés et les latences des requêtes achevées dans l'intervalle.

use std::collections::BTreeMap;
use std::io::Write;
use std::sync::atomic::{AtomicBool, AtomicU64, AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

use reqwest::header::{HeaderMap, HeaderName, HeaderValue};
use serde_json::json;

struct Sample {
    latencies_us: Vec<u64>,
    statuses: BTreeMap<String, u64>,
    bytes: u64,
}

#[derive(Default)]
struct Progress {
    done: AtomicU64,
    ok: AtomicU64,
    stopped: AtomicBool,
    finished: AtomicBool,
    // Boucle ouverte (`LOADGEN_RATE`), depuis le départ, chauffe comprise.
    planned: AtomicU64,
    emitted: AtomicU64,
    abandoned: AtomicU64,
    inflight: AtomicU64,
    inflight_max: AtomicU64,
}

/// Mesures de la fenêtre (requêtes prévues après la chauffe), boucle ouverte.
#[derive(Default)]
struct Window {
    planned: u64,
    emitted: u64,
    abandoned: u64,
    from_planned_us: Vec<u64>,
    from_emitted_us: Vec<u64>,
    lag_us: Vec<u64>,
    statuses: BTreeMap<String, u64>,
    bytes: u64,
}

/// Requêtes achevées depuis la dernière ligne de `LOADGEN_SERIES`.
#[derive(Default)]
struct Interval {
    from_planned_us: Vec<u64>,
    ok: u64,
}

async fn status_of(result: Result<reqwest::Response, reqwest::Error>) -> (String, u64) {
    match result {
        Ok(response) => {
            let status = response.status().as_u16().to_string();
            match response.bytes().await {
                Ok(body) => (status, body.len() as u64),
                Err(_) => ("body_error".to_owned(), 0),
            }
        }
        Err(e) if e.is_timeout() => ("timeout".to_owned(), 0),
        Err(_) => ("transport_error".to_owned(), 0),
    }
}

fn headers_from_env() -> Result<HeaderMap, String> {
    let mut map = HeaderMap::new();
    let Ok(file) = std::env::var("LOADGEN_HEADERS") else {
        return Ok(map);
    };
    for line in std::fs::read_to_string(&file)
        .map_err(|e| format!("{file}: {e}"))?
        .lines()
    {
        let line = line.trim();
        if line.is_empty() || line.starts_with('#') {
            continue;
        }
        let (name, value) = line
            .split_once(':')
            .ok_or_else(|| format!("{file}: ligne sans « : » : {line}"))?;
        let name = HeaderName::from_bytes(name.trim().as_bytes()).map_err(|e| format!("{file}: {e}"))?;
        let value = HeaderValue::from_str(value.trim()).map_err(|e| format!("{file}: {e}"))?;
        map.append(name, value);
    }
    Ok(map)
}

fn client_ips_from_env() -> Result<Vec<HeaderValue>, String> {
    match (
        std::env::var("LOADGEN_IP_PREFIX"),
        std::env::var("LOADGEN_IP_COUNT"),
    ) {
        (Err(_), Err(_)) => Ok(Vec::new()),
        (Ok(prefix), Ok(count)) => {
            let count = count
                .parse::<usize>()
                .map_err(|e| format!("LOADGEN_IP_COUNT: {e}"))?;
            (1..=count)
                .map(|n| HeaderValue::from_str(&format!("{prefix}{n:x}")).map_err(|e| e.to_string()))
                .collect()
        }
        _ => Err("LOADGEN_IP_PREFIX et LOADGEN_IP_COUNT vont ensemble".into()),
    }
}

fn percentile(sorted: &[u64], p: f64) -> f64 {
    if sorted.is_empty() {
        return 0.0;
    }
    let rank = ((p / 100.0) * sorted.len() as f64).ceil() as usize;
    sorted[rank.clamp(1, sorted.len()) - 1] as f64 / 1000.0
}

#[tokio::main(flavor = "multi_thread", worker_threads = 2)]
async fn main() -> Result<(), String> {
    let _ = rustls::crypto::ring::default_provider().install_default();
    let args: Vec<String> = std::env::args().collect();
    if args.len() != 6 {
        return Err("usage : loadgen <base> <fichier_chemins> <concurrence> <chauffe_s> <mesure_s>".into());
    }
    let base = args[1].trim_end_matches('/').to_owned();
    let paths: Vec<String> = std::fs::read_to_string(&args[2])
        .map_err(|e| format!("{}: {e}", args[2]))?
        .lines()
        .filter(|l| !l.trim().is_empty())
        .map(|l| format!("{base}{}", l.trim()))
        .collect();
    if paths.is_empty() {
        return Err("aucun chemin".into());
    }
    let parse = |i: usize| args[i].parse::<u64>().map_err(|e| format!("{}: {e}", args[i]));
    let (concurrency, warmup, measure) = (parse(3)? as usize, parse(4)?, parse(5)?);

    let client_ips = Arc::new(client_ips_from_env()?);
    let progress_file = std::env::var("LOADGEN_PROGRESS").ok();
    if let Some(file) = &progress_file
        && std::path::Path::new(&format!("{file}.stop")).exists()
    {
        return Err(format!("{file}.stop existe déjà"));
    }
    let progress = Arc::new(Progress::default());

    let client = reqwest::Client::builder()
        .default_headers(headers_from_env()?)
        .pool_max_idle_per_host(concurrency)
        .timeout(Duration::from_secs(60))
        .build()
        .map_err(|e| e.to_string())?;
    let paths = Arc::new(paths);
    let next = Arc::new(AtomicUsize::new(0));
    let start = Instant::now();
    let measure_from = start + Duration::from_secs(warmup);
    let stop = measure_from + Duration::from_secs(measure);

    let monitor = progress_file.map(|file| {
        let progress = progress.clone();
        tokio::spawn(async move {
            let (stop_file, tmp) = (format!("{file}.stop"), format!("{file}.tmp"));
            loop {
                if std::path::Path::new(&stop_file).exists() {
                    progress.stopped.store(true, Ordering::Relaxed);
                }
                let finished = progress.finished.load(Ordering::Relaxed);
                let t = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default();
                let line = json!({
                    "t": t.as_secs_f64(),
                    "done": progress.done.load(Ordering::Relaxed),
                    "ok": progress.ok.load(Ordering::Relaxed),
                    "planned": progress.planned.load(Ordering::Relaxed),
                    "emitted": progress.emitted.load(Ordering::Relaxed),
                    "abandoned": progress.abandoned.load(Ordering::Relaxed),
                    "inflight": progress.inflight.load(Ordering::Relaxed),
                });
                if std::fs::write(&tmp, line.to_string()).is_ok() {
                    let _ = std::fs::rename(&tmp, &file);
                }
                if finished {
                    break;
                }
                tokio::time::sleep(Duration::from_millis(250)).await;
            }
        })
    });

    if let Ok(rate) = std::env::var("LOADGEN_RATE") {
        let rate = rate.parse::<f64>().map_err(|e| format!("LOADGEN_RATE: {e}"))?;
        if !rate.is_finite() || rate <= 0.0 {
            return Err("LOADGEN_RATE doit être positif".into());
        }
        let window = Arc::new(Mutex::new(Window::default()));
        let interval = Arc::new(Mutex::new(Interval::default()));
        let series = std::env::var("LOADGEN_SERIES").ok().map(|file| {
            let (progress, interval) = (progress.clone(), interval.clone());
            tokio::spawn(async move {
                let mut out = std::fs::OpenOptions::new()
                    .create_new(true)
                    .append(true)
                    .open(&file)
                    .map_err(|e| format!("{file}: {e}"))?;
                let mut last = Instant::now();
                loop {
                    tokio::time::sleep(Duration::from_millis(250)).await;
                    let finished = progress.finished.load(Ordering::Relaxed);
                    if !finished && last.elapsed() < Duration::from_secs(10) {
                        continue;
                    }
                    last = Instant::now();
                    let mut done = std::mem::take(&mut *interval.lock().expect("intervalle"));
                    done.from_planned_us.sort_unstable();
                    let t = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default();
                    let line = json!({
                        "t": t.as_secs_f64(),
                        "planned": progress.planned.load(Ordering::Relaxed),
                        "emitted": progress.emitted.load(Ordering::Relaxed),
                        "completed": progress.done.load(Ordering::Relaxed),
                        "ok": progress.ok.load(Ordering::Relaxed),
                        "abandoned": progress.abandoned.load(Ordering::Relaxed),
                        "inflight": progress.inflight.load(Ordering::Relaxed),
                        "n": done.from_planned_us.len(),
                        "n_ok": done.ok,
                        "p50_ms": percentile(&done.from_planned_us, 50.0),
                        "p95_ms": percentile(&done.from_planned_us, 95.0),
                        "p99_ms": percentile(&done.from_planned_us, 99.0),
                        "max_ms": done.from_planned_us.last().map(|v| *v as f64 / 1000.0).unwrap_or(0.0),
                    });
                    writeln!(out, "{line}").map_err(|e| format!("{file}: {e}"))?;
                    if finished {
                        return Ok::<(), String>(());
                    }
                }
            })
        });
        let cap = concurrency as u64;
        let mut k: u64 = 0;
        loop {
            let planned_at = start + Duration::from_secs_f64(k as f64 / rate);
            k += 1;
            if planned_at >= stop || progress.stopped.load(Ordering::Relaxed) {
                break;
            }
            tokio::time::sleep_until(planned_at.into()).await;
            if progress.stopped.load(Ordering::Relaxed) {
                break;
            }
            let in_window = planned_at >= measure_from;
            let n = (k - 1) as usize;
            progress.planned.fetch_add(1, Ordering::Relaxed);
            if in_window {
                window.lock().expect("fenêtre").planned += 1;
            }
            if progress.inflight.load(Ordering::Relaxed) >= cap {
                progress.abandoned.fetch_add(1, Ordering::Relaxed);
                if in_window {
                    window.lock().expect("fenêtre").abandoned += 1;
                }
                continue;
            }
            let emitted_at = Instant::now();
            let inflight = progress.inflight.fetch_add(1, Ordering::Relaxed) + 1;
            progress.inflight_max.fetch_max(inflight, Ordering::Relaxed);
            progress.emitted.fetch_add(1, Ordering::Relaxed);
            if in_window {
                let mut w = window.lock().expect("fenêtre");
                w.emitted += 1;
                w.lag_us
                    .push(emitted_at.saturating_duration_since(planned_at).as_micros() as u64);
            }
            let mut request = client.get(&paths[n % paths.len()]);
            if !client_ips.is_empty() {
                request = request.header("cf-connecting-ip", client_ips[n % client_ips.len()].clone());
            }
            let (progress, window, interval) = (progress.clone(), window.clone(), interval.clone());
            tokio::spawn(async move {
                let (status, bytes) = status_of(request.send().await).await;
                let done_at = Instant::now();
                let from_planned = done_at.saturating_duration_since(planned_at).as_micros() as u64;
                let ok = status == "200";
                {
                    let mut i = interval.lock().expect("intervalle");
                    i.from_planned_us.push(from_planned);
                    i.ok += u64::from(ok);
                }
                if in_window {
                    let mut w = window.lock().expect("fenêtre");
                    w.from_planned_us.push(from_planned);
                    w.from_emitted_us
                        .push(done_at.saturating_duration_since(emitted_at).as_micros() as u64);
                    *w.statuses.entry(status).or_default() += 1;
                    w.bytes += bytes;
                }
                progress.done.fetch_add(1, Ordering::Relaxed);
                if ok {
                    progress.ok.fetch_add(1, Ordering::Relaxed);
                }
                progress.inflight.fetch_sub(1, Ordering::Relaxed);
            });
        }
        let ended = Instant::now();
        let deadline = ended + Duration::from_secs(65);
        while progress.inflight.load(Ordering::Relaxed) > 0 && Instant::now() < deadline {
            tokio::time::sleep(Duration::from_millis(10)).await;
        }
        let unfinished = progress.inflight.load(Ordering::Relaxed);
        progress.finished.store(true, Ordering::Relaxed);
        if let Some(monitor) = monitor {
            monitor.await.map_err(|e| e.to_string())?;
        }
        if let Some(series) = series {
            series.await.map_err(|e| e.to_string())??;
        }
        let mut w = std::mem::take(&mut *window.lock().expect("fenêtre"));
        w.from_planned_us.sort_unstable();
        w.from_emitted_us.sort_unstable();
        w.lag_us.sort_unstable();
        // Fenêtre prévue : de la fin de la chauffe à la dernière heure prévue (arrêt
        // demandé compris), indépendante de la durée des dernières réponses.
        let window_s = ended
            .min(stop)
            .saturating_duration_since(measure_from)
            .as_secs_f64();
        let completed = w.from_planned_us.len() as u64;
        let ok = w.statuses.get("200").copied().unwrap_or(0);
        println!(
            "{}",
            json!({
                "mode": "rate",
                "rate": rate,
                "max_inflight": cap,
                "planned": w.planned,
                "emitted": w.emitted,
                "completed": completed,
                "abandoned": w.abandoned,
                "unfinished": unfinished,
                "inflight_max": progress.inflight_max.load(Ordering::Relaxed),
                "requests": completed,
                "errors": completed - ok,
                "statuses": w.statuses,
                "window_s": window_s,
                "rps": completed as f64 / window_s,
                "served_rps": ok as f64 / window_s,
                "bytes": w.bytes,
                "p50_ms": percentile(&w.from_planned_us, 50.0),
                "p95_ms": percentile(&w.from_planned_us, 95.0),
                "p99_ms": percentile(&w.from_planned_us, 99.0),
                "max_ms": w.from_planned_us.last().map(|v| *v as f64 / 1000.0).unwrap_or(0.0),
                "service_p50_ms": percentile(&w.from_emitted_us, 50.0),
                "service_p95_ms": percentile(&w.from_emitted_us, 95.0),
                "service_p99_ms": percentile(&w.from_emitted_us, 99.0),
                "lag_p99_ms": percentile(&w.lag_us, 99.0),
                "lag_max_ms": w.lag_us.last().map(|v| *v as f64 / 1000.0).unwrap_or(0.0),
                "stopped": progress.stopped.load(Ordering::Relaxed),
            })
        );
        return Ok(());
    }

    let mut tasks = Vec::with_capacity(concurrency);
    for _ in 0..concurrency {
        let (client, paths, next) = (client.clone(), paths.clone(), next.clone());
        let (client_ips, progress) = (client_ips.clone(), progress.clone());
        tasks.push(tokio::spawn(async move {
            let mut sample = Sample {
                latencies_us: Vec::new(),
                statuses: BTreeMap::new(),
                bytes: 0,
            };
            loop {
                let sent = Instant::now();
                if sent >= stop || progress.stopped.load(Ordering::Relaxed) {
                    break;
                }
                let n = next.fetch_add(1, Ordering::Relaxed);
                let mut request = client.get(&paths[n % paths.len()]);
                if !client_ips.is_empty() {
                    request = request.header("cf-connecting-ip", client_ips[n % client_ips.len()].clone());
                }
                let (status, bytes) = match request.send().await {
                    Ok(response) => {
                        let status = response.status().as_u16().to_string();
                        match response.bytes().await {
                            Ok(body) => (status, body.len() as u64),
                            Err(_) => ("body_error".to_owned(), 0),
                        }
                    }
                    Err(e) if e.is_timeout() => ("timeout".to_owned(), 0),
                    Err(_) => ("transport_error".to_owned(), 0),
                };
                progress.done.fetch_add(1, Ordering::Relaxed);
                if status == "200" {
                    progress.ok.fetch_add(1, Ordering::Relaxed);
                }
                if sent >= measure_from {
                    sample.latencies_us.push(sent.elapsed().as_micros() as u64);
                    *sample.statuses.entry(status).or_default() += 1;
                    sample.bytes += bytes;
                }
            }
            sample
        }));
    }

    let mut latencies = Vec::new();
    let mut statuses: BTreeMap<String, u64> = BTreeMap::new();
    let mut bytes = 0;
    for task in tasks {
        let sample = task.await.map_err(|e| e.to_string())?;
        latencies.extend(sample.latencies_us);
        for (status, n) in sample.statuses {
            *statuses.entry(status).or_default() += n;
        }
        bytes += sample.bytes;
    }
    progress.finished.store(true, Ordering::Relaxed);
    if let Some(monitor) = monitor {
        monitor.await.map_err(|e| e.to_string())?;
    }
    // Fenêtre réelle : la dernière requête lancée avant l'arrêt peut finir après.
    let window = Instant::now()
        .saturating_duration_since(measure_from)
        .as_secs_f64();
    latencies.sort_unstable();
    let requests = latencies.len() as u64;
    let ok = statuses.get("200").copied().unwrap_or(0);
    println!(
        "{}",
        json!({
            "requests": requests,
            "errors": requests - ok,
            "statuses": statuses,
            "window_s": window,
            "rps": requests as f64 / window,
            "bytes": bytes,
            "p50_ms": percentile(&latencies, 50.0),
            "p95_ms": percentile(&latencies, 95.0),
            "p99_ms": percentile(&latencies, 99.0),
            "max_ms": latencies.last().map(|v| *v as f64 / 1000.0).unwrap_or(0.0),
            "stopped": progress.stopped.load(Ordering::Relaxed),
        })
    );
    Ok(())
}
