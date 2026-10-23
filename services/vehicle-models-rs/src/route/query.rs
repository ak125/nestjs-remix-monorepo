//! Query de la route : `qs.parse` 6.15.3 tel qu'Express le règle (`query parser:
//! 'extended'`, soit `allowPrototypes: true` et les défauts : `depth` 5, `arrayLimit`
//! 20, `parameterLimit` 1000, doublons combinés), puis `VehiclesQuerySchema` (zod
//! `strictObject`) et la clé de cache de `getModelsByBrand`.
//!
//! Le résultat de `qs` sert aussi au champ `req.query` des journaux pino : il est
//! reproduit valeur pour valeur (tableaux à trous, objets de débordement, ordre des
//! clés), vérifié contre Node par `bench/js-diff.mjs qs.parse`.

use crate::js::{self, number_to_string};
use crate::route::json::{Json, Obj};
use crate::route::uri::decode_uri_component;

const ARRAY_LIMIT: usize = 20;
const DEPTH: usize = 5;
const PARAMETER_LIMIT: usize = 1000;

/// Valeur produite par `qs` avant `utils.compact`.
#[derive(Clone, Debug)]
enum Qv {
    Str(String),
    /// Tableau JavaScript ; `None` = trou.
    Arr(Vec<Option<Qv>>),
    Obj(QObj),
}

/// Objet ordinaire ; `overflow` = marque `markOverflow` de `qs` (plus grand index).
#[derive(Clone, Debug, Default)]
struct QObj {
    keys: Vec<(String, Qv)>,
    overflow: Option<f64>,
}

impl QObj {
    fn get_mut(&mut self, key: &str) -> Option<&mut Qv> {
        self.keys.iter_mut().find(|(k, _)| k == key).map(|(_, v)| v)
    }

    fn has(&self, key: &str) -> bool {
        self.keys.iter().any(|(k, _)| k == key)
    }

    fn take(&mut self, key: &str) -> Option<Qv> {
        let i = self.keys.iter().position(|(k, _)| k == key)?;
        Some(std::mem::replace(&mut self.keys[i].1, Qv::Str(String::new())))
    }

    /// `obj[key] = value` : redéfinir garde la place ; une nouvelle clé d'index de
    /// tableau se range avant les autres, croissante (ordre de `Object.keys`).
    fn set(&mut self, key: String, value: Qv) {
        if let Some(slot) = self.get_mut(&key) {
            *slot = value;
            return;
        }
        match array_index(&key) {
            Some(n) => {
                let at = self
                    .keys
                    .iter()
                    .position(|(k, _)| array_index(k).is_none_or(|m| m > n))
                    .unwrap_or(self.keys.len());
                self.keys.insert(at, (key, value));
            }
            None => self.keys.push((key, value)),
        }
    }
}

fn array_index(key: &str) -> Option<u32> {
    if key.is_empty() || key.len() > 10 || (key.len() > 1 && key.starts_with('0')) {
        return None;
    }
    if !key.bytes().all(|b| b.is_ascii_digit()) {
        return None;
    }
    key.parse::<u64>()
        .ok()
        .filter(|n| *n < u64::from(u32::MAX))
        .map(|n| n as u32)
}

/// `String(parseInt(s, 10)) === s && n >= 0` : entier canonique positif ou nul.
fn canonical_index(s: &str) -> Option<f64> {
    let n = js::parse_int(s, Some(10));
    (!n.is_nan() && number_to_string(n) == s && n >= 0.0).then_some(n)
}

fn is_object(v: &Qv) -> bool {
    matches!(v, Qv::Arr(_) | Qv::Obj(_))
}

/// Valeur fausse pour `if (!source)` : seule la chaîne vide l'est ici.
fn falsy(v: &Qv) -> bool {
    matches!(v, Qv::Str(s) if s.is_empty())
}

/// `utils.decode` (charset utf-8) : `+` → espace, puis `decodeURIComponent` ou la
/// chaîne brute en cas d'erreur.
pub fn qs_decode(s: &str) -> String {
    let plus = s.replace('+', " ");
    decode_uri_component(&plus).unwrap_or(plus)
}

