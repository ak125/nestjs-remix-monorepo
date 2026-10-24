//! Protections globales de Node sur cette route : `BotGuardMiddleware` (blocage
//! IP, moteurs vérifiés par FCrDNS, sonde synthétique, géo, score), et
//! `CloudflareThrottlerGuard` (quatre paliers, deux contextes, compteurs en Redis
//! partagés avec Node).

use std::collections::{HashMap, VecDeque};
use std::fmt::Write;
use std::net::IpAddr;
use std::sync::Mutex;
use std::time::{Duration, Instant};

use ring::{digest, hmac};

use super::json::{self, Json};
use super::log::{self, ReqCtx};
use super::redis::{Redis, Reply};

const GOOD_BOTS: [&str; 14] = [
    "googlebot",
    "bingbot",
    "yandexbot",
    "slurp",
    "duckduckbot",
    "facebot",
    "twitterbot",
    "linkedinbot",
    "whatsapp",
    "telegrambot",
    "applebot",
    "pinterest",
    "semrushbot",
    "ahrefsbot",
];
const SUSPICIOUS_UA: [&str; 19] = [
    "python-requests",
    "python-urllib",
    "python/",
    "go-http-client",
    "java/",
    "curl/",
    "wget/",
    "httpclient",
    "libwww",
    "lwp-trivial",
    "scrapy",
    "phantomjs",
    "headlesschrome",
    "selenium",
    "puppeteer",
    "node-fetch",
    "axios/",
    "got/",
    "undici",
];
const TARGET_COUNTRIES: [&str; 23] = [
    "FR", "DZ", "TN", "MA", "BE", "CH", "GP", "MQ", "RE", "GF", "YT", "PM", "NC", "PF", "WF", "BL", "MF",
    "LU", "MC", "AD", "SN", "CI", "CM",
];
const VERIFIED_BOT_RDNS: [(&[&str], &[&str]); 6] = [
    (
        &[
            "googlebot",
            "google-inspectiontool",
            "storebot-google",
            "adsbot-google",
            "mediapartners-google",
            "apis-google",
            "feedfetcher-google",
            "googleother",
            "google-extended",
        ],
        &[".googlebot.com", ".google.com"],
    ),
    (&["bingbot", "adidxbot", "msnbot"], &[".search.msn.com"]),
    (&["applebot"], &[".applebot.apple.com"]),
    (&["duckduckbot", "duckduckgo"], &[".duckduckgo.com"]),
    (
        &["yandexbot", "yandeximages", "yandex.com/bots"],
        &[".yandex.com", ".yandex.net", ".yandex.ru"],
    ),
    (&["slurp"], &[".crawl.yahoo.net"]),
];
const CONFIG_REFRESH: Duration = Duration::from_secs(60);
const STATS_TTL: &[u8] = b"90000";

pub fn is_internal_ip(ip: &str) -> bool {
    if matches!(ip, "127.0.0.1" | "::1" | "::ffff:127.0.0.1") {
        return true;
    }
    let v4 = ip.strip_prefix("::ffff:").unwrap_or(ip);
    let mut parts = v4.split('.');
    match (parts.next(), parts.next(), parts.next()) {
        (Some("10"), Some(_), _) => true,
        (Some("192"), Some("168"), Some(_)) => true,
        (Some("172"), Some(b), Some(_)) => {
            b.len() == 2 && b.parse::<u8>().is_ok_and(|n| (16..=31).contains(&n))
        }
        _ => false,
    }
}

struct GuardConfig {
    enabled: bool,
    verified_bot_bypass: bool,
    threshold: f64,
    blocked_countries: Vec<String>,
    blocked_ips: Vec<String>,
    last_refresh: Option<Instant>,
}

pub struct Probe {
    pub enabled: bool,
    pub key: Option<hmac::Key>,
    pub egress: Vec<(IpAddr, u8)>,
}

impl Probe {
    /// `SyntheticProbeCredentialService.verify` : HMAC-SHA256 hexadécimal de
    /// `MÉTHODE|chemin|fenêtre` sur la minute courante ou la précédente.
    pub fn verify(&self, header: Option<&str>, method: &str, path: &str) -> bool {
        let (true, Some(key), Some(provided)) = (self.enabled, &self.key, header) else {
            return false;
        };
        if provided.is_empty() {
            return false;
        }
        let w = log::now_ms() / 60_000;
        // Node compare les chaînes hexadécimales : seule la forme minuscule passe.
        if provided.len() != 64
            || !provided
                .bytes()
                .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
        {
            return false;
        }
        let tag: Vec<u8> = (0..32)
            .filter_map(|i| u8::from_str_radix(&provided[2 * i..2 * i + 2], 16).ok())
            .collect();
        [w, w.wrapping_sub(1)].iter().any(|w| {
            let msg = format!("{}|{path}|{w}", method.to_ascii_uppercase());
            hmac::verify(key, msg.as_bytes(), &tag).is_ok()
        })
    }

    pub fn is_exempt_egress(&self, ip: &str) -> bool {
        let Ok(addr) = ip.parse::<IpAddr>() else {
            return false;
        };
        self.egress.iter().any(|(net, prefix)| match (net, addr) {
            (IpAddr::V4(n), IpAddr::V4(a)) => {
                let mask = if *prefix == 0 {
                    0
                } else {
                    u32::MAX << (32 - u32::from(*prefix))
                };
                u32::from(*n) & mask == u32::from(a) & mask
            }
            (IpAddr::V6(n), IpAddr::V6(a)) => {
                let mask = if *prefix == 0 {
                    0
                } else {
                    u128::MAX << (128 - u32::from(*prefix))
                };
                u128::from(*n) & mask == u128::from(a) & mask
            }
            _ => false,
        })
    }
}

