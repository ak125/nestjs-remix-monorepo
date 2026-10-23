//! Session de Node sur cette route : `cookie` 0.7.2, `express-session` 1.19
//! (`connect.sid`, magasin `connect-redis` `sess:`), `passport.session()` et
//! `CookieSerializer` (version de session, cache utilisateur de 5 s). La route
//! ne crée jamais de session ; elle relit, touche ou réécrit celle de Node.

use std::collections::HashMap;
use std::sync::Mutex;
use std::time::{Duration, Instant};

use base64::Engine;
use ring::hmac;

use super::json::{self, Json, Obj};
use super::log;
use super::redis::{Redis, Reply};
use super::uri;
use crate::postgrest::{Postgrest, Query};

const COOKIE_NAME: &str = "connect.sid";
const DEFAULT_TTL: i64 = 2_592_000;
const USER_CACHE_TTL: Duration = Duration::from_secs(5);

#[derive(Clone, Copy, Debug)]
pub struct User {
    pub is_admin: bool,
    pub level: f64,
}

pub enum SessionError {
    /// `SyntaxError` de `JSON.parse` → `BadRequestException` (400).
    Syntax(String),
    /// `TypeError` (500).
    Type(String),
    /// Erreur du magasin : réponse d'erreur de Redis, ou connexion perdue après
    /// l'envoi de la commande. Sans connexion, la commande attend (file hors ligne).
    Store(String),
}

/// Session chargée depuis Redis.
pub struct Loaded {
    pub sid: String,
    data: Obj,
    cookie: CookieData,
    pub modified: bool,
}

#[derive(Default)]
pub struct Session {
    pub loaded: Option<Loaded>,
    pub user: Option<User>,
}

pub struct Users {
    cache: Mutex<HashMap<String, (Instant, Option<User>)>>,
}

impl Default for Users {
    fn default() -> Self {
        Self {
            cache: Mutex::new(HashMap::new()),
        }
    }
}

/// `cookie.parse` (0.7.2), première occurrence gagnante.
pub fn parse_cookies(header: &str) -> Vec<(String, String)> {
    let mut out: Vec<(String, String)> = Vec::new();
    let s = header;
    let len = s.len();
    if len < 2 {
        return out;
    }
    let mut index = 0;
    while index < len {
        let Some(eq) = s[index..].find('=').map(|i| i + index) else {
            break;
        };
        let end = s[index..].find(';').map_or(len, |i| i + index);
        if eq > end {
            index = s[..eq].rfind(';').map_or(0, |i| i + 1);
            continue;
        }
        let key = s[index..eq].trim_matches([' ', '\t']);
        if !out.iter().any(|(k, _)| k == key) {
            let mut val = s[eq + 1..end].trim_matches([' ', '\t']);
            if val.len() >= 2 && val.starts_with('"') && val.ends_with('"') {
                val = &val[1..val.len() - 1];
            }
            let decoded = if val.contains('%') {
                uri::decode_uri_component(val).unwrap_or_else(|()| val.to_owned())
            } else {
                val.to_owned()
            };
            out.push((key.to_owned(), decoded));
        }
        index = end + 1;
    }
    out
}

fn sign(val: &str, key: &hmac::Key) -> String {
    let tag = hmac::sign(key, val.as_bytes());
    let b64 = base64::engine::general_purpose::STANDARD.encode(tag.as_ref());
    format!("{val}.{}", b64.trim_end_matches('='))
}

/// `cookie-signature.unsign` : longueur égale puis comparaison à temps constant.
pub fn unsign(input: &str, key: &hmac::Key) -> Option<String> {
    let tentative = &input[..input.rfind('.')?];
    let mac = base64::engine::general_purpose::STANDARD_NO_PAD
        .decode(&input[tentative.len() + 1..])
        .ok()?;
    // Vérification HMAC à temps constant, puis forme canonique (comme la
    // comparaison de chaînes de cookie-signature).
    hmac::verify(key, tentative.as_bytes(), &mac).ok()?;
    (sign(tentative, key) == input).then(|| tentative.to_owned())
}