fn array_to_object(items: Vec<Option<Qv>>) -> QObj {
    let mut obj = QObj::default();
    for (i, v) in items.into_iter().enumerate() {
        if let Some(v) = v {
            obj.set(i.to_string(), v);
        }
    }
    obj
}

/// `[].concat(a, b)` : un tableau est étalé (trous compris), le reste ajouté tel quel.
fn concat(parts: Vec<Qv>) -> Vec<Option<Qv>> {
    let mut out = Vec::new();
    for p in parts {
        match p {
            Qv::Arr(items) => out.extend(items),
            other => out.push(Some(other)),
        }
    }
    out
}

fn overflow_object(items: Vec<Option<Qv>>) -> Qv {
    let max = items.len() as f64 - 1.0;
    let mut obj = array_to_object(items);
    obj.overflow = Some(max);
    Qv::Obj(obj)
}

/// `utils.combine(a, b, arrayLimit)`.
fn combine(a: Qv, b: Qv) -> Qv {
    if let Qv::Obj(mut obj) = a {
        if let Some(max) = obj.overflow {
            let next = max + 1.0;
            obj.set(number_to_string(next), b);
            obj.overflow = Some(next);
            return Qv::Obj(obj);
        }
        return combine_plain(Qv::Obj(obj), b);
    }
    combine_plain(a, b)
}

fn combine_plain(a: Qv, b: Qv) -> Qv {
    let result = concat(vec![a, b]);
    if result.len() > ARRAY_LIMIT {
        return overflow_object(result);
    }
    Qv::Arr(result)
}

/// `utils.merge(target, source, options)` (`strictMerge` vrai par défaut).
fn merge(target: Qv, source: Qv) -> Qv {
    if falsy(&source) {
        return target;
    }
    if !is_object(&source) {
        return match target {
            Qv::Arr(mut items) => {
                let next = items.len();
                if next >= ARRAY_LIMIT {
                    items.push(Some(source));
                    let mut obj = array_to_object(items);
                    obj.overflow = Some(next as f64);
                    return Qv::Obj(obj);
                }
                items.push(Some(source));
                Qv::Arr(items)
            }
            Qv::Obj(mut obj) => match obj.overflow {
                Some(max) => {
                    let next = max + 1.0;
                    obj.set(number_to_string(next), source);
                    obj.overflow = Some(next);
                    Qv::Obj(obj)
                }
                None => Qv::Arr(vec![Some(Qv::Obj(obj)), Some(source)]),
            },
            primitive => Qv::Arr(vec![Some(primitive), Some(source)]),
        };
    }

    if !is_object(&target) {
        if let Qv::Obj(src) = &source
            && let Some(max) = src.overflow
        {
            let Qv::Obj(src) = source else { unreachable!() };
            let mut result = QObj::default();
            result.set("0".into(), target);
            for (k, v) in src.keys {
                let old = js::parse_int(&k, Some(10));
                result.set(number_to_string(old + 1.0), v);
            }
            result.overflow = Some(max + 1.0);
            return Qv::Obj(result);
        }
        let combined = concat(vec![Qv::Arr(vec![Some(target)]), source]);
        if combined.len() > ARRAY_LIMIT {
            return overflow_object(combined);
        }
        return Qv::Arr(combined);
    }

    match (target, source) {
        (Qv::Arr(mut t), Qv::Arr(s)) => {
            for (i, item) in s.into_iter().enumerate() {
                let Some(item) = item else { continue };
                match t.get_mut(i) {
                    Some(slot @ Some(_)) => {
                        let existing = slot.take().unwrap_or(Qv::Str(String::new()));
                        if is_object(&existing) && is_object(&item) {
                            *slot = Some(merge(existing, item));
                        } else {
                            *slot = Some(existing);
                            t.push(Some(item));
                        }
                    }
                    _ => {
                        if i >= t.len() {
                            t.resize(i + 1, None);
                        }
                        t[i] = Some(item);
                    }
                }
            }
            if t.len() > ARRAY_LIMIT {
                return overflow_object(t);
            }
            Qv::Arr(t)
        }
        (target, source) => {
            let mut acc = match target {
                Qv::Arr(items) => array_to_object(items),
                Qv::Obj(obj) => obj,
                Qv::Str(_) => unreachable!(),
            };
            let (entries, src_overflow) = match source {
                Qv::Arr(items) => (
                    items
                        .into_iter()
                        .enumerate()
                        .filter_map(|(i, v)| v.map(|v| (i.to_string(), v)))
                        .collect::<Vec<_>>(),
                    None,
                ),
                Qv::Obj(obj) => (obj.keys, obj.overflow),
                Qv::Str(_) => unreachable!(),
            };
            for (key, value) in entries {
                if acc.has(&key) {
                    let existing = acc.take(&key).unwrap_or(Qv::Str(String::new()));
                    acc.set(key.clone(), merge(existing, value));
                } else {
                    acc.set(key.clone(), value);
                }
                if let Some(max) = src_overflow
                    && acc.overflow.is_none()
                {
                    acc.overflow = Some(max);
                }
                if let Some(max) = acc.overflow
                    && let Some(n) = canonical_index(&key)
                    && n > max
                {
                    acc.overflow = Some(n);
                }
            }
            Qv::Obj(acc)
        }
    }
}