/// `SEO_CP_SYNTHETIC_PROBE_EGRESS_IPS` : `réseau/préfixe` ou IP seule.
pub fn parse_egress(list: &str) -> Vec<(IpAddr, u8)> {
    list.split(',')
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .filter_map(|entry| {
            let (net, prefix) = entry.split_once('/').unwrap_or((entry, ""));
            let ip = net.parse::<IpAddr>().ok()?;
            let max = if ip.is_ipv4() { 32 } else { 128 };
            let prefix = if prefix.is_empty() {
                max
            } else {
                prefix.parse::<u8>().ok()?
            };
            (prefix <= max).then_some((ip, prefix))
        })
        .collect()
}

pub enum Verdict {
    Next {
        verified_bot: bool,
        verified_probe: bool,
    },
    Block(&'static str),
}

pub struct BotGuard {
    config: Mutex<GuardConfig>,
    resolver: Option<hickory_resolver::TokioResolver>,
    metrics_warned: Mutex<Option<Instant>>,
}

pub struct Fingerprint<'a> {
    pub peer: &'a str,
    pub cf_ip: Option<&'a str>,
    pub xff: Option<&'a str>,
    pub real_ip: Option<&'a str>,
    pub country: Option<&'a str>,
    pub ua: &'a str,
    pub accept_language: Option<&'a str>,
    pub path: &'a str,
    pub method: &'a str,
    pub probe_header: Option<&'a str>,
    pub authenticated: bool,
}

impl BotGuard {
    pub fn new(env: &dyn Fn(&str) -> Option<String>) -> Self {
        let get = |k: &str, d: &str| env(k).unwrap_or_else(|| d.to_owned());
        let threshold = get("BOT_GUARD_SUSPICION_THRESHOLD", "80")
            .parse::<u8>()
            .ok()
            .filter(|n| (1..=100).contains(n));
        if threshold.is_none() {
            log::line(
                log::WARN,
                None,
                "BotGuardService",
                "Invalid BotGuard env threshold; keeping default 80",
            );
        }
        let resolver = hickory_resolver::TokioResolver::builder_tokio()
            .ok()
            .map(|b| b.build());
        let resolver = resolver.and_then(Result::ok);
        Self {
            config: Mutex::new(GuardConfig {
                enabled: get("BOT_GUARD_ENABLED", "true") == "true",
                verified_bot_bypass: get("BOT_GUARD_VERIFIED_BOT_BYPASS", "true") == "true",
                threshold: f64::from(threshold.unwrap_or(80)),
                blocked_countries: get("BOT_GUARD_BLOCKED_COUNTRIES", "CN")
                    .split(',')
                    .map(|s| s.trim().to_ascii_uppercase())
                    .filter(|s| !s.is_empty())
                    .collect(),
                blocked_ips: Vec::new(),
                last_refresh: None,
            }),
            resolver,
            metrics_warned: Mutex::new(None),
        }
    }

    /// `refreshConfig` : surcharge stockée dans `bot-guard:config`.
    pub async fn refresh(&self, redis: &Redis, req: &ReqCtx) {
        let stored = redis.cache_get("bot-guard:config", Some(req)).await;
        let Ok(mut c) = self.config.lock() else { return };
        if let Some(Json::Obj(o)) = stored.filter(Json::truthy) {
            if let Some(v) = o.get("enabled") {
                c.enabled = v.truthy();
            }
            let strings = |v: &Json| match v {
                Json::Arr(a) => a.iter().map(Json::to_js_string).collect(),
                _ => Vec::new(),
            };
            if let Some(v) = o.get("blockedCountries") {
                c.blocked_countries = strings(v);
            }
            if let Some(v) = o.get("blockedIps") {
                c.blocked_ips = strings(v);
            }
            if let Some(v) = o.get("suspicionThreshold") {
                match v {
                    Json::Num(n) if n.fract() == 0.0 && (1.0..=100.0).contains(n) => c.threshold = *n,
                    _ => log::line(
                        log::WARN,
                        None,
                        "BotGuardService",
                        "Invalid BotGuard stored threshold; keeping last valid value",
                    ),
                }
            }
            if let Some(v) = o.get("verifiedBotBypass") {
                c.verified_bot_bypass = v.truthy();
            }
        }
        c.last_refresh = Some(Instant::now());
    }

    async fn maybe_refresh(&self, redis: &Redis, req: &ReqCtx) {
        let due = self
            .config
            .lock()
            .map(|c| c.last_refresh.is_none_or(|t| t.elapsed() > CONFIG_REFRESH))
            .unwrap_or(false);
        if due {
            self.refresh(redis, req).await;
        }
    }

    fn snapshot<T>(&self, f: impl FnOnce(&GuardConfig) -> T) -> T {
        f(&self.config.lock().expect("config BotGuard"))
    }