pub fn encode_uri_component(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for b in s.bytes() {
        if b.is_ascii_alphanumeric() || b"-_.!~*'()".contains(&b) {
            out.push(b as char);
        } else {
            out.push_str(&format!("%{b:02X}"));
        }
    }
    out
}

/// Champs de `Cookie#data` (ordre de `toJSON`).
struct CookieData {
    original_max_age: Option<Json>,
    partitioned: Option<Json>,
    priority: Option<Json>,
    expires: Option<i64>,
    secure: Option<Json>,
    http_only: Option<Json>,
    domain: Option<Json>,
    path: Option<Json>,
    same_site: Option<Json>,
}

impl CookieData {
    fn from_stored(stored: &Obj) -> Self {
        let get = |k: &str| stored.get(k).cloned();
        Self {
            original_max_age: Some(get("originalMaxAge").unwrap_or(Json::Null)),
            partitioned: get("partitioned"),
            priority: get("priority"),
            expires: stored.get("expires").and_then(Json::as_str).and_then(parse_iso),
            secure: get("secure"),
            http_only: Some(get("httpOnly").unwrap_or(Json::Bool(true))),
            domain: get("domain"),
            path: Some(get("path").unwrap_or_else(|| Json::Str("/".into()))),
            same_site: get("sameSite"),
        }
    }

    /// `touch()` → `resetMaxAge()` : `expires = now + originalMaxAge`.
    fn touch(&mut self, now: i64) {
        self.expires = match &self.original_max_age {
            Some(Json::Num(ms)) => Some(now + *ms as i64),
            _ => None,
        };
    }

    fn to_json(&self) -> Json {
        let mut o = Obj::new();
        let mut put = |k: &str, v: &Option<Json>| {
            if let Some(v) = v {
                o.insert(k.to_owned(), v.clone());
            }
        };
        put("originalMaxAge", &self.original_max_age);
        put("partitioned", &self.partitioned);
        put("priority", &self.priority);
        let expires = Some(self.expires.map_or(Json::Null, |ms| Json::Str(iso(ms))));
        put("expires", &expires);
        put("secure", &self.secure);
        put("httpOnly", &self.http_only);
        put("domain", &self.domain);
        put("path", &self.path);
        put("sameSite", &self.same_site);
        Json::Obj(o)
    }

    fn secure(&self) -> bool {
        self.secure.as_ref().is_some_and(Json::truthy)
    }

    /// `cookie.serialize(name, val, cookie.data)`.
    fn serialize(&self, value: &str) -> Option<String> {
        let mut out = format!("{COOKIE_NAME}={}", encode_uri_component(value));
        if let Some(Json::Str(d)) = &self.domain {
            out.push_str(&format!("; Domain={d}"));
        }
        if let Some(Json::Str(p)) = &self.path {
            out.push_str(&format!("; Path={p}"));
        }
        let ms = self.expires?;
        let at = std::time::UNIX_EPOCH + Duration::from_millis(ms.max(0) as u64);
        out.push_str(&format!("; Expires={}", httpdate::fmt_http_date(at)));
        if self.http_only.as_ref().is_some_and(Json::truthy) {
            out.push_str("; HttpOnly");
        }
        if self.secure() {
            out.push_str("; Secure");
        }
        if self.partitioned.as_ref().is_some_and(Json::truthy) {
            out.push_str("; Partitioned");
        }
        if let Some(Json::Str(p)) = &self.priority {
            match p.to_ascii_lowercase().as_str() {
                "low" => out.push_str("; Priority=Low"),
                "medium" => out.push_str("; Priority=Medium"),
                "high" => out.push_str("; Priority=High"),
                _ => return None,
            }
        }
        match &self.same_site {
            None | Some(Json::Bool(false)) | Some(Json::Null) => {}
            Some(Json::Bool(true)) => out.push_str("; SameSite=Strict"),
            Some(Json::Str(s)) => match s.to_ascii_lowercase().as_str() {
                "strict" => out.push_str("; SameSite=Strict"),
                "lax" => out.push_str("; SameSite=Lax"),
                "none" => out.push_str("; SameSite=None"),
                _ => return None,
            },
            Some(_) => return None,
        }
        Some(out)
    }
}