/// `splitKeyIntoSegments` (sans `allowDots`, `allowPrototypes` vrai).
fn split_key(key: &str) -> Vec<String> {
    let b = key.as_bytes();
    let mut segments = Vec::new();
    let first = key.find('[');
    let parent = first.map_or(key, |f| &key[..f]);
    if !parent.is_empty() {
        segments.push(parent.to_owned());
    }
    let mut open = first;
    let mut collected = 0;
    while let Some(o) = open {
        if collected >= DEPTH {
            break;
        }
        let mut level = 1;
        let mut close = None;
        let mut i = o + 1;
        while i < b.len() && close.is_none() {
            match b[i] {
                b'[' => level += 1,
                b']' => {
                    level -= 1;
                    if level == 0 {
                        close = Some(i);
                    }
                }
                _ => {}
            }
            i += 1;
        }
        let Some(c) = close else {
            segments.push(format!("[{}]", &key[o..]));
            return segments;
        };
        segments.push(key[o..=c].to_owned());
        collected += 1;
        open = key[c + 1..].find('[').map(|p| p + c + 1);
    }
    if let Some(o) = open {
        segments.push(format!("[{}]", &key[o..]));
    }
    segments
}

/// `parseObject(chain, val, options, valuesParsed = true)`.
fn parse_object(chain: &[String], val: Qv) -> Option<Qv> {
    let mut leaf = Some(val);
    for root in chain.iter().rev() {
        let current = leaf.take();
        if root == "[]" {
            leaf = Some(match current {
                Some(Qv::Obj(obj)) if obj.overflow.is_some() => Qv::Obj(obj),
                Some(v) => combine(Qv::Arr(Vec::new()), v),
                // `[].concat([], undefined)` : un élément `undefined`, compacté plus tard.
                None => Qv::Arr(vec![None]),
            });
            continue;
        }
        let clean = if root.starts_with('[') && root.ends_with(']') && root.len() >= 2 {
            &root[1..root.len() - 1]
        } else {
            root.as_str()
        };
        let index = js::parse_int(clean, Some(10));
        let valid_index =
            !index.is_nan() && root != clean && number_to_string(index) == clean && index >= 0.0;
        let mut obj = QObj::default();
        if valid_index && index < ARRAY_LIMIT as f64 {
            let i = index as usize;
            let mut items = vec![None; i + 1];
            items[i] = current;
            leaf = Some(Qv::Arr(items));
            continue;
        }
        if valid_index {
            if let Some(v) = current {
                obj.set(clean.to_owned(), v);
            }
            obj.overflow = Some(index);
        } else if clean != "__proto__"
            && let Some(v) = current
        {
            obj.set(clean.to_owned(), v);
        }
        leaf = Some(Qv::Obj(obj));
    }
    leaf
}