    pub async fn check(
        &'static self,
        fp: &Fingerprint<'_>,
        probe: &Probe,
        redis: &'static Redis,
        req: &ReqCtx,
    ) -> Verdict {
        let next = Verdict::Next {
            verified_bot: false,
            verified_probe: false,
        };
        if !self.snapshot(|c| c.enabled) {
            return next;
        }
        let ip = client_ip(fp);
        if is_internal_ip(&ip) {
            return next;
        }
        let country = fp.country.map(str::to_uppercase);
        let country_s = country.clone().unwrap_or_else(|| "undefined".into());

        let blocked_ip = if self.snapshot(|c| c.enabled) {
            self.maybe_refresh(redis, req).await;
            self.snapshot(|c| c.blocked_ips.contains(&ip))
        } else {
            false
        };
        if blocked_ip {
            self.log_blocked(redis, req, &ip, country.as_deref(), "ip_block", fp.path)
                .await;
            log::line(
                log::WARN,
                Some(req),
                "BotGuardMiddleware",
                &format!(
                    "Blocked: ip={ip} country={country_s} path={} reason=ip_block",
                    fp.path
                ),
            );
            return Verdict::Block("IP_BLOCKED");
        }
        if self.is_verified_search_engine(&ip, fp.ua, redis, req).await {
            self.track_allowed(redis, req, country.as_deref());
            return Verdict::Next {
                verified_bot: true,
                verified_probe: false,
            };
        }
        if probe.verify(fp.probe_header, fp.method, fp.path) || probe.is_exempt_egress(&ip) {
            self.track_allowed(redis, req, country.as_deref());
            return Verdict::Next {
                verified_bot: false,
                verified_probe: true,
            };
        }
        if let Some(cc) = country.as_deref() {
            let blocked = if self.snapshot(|c| c.enabled) {
                self.maybe_refresh(redis, req).await;
                self.snapshot(|c| c.blocked_countries.iter().any(|b| b == cc))
            } else {
                false
            };
            if blocked {
                self.log_blocked(redis, req, &ip, Some(cc), "geo_block", fp.path)
                    .await;
                log::line(
                    log::WARN,
                    Some(req),
                    "BotGuardMiddleware",
                    &format!("Blocked: ip={ip} country={cc} path={} reason=geo_block", fp.path),
                );
                return Verdict::Block("GEO_BLOCKED");
            }
        }
        let score = suspicion_score(fp, country.as_deref());
        if score >= self.snapshot(|c| c.threshold) {
            self.log_blocked(redis, req, &ip, country.as_deref(), "behavioral", fp.path)
                .await;
            let ua: String = js_substring(fp.ua, 80);
            log::line(
                log::WARN,
                Some(req),
                "BotGuardMiddleware",
                &format!(
                    "Blocked: ip={ip} country={country_s} score={} path={} ua=\"{ua}\" reason=behavioral",
                    crate::js::number_to_string(score),
                    fp.path
                ),
            );
            return Verdict::Block("SUSPICIOUS");
        }
        self.track_allowed(redis, req, country.as_deref());
        next
    }

    async fn is_verified_search_engine(&self, ip: &str, ua: &str, redis: &Redis, req: &ReqCtx) -> bool {
        if !self.snapshot(|c| c.verified_bot_bypass) {
            return false;
        }
        let ua = ua.to_lowercase();
        let Some((_, suffixes)) = VERIFIED_BOT_RDNS
            .iter()
            .find(|(t, _)| t.iter().any(|t| ua.contains(t)))
        else {
            return false;
        };
        let norm = normalize_ip(ip);
        if norm.is_empty() {
            return false;
        }
        let key = format!("bot-guard:vbot:{norm}");
        if let Some(v) = redis.cache_get(&key, Some(req)).await
            && v != Json::Null
        {
            return v.truthy();
        }
        let verified = self.fcrdns(&norm, suffixes).await;
        let ttl = if verified { "21600" } else { "3600" };
        let value = if verified { "true" } else { "false" };
        if let Ok(r) = redis
            .cmd(&[b"SETEX", key.as_bytes(), ttl.as_bytes(), value.as_bytes()])
            .await
        {
            let result = r.into_string().unwrap_or_default();
            log::line(
                log::INFO,
                Some(req),
                "CacheService",
                &format!("Redis SET {key} = {result} (TTL: {ttl}s)"),
            );
        }
        verified
    }

    async fn fcrdns(&self, norm: &str, suffixes: &[&str]) -> bool {
        let (Some(resolver), Ok(addr)) = (&self.resolver, norm.parse::<IpAddr>()) else {
            return false;
        };
        let Ok(names) = resolver.reverse_lookup(addr).await else {
            return false;
        };
        let host = names
            .answers()
            .iter()
            .filter_map(|r| match &r.data {
                hickory_resolver::proto::rr::RData::PTR(p) => Some(p.0.to_string()),
                _ => None,
            })
            .map(|n| n.to_lowercase().trim_end_matches('.').to_owned())
            .find(|h| suffixes.iter().any(|s| h == &s[1..] || h.ends_with(s)));
        let Some(host) = host else { return false };
        let (v4, v6) = tokio::join!(
            resolver.ipv4_lookup(host.as_str()),
            resolver.ipv6_lookup(host.as_str())
        );
        let mut ips: Vec<String> = Vec::new();
        if let Ok(l) = v4 {
            ips.extend(l.answers().iter().filter_map(|r| match &r.data {
                hickory_resolver::proto::rr::RData::A(a) => Some(a.0.to_string()),
                hickory_resolver::proto::rr::RData::AAAA(a) => Some(a.0.to_string()),
                _ => None,
            }));
        }
        if let Ok(l) = v6 {
            ips.extend(l.answers().iter().filter_map(|r| match &r.data {
                hickory_resolver::proto::rr::RData::A(a) => Some(a.0.to_string()),
                hickory_resolver::proto::rr::RData::AAAA(a) => Some(a.0.to_string()),
                _ => None,
            }));
        }
        ips.iter().any(|f| normalize_ip(f) == norm)
    }

    fn observation_cmds(kind: &str, country: Option<&str>) -> (String, Vec<String>) {
        let key = format!("bot-guard:stats:v2:minute:{}", log::now_ms() / 60_000);
        let mut fields = vec![kind.to_owned()];
        if let Some(cc) = country.filter(|c| c.len() == 2 && c.bytes().all(|b| b.is_ascii_uppercase())) {
            fields.push(format!("{kind}:country:{cc}"));
        }
        (key, fields)
    }

