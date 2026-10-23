//! Service complet devant un faux PostgREST : URL et en-têtes envoyés,
//! nouvelles tentatives, bornes et réponses HTTP du contrat Node ↔ Rust.

use std::sync::{Arc, Mutex};
use std::time::Duration;

use axum::Router;
use axum::extract::{Path, RawQuery, State};
use axum::http::HeaderMap;
use axum::response::{IntoResponse, Response};
use axum::routing::get;
use serde_json::{Value, json};
use tokio::sync::Semaphore;
use vehicle_models_rs::api::{AppState, router};
use vehicle_models_rs::config::Config;
use vehicle_models_rs::postgrest::Postgrest;

#[derive(Clone)]
struct Seen {
    table: String,
    query: String,
    headers: HeaderMap,
}

struct Canned {
    status: u16,
    headers: Vec<(&'static str, String)>,
    body: String,
    delay: Duration,
}

fn canned(status: u16, body: impl Into<String>) -> Canned {
    Canned {
        status,
        headers: Vec::new(),
        body: body.into(),
        delay: Duration::ZERO,
    }
}

type Responder = dyn Fn(&Seen, usize) -> Canned + Send + Sync;

struct Fake {
    seen: Mutex<Vec<Seen>>,
    respond: Box<Responder>,
}

impl Fake {
    fn seen(&self) -> Vec<Seen> {
        self.seen.lock().unwrap().clone()
    }
}

async fn fake_handler(
    State(fake): State<Arc<Fake>>,
    Path(table): Path<String>,
    RawQuery(query): RawQuery,
    headers: HeaderMap,
) -> Response {
    let seen = Seen {
        table,
        query: query.unwrap_or_default(),
        headers,
    };
    let attempt = {
        let mut all = fake.seen.lock().unwrap();
        let attempt = all
            .iter()
            .filter(|s| s.table == seen.table && s.query == seen.query)
            .count();
        all.push(seen.clone());
        attempt
    };
    let c = (fake.respond)(&seen, attempt);
    tokio::time::sleep(c.delay).await;
    let mut response = (axum::http::StatusCode::from_u16(c.status).unwrap(), c.body).into_response();
    response
        .headers_mut()
        .insert("content-type", "application/json".parse().unwrap());
    for (k, v) in c.headers {
        response.headers_mut().insert(k, v.parse().unwrap());
    }
    response
}

struct Harness {
    base: String,
    fake: Arc<Fake>,
    http: reqwest::Client,
}

impl Harness {
    async fn get(&self, path_and_query: &str) -> (u16, Value) {
        let r = self
            .http
            .get(format!("{}{path_and_query}", self.base))
            .send()
            .await
            .unwrap();
        let status = r.status().as_u16();
        assert_eq!(r.headers()["content-type"], "application/json; charset=utf-8");
        (status, serde_json::from_slice(&r.bytes().await.unwrap()).unwrap())
    }
}

async fn start(
    respond: impl Fn(&Seen, usize) -> Canned + Send + Sync + 'static,
    tweak: impl FnOnce(&mut Config),
) -> Harness {
    let _ = rustls::crypto::ring::default_provider().install_default();
    let fake = Arc::new(Fake {
        seen: Mutex::new(Vec::new()),
        respond: Box::new(respond),
    });
    let fake_listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let fake_addr = fake_listener.local_addr().unwrap();
    let app = Router::new()
        .route("/rest/v1/{table}", get(fake_handler))
        .with_state(fake.clone());
    tokio::spawn(async move { axum::serve(fake_listener, app).await.unwrap() });

    let supabase_url = format!("http://{fake_addr}");
    let mut cfg = Config::from_lookup(|key| match key {
        "SUPABASE_URL" => Some(supabase_url.clone()),
        "SUPABASE_SERVICE_ROLE_KEY" => Some("test-key".into()),
        _ => None,
    })
    .unwrap();
    tweak(&mut cfg);
    let state = Arc::new(AppState {
        pg: Postgrest::new(&cfg).unwrap(),
        inflight: Arc::new(Semaphore::new(cfg.max_inflight)),
        deadline: cfg.request_deadline,
        max_type_rows: cfg.max_type_rows,
    });
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    tokio::spawn(async move { axum::serve(listener, router(state)).await.unwrap() });
    Harness {
        base: format!("http://{addr}"),
        fake,
        http: reqwest::Client::new(),
    }
}

const STEP1: &str = "select=modele_id&modele_marque_id=eq.7";

fn types_query(ids: &str, offset: usize) -> String {
    format!(
        "select=type_id%2Ctype_modele_id%2Ctype_year_from%2Ctype_year_to%2Ctype_fuel\
         &type_modele_id=in.%28{ids}%29&order=type_modele_id.asc%2Ctype_id.asc&offset={offset}&limit=1000"
    )
}

#[tokio::test]
async fn year_filter_enrichment_and_request_shape() {
    let h = start(
        |seen, _| match (seen.table.as_str(), seen.query.as_str()) {
            ("auto_modele", STEP1) => {
                canned(200, r#"[{"modele_id":10},{"modele_id":11},{"modele_id":12},{"modele_id":13}]"#)
            }
            ("auto_type", _) => canned(
                200,
                r#"[
                {"type_id":"1","type_modele_id":"10","type_year_from":"2000","type_year_to":"2010","type_fuel":"Diesel"},
                {"type_id":"2","type_modele_id":"10","type_year_from":"2005","type_year_to":null,"type_fuel":"Essence"},
                {"type_id":"3","type_modele_id":"10","type_year_from":"2001","type_year_to":"2003","type_fuel":"Diesel"},
                {"type_id":"4","type_modele_id":"11","type_year_from":"1990","type_year_to":"1995","type_fuel":""},
                {"type_id":"5","type_modele_id":"12","type_year_from":null,"type_year_to":null,"type_fuel":null},
                {"type_id":"6","type_modele_id":"","type_year_from":"2008","type_year_to":"2008","type_fuel":"GPL"}
            ]"#,
            ),
            ("auto_modele", _) => Canned {
                headers: vec![("content-range", "0-1/2".into())],
                ..canned(
                    200,
                    r#"[{"modele_id":12,"modele_name":"A","x":1.5},{"modele_id":10,"modele_name":"B"}]"#,
                )
            },
            _ => canned(404, "{}"),
        },
        |_| {},
    )
    .await;

    let (status, body) = h.get("/v1/brands/7/models?year=2008&page=0&limit=100").await;
    assert_eq!(status, 200);
    assert_eq!(
        body,
        json!({
            "success": true,
            "data": [
                { "modele_id": 12, "modele_name": "A", "x": 1.5, "motorisationsCount": 1, "modele_fuel_types": [] },
                { "modele_id": 10, "modele_name": "B", "motorisationsCount": 3, "modele_fuel_types": ["Diesel", "Essence"] }
            ],
            "total": 2,
            "page": 0,
            "limit": 100
        })
    );

    let seen = h.fake.seen();
    let queries: Vec<String> = seen.iter().map(|s| s.query.clone()).collect();
    assert_eq!(
        queries,
        vec![
            STEP1.to_owned(),
            types_query("10%2C11%2C12%2C13", 0),
            "select=*&modele_marque_id=eq.7&modele_id=in.%2810%2C12%29&modele_display=eq.1\
             &limit=100&offset=0&order=modele_name.asc%2Cmodele_id.asc"
                .to_owned(),
        ]
    );
    for s in &seen {
        assert_eq!(s.headers["apikey"], "test-key");
        assert_eq!(s.headers["authorization"], "Bearer test-key");
        assert_eq!(s.headers["accept-profile"], "public");
        assert!(!s.headers.contains_key("x-retry-count"));
    }
    assert!(!seen[0].headers.contains_key("prefer"));
    assert!(!seen[1].headers.contains_key("prefer"));
    assert_eq!(seen[2].headers["prefer"], "count=exact");
}

#[tokio::test]
async fn types_are_read_in_batches_of_1000() {
    let h = start(
        |seen, _| match seen.table.as_str() {
            "auto_modele" if seen.query == STEP1 => canned(200, r#"[{"modele_id":10}]"#),
            "auto_type" => {
                let row = r#"{"type_modele_id":"10","type_fuel":"Diesel"}"#;
                let n = if seen.query.contains("offset=0&") { 1000 } else { 1 };
                canned(200, format!("[{}]", vec![row; n].join(",")))
            }
            _ => Canned {
                headers: vec![("content-range", "0-0/1".into())],
                ..canned(200, r#"[{"modele_id":10}]"#)
            },
        },
        |_| {},
    )
    .await;

    let (status, body) = h.get("/v1/brands/7/models").await;
    assert_eq!(status, 200);
    assert_eq!(body["data"][0]["motorisationsCount"], 1001);
    assert_eq!(
        (body["page"].clone(), body["limit"].clone(), body["total"].clone()),
        (json!(0), json!(50), json!(1))
    );
    let types: Vec<String> = h
        .fake
        .seen()
        .into_iter()
        .filter(|s| s.table == "auto_type")
        .map(|s| s.query)
        .collect();
    assert_eq!(types, [types_query("10", 0), types_query("10", 1000)]);
    let main = h.fake.seen().pop().unwrap().query;
    assert_eq!(
        main,
        "select=*&modele_marque_id=eq.7&modele_id=in.%2810%29&modele_display=eq.1&limit=50&offset=0&order=modele_name.asc%2Cmodele_id.asc"
    );
}

#[tokio::test]
async fn search_include_all_and_paging_reach_the_main_query() {
    let h = start(
        |seen, _| match seen.table.as_str() {
            "auto_modele" if seen.query == STEP1 => canned(200, r#"[{"modele_id":10}]"#),
            "auto_type" => canned(200, r#"[{"type_modele_id":"10"}]"#),
            _ => canned(200, "[]"),
        },
        |_| {},
    )
    .await;

    let (status, body) = h
        .get("/v1/brands/7/models?search=a+b%2C%25&includeAll=true&page=2&limit=10")
        .await;
    assert_eq!(status, 200);
    assert_eq!(
        body,
        json!({ "success": true, "data": [], "total": 0, "page": 2, "limit": 10 })
    );
    assert_eq!(
        h.fake.seen().pop().unwrap().query,
        "select=*&modele_marque_id=eq.7&modele_id=in.%2810%29\
         &or=%28modele_alias.ilike.%25a+b%2C%25%25%2Cmodele_name.ilike.%25a+b%2C%25%25%29\
         &limit=10&offset=20&order=modele_name.asc%2Cmodele_id.asc"
    );
}

#[tokio::test]
async fn no_model_with_types_returns_an_empty_page() {
    let h = start(|_, _| canned(200, "[]"), |_| {}).await;
    let (status, body) = h.get("/v1/brands/7/models?year=2010").await;
    assert_eq!(status, 200);
    assert_eq!(
        body,
        json!({ "success": true, "data": [], "total": 0, "page": 0, "limit": 50 })
    );
    // Étape 1 vide (`[]` est vrai en JavaScript) : la requête types part quand même, avec `in.()`.
    assert_eq!(h.fake.seen().len(), 2);
    assert_eq!(h.fake.seen()[1].query, types_query("", 0));
}

#[tokio::test]
async fn postgrest_error_is_relayed_as_the_thrown_value() {
    let error = json!({ "code": "42703", "message": "column does not exist", "details": null, "hint": null });
    let body = error.to_string();
    let h = start(move |_, _| canned(400, body.clone()), |_| {}).await;
    let (status, body) = h.get("/v1/brands/7/models").await;
    assert_eq!(status, 502);
    assert_eq!(body, json!({ "error": "upstream", "thrown": error }));
    assert_eq!(h.fake.seen().len(), 1);
}

#[tokio::test]
async fn status_503_is_retried_like_postgrest_js() {
    let h = start(
        |seen, attempt| match seen.table.as_str() {
            "auto_modele" if seen.query == STEP1 && attempt == 0 => Canned {
                headers: vec![("retry-after", "0".into())],
                ..canned(503, r#"{"message":"busy"}"#)
            },
            "auto_modele" if seen.query == STEP1 => canned(200, "[]"),
            _ => canned(200, "[]"),
        },
        |_| {},
    )
    .await;
    let (status, _) = h.get("/v1/brands/7/models").await;
    assert_eq!(status, 200);
    let seen = h.fake.seen();
    assert_eq!(seen[0].query, STEP1);
    assert_eq!(seen[1].query, STEP1);
    assert_eq!(seen[1].headers["x-retry-count"], "1");

    // Toujours 503 : 1 appel + 3 nouvelles tentatives, puis l'erreur PostgREST.
    let h = start(
        |_, _| Canned {
            headers: vec![("retry-after", "0".into())],
            ..canned(503, r#"{"message":"down"}"#)
        },
        |_| {},
    )
    .await;
    let (status, body) = h.get("/v1/brands/7/models").await;
    assert_eq!(
        (status, body),
        (
            502,
            json!({ "error": "upstream", "thrown": { "message": "down" } })
        )
    );
    let retries: Vec<String> = h
        .fake
        .seen()
        .iter()
        .map(|s| {
            s.headers
                .get("x-retry-count")
                .map_or("-".into(), |v| v.to_str().unwrap().into())
        })
        .collect();
    assert_eq!(retries, ["-", "1", "2", "3"]);
}

#[tokio::test]
async fn invalid_requests_are_400_without_upstream_call() {
    let h = start(|_, _| canned(200, "[]"), |_| {}).await;
    for path in [
        "/v1/brands/0/models",
        "/v1/brands/7/models?limit=0",
        "/v1/brands/7/models?x=1",
    ] {
        let (status, body) = h.get(path).await;
        assert_eq!(
            (status, body["error"].clone()),
            (400, json!("invalid_request")),
            "{path}"
        );
    }
    let (status, _) = h.get("/v1/other").await;
    assert_eq!(status, 404);
    assert!(h.fake.seen().is_empty());
}

#[tokio::test]
async fn bounds_overload_deadline_and_body_size() {
    let slow = |_: &Seen, _: usize| Canned {
        delay: Duration::from_millis(400),
        ..canned(200, "[]")
    };

    let h = start(slow, |cfg| cfg.max_inflight = 1).await;
    let (a, b) = tokio::join!(h.get("/v1/brands/7/models"), async {
        tokio::time::sleep(Duration::from_millis(100)).await;
        h.get("/v1/brands/7/models").await
    });
    assert_eq!(a.0, 200);
    assert_eq!(b, (503, json!({ "error": "overloaded" })));

    let h = start(slow, |cfg| cfg.request_deadline = Duration::from_millis(150)).await;
    assert_eq!(
        h.get("/v1/brands/7/models").await,
        (504, json!({ "error": "deadline" }))
    );

    let big = format!("[{}]", vec![r#"{"modele_id":10}"#; 100].join(","));
    let h = start(
        move |_, _| canned(200, big.clone()),
        |cfg| cfg.max_body_bytes = 64,
    )
    .await;
    let (status, body) = h.get("/v1/brands/7/models").await;
    assert_eq!((status, body["error"].clone()), (502, json!("upstream")));
    assert_eq!(body["thrown"]["code"], "");
    assert_eq!(h.fake.seen().len(), 1, "un corps trop gros n'est pas rejoué");

    let h = start(
        |seen, _| match seen.table.as_str() {
            "auto_modele" => canned(200, r#"[{"modele_id":10}]"#),
            _ => canned(
                200,
                format!("[{}]", vec![r#"{"type_modele_id":"10"}"#; 1000].join(",")),
            ),
        },
        |cfg| cfg.max_type_rows = 1500,
    )
    .await;
    let (status, body) = h.get("/v1/brands/7/models").await;
    assert_eq!(
        (status, body["thrown"]["code"].clone()),
        (502, json!("VEHICLE_MODELS_RS_LIMIT"))
    );
}

/// Faux PostgREST qui applique filtres `eq`/`in`, tri et plage sur un jeu en
/// mémoire, et rend les lignes ex æquo (ou non triées) dans un ordre qui change
/// d'une page à l'autre, comme PostgreSQL sans ORDER BY total.
fn pg_like(seen: &Seen, models: &[Value], types: &[Value]) -> Canned {
    fn text(v: &Value) -> String {
        v.as_str().map_or_else(|| v.to_string(), str::to_owned)
    }
    fn compare(a: &Value, b: &Value) -> std::cmp::Ordering {
        match (a.as_f64(), b.as_f64()) {
            (Some(x), Some(y)) => x.total_cmp(&y),
            _ => text(a).cmp(&text(b)),
        }
    }
    let mut rows: Vec<&Value> = if seen.table == "auto_type" { types } else { models }
        .iter()
        .collect();
    let (mut select, mut orders, mut offset, mut limit) = (String::new(), Vec::new(), 0usize, usize::MAX);
    for (k, v) in url::form_urlencoded::parse(seen.query.as_bytes()) {
        match k.as_ref() {
            "select" => select = v.into_owned(),
            "order" => {
                orders = v
                    .split(',')
                    .map(|o| o.trim_end_matches(".asc").to_owned())
                    .collect()
            }
            "offset" => offset = v.parse().unwrap(),
            "limit" => limit = v.parse().unwrap(),
            column => {
                if let Some(x) = v.strip_prefix("eq.") {
                    rows.retain(|r| text(&r[column]) == x);
                } else if let Some(list) = v.strip_prefix("in.(").and_then(|l| l.strip_suffix(')')) {
                    let set: std::collections::HashSet<&str> = list.split(',').collect();
                    rows.retain(|r| set.contains(text(&r[column]).as_str()));
                }
            }
        }
    }
    let total = rows.len();
    if limit != usize::MAX && (offset / limit) % 2 == 1 {
        rows.reverse();
    }
    rows.sort_by(|a, b| {
        orders
            .iter()
            .map(|c| compare(&a[c.as_str()], &b[c.as_str()]))
            .find(|o| o.is_ne())
            .unwrap_or(std::cmp::Ordering::Equal)
    });
    let page: Vec<Value> = rows
        .into_iter()
        .skip(offset)
        .take(limit)
        .map(|r| {
            if select == "modele_id" {
                json!({ "modele_id": r["modele_id"] })
            } else {
                r.clone()
            }
        })
        .collect();
    let range = if page.is_empty() {
        format!("*/{total}")
    } else {
        format!("{offset}-{}/{total}", offset + page.len() - 1)
    };
    Canned {
        headers: vec![("content-range", range)],
        ..canned(200, Value::Array(page).to_string())
    }
}

#[tokio::test]
async fn type_batches_and_pages_are_totally_ordered() {
    let models: Vec<Value> = [(4, "Gamma"), (3, "Beta"), (1, "Alpha"), (2, "Beta")]
        .into_iter()
        .map(|(id, name)| json!({ "modele_id": id, "modele_name": name, "modele_display": 1, "modele_marque_id": 7 }))
        .collect();
    // 2 500 motorisations en trois lots, réparties par blocs (800, 800, 600, 300)
    // pour qu'un recouvrement de lots ne se compense pas d'un modèle à l'autre.
    let fuels = ["Diesel", "Essence", "GPL"];
    let types: Vec<Value> = (0..2500usize)
        .map(|i| {
            let model = match i {
                0..800 => 1,
                800..1600 => 2,
                1600..2200 => 3,
                _ => 4,
            };
            json!({
                "type_id": (100_000 + i).to_string(),
                "type_modele_id": model.to_string(),
                "type_year_from": "2000",
                "type_year_to": "2020",
                "type_fuel": fuels[i % 3],
            })
        })
        .collect();
    let h = start(move |seen, _| pg_like(seen, &models, &types), |_| {}).await;

    let (status, body) = h.get("/v1/brands/7/models?page=0&limit=10").await;
    assert_eq!(status, 200);
    let summary: Vec<(Value, Value, Value)> = body["data"]
        .as_array()
        .unwrap()
        .iter()
        .map(|m| {
            (
                m["modele_id"].clone(),
                m["motorisationsCount"].clone(),
                m["modele_fuel_types"].clone(),
            )
        })
        .collect();
    assert_eq!(
        summary,
        vec![
            (json!(1), json!(800), json!(["Diesel", "Essence", "GPL"])),
            (json!(2), json!(800), json!(["GPL", "Diesel", "Essence"])),
            (json!(3), json!(600), json!(["Essence", "GPL", "Diesel"])),
            (json!(4), json!(300), json!(["Essence", "GPL", "Diesel"])),
        ]
    );

    let mut ids = Vec::new();
    for page in 0..3 {
        let (status, body) = h.get(&format!("/v1/brands/7/models?page={page}&limit=2")).await;
        assert_eq!(status, 200);
        assert_eq!(body["total"], 4);
        ids.extend(
            body["data"]
                .as_array()
                .unwrap()
                .iter()
                .map(|m| m["modele_id"].clone()),
        );
    }
    assert_eq!(ids, [json!(1), json!(2), json!(3), json!(4)]);
}
