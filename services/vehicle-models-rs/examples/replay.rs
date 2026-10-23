//! Banc d'essai hors production : proxy d'enregistrement puis de rejeu PostgREST.
//!
//! `record <écoute> <SUPABASE_URL> <fichier.jsonl>` relaie vers la base, un appel à la
//! fois, les seuls GET des tables listées dans `RECORD_TABLES` (par défaut
//! `auto_modele,auto_type`), avec la clé lue dans `SUPABASE_SERVICE_ROLE_KEY` : les
//! `apikey`/`authorization` du client ne sont jamais relayés et la clé n'est jamais
//! écrite. Tout autre appel (écriture, RPC, autre table) est refusé (403) sans atteindre
//! la base, et compté. Une clé déjà enregistrée est resservie sans nouvel appel.
//!
//! `replay <écoute> <fichier.jsonl> [latence_ms] [fichier…]` resert les échanges des
//! fichiers. La clé d'un échange est la méthode, le chemin et la requête brute ; une clé
//! absente répond 599 et prouve une divergence d'encodage entre les deux clients
//! (`misses` pour les tables de la route, `other_misses` pour les autres).
//!
//! Aucune écriture n'est relayée. En rejeu, `POST /rest/v1/__error_logs` répond 201 sans
//! corps, comme PostgREST avec `return=minimal` (puits du journal d'erreurs) ; toute autre
//! écriture répond 403. Dans les deux modes, les écritures reçues sont gardées (bornées)
//! pour `GET /__writes`, afin de comparer les tentatives d'écriture des deux chemins.
//!
//! `GET /__stats` : compteurs ; `POST /__fault` (`{"status","body","remaining","path_prefix"}`) :
//! réponses imposées aux lectures (dont le chemin commence par `path_prefix` s'il est
//! donné, comptées dans `faulted`) pour éprouver les chemins d'erreur ; `POST /__reset`.

use std::collections::HashMap;
use std::io::{BufRead, Write};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use axum::Router;
use axum::body::Bytes;
use axum::extract::{DefaultBodyLimit, State};
use axum::http::{HeaderMap, HeaderValue, Method, StatusCode, Uri, header};
use axum::response::{IntoResponse, Response};
use axum::routing::{get, post};
use serde_json::{Value, json};

/// En-têtes de requête comparés entre l'enregistrement et le rejeu.
const COMPARED_REQUEST_HEADERS: [&str; 3] = ["accept", "accept-profile", "prefer"];
/// En-têtes du client relayés vers la base (`accept-encoding` exclu : corps en clair ;
/// `apikey`/`authorization` remplacés par la clé du banc).
const FORWARDED_REQUEST_HEADERS: [&str; 4] = ["accept", "accept-profile", "prefer", "x-client-info"];
/// Tables lues par la route (contenu et contrôle de session) : leurs absences bloquent la parité.
const ROUTE_TABLES: [&str; 4] = ["auto_modele", "auto_type", "___config_admin", "___xtr_customer"];
const DEFAULT_RECORD_TABLES: &str = "auto_modele,auto_type";
/// Seule écriture acceptée en rejeu, jamais relayée.
const ERROR_LOG_SINK: &str = "/rest/v1/__error_logs";
const MAX_WRITES: usize = 500;
const MAX_WRITE_BODY: usize = 1 << 16;
const MAX_MISS_KEYS: usize = 50;

#[derive(Debug, PartialEq, Eq)]
enum Decision {
    /// Enregistrement : lecture relayée vers la base.
    Forward,
    /// Rejeu : lecture servie depuis les fichiers.
    Lookup,
    /// Rejeu : écriture du journal d'erreurs, gardée et acquittée (201).
    AcceptWrite,
    /// Écriture refusée (403), gardée.
    RefuseWrite,
    /// Enregistrement : lecture hors liste autorisée, refusée (403).
    RefusePath,
}

/// Table PostgREST visée par un chemin sans requête (`/rest/v1/<table>`), RPC exclues.
fn table_of(path: &str) -> Option<&str> {
    path.strip_prefix("/rest/v1/")
        .filter(|t| !t.is_empty() && !t.contains('/'))
}