    async fn record(
        redis: &Redis,
        kind: &str,
        country: Option<&str>,
        recent: Option<String>,
    ) -> Result<(), String> {
        let (key, fields) = Self::observation_cmds(kind, country);
        let mut cmds: Vec<Vec<&[u8]>> = vec![vec![b"MULTI"]];
        for f in &fields {
            cmds.push(vec![b"HINCRBY", key.as_bytes(), f.as_bytes(), b"1"]);
        }
        cmds.push(vec![b"EXPIRE", key.as_bytes(), STATS_TTL]);
        cmds.push(vec![b"EXEC"]);
        let list = b"bot-guard:recent-blocks:v2";
        if let Some(entry) = &recent {
            cmds.extend([
                vec![&b"MULTI"[..]],
                vec![b"LPUSH", list, entry.as_bytes()],
                vec![b"LTRIM", list, b"0", b"99"],
                vec![b"EXPIRE", list, b"86400"],
                vec![b"EXEC"],
            ]);
        }
        let refs: Vec<&[&[u8]]> = cmds.iter().map(Vec::as_slice).collect();
        let replies = redis.pipeline(&refs).await?;
        let failed = replies.iter().any(|r| match r {
            Reply::Error(_) | Reply::Nil => true,
            Reply::Array(items) => items.iter().any(|i| matches!(i, Reply::Error(_))),
            _ => false,
        });
        if failed {
            Err("Redis unavailable for telemetry".into())
        } else {
            Ok(())
        }
    }

    /// Dans le contexte de la requête, comme `this.logger.warn` sous pino-http
    /// (y compris depuis `void this.trackAllowed()`).
    fn warn_metrics(&self, req: &ReqCtx) {
        if let Ok(mut last) = self.metrics_warned.lock()
            && last.is_none_or(|t| t.elapsed() >= Duration::from_secs(60))
        {
            *last = Some(Instant::now());
            log::line(
                log::WARN,
                Some(req),
                "BotGuardService",
                "BotGuard metrics unavailable; enforcement unchanged, observations may be missing",
            );
        }
    }

    async fn log_blocked(
        &self,
        redis: &Redis,
        req: &ReqCtx,
        ip: &str,
        country: Option<&str>,
        reason: &str,
        path: &str,
    ) {
        let mut entry = json::Obj::new();
        entry.insert("ip".into(), Json::Str(ip.into()));
        if let Some(c) = country {
            entry.insert("country".into(), Json::Str(c.into()));
        }
        entry.insert("reason".into(), Json::Str(reason.into()));
        entry.insert("path".into(), Json::Str(path.into()));
        entry.insert("timestamp".into(), Json::Str(super::session::iso_now()));
        if Self::record(
            redis,
            "blocked",
            country,
            Some(json::stringify(&Json::Obj(entry))),
        )
        .await
        .is_err()
        {
            self.warn_metrics(req);
        }
    }

    fn track_allowed(&'static self, redis: &'static Redis, req: &ReqCtx, country: Option<&str>) {
        // Comme Node (`void this.trackAllowed()`), sans attendre la réponse.
        let country = country.map(str::to_owned);
        let (guard, req) = (self, req.clone());
        tokio::spawn(async move {
            if Self::record(redis, "allowed", country.as_deref(), None)
                .await
                .is_err()
            {
                guard.warn_metrics(&req);
            }
        });
    }
}

fn normalize_ip(ip: &str) -> String {
    let s = if ip.len() >= 7 && ip[..7].eq_ignore_ascii_case("::ffff:") {
        &ip[7..]
    } else {
        ip
    };
    s.trim().to_lowercase()
}

fn js_substring(s: &str, n: usize) -> String {
    let units: Vec<u16> = s.encode_utf16().take(n).collect();
    String::from_utf16_lossy(&units)
}

fn client_ip(fp: &Fingerprint<'_>) -> String {
    if is_internal_ip(fp.peer) {
        let candidate = fp
            .cf_ip
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .or_else(|| {
                fp.xff
                    .and_then(|x| x.split(',').next())
                    .map(str::trim)
                    .filter(|s| !s.is_empty())
            })
            .or_else(|| fp.real_ip.map(str::trim).filter(|s| !s.is_empty()));
        if let Some(c) = candidate {
            return c.to_owned();
        }
    }
    if fp.peer.is_empty() {
        "unknown".into()
    } else {
        fp.peer.to_owned()
    }
}

fn suspicion_score(fp: &Fingerprint<'_>, country: Option<&str>) -> f64 {
    let mut score = 0.0;
    if fp.accept_language.is_none_or(str::is_empty) {
        score += 30.0;
    }
    let ua = fp.ua.to_lowercase();
    let suspicious = if fp.ua.encode_utf16().count() < 10 {
        true
    } else if GOOD_BOTS.iter().any(|b| ua.contains(b)) {
        false
    } else {
        SUSPICIOUS_UA.iter().any(|s| ua.contains(s))
    };
    if suspicious {
        score += 20.0;
    }
    if !fp.authenticated && fp.path != "/" && !fp.path.starts_with("/build/") {
        score += 15.0;
    }
    if let Some(cc) = country.filter(|c| !c.is_empty())
        && !TARGET_COUNTRIES.contains(&cc)
    {
        score += 10.0;
    }
    if ["/api/catalog/", "/api/products/", "/api/search/"]
        .iter()
        .any(|p| fp.path.starts_with(p))
    {
        score += 10.0;
    }
    f64::min(score, 100.0)
}

/// Paliers du limiteur (`THROTTLER_TIERS`) : nom, ttl en ms, limite. Sans
/// `blockDuration`, la bibliothèque bloque pendant le ttl.
pub const TIERS: [(&str, u64, u32); 4] = [
    ("short", 1_000, 15),
    ("medium", 60_000, 100),
    ("payment_callback", 60_000, 100),
    ("long", 3_600_000, 2_000),
];

/// Contextes du garde global pour une requête de la route, dans l'ordre de Node
/// (trace CDP : huit incréments) : le catch-all Remix (`/{*path}`), qui compte
/// tout le trafic Node de l'adresse, puis le contrôleur.
const CONTEXTS: [&str; 2] = ["RemixController-handler", "VehiclesController-getModelsByBrand"];

