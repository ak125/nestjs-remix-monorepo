//! Client PostgREST minimal qui reproduit ce que fait le chemin legacy :
//! URL construite comme postgrest-js 2.108 (`URLSearchParams`), en-têtes,
//! nouvelles tentatives (`executeWithRetry`), délai de 15 s et sémaphore
//! partagé de `SupabaseBaseService`, puis traitement `processResponse`.

use std::sync::Arc;
use std::time::Duration;

use reqwest::header::{AUTHORIZATION, CONTENT_RANGE, HeaderMap, HeaderValue, RETRY_AFTER};
use serde_json::{Value, json};
use tokio::sync::Semaphore;

use crate::config::Config;
use crate::js;

const CLIENT_INFO: &str = concat!("vehicle-models-rs/", env!("CARGO_PKG_VERSION"));
/// `DEFAULT_MAX_RETRIES` de postgrest-js.
const MAX_RETRIES: u32 = 3;
/// Plafond de `getRetryDelay` ; appliqué aussi à `Retry-After` (non plafonné
/// côté postgrest-js), l'échéance globale de la requête restant la borne finale.
const MAX_RETRY_DELAY: Duration = Duration::from_secs(30);

/// Requête GET dont les paramètres suivent la sémantique de `URLSearchParams`.
pub struct Query {
    table: &'static str,
    params: Vec<(&'static str, String)>,
    count_exact: bool,
    single: bool,
}

impl Query {
    pub fn new(table: &'static str) -> Self {
        Self {
            table,
            params: Vec::new(),
            count_exact: false,
            single: false,
        }
    }

    /// `.single()` → `Accept: application/vnd.pgrst.object+json`.
    pub fn single(mut self) -> Self {
        self.single = true;
        self
    }

    /// `select(columns, { count: 'exact' })` → en-tête `Prefer: count=exact`.
    pub fn count_exact(mut self) -> Self {
        self.count_exact = true;
        self
    }

    /// `URLSearchParams#set` : remplace la première occurrence en gardant sa
    /// position et retire les suivantes, sinon ajoute en fin.
    pub fn set(&mut self, key: &'static str, value: String) {
        match self.params.iter().position(|(k, _)| *k == key) {
            Some(first) => {
                self.params[first].1 = value;
                let mut index = 0;
                self.params.retain(|(k, _)| {
                    let keep = *k != key || index == first;
                    index += 1;
                    keep
                });
            }
            None => self.params.push((key, value)),
        }
    }

    /// `URLSearchParams#append`.
    pub fn append(&mut self, key: &'static str, value: String) {
        self.params.push((key, value));
    }

    /// URL sérialisée comme `url.toString()` (encodage
    /// `application/x-www-form-urlencoded`, espace → `+`).
    pub fn url(&self, rest_url: &str) -> String {
        let query = url::form_urlencoded::Serializer::new(String::new())
            .extend_pairs(self.params.iter().map(|(k, v)| (*k, v.as_str())))
            .finish();
        format!("{rest_url}/{}?{query}", self.table)
    }
}

/// Filtre `in.(…)` de postgrest-js : valeurs dédupliquées, chaîne contenant
/// `,`, `(` ou `)` placée entre guillemets.
pub fn in_filter<'a>(values: impl IntoIterator<Item = &'a str>) -> String {
    let mut seen = std::collections::HashSet::new();
    let cleaned: Vec<String> = values
        .into_iter()
        .filter(|v| seen.insert(*v))
        .map(|v| {
            if v.contains([',', '(', ')']) {
                format!("\"{v}\"")
            } else {
                v.to_owned()
            }
        })
        .collect();
    format!("in.({})", cleaned.join(","))
}

/// Résultat `{ data, error, count, status }` de postgrest-js ; `Value::Null`
/// tient lieu de `null`.
#[derive(Debug)]
pub struct PgResponse<D = Value> {
    pub data: D,
    pub error: Value,
    pub count: Option<f64>,
    pub status: u16,
}

/// `data` d'une réponse analysée par l'appelant (`get_with`).
#[derive(Debug)]
pub enum Data<D> {
    /// `null` : corps vide, erreur ou échec de `fetch`.
    Null,
    /// `[]` que postgrest-js substitue à un 404 dont le corps est un tableau.
    EmptyArray,
    /// Corps 2xx analysé.
    Parsed(D),
}

impl<D> PgResponse<Data<D>> {
    /// Forme de l'erreur que postgrest-js renvoie après un échec de `fetch`.
    fn fetch_error(message: String) -> Self {
        Self {
            data: Data::Null,
            error: json!({ "message": message, "details": "", "hint": "", "code": "" }),
            count: None,
            status: 0,
        }
    }
}

