//! Sonde des portages JavaScript de `route::*`, pilotée par `bench/js-diff.mjs`.
//! Chaque ligne d'entrée est `{"fn": "...", "input": ...}` ; chaque ligne de sortie
//! est la chaîne JSON du résultat, à comparer à celui de Node.

use std::io::{BufRead, Write};

use serde_json::Value;
use vehicle_models_rs::route::json::{self, Json, Obj};
use vehicle_models_rs::route::{query, uri};

/// Sortie de `VehiclesQuerySchema` au format de la clé de cache de Node (que R2 n'a
/// plus) : `JSON.stringify(params)` après `params.brandId = String(brandId)`,
/// valeurs `undefined` omises, comme la fonction `query.zod` de `bench/js-diff.mjs`.
fn node_params(brand_id: u32, q: &query::VehiclesQuery) -> String {
    fn put_str(o: &mut Obj, k: &str, v: &Option<String>) {
        if let Some(v) = v {
            o.insert(k.into(), Json::Str(v.clone()));
        }
    }
    let mut o = Obj::new();
    put_str(&mut o, "search", &q.search);
    o.insert("brandId".into(), Json::Str(brand_id.to_string()));
    put_str(&mut o, "modelId", &q.model_id);
    put_str(&mut o, "typeId", &q.type_id);
    if let Some(y) = q.year {
        o.insert("year".into(), Json::Num(f64::from(y)));
    }
    if let Some(l) = q.limit {
        o.insert("limit".into(), Json::Num(f64::from(l)));
    }
    if let Some(p) = q.page {
        o.insert("page".into(), Json::Num(f64::from(p)));
    }
    o.insert("includeAll".into(), Json::Bool(q.include_all));
    format!("models_by_brand:{brand_id}:{}", json::stringify(&Json::Obj(o)))
}

fn probe(function: &str, input: &Value) -> String {
    match function {
        "json.parse" => match json::parse(input.as_str().unwrap_or_default()) {
            Ok(v) => format!("ok:{}", json::stringify(&v)),
            Err(e) => format!("err:{}", e.message),
        },
        "uri.decode" => match uri::decode_uri_component(input.as_str().unwrap_or_default()) {
            Ok(s) => format!("ok:{s}"),
            Err(()) => "err".to_owned(),
        },
        "qs.parse" => json::stringify(&Json::Obj(query::parse(input.as_str().unwrap_or_default()))),
        "query.zod" => match query::validate(&query::parse(input.as_str().unwrap_or_default())) {
            Ok(q) => format!("ok:{}", node_params(140, &q)),
            Err(()) => "err".to_owned(),
        },
        "param.positive" => match query::positive_int_param(input.as_str().unwrap_or_default()) {
            Some(n) => format!("ok:{n}"),
            None => "err".to_owned(),
        },
        other => format!("unknown:{other}"),
    }
}

fn main() {
    let stdin = std::io::stdin();
    let mut out = std::io::BufWriter::new(std::io::stdout());
    for line in stdin.lock().lines() {
        let Ok(line) = line else { break };
        let Ok(req) = serde_json::from_str::<Value>(&line) else {
            writeln!(out, "\"bad-request\"").ok();
            continue;
        };
        let function = req["fn"].as_str().unwrap_or_default();
        let result = probe(function, &req["input"]);
        writeln!(out, "{}", Value::String(result)).ok();
    }
    out.flush().ok();
}