/// `THROTTLER_INCREMENT_LUA` du stockage Node (`RedisThrottlerStorage`) ; égalité
/// vérifiée par throttler-redis-storage.service.test.ts.
const INCREMENT_LUA: &str = include_str!("throttle.lua");
const KEY_PREFIX: &str = "throttler:";
/// `COMMAND_TIMEOUT_MS` du stockage Node.
pub const THROTTLER_REDIS_TIMEOUT: Duration = Duration::from_millis(250);

/// Une entrée du garde : clé `sha256(Classe-Handler-palier-traqueur)` et palier.
struct Entry {
    key: String,
    name: &'static str,
    ttl: u64,
    limit: u32,
}

fn entries(tracker: &str) -> Vec<Entry> {
    CONTEXTS
        .iter()
        .flat_map(|ctx| {
            TIERS.iter().map(move |&(name, ttl, limit)| {
                let d = digest::digest(&digest::SHA256, format!("{ctx}-{name}-{tracker}").as_bytes());
                Entry {
                    key: hex(d.as_ref()),
                    name,
                    ttl,
                    limit,
                }
            })
        })
        .collect()
}

fn hex(bytes: &[u8]) -> String {
    let mut s = String::with_capacity(2 * bytes.len());
    for b in bytes {
        let _ = write!(s, "{b:02x}");
    }
    s
}

/// Retour de `increment` pour une entrée.
#[derive(Debug, Clone, Copy, PartialEq)]
struct Hit {
    total: i64,
    to_expire: i64,
    blocked: bool,
    to_block: i64,
}

/// Réponse du script : quatre entiers par entrée traitée ; seule la dernière
/// peut être bloquée, et toutes sont traitées sinon.
fn parse_hits(reply: Reply, n: usize) -> Result<Vec<Hit>, String> {
    let items = match reply {
        Reply::Array(items) => items,
        Reply::Error(e) => return Err(format!("Redis : {e}")),
        other => return Err(format!("réponse inattendue du limiteur : {other:?}")),
    };
    let hits: Option<Vec<Hit>> = items
        .iter()
        .map(|item| match item {
            Reply::Array(f) => match f.as_slice() {
                [
                    Reply::Int(t),
                    Reply::Int(e),
                    Reply::Int(b @ (0 | 1)),
                    Reply::Int(tb),
                ] => Some(Hit {
                    total: *t,
                    to_expire: *e,
                    blocked: *b == 1,
                    to_block: *tb,
                }),
                _ => None,
            },
            _ => None,
        })
        .collect();
    let complete = |h: &[Hit]| match h.split_last() {
        Some((last, rest)) => {
            h.len() <= n && !rest.iter().any(|h| h.blocked) && (last.blocked || h.len() == n)
        }
        None => false,
    };
    match hits {
        Some(h) if complete(&h) => Ok(h),
        _ => Err(format!("réponse inattendue du limiteur : {items:?}")),
    }
}

/// Enregistrement de `ThrottlerStorageService` 6.7.1 : échéances des coups vivants.
struct LocalRecord {
    expires: u64,
    block_expires: u64,
    blocked: bool,
    hits: VecDeque<u64>,
}

/// Taille de table minimale avant élagage.
const PRUNE_MIN: usize = 50_000;

/// Stockage en mémoire du processus : repli quand Redis échoue, comme Node.
#[derive(Default)]
struct Local {
    records: HashMap<String, LocalRecord>,
    /// Taille de table au-delà de laquelle le prochain élagage a lieu.
    prune_at: usize,
}

impl Local {
    /// `ThrottlerStorageService.increment` 6.7.1, branche avec blocage : celle de
    /// tous les paliers (blockDuration = ttl).
    fn increment(&mut self, key: &str, now: u64, ttl: u64, limit: u32) -> Hit {
        let rec = self.records.entry(key.to_owned()).or_insert_with(|| LocalRecord {
            expires: now + ttl,
            block_expires: 0,
            blocked: false,
            hits: VecDeque::new(),
        });
        while rec.hits.front().is_some_and(|&at| at <= now) {
            rec.hits.pop_front();
        }
        let secs = |at: u64| (at as i64 - now as i64 + 999).div_euclid(1000);
        let mut to_expire = secs(rec.expires);
        if to_expire <= 0 {
            rec.expires = now + ttl;
            to_expire = secs(rec.expires);
        }
        if !rec.blocked {
            rec.hits.push_back(now + ttl);
        }
        if rec.hits.len() > limit as usize && !rec.blocked {
            rec.blocked = true;
            rec.block_expires = now + ttl;
        }
        let to_block = secs(rec.block_expires);
        if to_block <= 0 && rec.blocked {
            // `resetBlockedRequest`, puis le coup de la requête.
            rec.blocked = false;
            rec.hits.clear();
            rec.hits.push_back(now + ttl);
        }
        Hit {
            total: rec.hits.len() as i64,
            to_expire,
            blocked: rec.blocked,
            to_block,
        }
    }

    /// Entrées dans l'ordre du garde, arrêt à la première bloquée.
    fn increment_all(&mut self, entries: &[Entry], now: u64) -> Vec<Hit> {
        let mut out = Vec::with_capacity(entries.len());
        for e in entries {
            let hit = self.increment(&e.key, now, e.ttl, e.limit);
            out.push(hit);
            if hit.blocked {
                break;
            }
        }
        if self.records.len() > self.prune_at.max(PRUNE_MIN) {
            // Purge de 6.7.1 : ni blocage, ni échéance, ni coup vivants. Un
            // enregistrement élagué se comporte comme un neuf.
            self.records.retain(|_, r| {
                (r.blocked && r.block_expires > now)
                    || r.expires > now
                    || r.hits.back().is_some_and(|&at| at > now)
            });
            // Seuil doublé : quand les traqueurs sont tous vivants (coups en
            // attente jusqu'à 1 h), rien n'est élagable et le parcours de la
            // table, verrou tenu, reste amorti au lieu d'avoir lieu à chaque
            // requête.
            self.prune_at = self.records.len() * 2;
        }
        out
    }
}

