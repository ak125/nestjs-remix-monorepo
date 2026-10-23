//! Interface HTTP appelée par `VehicleModelsService` (backend Node).
//!
//! `GET /v1/brands/{brandId}/models?page=&limit=&year=&search=&includeAll=`
//! - 200 : objet de retour du legacy, octet pour octet après `JSON.parse`.
//! - 400 `{"error":"invalid_request"}` : paramètres hors du contrat zod.
//! - 502 `{"error":"upstream"|"contract"|"limit","thrown":…}` : valeur que
//!   Node relève telle quelle (même 500 que le legacy).
//! - 503 `{"error":"overloaded"}` : borne de requêtes simultanées atteinte.
//! - 504 `{"error":"deadline"}` : échéance de la requête dépassée.

use std::sync::Arc;
use std::time::{Duration, Instant};

use axum::Router;
use axum::body::Body;
use axum::extract::{Path, RawQuery, State};
use axum::http::{StatusCode, header};
use axum::response::Response;
use axum::routing::get;
use serde_json::{Value, json};
use tokio::sync::Semaphore;

use crate::models::{ModelsRequest, Outcome, models_by_brand};
use crate::postgrest::Postgrest;

const INT4_MAX: u32 = 2_147_483_647;
/// Plus long que tout appel légitime (200 unités UTF-16 de recherche encodées).
const MAX_QUERY_BYTES: usize = 4096;

pub struct AppState {
    pub pg: Postgrest,
    pub inflight: Arc<Semaphore>,
    pub deadline: Duration,
    pub max_type_rows: usize,
}

pub fn router(state: Arc<AppState>) -> Router {
    Router::new()
        .route("/v1/brands/{brand_id}/models", get(models_handler))
        .fallback(|| async { json_response(StatusCode::NOT_FOUND, &json!({ "error": "not_found" })) })
        .with_state(state)
}

fn json_response(status: StatusCode, body: &Value) -> Response {
    Response::builder()
        .status(status)
        .header(header::CONTENT_TYPE, "application/json; charset=utf-8")
        .body(Body::from(serde_json::to_vec(body).unwrap_or_default()))
        .unwrap_or_default()
}

async fn models_handler(
    State(state): State<Arc<AppState>>,
    Path(brand_id): Path<String>,
    RawQuery(query): RawQuery,
) -> Response {
    let Ok(_slot) = state.inflight.clone().try_acquire_owned() else {
        tracing::warn!("borne de requêtes simultanées atteinte");
        return json_response(StatusCode::SERVICE_UNAVAILABLE, &json!({ "error": "overloaded" }));
    };
    let request = match parse_request(&brand_id, query.as_deref().unwrap_or("")) {
        Ok(request) => request,
        Err(message) => {
            tracing::warn!(%message, "requête refusée");
            return json_response(
                StatusCode::BAD_REQUEST,
                &json!({ "error": "invalid_request", "message": message }),
            );
        }
    };

    let started = Instant::now();
    let outcome = tokio::time::timeout(
        state.deadline,
        models_by_brand(&state.pg, &request, state.max_type_rows),
    )
    .await;
    let elapsed_ms = started.elapsed().as_millis() as u64;
    let brand = request.brand_id;
    match outcome {
        Ok(Outcome::Ok(body)) => {
            tracing::debug!(brand, elapsed_ms, "200");
            json_response(StatusCode::OK, &body)
        }
        Ok(Outcome::Thrown(thrown)) => {
            tracing::warn!(brand, elapsed_ms, %thrown, "erreur PostgREST relayée");
            json_response(
                StatusCode::BAD_GATEWAY,
                &json!({ "error": "upstream", "thrown": thrown }),
            )
        }
        Ok(Outcome::Contract(message)) => {
            tracing::error!(brand, elapsed_ms, %message, "réponse PostgREST hors contrat");
            let thrown = json!({ "message": format!("vehicle-models-rs: {message}"), "code": "VEHICLE_MODELS_RS_CONTRACT" });
            json_response(
                StatusCode::BAD_GATEWAY,
                &json!({ "error": "contract", "thrown": thrown }),
            )
        }
        Ok(Outcome::Limit(message)) => {
            tracing::error!(brand, elapsed_ms, %message, "borne de sécurité atteinte");
            let thrown = json!({ "message": format!("vehicle-models-rs: {message}"), "code": "VEHICLE_MODELS_RS_LIMIT" });
            json_response(
                StatusCode::BAD_GATEWAY,
                &json!({ "error": "limit", "thrown": thrown }),
            )
        }
        Err(_) => {
            tracing::error!(brand, elapsed_ms, "échéance dépassée");
            json_response(StatusCode::GATEWAY_TIMEOUT, &json!({ "error": "deadline" }))
        }
    }
}