/// Jours civils (algorithme de H. Hinnant) pour `Date#toISOString`.
pub fn iso_now() -> String {
    iso(super::log::now_ms() as i64)
}

pub fn iso(ms: i64) -> String {
    let secs = ms.div_euclid(1000);
    let milli = ms.rem_euclid(1000);
    let days = secs.div_euclid(86_400);
    let tod = secs.rem_euclid(86_400);
    let z = days + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z - era * 146_097;
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    let y = yoe + era * 400 + i64::from(m <= 2);
    format!(
        "{y:04}-{m:02}-{d:02}T{:02}:{:02}:{:02}.{milli:03}Z",
        tod / 3600,
        tod / 60 % 60,
        tod % 60
    )
}

/// `new Date(iso)` pour la forme `toISOString` que Node écrit.
fn parse_iso(s: &str) -> Option<i64> {
    let b = s.as_bytes();
    if b.len() < 20 || !s.ends_with('Z') || b[4] != b'-' || b[7] != b'-' || b[10] != b'T' {
        return None;
    }
    let n = |r: std::ops::Range<usize>| s.get(r)?.parse::<i64>().ok();
    let (y, mo, d, h, mi, sec) = (n(0..4)?, n(5..7)?, n(8..10)?, n(11..13)?, n(14..16)?, n(17..19)?);
    let ms = match &s[19..s.len() - 1] {
        "" => 0,
        frac if frac.starts_with('.') && frac.len() == 4 => frac[1..].parse::<i64>().ok()?,
        _ => return None,
    };
    if !(1..=12).contains(&mo) || !(1..=31).contains(&d) || h > 23 || mi > 59 || sec > 59 {
        return None;
    }
    let y2 = if mo <= 2 { y - 1 } else { y };
    let era = y2.div_euclid(400);
    let yoe = y2 - era * 400;
    let mp = if mo > 2 { mo - 3 } else { mo + 9 };
    let doy = (153 * mp + 2) / 5 + d - 1;
    let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
    let days = era * 146_097 + doe - 719_468;
    Some(((days * 86_400 + h * 3600 + mi * 60 + sec) * 1000) + ms)
}

fn type_error_reading(v: Option<&Json>, prop: &str) -> SessionError {
    let what = if matches!(v, Some(Json::Null)) {
        "null"
    } else {
        "undefined"
    };
    SessionError::Type(format!("Cannot read properties of {what} (reading '{prop}')"))
}

pub struct SessionStore<'a> {
    /// `sess:*` (connect-redis sur node-redis, file hors ligne).
    pub sessions: &'a Redis,
    /// `session_version:*` (CacheService, borné).
    pub redis: &'a Redis,
    pub key: &'a hmac::Key,
    pub pg: &'a Postgrest,
    pub users: &'a Users,
}