/// `CloudflareThrottlerGuard` avec le stockage `RedisThrottlerStorage` de Node :
/// mêmes clés et même script, donc un seul budget par adresse et par limite,
/// quel que soit le processus qui sert la requête.
pub struct Throttler {
    redis: Redis,
    sha: String,
    local: Mutex<Local>,
    /// Décisions prises en mémoire depuis l'entrée en repli ; `None` hors repli.
    degraded: Mutex<Option<usize>>,
}

pub enum Throttle {
    Headers(Vec<(String, String)>),
    Blocked { headers: Vec<(String, String)> },
}

impl Throttler {
    /// `redis` : connexion dédiée en `Mode::Bounded(THROTTLER_REDIS_TIMEOUT)`, comme celle
    /// du stockage Node (sans file hors ligne).
    pub fn new(redis: Redis) -> Self {
        let sha = digest::digest(&digest::SHA1_FOR_LEGACY_USE_ONLY, INCREMENT_LUA.as_bytes());
        Self {
            redis,
            sha: hex(sha.as_ref()),
            local: Mutex::default(),
            degraded: Mutex::new(None),
        }
    }

    /// `handleRequest` pour chaque entrée, compteurs en Redis ; en panne, stockage
    /// du processus, ni ouvert ni fermé, journalisé à l'entrée et au retour.
    pub async fn hit(&self, tracker: &str, req: &ReqCtx) -> Throttle {
        let now = log::now_ms();
        let entries = entries(tracker);
        let hits = match self.shared(&entries, now).await {
            Ok(hits) => {
                self.recover(req);
                hits
            }
            Err(cause) => {
                let hits = self.local.lock().expect("limiteur").increment_all(&entries, now);
                self.degrade(&cause, hits.len(), req);
                hits
            }
        };
        let mut headers = Vec::new();
        for (e, h) in entries.iter().zip(&hits) {
            if h.blocked {
                headers.push((format!("Retry-After-{}", e.name), h.to_block.to_string()));
                return Throttle::Blocked { headers };
            }
            headers.push((format!("X-RateLimit-Limit-{}", e.name), e.limit.to_string()));
            headers.push((
                format!("X-RateLimit-Remaining-{}", e.name),
                (i64::from(e.limit) - h.total).max(0).to_string(),
            ));
            headers.push((format!("X-RateLimit-Reset-{}", e.name), h.to_expire.to_string()));
        }
        Throttle::Headers(headers)
    }

    /// Une commande pour toutes les entrées : EVALSHA, puis EVAL si Redis ne
    /// connaît pas le script (comme `defineCommand` d'ioredis).
    async fn shared(&self, entries: &[Entry], now: u64) -> Result<Vec<Hit>, String> {
        let numkeys = (2 * entries.len()).to_string();
        let mut words = Vec::with_capacity(1 + 5 * entries.len());
        for e in entries {
            words.push(format!("{KEY_PREFIX}{}", e.key));
            words.push(format!("{KEY_PREFIX}{}:{}", e.key, e.name));
        }
        words.push(now.to_string());
        for e in entries {
            words.extend([e.ttl.to_string(), e.limit.to_string(), e.ttl.to_string()]);
        }
        let mut args: Vec<&[u8]> = vec![b"EVALSHA", self.sha.as_bytes(), numkeys.as_bytes()];
        args.extend(words.iter().map(String::as_bytes));
        let mut reply = self.redis.cmd(&args).await?;
        if matches!(&reply, Reply::Error(e) if e.starts_with("NOSCRIPT")) {
            args[0] = b"EVAL";
            args[1] = INCREMENT_LUA.as_bytes();
            reply = self.redis.cmd(&args).await?;
        }
        parse_hits(reply, entries.len())
    }

    fn degrade(&self, cause: &str, decisions: usize, req: &ReqCtx) {
        let mut d = self.degraded.lock().expect("repli du limiteur");
        if d.is_none() {
            log::line(
                log::ERROR,
                Some(req),
                "RedisThrottlerStorage",
                &format!(
                    "Redis indisponible ({cause}) : limiteur en mémoire du processus, budget non partagé"
                ),
            );
        }
        *d = Some(d.unwrap_or(0) + decisions);
    }

    fn recover(&self, req: &ReqCtx) {
        if let Some(n) = self.degraded.lock().expect("repli du limiteur").take() {
            log::line(
                log::WARN,
                Some(req),
                "RedisThrottlerStorage",
                &format!(
                    "Redis revenu : budget partagé rétabli après {n} décision(s) en mémoire du processus"
                ),
            );
        }
    }
}

#[cfg(test)]
mod tests {
    use super::super::redis::Mode;
    use super::*;

    #[test]
    fn internal_ips_and_egress() {
        assert!(
            is_internal_ip("172.16.0.1")
                && is_internal_ip("::ffff:10.1.2.3")
                && !is_internal_ip("172.32.0.1")
        );
        let probe = Probe {
            enabled: false,
            key: None,
            egress: parse_egress("192.0.2.0/28, 2001:db8::1, bad"),
        };
        assert!(probe.is_exempt_egress("192.0.2.15") && !probe.is_exempt_egress("192.0.2.16"));
        assert!(probe.is_exempt_egress("2001:db8::1"));
    }

    const T0: u64 = 1_800_000_000_000;

    fn ctx() -> ReqCtx {
        ReqCtx {
            method: "GET".into(),
            url: "/api/vehicles/brands/1/models?year=2010".into(),
            id: "test".into(),
            query: None,
        }
    }