/// Mêmes règles que `PositiveIntParamPipe` et `VehiclesQuerySchema` (zod).
pub fn parse_request(brand_id: &str, query: &str) -> Result<ModelsRequest, String> {
    if query.len() > MAX_QUERY_BYTES {
        return Err("chaîne de requête trop longue".into());
    }
    let mut request = ModelsRequest {
        brand_id: positive_int(brand_id).ok_or("brandId invalide")?,
        ..ModelsRequest::default()
    };
    let mut seen: Vec<String> = Vec::new();
    for (key, value) in url::form_urlencoded::parse(query.as_bytes()) {
        if seen.iter().any(|k| *k == key) {
            return Err(format!("paramètre répété : {key}"));
        }
        seen.push(key.to_string());
        match key.as_ref() {
            "page" => request.page = Some(non_negative_int(&value).ok_or("page invalide")?),
            "limit" => request.limit = Some(positive_int(&value).ok_or("limit invalide")?),
            "year" => request.year = Some(year(&value).ok_or("year invalide")?),
            "search" => {
                let units = value.encode_utf16().count();
                if !(1..=200).contains(&units) {
                    return Err("search doit compter de 1 à 200 unités UTF-16".into());
                }
                request.search = Some(value.into_owned());
            }
            "includeAll" => {
                request.include_all = match value.as_ref() {
                    "true" => true,
                    "false" => false,
                    _ => return Err("includeAll doit valoir true ou false".into()),
                }
            }
            other => return Err(format!("paramètre inconnu : {other}")),
        }
    }
    Ok(request)
}

fn digits_only(s: &str) -> bool {
    !s.is_empty() && s.bytes().all(|b| b.is_ascii_digit())
}

/// `/^[1-9]\d*$/` borné à int4.
fn positive_int(s: &str) -> Option<u32> {
    (digits_only(s) && !s.starts_with('0'))
        .then(|| s.parse::<u32>().ok())
        .flatten()
        .filter(|n| *n <= INT4_MAX)
}

/// `/^(0|[1-9]\d*)$/` borné à int4.
fn non_negative_int(s: &str) -> Option<u32> {
    if s == "0" { Some(0) } else { positive_int(s) }
}

/// `/^[1-9]\d{3}$/` entre 1900 et 2100.
fn year(s: &str) -> Option<u16> {
    (s.len() == 4 && digits_only(s) && !s.starts_with('0'))
        .then(|| s.parse::<u16>().ok())
        .flatten()
        .filter(|y| (1900..=2100).contains(y))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_the_vehicle_selector_call() {
        let r = parse_request("140", "year=2015&page=0&limit=100&includeAll=false").unwrap();
        assert_eq!(
            (r.brand_id, r.page, r.limit, r.year, r.include_all),
            (140, Some(0), Some(100), Some(2015), false)
        );
    }

    #[test]
    fn rejects_what_zod_rejects() {
        for (brand, query) in [
            ("0", ""),
            ("012", ""),
            ("2147483648", ""),
            ("1", "page=-1"),
            ("1", "page=00"),
            ("1", "limit=0"),
            ("1", "limit=+5"),
            ("1", "year=1899"),
            ("1", "year=02010"),
            ("1", "includeAll=1"),
            ("1", "foo=bar"),
            ("1", "page=1&page=2"),
            ("1", "search="),
        ] {
            assert!(parse_request(brand, query).is_err(), "{brand} {query}");
        }
        let long = format!("search={}", "é".repeat(201));
        assert!(parse_request("1", &long).is_err());
        let ok = format!("search={}", "%F0%9F%9A%97".repeat(100));
        assert_eq!(
            parse_request("1", &ok).unwrap().search.unwrap().chars().count(),
            100
        );
    }

    #[test]
    fn decodes_form_encoding_like_url_search_params() {
        let r = parse_request("1", "search=a+b%2C%25").unwrap();
        assert_eq!(r.search.as_deref(), Some("a b,%"));
    }
}