impl PgResponse<Data<Value>> {
    fn into_value(self) -> PgResponse {
        PgResponse {
            data: match self.data {
                Data::Null => Value::Null,
                Data::EmptyArray => json!([]),
                Data::Parsed(data) => data,
            },
            error: self.error,
            count: self.count,
            status: self.status,
        }
    }
}

/// Échec d'une tentative. Comme postgrest-js, seul un échec avant réception
/// des en-têtes (rejet de `fetch`) est rejoué ; un échec pendant la lecture du
/// corps (`res.text()`) ne l'est pas.
enum AttemptError {
    Retryable(String),
    Final(String),
}

struct RawResponse {
    status: u16,
    content_range: Option<String>,
    retry_after: Option<String>,
    body: Vec<u8>,
}

pub struct Postgrest {
    http: reqwest::Client,
    rest_url: String,
    headers: HeaderMap,
    upstream: Arc<Semaphore>,
    attempt_timeout: Duration,
    max_body_bytes: usize,
}

impl Postgrest {
    pub fn new(cfg: &Config) -> Result<Self, String> {
        let mut base = cfg.supabase_url.clone();
        if !base.ends_with('/') {
            base.push('/');
        }
        let rest_url = url::Url::parse(&base)
            .and_then(|u| u.join("rest/v1"))
            .map_err(|e| format!("SUPABASE_URL invalide : {e}"))?
            .to_string();

        let key = HeaderValue::from_str(&cfg.api_key)
            .map_err(|_| "clé Supabase non représentable en en-tête HTTP".to_owned())?;
        let bearer = HeaderValue::from_str(&format!("Bearer {}", cfg.api_key))
            .map_err(|_| "clé Supabase non représentable en en-tête HTTP".to_owned())?;
        let mut headers = HeaderMap::new();
        headers.insert("apikey", key);
        headers.insert(AUTHORIZATION, bearer);
        headers.insert("x-client-info", HeaderValue::from_static(CLIENT_INFO));
        headers.insert("accept-profile", HeaderValue::from_static("public"));

        let http = reqwest::Client::builder()
            .pool_max_idle_per_host(cfg.upstream_concurrency)
            .pool_idle_timeout(Duration::from_secs(60))
            .tcp_nodelay(true)
            .build()
            .map_err(|e| format!("client HTTP : {e}"))?;

        Ok(Self {
            http,
            rest_url,
            headers,
            upstream: Arc::new(Semaphore::new(cfg.upstream_concurrency)),
            attempt_timeout: cfg.upstream_timeout,
            max_body_bytes: cfg.max_body_bytes,
        })
    }

    /// Réponse dont le corps 2xx devient une `Value`, comme `JSON.parse`.
    pub async fn get(&self, query: &Query) -> PgResponse {
        self.get_with(query, |text| serde_json::from_str::<Value>(text))
            .await
            .into_value()
    }

    /// `insert(rows)` de postgrest-js (`?columns=` des clés, sans `Prefer`) ;
    /// une écriture n'est jamais rejouée. Renvoie le statut ou le message d'échec.
    pub async fn insert(&self, table: &str, columns: &[&str], body: String) -> Result<u16, String> {
        let cols: Vec<String> = columns.iter().map(|c| format!("\"{c}\"")).collect();
        let mut url = url::Url::parse(&format!("{}/{table}", self.rest_url)).map_err(|e| e.to_string())?;
        url.query_pairs_mut().append_pair("columns", &cols.join(","));
        let request = self
            .http
            .post(url.as_str())
            .headers(self.headers.clone())
            .header("content-type", "application/json")
            .body(body);
        let send = async {
            let _permit = self.upstream.acquire().await.map_err(|e| e.to_string())?;
            request
                .send()
                .await
                .map_err(|e| format!("TypeError: fetch failed ({e})"))
        };
        let response = tokio::time::timeout(self.attempt_timeout, send)
            .await
            .map_err(|_| "TimeoutError: Supabase Request Timeout".to_owned())??;
        let status = response.status().as_u16();
        if (200..300).contains(&status) {
            Ok(status)
        } else {
            let text = response.text().await.unwrap_or_default();
            let message = serde_json::from_str::<Value>(&text)
                .ok()
                .and_then(|v| v.get("message").and_then(Value::as_str).map(str::to_owned))
                .unwrap_or(text);
            Err(message)
        }
    }