    /// `generateKey` de @nestjs/throttler : sha256 hexadécimal de
    /// `Classe-Handler-palier-traqueur` (valeurs de `sha256sum`).
    #[test]
    fn throttler_keys_follow_nest_generate_key() {
        let e = entries("2001:db8::1");
        let names: Vec<_> = e.iter().map(|e| e.name).collect();
        assert_eq!(names, ["short", "medium", "payment_callback", "long"].repeat(2));
        assert_eq!(
            e[3].key,
            "a550d10efd82bf7cd08a9c8673658ba023dfa68abe979f4302ff8f4562eccb96"
        );
        assert_eq!(
            e[4].key,
            "8627a9d0336998cb46bfc97410a7e6e156547c8f86aa96f6152c1dffe696f965"
        );
        let t = Throttler::new(
            Redis::new("redis://127.0.0.1:1", Mode::Bounded(THROTTLER_REDIS_TIMEOUT)).unwrap(),
        );
        assert_eq!(t.sha, "71fd7c0fdbd237dc0f33e4425905bfa785366aef");
    }

    /// Seizième requête de la seconde : blocage sur le premier palier du premier
    /// contexte, sans incrément des suivants ; levée du blocage à l'échéance.
    #[test]
    fn local_blocks_on_sixteenth_hit_and_stops() {
        let e = entries("a");
        let mut l = Local::default();
        for _ in 0..15 {
            let hits = l.increment_all(&e, T0);
            assert!(hits.len() == 8 && hits.iter().all(|h| !h.blocked));
        }
        let hits = l.increment_all(&e, T0);
        assert_eq!(
            hits,
            [Hit {
                total: 16,
                to_expire: 1,
                blocked: true,
                to_block: 1
            }]
        );
        assert_eq!(l.records[&e[4].key].hits.len(), 15);
        assert_eq!(l.records[&e[1].key].hits.len(), 15);
        assert!(l.increment_all(&e, T0 + 999)[0].blocked);
        let hits = l.increment_all(&e, T0 + 1_000);
        assert_eq!(hits.len(), 8);
        assert_eq!(
            hits[0],
            Hit {
                total: 1,
                to_expire: 1,
                blocked: false,
                to_block: 0
            }
        );
        assert_eq!((hits[1].total, hits[4].total), (16, 1));
    }

    #[test]
    fn local_prune_is_amortised_when_all_trackers_live() {
        let mut l = Local::default();
        let trackers = PRUNE_MIN / 8 + 1;
        for i in 0..trackers {
            l.increment_all(&entries(&format!("t{i}")), T0);
        }
        let len = l.records.len();
        assert_eq!(len, trackers * 8);
        assert_eq!(l.prune_at, len * 2);
        l.increment_all(&entries("encore"), T0);
        assert_eq!(l.prune_at, len * 2);
        // Une heure plus tard, plus rien n'est vivant.
        l.prune_at = 0;
        l.increment_all(&entries("tard"), T0 + 3_600_000);
        assert_eq!(l.records.len(), 8);
    }

    #[test]
    fn parse_hits_rejects_incomplete_replies() {
        let hit = |b: i64| Reply::Array(vec![Reply::Int(1), Reply::Int(1), Reply::Int(b), Reply::Int(0)]);
        let ok = |r: Vec<Reply>, n| parse_hits(Reply::Array(r), n);
        assert_eq!(ok(vec![hit(0); 8], 8).unwrap().len(), 8);
        assert_eq!(ok(vec![hit(0), hit(1)], 8).unwrap().len(), 2);
        for bad in [
            vec![],
            vec![hit(0); 7],
            vec![hit(0); 9],
            vec![hit(1), hit(0)],
            vec![hit(2)],
            vec![Reply::Int(1)],
        ] {
            assert!(ok(bad.clone(), 8).is_err(), "{bad:?}");
        }
        assert_eq!(
            parse_hits(Reply::Error("ERR x".into()), 8),
            Err("Redis : ERR x".into())
        );
        assert!(parse_hits(Reply::Nil, 8).is_err());
    }

    async fn free_addr() -> std::net::SocketAddr {
        let probe = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        probe.local_addr().unwrap()
    }

    /// Redis absent : repli en mémoire du processus, mêmes en-têtes et même 429
    /// que Node, décisions comptées pour le journal du retour.
    #[tokio::test]
    async fn throttler_falls_back_to_process_memory_when_redis_is_down() {
        let url = format!("redis://{}", free_addr().await);
        let t = Throttler::new(Redis::new(&url, Mode::Bounded(THROTTLER_REDIS_TIMEOUT)).unwrap());
        let Throttle::Headers(first) = t.hit("a", &ctx()).await else {
            panic!("attendu 200")
        };
        assert_eq!(first.len(), 24);
        assert_eq!(
            first[..3],
            [
                ("X-RateLimit-Limit-short".to_owned(), "15".to_owned()),
                ("X-RateLimit-Remaining-short".to_owned(), "14".to_owned()),
                ("X-RateLimit-Reset-short".to_owned(), "1".to_owned()),
            ]
        );
        for _ in 1..15 {
            assert!(matches!(t.hit("a", &ctx()).await, Throttle::Headers(_)));
        }
        let Throttle::Blocked { headers } = t.hit("a", &ctx()).await else {
            panic!("attendu 429")
        };
        assert_eq!(headers, [("Retry-After-short".to_owned(), "1".to_owned())]);
        assert_eq!(*t.degraded.lock().unwrap(), Some(15 * 8 + 1));
    }

    /// Lit une commande RESP (tableau de chaînes) côté serveur.
    async fn read_command(r: &mut tokio::io::BufReader<tokio::net::TcpStream>) -> Vec<Vec<u8>> {
        use tokio::io::{AsyncBufReadExt, AsyncReadExt};
        let mut line = String::new();
        r.read_line(&mut line).await.unwrap();
        let n: usize = line.trim_end().strip_prefix('*').unwrap().parse().unwrap();
        let mut words = Vec::with_capacity(n);
        for _ in 0..n {
            line.clear();
            r.read_line(&mut line).await.unwrap();
            let len: usize = line.trim_end().strip_prefix('$').unwrap().parse().unwrap();
            let mut w = vec![0; len + 2];
            r.read_exact(&mut w).await.unwrap();
            w.truncate(len);
            words.push(w);
        }
        words
    }