fn record_decision(method: &Method, path: &str, tables: &[String]) -> Decision {
    if method != Method::GET {
        return Decision::RefuseWrite;
    }
    match table_of(path) {
        Some(table) if tables.iter().any(|t| t == table) => Decision::Forward,
        _ => Decision::RefusePath,
    }
}

fn replay_decision(method: &Method, path: &str) -> Decision {
    if method == Method::GET || method == Method::HEAD {
        Decision::Lookup
    } else if method == Method::POST && path == ERROR_LOG_SINK {
        Decision::AcceptWrite
    } else {
        Decision::RefuseWrite
    }
}

fn is_route_table(path: &str) -> bool {
    table_of(path).is_some_and(|t| ROUTE_TABLES.contains(&t))
}

fn fault_applies(prefix: Option<&str>, path: &str) -> bool {
    prefix.is_none_or(|p| path.starts_with(p))
}

fn parse_tables(spec: &str) -> Vec<String> {
    spec.split(',')
        .map(str::trim)
        .filter(|t| !t.is_empty())
        .map(str::to_owned)
        .collect()
}

#[derive(Clone)]
struct Exchange {
    status: u16,
    content_type: Option<String>,
    content_range: Option<String>,
    body: String,
    request: HashMap<String, String>,
}

struct Fault {
    status: u16,
    body: String,
    remaining: i64,
    path_prefix: Option<String>,
}

enum Mode {
    Record {
        upstream: String,
        key: String,
        tables: Vec<String>,
        client: reqwest::Client,
        out: Mutex<std::fs::File>,
        /// Un seul appel à la base à la fois.
        serial: tokio::sync::Mutex<()>,
    },
    Replay {
        latency: Duration,
    },
}

#[derive(Default)]
struct Counters {
    hits: AtomicU64,
    misses: AtomicU64,
    other_misses: AtomicU64,
    header_mismatches: AtomicU64,
    upstream_calls: AtomicU64,
    upstream_errors: AtomicU64,
    reused: AtomicU64,
    refused_paths: AtomicU64,
    accepted_writes: AtomicU64,
    refused_writes: AtomicU64,
    faulted: AtomicU64,
}