    /// Comme `get`, mais le corps 2xx non vide est confié à `parse`, appelée au
    /// plus une fois (dernière tentative) ; son échec donne l'erreur
    /// `{ message: texte }` de postgrest-js. Les corps d'erreur restent des `Value`.
    pub async fn get_with<D, E>(
        &self,
        query: &Query,
        parse: impl FnOnce(&str) -> Result<D, E>,
    ) -> PgResponse<Data<D>> {
        let url = query.url(&self.rest_url);
        let mut attempt = 0;
        loop {
            match self.attempt(&url, query, attempt).await {
                Ok(raw) if matches!(raw.status, 503 | 520) && attempt < MAX_RETRIES => {
                    let delay = raw.retry_after.as_deref().map_or_else(
                        || backoff(attempt),
                        |h| {
                            let secs = js::parse_int(h, Some(10));
                            let secs = if js::number_truthy(secs) {
                                secs.max(0.0)
                            } else {
                                0.0
                            };
                            Duration::from_secs_f64(secs.min(MAX_RETRY_DELAY.as_secs_f64()))
                        },
                    );
                    tracing::warn!(
                        status = raw.status,
                        attempt,
                        table = query.table,
                        "PostgREST indisponible, nouvelle tentative"
                    );
                    attempt += 1;
                    tokio::time::sleep(delay).await;
                }
                Ok(raw) => return process_response(raw, query.count_exact, parse),
                Err(AttemptError::Retryable(message)) if attempt < MAX_RETRIES => {
                    tracing::warn!(attempt, table = query.table, %message, "échec de transport PostgREST, nouvelle tentative");
                    tokio::time::sleep(backoff(attempt)).await;
                    attempt += 1;
                }
                Err(AttemptError::Retryable(message) | AttemptError::Final(message)) => {
                    tracing::warn!(attempt, table = query.table, %message, "échec de transport PostgREST");
                    return PgResponse::fetch_error(message);
                }
            }
        }
    }

    async fn attempt(&self, url: &str, query: &Query, attempt: u32) -> Result<RawResponse, AttemptError> {
        // Délai unique de 15 s par tentative, attente du sémaphore comprise,
        // comme `AbortSignal.timeout(15000)` dans SupabaseBaseService.
        let deadline = tokio::time::Instant::now() + self.attempt_timeout;
        let timeout_message = || {
            format!(
                "TimeoutError: Supabase Request Timeout ({}s)",
                self.attempt_timeout.as_secs()
            )
        };

        let mut request = self.http.get(url).headers(self.headers.clone());
        if query.count_exact {
            request = request.header("prefer", "count=exact");
        }
        if query.single {
            request = request.header("accept", "application/vnd.pgrst.object+json");
        }
        if attempt > 0 {
            request = request.header("x-retry-count", attempt.to_string());
        }
        // Le jeton est rendu dès réception des en-têtes, comme le sémaphore
        // global de SupabaseBaseService.
        let send = async {
            let _permit = self.upstream.acquire().await.map_err(|e| e.to_string())?;
            request.send().await.map_err(|e| format!("TransportError: {e}"))
        };
        let mut response = match tokio::time::timeout_at(deadline, send).await {
            Ok(Ok(response)) => response,
            Ok(Err(message)) => return Err(AttemptError::Retryable(message)),
            Err(_) => return Err(AttemptError::Retryable(timeout_message())),
        };

        let header = |name| {
            let values: Vec<&str> = response
                .headers()
                .get_all(name)
                .iter()
                .filter_map(|v| v.to_str().ok())
                .collect();
            (!values.is_empty()).then(|| values.join(", "))
        };
        let content_range = header(CONTENT_RANGE);
        let retry_after = header(RETRY_AFTER);
        let status = response.status().as_u16();
        let too_large = || {
            AttemptError::Final(format!(
                "BodyTooLarge: réponse PostgREST > {} octets",
                self.max_body_bytes
            ))
        };
        if response
            .content_length()
            .is_some_and(|len| len > self.max_body_bytes as u64)
        {
            return Err(too_large());
        }
        let read_body = async {
            let mut body = Vec::new();
            while let Some(chunk) = response
                .chunk()
                .await
                .map_err(|e| AttemptError::Final(format!("TransportError: {e}")))?
            {
                if body.len() + chunk.len() > self.max_body_bytes {
                    return Err(too_large());
                }
                body.extend_from_slice(&chunk);
            }
            Ok(body)
        };
        let body = tokio::time::timeout_at(deadline, read_body)
            .await
            .map_err(|_| AttemptError::Final(timeout_message()))??;
        Ok(RawResponse {
            status,
            content_range,
            retry_after,
            body,
        })
    }
}

/// `getRetryDelay` de postgrest-js : 1 s, 2 s, 4 s…, plafonné à 30 s.
fn backoff(attempt: u32) -> Duration {
    Duration::from_millis(1000u64.saturating_mul(1 << attempt.min(16))).min(MAX_RETRY_DELAY)
}