    /// Script inconnu de Redis (redémarrage, SCRIPT FLUSH) : EVAL avec le texte,
    /// comme `defineCommand` d'ioredis ; puis lecture de la réponse imbriquée.
    #[tokio::test]
    async fn throttler_sends_evalsha_then_eval_on_noscript() {
        use tokio::io::AsyncWriteExt;
        let server = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let url = format!("redis://{}", server.local_addr().unwrap());
        let t = Throttler::new(Redis::new(&url, Mode::Bounded(Duration::from_secs(2))).unwrap());
        let fake = tokio::spawn(async move {
            let (sock, _) = server.accept().await.unwrap();
            let mut r = tokio::io::BufReader::new(sock);
            let first = read_command(&mut r).await;
            r.get_mut()
                .write_all(b"-NOSCRIPT No matching script. Please use EVAL.\r\n")
                .await
                .unwrap();
            let second = read_command(&mut r).await;
            let mut reply = b"*8\r\n".to_vec();
            for i in 0..8 {
                reply.extend_from_slice(format!("*4\r\n:{}\r\n:60\r\n:0\r\n:0\r\n", i + 1).as_bytes());
            }
            r.get_mut().write_all(&reply).await.unwrap();
            (first, second)
        });
        let Throttle::Headers(h) = t.hit("2001:db8::1", &ctx()).await else {
            panic!("attendu 200")
        };
        let (first, second) = fake.await.unwrap();
        assert_eq!(first.len(), 3 + 16 + 1 + 24);
        assert_eq!(
            (&first[0][..], &first[1][..], &first[2][..]),
            (&b"EVALSHA"[..], t.sha.as_bytes(), &b"16"[..])
        );
        let e = entries("2001:db8::1");
        assert_eq!(first[3], format!("throttler:{}", e[0].key).into_bytes());
        assert_eq!(first[4], format!("throttler:{}:short", e[0].key).into_bytes());
        let now: u64 = String::from_utf8_lossy(&first[19]).parse().unwrap();
        assert!(log::now_ms().abs_diff(now) < 60_000);
        let argv = |r: std::ops::Range<usize>| {
            first[r]
                .iter()
                .map(|w| String::from_utf8_lossy(w).into_owned())
                .collect::<Vec<_>>()
        };
        assert_eq!(argv(20..23), ["1000", "15", "1000"]);
        assert_eq!(argv(41..44), ["3600000", "2000", "3600000"]);
        assert_eq!(
            (&second[0][..], &second[1][..]),
            (&b"EVAL"[..], INCREMENT_LUA.as_bytes())
        );
        assert_eq!(second[2..], first[2..]);
        // Paliers du second contexte : leurs valeurs remplacent celles du premier.
        assert_eq!(h[1], ("X-RateLimit-Remaining-short".to_owned(), "14".to_owned()));
        assert_eq!(h[13], ("X-RateLimit-Remaining-short".to_owned(), "10".to_owned()));
        assert!(t.degraded.lock().unwrap().is_none());
    }

    fn real_redis() -> Redis {
        let url = std::env::var("THROTTLER_TEST_REDIS_URL").expect("THROTTLER_TEST_REDIS_URL");
        Redis::new(&url, Mode::Bounded(Duration::from_secs(2))).unwrap()
    }

    fn unique(tag: &str) -> String {
        format!("{tag}-{}-{}", std::process::id(), log::now_ms())
    }

    /// Script Redis et repli en mémoire : mêmes décisions sur une séquence qui
    /// traverse blocages, levées et échéances (horloge de l'appelant).
    #[tokio::test]
    #[ignore = "exige THROTTLER_TEST_REDIS_URL (Redis jetable)"]
    async fn shared_and_local_agree_on_real_redis() {
        let t = Throttler::new(real_redis());
        let e = entries(&unique("parite"));
        let mut l = Local::default();
        let mut now = log::now_ms();
        let mut seed = 0x2545_f491_4f6c_dd1d_u64;
        let mut blocked = 0;
        for step in 0..600 {
            seed ^= seed << 13;
            seed ^= seed >> 7;
            seed ^= seed << 17;
            now += [0, 1, 7, 40, 120, 999, 1000, 1001, 4000][(seed % 9) as usize];
            let shared = t.shared(&e, now).await.unwrap();
            assert_eq!(shared, l.increment_all(&e, now), "pas {step}");
            blocked += usize::from(shared.last().is_some_and(|h| h.blocked));
        }
        assert!(blocked > 0);
    }

    /// Deux processus, quarante requêtes simultanées de la même adresse : quinze
    /// servies en tout sur le palier d'une seconde, sans repli.
    #[tokio::test(flavor = "multi_thread", worker_threads = 4)]
    #[ignore = "exige THROTTLER_TEST_REDIS_URL (Redis jetable)"]
    async fn concurrent_hits_from_two_processes_share_one_budget() {
        let procs = [
            std::sync::Arc::new(Throttler::new(real_redis())),
            std::sync::Arc::new(Throttler::new(real_redis())),
        ];
        let tracker = unique("rafale");
        let tasks: Vec<_> = (0..40)
            .map(|i| {
                let t = procs[i % 2].clone();
                let tracker = tracker.clone();
                tokio::spawn(async move { matches!(t.hit(&tracker, &ctx()).await, Throttle::Headers(_)) })
            })
            .collect();
        let mut served = 0;
        for task in tasks {
            served += usize::from(task.await.unwrap());
        }
        assert_eq!(served, 15);
        assert!(procs.iter().all(|t| t.degraded.lock().unwrap().is_none()));
    }
}