impl Counters {
    fn all(&self) -> [(&'static str, &AtomicU64); 11] {
        [
            ("hits", &self.hits),
            ("misses", &self.misses),
            ("other_misses", &self.other_misses),
            ("header_mismatches", &self.header_mismatches),
            ("upstream_calls", &self.upstream_calls),
            ("upstream_errors", &self.upstream_errors),
            ("reused", &self.reused),
            ("refused_paths", &self.refused_paths),
            ("accepted_writes", &self.accepted_writes),
            ("refused_writes", &self.refused_writes),
            ("faulted", &self.faulted),
        ]
    }
}

struct Replay {
    mode: Mode,
    exchanges: Mutex<HashMap<String, Exchange>>,
    fault: Mutex<Option<Fault>>,
    counters: Counters,
    miss_keys: Mutex<Vec<String>>,
    writes: Mutex<Vec<Value>>,
}

fn bump(counter: &AtomicU64) {
    counter.fetch_add(1, Ordering::Relaxed);
}

fn request_headers(headers: &HeaderMap) -> HashMap<String, String> {
    COMPARED_REQUEST_HEADERS
        .iter()
        .filter_map(|name| {
            let value = headers.get(*name)?.to_str().ok()?;
            Some(((*name).to_owned(), value.to_owned()))
        })
        .collect()
}

fn respond(status: u16, content_type: Option<&str>, content_range: Option<&str>, body: String) -> Response {
    let mut response = (
        StatusCode::from_u16(status).unwrap_or(StatusCode::BAD_GATEWAY),
        body,
    )
        .into_response();
    let headers = response.headers_mut();
    for (name, value) in [
        (header::CONTENT_TYPE, content_type),
        (header::CONTENT_RANGE, content_range),
    ] {
        if let Some(value) = value.and_then(|v| HeaderValue::from_str(v).ok()) {
            headers.insert(name, value);
        }
    }
    response
}

fn refusal(reason: &str, key: &str) -> Response {
    respond(
        403,
        Some("application/json"),
        None,
        json!({ "message": "banc : appel refusé", "reason": reason, "key": key }).to_string(),
    )
}

fn serve(exchange: Exchange) -> Response {
    respond(
        exchange.status,
        exchange.content_type.as_deref(),
        exchange.content_range.as_deref(),
        exchange.body,
    )
}

/// Garde une écriture reçue (bornée en nombre et en taille), sans jamais la relayer.
fn keep_write(state: &Replay, method: &Method, uri: &Uri, headers: &HeaderMap, body: &Bytes, answer: u16) {
    let mut writes = state.writes.lock().unwrap();
    if writes.len() >= MAX_WRITES {
        return;
    }
    let text = String::from_utf8_lossy(&body[..body.len().min(MAX_WRITE_BODY)]).into_owned();
    writes.push(json!({
        "method": method.as_str(),
        "path": uri.path(),
        "query": uri.query(),
        "prefer": headers.get("prefer").and_then(|v| v.to_str().ok()),
        "answer": answer,
        "body_len": body.len(),
        "body": text,
    }));
}

async fn handle(
    State(state): State<Arc<Replay>>,
    method: Method,
    uri: Uri,
    headers: HeaderMap,
    body: Bytes,
) -> Response {
    let path = uri.path();
    let key = format!(
        "{method} {}",
        uri.path_and_query().map(|p| p.as_str()).unwrap_or("/")
    );
    let decision = match &state.mode {
        Mode::Record { tables, .. } => record_decision(&method, path, tables),
        Mode::Replay { .. } => replay_decision(&method, path),
    };
    match decision {
        Decision::RefuseWrite => {
            bump(&state.counters.refused_writes);
            keep_write(&state, &method, &uri, &headers, &body, 403);
            return refusal("écriture", &key);
        }
        Decision::AcceptWrite => {
            bump(&state.counters.accepted_writes);
            keep_write(&state, &method, &uri, &headers, &body, 201);
            return respond(201, None, None, String::new());
        }
        Decision::RefusePath => {
            bump(&state.counters.refused_paths);
            eprintln!("record: lecture hors liste refusée {}", uri.path());
            return refusal("hors liste", &key);
        }
        Decision::Forward | Decision::Lookup => {}
    }
    {
        let mut fault = state.fault.lock().unwrap();
        if let Some(f) = fault
            .as_mut()
            .filter(|f| f.remaining != 0 && fault_applies(f.path_prefix.as_deref(), path))
        {
            f.remaining -= 1;
            bump(&state.counters.faulted);
            return respond(
                f.status,
                Some("application/json; charset=utf-8"),
                None,
                f.body.clone(),
            );
        }
    }
    let request = request_headers(&headers);
    let found = state.exchanges.lock().unwrap().get(&key).cloned();
    match &state.mode {
        Mode::Replay { latency } => {
            let Some(exchange) = found else {
                if is_route_table(path) {
                    bump(&state.counters.misses);
                    let mut keys = state.miss_keys.lock().unwrap();
                    if keys.len() < MAX_MISS_KEYS {
                        keys.push(key.clone());
                    }
                    eprintln!("replay: clé absente {key}");
                } else {
                    bump(&state.counters.other_misses);
                    eprintln!("replay: clé absente hors route {method} {path}");
                }
                return respond(
                    599,
                    Some("application/json"),
                    None,
                    json!({ "message": "replay miss", "key": key }).to_string(),
                );
            };
            if exchange.request != request {
                bump(&state.counters.header_mismatches);
                eprintln!(
                    "replay: en-têtes différents pour {key}: {request:?} != {:?}",
                    exchange.request
                );
            }
            bump(&state.counters.hits);
            if !latency.is_zero() {
                tokio::time::sleep(*latency).await;
            }
            serve(exchange)
        }
        Mode::Record {
            upstream,
            key: api_key,
            client,
            out,
            serial,
            ..
        } => {
            if let Some(exchange) = found {
                bump(&state.counters.reused);
                return serve(exchange);
            }
            let _turn = serial.lock().await;
            // Une autre requête a pu enregistrer la même clé pendant l'attente.
            if let Some(exchange) = state.exchanges.lock().unwrap().get(&key).cloned() {
                bump(&state.counters.reused);
                return serve(exchange);
            }
            let mut forwarded = reqwest::header::HeaderMap::new();
            for name in FORWARDED_REQUEST_HEADERS {
                if let Some(value) = headers.get(name) {
                    forwarded.insert(name, value.clone());
                }
            }
            let (Ok(apikey), Ok(bearer)) = (
                HeaderValue::from_str(api_key),
                HeaderValue::from_str(&format!("Bearer {api_key}")),
            ) else {
                return respond(500, None, None, String::new());
            };
            forwarded.insert("apikey", apikey);
            forwarded.insert(header::AUTHORIZATION, bearer);
            let target = uri.path_and_query().map(|p| p.as_str()).unwrap_or("/");
            bump(&state.counters.upstream_calls);
            let reply = match client
                .get(format!("{upstream}{target}"))
                .headers(forwarded)
                .send()
                .await
            {
                Ok(reply) => reply,
                Err(e) => {
                    bump(&state.counters.upstream_errors);
                    eprintln!("record: relais impossible pour {key}: {}", e.without_url());
                    return respond(502, None, None, String::new());
                }
            };
            let status = reply.status().as_u16();
            let text = |name: &str| {
                reply
                    .headers()
                    .get(name)
                    .and_then(|v| v.to_str().ok())
                    .map(str::to_owned)
            };
            let (content_type, content_range) = (text("content-type"), text("content-range"));
            let body = match reply.text().await {
                Ok(body) => body,
                Err(e) => {
                    bump(&state.counters.upstream_errors);
                    eprintln!("record: corps illisible pour {key}: {}", e.without_url());
                    return respond(502, None, None, String::new());
                }
            };
            let exchange = Exchange {
                status,
                content_type,
                content_range,
                body,
                request,
            };
            let line = json!({
                "key": key,
                "request": exchange.request,
                "status": exchange.status,
                "content_type": exchange.content_type,
                "content_range": exchange.content_range,
                "body": exchange.body,
            });
            if let Err(e) = writeln!(out.lock().unwrap(), "{line}") {
                eprintln!("record: écriture impossible : {e}");
                return respond(500, None, None, String::new());
            }
            state.exchanges.lock().unwrap().insert(key, exchange.clone());
            bump(&state.counters.hits);
            serve(exchange)
        }
    }
}

async fn stats(State(state): State<Arc<Replay>>) -> Response {
    let mut body = serde_json::Map::new();
    for (name, counter) in state.counters.all() {
        body.insert(name.to_owned(), json!(counter.load(Ordering::Relaxed)));
    }
    body.insert(
        "exchanges".to_owned(),
        json!(state.exchanges.lock().unwrap().len()),
    );
    body.insert("miss_keys".to_owned(), json!(*state.miss_keys.lock().unwrap()));
    respond(
        200,
        Some("application/json"),
        None,
        Value::Object(body).to_string(),
    )
}

async fn writes(State(state): State<Arc<Replay>>) -> Response {
    let writes = state.writes.lock().unwrap();
    let body = json!({ "kept": writes.len(), "max": MAX_WRITES, "writes": *writes });
    respond(200, Some("application/json"), None, body.to_string())
}

async fn reset(State(state): State<Arc<Replay>>) -> StatusCode {
    for (_, counter) in state.counters.all() {
        counter.store(0, Ordering::Relaxed);
    }
    state.miss_keys.lock().unwrap().clear();
    state.writes.lock().unwrap().clear();
    *state.fault.lock().unwrap() = None;
    StatusCode::NO_CONTENT
}

fn parse_fault(body: &[u8]) -> Option<Fault> {
    let spec = serde_json::from_slice::<Value>(body).ok()?;
    let status = u16::try_from(spec["status"].as_u64()?).ok()?;
    Some(Fault {
        status,
        body: spec["body"].as_str()?.to_owned(),
        remaining: spec["remaining"].as_i64().unwrap_or(-1),
        path_prefix: spec["path_prefix"].as_str().map(str::to_owned),
    })
}

async fn fault(State(state): State<Arc<Replay>>, body: Bytes) -> StatusCode {
    let Some(fault) = parse_fault(&body) else {
        return StatusCode::BAD_REQUEST;
    };
    *state.fault.lock().unwrap() = Some(fault);
    StatusCode::NO_CONTENT
}

fn load(path: &str, exchanges: &mut HashMap<String, Exchange>) -> Result<(), String> {
    let file = std::fs::File::open(path).map_err(|e| format!("{path}: {e}"))?;
    for (n, line) in std::io::BufReader::new(file).lines().enumerate() {
        let line = line.map_err(|e| e.to_string())?;
        if line.trim().is_empty() {
            continue;
        }
        let v: Value = serde_json::from_str(&line).map_err(|e| format!("{path}:{}: {e}", n + 1))?;
        let text = |name: &str| v[name].as_str().map(str::to_owned);
        let request = v["request"]
            .as_object()
            .map(|o| {
                o.iter()
                    .filter_map(|(k, v)| Some((k.clone(), v.as_str()?.to_owned())))
                    .collect()
            })
            .unwrap_or_default();
        let key = text("key").ok_or_else(|| format!("{path}:{}: clé absente", n + 1))?;
        let exchange = Exchange {
            status: v["status"]
                .as_u64()
                .and_then(|s| u16::try_from(s).ok())
                .ok_or_else(|| format!("{path}:{}: statut absent", n + 1))?,
            content_type: text("content_type"),
            content_range: text("content_range"),
            body: text("body").ok_or_else(|| format!("{path}:{}: corps absent", n + 1))?,
            request,
        };
        if exchanges.insert(key.clone(), exchange).is_some() {
            return Err(format!("{path}:{}: clé en double {key}", n + 1));
        }
    }
    Ok(())
}

#[tokio::main(flavor = "multi_thread", worker_threads = 2)]
async fn main() -> Result<(), String> {
    let _ = rustls::crypto::ring::default_provider().install_default();
    let args: Vec<String> = std::env::args().collect();
    let usage = "usage : replay record <écoute> <SUPABASE_URL> <fichier> | replay replay <écoute> <fichier> [latence_ms] [fichier…]";
    let mut exchanges = HashMap::new();
    let mode = match args.get(1).map(String::as_str) {
        Some("record") if args.len() == 5 => {
            let key = std::env::var("SUPABASE_SERVICE_ROLE_KEY")
                .ok()
                .filter(|k| !k.is_empty())
                .ok_or("record : SUPABASE_SERVICE_ROLE_KEY absente")?;
            let tables = parse_tables(
                &std::env::var("RECORD_TABLES").unwrap_or_else(|_| DEFAULT_RECORD_TABLES.to_owned()),
            );
            if tables.is_empty() {
                return Err("record : RECORD_TABLES vide".to_owned());
            }
            let out = std::fs::OpenOptions::new()
                .create_new(true)
                .write(true)
                .open(&args[4])
                .map_err(|e| format!("{}: {e}", args[4]))?;
            let client = reqwest::Client::builder()
                .timeout(Duration::from_secs(30))
                .build()
                .map_err(|e| e.to_string())?;
            eprintln!("record: tables autorisées {tables:?}, un appel à la fois");
            Mode::Record {
                upstream: args[3].trim_end_matches('/').to_owned(),
                key,
                tables,
                client,
                out: Mutex::new(out),
                serial: tokio::sync::Mutex::new(()),
            }
        }
        Some("replay") if args.len() >= 4 => {
            let latency = match args.get(4) {
                Some(ms) => ms.parse::<u64>().map_err(|e| format!("latence {ms}: {e}"))?,
                None => 0,
            };
            load(&args[3], &mut exchanges)?;
            for extra in args.iter().skip(5) {
                load(extra, &mut exchanges)?;
            }
            Mode::Replay {
                latency: Duration::from_millis(latency),
            }
        }
        _ => return Err(usage.to_owned()),
    };
    let state = Arc::new(Replay {
        mode,
        exchanges: Mutex::new(exchanges),
        fault: Mutex::new(None),
        counters: Counters::default(),
        miss_keys: Mutex::new(Vec::new()),
        writes: Mutex::new(Vec::new()),
    });
    let app = Router::new()
        .route("/__stats", get(stats))
        .route("/__writes", get(writes))
        .route("/__reset", post(reset))
        .route("/__fault", post(fault))
        .fallback(handle)
        .layer(DefaultBodyLimit::max(16 << 20))
        .with_state(state);
    let listener = tokio::net::TcpListener::bind(&args[2])
        .await
        .map_err(|e| format!("{}: {e}", args[2]))?;
    eprintln!("replay: écoute sur {}", args[2]);
    axum::serve(listener, app).await.map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn tables() -> Vec<String> {
        parse_tables(DEFAULT_RECORD_TABLES)
    }

    #[test]
    fn record_relaie_seulement_les_get_des_tables_autorisees() {
        let t = tables();
        assert_eq!(
            record_decision(&Method::GET, "/rest/v1/auto_modele", &t),
            Decision::Forward
        );
        assert_eq!(
            record_decision(&Method::GET, "/rest/v1/auto_type", &t),
            Decision::Forward
        );
        for method in [
            Method::POST,
            Method::PATCH,
            Method::PUT,
            Method::DELETE,
            Method::HEAD,
        ] {
            assert_eq!(
                record_decision(&method, "/rest/v1/auto_modele", &t),
                Decision::RefuseWrite
            );
        }
        for path in [
            "/rest/v1/__error_logs",
            "/rest/v1/rpc/get_models",
            "/rest/v1/auto_modele/x",
            "/rest/v1/",
            "/auth/v1/user",
            "/rest/v1/auto_modele_x",
        ] {
            assert_eq!(
                record_decision(&Method::GET, path, &t),
                Decision::RefusePath,
                "{path}"
            );
        }
    }

    #[test]
    fn rejeu_acquitte_le_seul_puits_du_journal_et_refuse_les_autres_ecritures() {
        assert_eq!(
            replay_decision(&Method::GET, "/rest/v1/auto_type"),
            Decision::Lookup
        );
        assert_eq!(
            replay_decision(&Method::HEAD, "/rest/v1/auto_type"),
            Decision::Lookup
        );
        assert_eq!(
            replay_decision(&Method::POST, ERROR_LOG_SINK),
            Decision::AcceptWrite
        );
        assert_eq!(
            replay_decision(&Method::POST, "/rest/v1/rpc/x"),
            Decision::RefuseWrite
        );
        assert_eq!(
            replay_decision(&Method::PATCH, ERROR_LOG_SINK),
            Decision::RefuseWrite
        );
        assert_eq!(
            replay_decision(&Method::POST, "/rest/v1/__error_logs/x"),
            Decision::RefuseWrite
        );
    }

    #[test]
    fn tables_de_la_route_et_portee_des_pannes() {
        assert!(is_route_table("/rest/v1/auto_modele"));
        assert!(is_route_table("/rest/v1/___config_admin"));
        assert!(!is_route_table("/rest/v1/__seo_keywords"));
        assert!(!is_route_table("/rest/v1/rpc/auto_type"));
        assert!(fault_applies(None, "/rest/v1/___xtr_customer"));
        assert!(fault_applies(Some("/rest/v1/auto_"), "/rest/v1/auto_type"));
        assert!(!fault_applies(Some("/rest/v1/auto_"), "/rest/v1/___xtr_customer"));
    }

    #[test]
    fn specification_de_panne() {
        let f = parse_fault(br#"{"status":503,"body":"x","path_prefix":"/rest/v1/auto_modele"}"#).unwrap();
        assert_eq!((f.status, f.remaining), (503, -1));
        assert_eq!(f.path_prefix.as_deref(), Some("/rest/v1/auto_modele"));
        assert!(parse_fault(br#"{"status":70000,"body":"x"}"#).is_none());
        assert!(parse_fault(br#"{"status":503}"#).is_none());
        assert_eq!(parse_tables(" a, ,b "), ["a", "b"]);
    }

    #[test]
    fn chargement_refuse_une_cle_en_double() {
        let dir = std::env::temp_dir().join(format!("replay-test-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let file = dir.join("x.jsonl");
        let line = r#"{"key":"GET /rest/v1/auto_type?a=1","request":{},"status":200,"body":"[]"}"#;
        std::fs::write(&file, format!("{line}\n\n")).unwrap();
        let mut exchanges = HashMap::new();
        load(file.to_str().unwrap(), &mut exchanges).unwrap();
        assert_eq!(exchanges.len(), 1);
        let err = load(file.to_str().unwrap(), &mut exchanges).unwrap_err();
        assert!(err.contains("clé en double"), "{err}");
        std::fs::remove_dir_all(&dir).unwrap();
    }
}