impl SessionStore<'_> {
    /// `session()` puis `passport.session()`.
    pub async fn load(&self, cookie_header: Option<&str>) -> Result<Session, SessionError> {
        let mut session = Session::default();
        let Some(raw) = cookie_header
            .map(parse_cookies)
            .and_then(|c| c.into_iter().find(|(k, _)| k == COOKIE_NAME).map(|(_, v)| v))
        else {
            return Ok(session);
        };
        let Some(sid) = raw.strip_prefix("s:").and_then(|v| unsign(v, self.key)) else {
            return Ok(session);
        };
        let key = format!("sess:{sid}");
        let stored = match self.sessions.cmd(&[b"GET", key.as_bytes()]).await {
            Ok(Reply::Bulk(b)) if !b.is_empty() => String::from_utf8_lossy(&b).into_owned(),
            Ok(Reply::Error(e)) => return Err(SessionError::Store(e)),
            Ok(_) => return Ok(session),
            Err(e) => return Err(SessionError::Store(e)),
        };
        let sess = json::parse(&stored).map_err(|e| SessionError::Syntax(e.message))?;
        if !sess.truthy() {
            return Ok(session);
        }
        let Json::Obj(mut data) = sess else {
            return Err(type_error_reading(None, "expires"));
        };
        let cookie = match data.get("cookie") {
            Some(Json::Obj(c)) => CookieData::from_stored(c),
            Some(Json::Null) | None => return Err(type_error_reading(data.get("cookie"), "expires")),
            Some(_) => return Err(SessionError::Type("argument options must be a object".into())),
        };

        let mut modified = false;
        let su = match data.get("passport") {
            Some(p) if p.truthy() => p.as_obj().and_then(|o| o.get("user")).cloned(),
            _ => None,
        };
        if let Some(su) = su.filter(|v| v.truthy() || matches!(v, Json::Num(n) if *n == 0.0)) {
            match self.deserialize(&su).await {
                Some(user) => session.user = Some(user),
                None => {
                    if let Some(Json::Obj(p)) = data.get_mut("passport") {
                        p.remove("user");
                        modified = true;
                    }
                }
            }
        }
        session.loaded = Some(Loaded {
            sid,
            data,
            cookie,
            modified,
        });
        Ok(session)
    }

    /// `CookieSerializer.deserializeUser`.
    async fn deserialize(&self, su: &Json) -> Option<User> {
        let (user_id, source, version) = match su {
            Json::Str(s) => (s.clone(), None, 0.0),
            Json::Obj(o) => (
                o.get("userId")
                    .map_or_else(|| "undefined".to_owned(), Json::to_js_string),
                o.get("authSource").filter(|v| v.truthy()).map(Json::to_js_string),
                match o.get("sessionVersion") {
                    Some(Json::Num(n)) if *n != 0.0 && !n.is_nan() => *n,
                    _ => 0.0,
                },
            ),
            _ => ("undefined".to_owned(), None, 0.0),
        };
        let current = self.session_version(&user_id).await;
        if current > 0.0 && version < current {
            log::line(
                log::INFO,
                None,
                "CookieSerializer",
                &format!(
                    "Session rejected: version {} < {} for user {user_id}",
                    crate::js::number_to_string(version),
                    crate::js::number_to_string(current)
                ),
            );
            return None;
        }
        let cache_key = format!("{}:{user_id}", source.as_deref().unwrap_or("unknown"));
        if let Some((at, user)) = self.users.cache.lock().ok()?.get(&cache_key).copied()
            && at.elapsed() < USER_CACHE_TTL
        {
            return user;
        }
        // Horodatage pris avant la lecture, comme `now` dans CookieSerializer.
        let looked_up = Instant::now();
        let user = match source.as_deref() {
            Some("admin") => self.find_admin(&user_id).await,
            Some(_) => self.find_customer(&user_id).await,
            None => match self.find_admin(&user_id).await {
                Some(u) => Some(u),
                None => self.find_customer(&user_id).await,
            },
        };
        let mut cache = self.users.cache.lock().ok()?;
        match user {
            None => {
                log::line(
                    log::INFO,
                    None,
                    "CookieSerializer",
                    &format!("User not found during deserialization: {cache_key}"),
                );
                cache.remove(&cache_key);
            }
            Some(u) => {
                cache.insert(cache_key, (looked_up, Some(u)));
                cache.retain(|_, (at, _)| at.elapsed() < USER_CACHE_TTL);
            }
        }
        user
    }

    async fn session_version(&self, user_id: &str) -> f64 {
        let key = format!("session_version:{user_id}");
        match self.redis.cmd(&[b"GET", key.as_bytes()]).await {
            Ok(Reply::Bulk(b)) if !b.is_empty() => match json::parse(&String::from_utf8_lossy(&b)) {
                Ok(Json::Num(n)) if n != 0.0 && !n.is_nan() => n,
                _ => 0.0,
            },
            _ => 0.0,
        }
    }

    async fn find_admin(&self, id: &str) -> Option<User> {
        let mut q = Query::new("___config_admin").single();
        q.set("select", "*".into());
        q.append("cnfa_id", format!("eq.{id}"));
        let r = self.pg.get(&q).await;
        if crate::js::truthy(Some(&r.error)) || !crate::js::truthy(Some(&r.data)) {
            return None;
        }
        let raw = r.data.get("cnfa_level").filter(|v| crate::js::truthy(Some(v)));
        let level_str = raw.map_or_else(|| "7".to_owned(), |v| crate::js::to_js_string(Some(v)));
        let level = crate::js::parse_int(&level_str, None);
        Some(User {
            is_admin: level >= 7.0,
            level,
        })
    }

    async fn find_customer(&self, id: &str) -> Option<User> {
        let mut q = Query::new("___xtr_customer").single();
        q.set("select", "*".into());
        q.append("cst_id", format!("eq.{id}"));
        let r = self.pg.get(&q).await;
        (!crate::js::truthy(Some(&r.error)) && crate::js::truthy(Some(&r.data))).then_some(User {
            is_admin: false,
            level: 1.0,
        })
    }

    /// Fin de requête d'express-session : `touch()`, puis `SET … EX` si la
    /// session a changé, sinon `EXPIRE`. Renvoie l'en-tête `Set-Cookie` éventuel
    /// (calculé à l'écriture des en-têtes, comme `onHeaders`).
    pub fn set_cookie(&self, loaded: &mut Loaded, req_secure: bool) -> Option<String> {
        loaded.cookie.touch(log::now_ms() as i64);
        if !(loaded.modified && loaded.cookie.expires.is_some()) {
            return None;
        }
        if loaded.cookie.secure() && !req_secure {
            return None;
        }
        loaded
            .cookie
            .serialize(&format!("s:{}", sign(&loaded.sid, self.key)))
    }

    pub async fn persist(&self, loaded: &Loaded) {
        let key = format!("sess:{}", loaded.sid);
        let ttl = loaded.cookie.expires.map_or(DEFAULT_TTL, |ms| {
            (ms - log::now_ms() as i64 + 999).div_euclid(1000)
        });
        let result = if ttl <= 0 {
            self.sessions.cmd(&[b"DEL", key.as_bytes()]).await
        } else if loaded.modified {
            let mut data = loaded.data.clone();
            if let Some(slot) = data.get_mut("cookie") {
                *slot = loaded.cookie.to_json();
            }
            let body = json::stringify(&Json::Obj(data));
            let ttl = ttl.to_string();
            self.sessions
                .cmd(&[b"SET", key.as_bytes(), body.as_bytes(), b"EX", ttl.as_bytes()])
                .await
        } else {
            let ttl = ttl.to_string();
            self.sessions
                .cmd(&[b"EXPIRE", key.as_bytes(), ttl.as_bytes()])
                .await
        };
        if let Err(e) = result {
            log::line(log::ERROR, None, "express-session", &format!("store: {e}"));
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn cookie_parse_matches_cookie_0_7() {
        let c = parse_cookies("a=1; b=\"x%20y\"; a=2; bad; c=%ZZ");
        assert_eq!(
            c,
            [
                ("a".into(), "1".into()),
                ("b".into(), "x y".into()),
                ("c".into(), "%ZZ".into())
            ]
        );
        assert!(parse_cookies("x").is_empty());
    }

    #[test]
    fn sign_roundtrip_and_iso() {
        let key = hmac::Key::new(hmac::HMAC_SHA256, b"secret");
        let s = sign("abc", &key);
        assert_eq!(unsign(&s, &key).as_deref(), Some("abc"));
        assert!(unsign(&format!("{s}x"), &key).is_none());
        let ms = parse_iso("2026-11-20T23:18:22.123Z").unwrap();
        assert_eq!(iso(ms), "2026-11-20T23:18:22.123Z");
        assert_eq!(encode_uri_component("s:a+b/c=."), "s%3Aa%2Bb%2Fc%3D.");
    }
}