/// `utils.compact` : retire les trous de tous les tableaux.
fn compact(v: Qv) -> Json {
    match v {
        Qv::Str(s) => Json::Str(s),
        Qv::Arr(items) => Json::Arr(items.into_iter().flatten().map(compact).collect()),
        Qv::Obj(obj) => {
            let mut out = Obj::new();
            for (k, v) in obj.keys {
                out.insert(k, compact(v));
            }
            Json::Obj(out)
        }
    }
}

/// `qs.parse(str, { allowPrototypes: true })` ; la chaîne est la query brute, sans `?`.
pub fn parse(raw: &str) -> Obj {
    if raw.is_empty() {
        return Obj::new();
    }
    let clean = replace_ci(&replace_ci(raw, "%5B", "["), "%5D", "]");

    // parseValues : objet sans prototype, doublons combinés.
    let mut temp = QObj::default();
    for part in clean.split('&').take(PARAMETER_LIMIT) {
        let pos = match part.find("]=") {
            Some(p) => Some(p + 1),
            None => part.find('='),
        };
        let (key, val) = match pos {
            None => (qs_decode(part), String::new()),
            Some(p) => (qs_decode(&part[..p]), qs_decode(&part[p + 1..])),
        };
        let val = Qv::Str(val);
        if temp.has(&key) {
            let existing = temp.take(&key).unwrap_or(Qv::Str(String::new()));
            temp.set(key, combine(existing, val));
        } else {
            temp.set(key, val);
        }
    }

    let mut obj = Qv::Obj(QObj::default());
    for (key, val) in temp.keys {
        if key.is_empty() {
            continue;
        }
        let chain = split_key(&key);
        if let Some(new_obj) = parse_object(&chain, val) {
            obj = merge(obj, new_obj);
        }
    }
    match compact(obj) {
        Json::Obj(o) => o,
        _ => Obj::new(),
    }
}

/// `str.replace(/needle/gi, with)` pour un motif ASCII.
fn replace_ci(s: &str, needle: &str, with: &str) -> String {
    let lower = s.to_ascii_lowercase();
    let needle = needle.to_ascii_lowercase();
    let mut out = String::with_capacity(s.len());
    let mut last = 0;
    for (i, _) in lower.match_indices(&needle) {
        out.push_str(&s[last..i]);
        out.push_str(with);
        last = i + needle.len();
    }
    out.push_str(&s[last..]);
    out
}

/// Sortie de `VehiclesQuerySchema` (après `transform`), clés dans l'ordre du schéma.
#[derive(Clone, Debug, Default, PartialEq)]
pub struct VehiclesQuery {
    pub search: Option<String>,
    pub brand_id: Option<String>,
    pub model_id: Option<String>,
    pub type_id: Option<String>,
    pub year: Option<u16>,
    pub limit: Option<u32>,
    pub page: Option<u32>,
    pub include_all: bool,
}

const SCHEMA_KEYS: [&str; 8] = [
    "search",
    "brandId",
    "modelId",
    "typeId",
    "year",
    "limit",
    "page",
    "includeAll",
];

/// `z.preprocess(v => typeof v === 'string' && v.trim() === '' ? undefined : v, …)`.
fn present(v: Option<&Json>) -> Result<Option<&str>, ()> {
    match v {
        None => Ok(None),
        Some(Json::Str(s)) if js::trims_to_empty(s) => Ok(None),
        Some(Json::Str(s)) => Ok(Some(s)),
        Some(_) => Err(()),
    }
}

fn utf16_len(s: &str) -> usize {
    s.chars().map(char::len_utf16).sum()
}

fn optional_string(v: Option<&Json>) -> Result<Option<String>, ()> {
    match present(v)? {
        Some(s) if (1..=200).contains(&utf16_len(s)) => Ok(Some(s.to_owned())),
        Some(_) => Err(()),
        None => Ok(None),
    }
}

/// Chiffres ASCII sans zéro de tête (`^[1-9]\d*$`, ou `^(0|[1-9]\d*)$` si `zero`).
fn decimal(s: &str, zero: bool) -> Option<f64> {
    let ok = match s.as_bytes() {
        [b'0'] => zero,
        [b'1'..=b'9', rest @ ..] => rest.iter().all(u8::is_ascii_digit),
        _ => false,
    };
    ok.then(|| s.parse::<f64>().unwrap_or(f64::INFINITY))
}