/// `processResponse` de postgrest-js (méthode GET, sans `maybeSingle`).
fn process_response<D, E>(
    raw: RawResponse,
    count_exact: bool,
    parse: impl FnOnce(&str) -> Result<D, E>,
) -> PgResponse<Data<D>> {
    // `Response#text()` : décodage UTF-8 avec remplacement et retrait du BOM.
    let text = String::from_utf8_lossy(&raw.body);
    let text = text.strip_prefix('\u{FEFF}').unwrap_or(&text);
    let mut out = PgResponse {
        data: Data::Null,
        error: Value::Null,
        count: None,
        status: raw.status,
    };
    if (200..300).contains(&raw.status) {
        if !text.is_empty() {
            match parse(text) {
                Ok(data) => out.data = Data::Parsed(data),
                Err(_) => out.error = json!({ "message": text }),
            }
        }
        if count_exact
            && let Some(range) = raw.content_range.as_deref()
            && let Some(total) = range.split('/').nth(1)
        {
            out.count = Some(js::parse_int(total, None));
        }
    } else {
        match serde_json::from_str::<Value>(text) {
            Ok(error) if error.is_array() && raw.status == 404 => {
                out.data = Data::EmptyArray;
                out.status = 200;
            }
            Ok(error) => out.error = error,
            Err(_) if raw.status == 404 && text.is_empty() => out.status = 204,
            Err(_) => out.error = json!({ "message": text }),
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    fn process_response(raw: RawResponse, count_exact: bool) -> PgResponse {
        super::process_response(raw, count_exact, |text| serde_json::from_str::<Value>(text)).into_value()
    }

    fn raw(status: u16, body: &str, content_range: Option<&str>) -> RawResponse {
        RawResponse {
            status,
            content_range: content_range.map(str::to_owned),
            retry_after: None,
            body: body.as_bytes().to_vec(),
        }
    }

    #[test]
    fn set_keeps_first_position_like_url_search_params() {
        let mut q = Query::new("auto_modele");
        q.set("select", "*".into());
        q.append("modele_marque_id", "eq.140".into());
        q.set("limit", "50".into());
        q.set("offset", "0".into());
        q.set("limit", "50".into());
        q.set("order", "modele_name.asc".into());
        assert_eq!(
            q.url("http://h/rest/v1"),
            "http://h/rest/v1/auto_modele?select=*&modele_marque_id=eq.140&limit=50&offset=0&order=modele_name.asc"
        );
    }

    #[test]
    fn form_encoding_matches_url_search_params() {
        let mut q = Query::new("auto_modele");
        q.append("or", "(modele_alias.ilike.%a b,é&+%)".into());
        assert_eq!(
            q.url("http://h/rest/v1"),
            "http://h/rest/v1/auto_modele?or=%28modele_alias.ilike.%25a+b%2C%C3%A9%26%2B%25%29"
        );
    }

    #[test]
    fn in_filter_dedups_and_quotes_reserved() {
        assert_eq!(
            in_filter(["1", "2", "1", "a,b", "(x)"]),
            "in.(1,2,\"a,b\",\"(x)\")"
        );
        assert_eq!(in_filter(std::iter::empty()), "in.()");
    }

    #[test]
    fn process_response_ok_and_count() {
        let r = process_response(raw(200, "[{\"a\":1}]", Some("0-0/37")), true);
        assert_eq!(r.data, json!([{ "a": 1 }]));
        assert_eq!(r.count, Some(37.0));
        let r = process_response(raw(200, "[]", Some("*/0")), false);
        assert_eq!(r.count, None);
        let r = process_response(raw(200, "", None), true);
        assert_eq!(r.data, Value::Null);
        assert_eq!(r.error, Value::Null);
        let r = process_response(raw(200, "pas du json", None), false);
        assert_eq!(r.error, json!({ "message": "pas du json" }));
    }

    #[test]
    fn process_response_errors() {
        let r = process_response(raw(400, "{\"code\":\"PGRST100\"}", None), false);
        assert_eq!(r.error, json!({ "code": "PGRST100" }));
        let r = process_response(raw(404, "[]", None), false);
        assert_eq!((r.status, r.data, r.error), (200, json!([]), Value::Null));
        let r = process_response(raw(404, "", None), false);
        assert_eq!((r.status, r.error), (204, Value::Null));
        let r = process_response(raw(502, "<html>", None), false);
        assert_eq!(r.error, json!({ "message": "<html>" }));
        let r = process_response(raw(500, "null", None), false);
        assert_eq!(r.error, Value::Null);
    }

    #[test]
    fn backoff_matches_get_retry_delay() {
        assert_eq!(backoff(0), Duration::from_secs(1));
        assert_eq!(backoff(2), Duration::from_secs(4));
        assert_eq!(backoff(10), MAX_RETRY_DELAY);
    }
}