fn int4(v: Option<&Json>, zero: bool) -> Result<Option<u32>, ()> {
    match present(v)? {
        None => Ok(None),
        Some(s) => match decimal(s, zero) {
            Some(n) if n <= 2_147_483_647.0 => Ok(Some(n as u32)),
            _ => Err(()),
        },
    }
}

/// `PositiveIntParamSchema` appliqué au paramètre de chemin décodé.
pub fn positive_int_param(s: &str) -> Option<u32> {
    decimal(s, false)
        .filter(|n| *n <= 2_147_483_647.0)
        .map(|n| n as u32)
}

/// `VehiclesQuerySchema.parse(query)` ; `Err(())` = toute `ZodError`.
// L'échec ne porte aucune information côté JavaScript (zod/URIError).
#[allow(clippy::result_unit_err)]
pub fn validate(query: &Obj) -> Result<VehiclesQuery, ()> {
    if query.iter().any(|(k, _)| !SCHEMA_KEYS.contains(&k.as_str())) {
        return Err(());
    }
    let year = match present(query.get("year"))? {
        None => None,
        Some(s) => {
            let four = s.len() == 4 && decimal(s, false).is_some();
            match s.parse::<u16>() {
                Ok(y) if four && (1900..=2100).contains(&y) => Some(y),
                _ => return Err(()),
            }
        }
    };
    let include_all = match present(query.get("includeAll"))? {
        None => false,
        Some("true") => true,
        Some("false") => false,
        Some(_) => return Err(()),
    };
    Ok(VehiclesQuery {
        search: optional_string(query.get("search"))?,
        brand_id: optional_string(query.get("brandId"))?,
        model_id: optional_string(query.get("modelId"))?,
        type_id: optional_string(query.get("typeId"))?,
        year,
        limit: int4(query.get("limit"), false)?,
        page: int4(query.get("page"), true)?,
        include_all,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::route::json;

    fn qs(s: &str) -> String {
        json::stringify(&Json::Obj(parse(s)))
    }

    #[test]
    fn qs_shapes_seen_on_node() {
        assert_eq!(qs("year=2008&page=0"), r#"{"year":"2008","page":"0"}"#);
        assert_eq!(qs("year[]=2008"), r#"{"year":["2008"]}"#);
        assert_eq!(qs("year[a]=1"), r#"{"year":{"a":"1"}}"#);
        assert_eq!(qs("%ZZ=1&=2&__proto__=3"), r#"{"%ZZ":"1"}"#);
        assert_eq!(qs("a=1&a=2"), r#"{"a":["1","2"]}"#);
        assert_eq!(qs("a[1]=x&a[0]=y"), r#"{"a":["y","x"]}"#);
        assert_eq!(qs("b=1&0=2"), r#"{"0":"2","b":"1"}"#);
        assert_eq!(qs("a+b=c+d%20e"), r#"{"a b":"c d e"}"#);
    }

    #[test]
    fn schema_like_zod() {
        let ok = validate(&parse("year=2008&page=0&limit=100&includeAll=true")).unwrap();
        assert_eq!(
            (ok.year, ok.page, ok.limit, ok.include_all),
            (Some(2008), Some(0), Some(100), true)
        );
        for bad in [
            "year=1899",
            "year=02008",
            "page=01",
            "limit=0",
            "limit=2147483648",
            "foo=1",
            "year[]=2008",
            "includeAll=yes",
            "constructor=1",
        ] {
            assert!(validate(&parse(bad)).is_err(), "{bad}");
        }
        assert_eq!(
            validate(&parse("year=%20&search=")).unwrap(),
            VehiclesQuery::default()
        );
        assert_eq!(positive_int_param("2147483647"), Some(2_147_483_647));
        for bad in ["0", "01", "-1", "+1", "1.5", "2147483648", ""] {
            assert_eq!(positive_int_param(bad), None, "{bad}");
        }
    }
}
