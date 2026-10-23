//! Chaîne Express/Nest de la route, dans l'ordre de `main.ts` : session,
//! compression, corps JSON, helmet, CORS, middlewares Nest (décodage, pino-http,
//! X-Request-ID, BotGuard), limiteur, en-têtes SEO, pipes, contrôleur, service.

use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use base64::Engine;
use ring::rand::{SecureRandom, SystemRandom};
use ring::{digest, hmac};

use super::compress;
use super::guard::{
    BotGuard, Fingerprint, Probe, THROTTLER_REDIS_TIMEOUT, Throttle, Throttler, Verdict, is_internal_ip,
    parse_egress,
};
use super::headers::Headers;
use super::json::{self, Json};
use super::log::{self, Completion, ReqCtx};
use super::query;
use super::redis::{Mode, Redis};
use super::session::{self, SessionError, SessionStore, Users};
use super::uri;
use crate::config::Config;
use crate::js;
use crate::models::{Event, ModelsRequest, Outcome, models_by_brand_observed};
use crate::postgrest::Postgrest;

const MAX_BODY: usize = 10 * 1024 * 1024;
const ERROR_COLUMNS: [&str; 16] = [
    "err_created_at",
    "err_code",
    "err_subject",
    "err_severity",
    "err_url",
    "err_method",
    "err_status",
    "err_user_agent",
    "err_ip",
    "err_user_id",
    "err_session_id",
    "err_correlation",
    "err_message",
    "err_stack",
    "err_context",
    "err_env",
];

pub struct State {
    pub base: Config,
    pub pg: Postgrest,
    pub redis: Redis,
    sessions: Redis,
    users: Users,
    session_key: hmac::Key,
    guard: BotGuard,
    probe: Probe,
    throttler: Throttler,
    errors: Mutex<ErrorBuffer>,
    cors_origins: Vec<String>,
    csp: (String, String),
    rng: SystemRandom,
}

#[derive(Default)]
struct ErrorBuffer {
    rows: Vec<String>,
    seen: HashMap<String, Instant>,
    failures: u32,
    open_until: Option<Instant>,
}

impl State {
    /// Refuse un démarrage dont la configuration diffère de celle mesurée sur A2.
    pub fn from_env(env: &dyn Fn(&str) -> Option<String>) -> Result<&'static State, String> {
        if env("NODE_ENV").as_deref() != Some("production") {
            return Err(
                "NODE_ENV=production exigé : la route R2 reproduit la chaîne de production (CSP sans HMR)"
                    .into(),
            );
        }
        let base = Config::from_lookup(env)?;
        let secret = env("SESSION_SECRET").ok_or("SESSION_SECRET manquant")?;
        if secret.trim().len() < 32 {
            return Err("SESSION_SECRET : 32 caractères au moins".into());
        }
        let redis_url = env("REDIS_URL").ok_or("REDIS_URL manquant")?;
        let redis_timeout = env("ROUTE_REDIS_TIMEOUT_MS")
            .and_then(|v| v.parse().ok())
            .unwrap_or(2000);
        let probe_enabled = env("SEO_CP_SYNTHETIC_PROBE_ENABLED").as_deref() == Some("true");
        let probe_secret = env("SEO_CP_SYNTHETIC_PROBE_SECRET").filter(|s| !s.is_empty());
        let img = base
            .supabase_url
            .chars()
            .filter(|c| !c.is_control() && !c.is_whitespace())
            .collect::<String>();
        let csp = (
            "default-src 'self';style-src 'self' 'unsafe-inline';script-src 'self' https://www.googletagmanager.com https://www.google-analytics.com https://tagmanager.google.com 'nonce-".to_owned(),
            format!("';img-src 'self' data: blob: {img} https://www.automecanik.com https://www.google-analytics.com https://www.googletagmanager.com;connect-src 'self' ws: wss: https://www.google-analytics.com https://analytics.google.com https://region1.google-analytics.com https://*.ingest.de.sentry.io;font-src 'self' data:;object-src 'none';media-src 'self';frame-src 'self';form-action 'self' https://paiement.systempay.fr https://paiement-secure.test.lyra-collect.com https://tpeweb.paybox.com https://preprod-tpeweb.paybox.com;base-uri 'self';frame-ancestors 'self';script-src-attr 'none';upgrade-insecure-requests"),
        );
        let state = State {
            pg: Postgrest::new(&base)?,
            redis: Redis::new(&redis_url, Mode::Bounded(Duration::from_millis(redis_timeout)))?,
            // Client de connect-redis (session-store.service.ts) : connectTimeout de
            // CONNECT_TIMEOUT_MS et journal de son écouteur 'error'.
            sessions: Redis::new(
                &redis_url,
                Mode::OfflineQueue {
                    connect_timeout: Duration::from_millis(5000),
                    context: "SessionStoreService",
                    msg: "Erreur Redis (session)",
                    ready: "Redis (session) ready — vehicle-models-route",
                },
            )?,
            users: Users::default(),
            session_key: hmac::Key::new(hmac::HMAC_SHA256, secret.as_bytes()),
            guard: BotGuard::new(env),
            probe: Probe {
                enabled: probe_enabled,
                key: probe_secret.map(|s| hmac::Key::new(hmac::HMAC_SHA256, s.as_bytes())),
                egress: parse_egress(&env("SEO_CP_SYNTHETIC_PROBE_EGRESS_IPS").unwrap_or_default()),
            },
            // Connexion dédiée, comme RedisThrottlerStorage : un appel du limiteur
            // n'attend pas derrière une lecture de cache, et inversement.
            throttler: Throttler::new(Redis::new(&redis_url, Mode::Bounded(THROTTLER_REDIS_TIMEOUT))?),
            errors: Mutex::new(ErrorBuffer::default()),
            cors_origins: env("CORS_ORIGIN")
                .unwrap_or_else(|| "https://www.automecanik.com".into())
                .split(',')
                .map(|s| s.trim().to_owned())
                .collect(),
            csp,
            rng: SystemRandom::new(),
            base,
        };
        Ok(Box::leak(Box::new(state)))
    }

    fn random(&self, n: usize) -> Vec<u8> {
        let mut b = vec![0; n];
        self.rng.fill(&mut b).expect("aléa système");
        b
    }

    fn uuid(&self) -> String {
        let mut b = self.random(16);
        b[6] = (b[6] & 0x0f) | 0x40;
        b[8] = (b[8] & 0x3f) | 0x80;
        let h: String = b.iter().map(|x| format!("{x:02x}")).collect();
        format!(
            "{}-{}-{}-{}-{}",
            &h[..8],
            &h[8..12],
            &h[12..16],
            &h[16..20],
            &h[20..]
        )
    }

    /// Tâche `ErrorLogService` : vidage toutes les 5 s par lots de 500 ; après 3
    /// échecs, le tampon est abandonné pendant 60 s (lignes perdues, comme Node).
    pub async fn flush_errors_forever(&'static self) {
        loop {
            tokio::time::sleep(Duration::from_secs(5)).await;
            let rows = {
                let mut b = self.errors.lock().expect("journal d'erreurs");
                if b.rows.is_empty() {
                    continue;
                }
                if b.open_until.is_some_and(|t| Instant::now() < t) {
                    b.rows.clear();
                    continue;
                }
                let n = b.rows.len().min(500);
                b.rows.drain(..n).collect::<Vec<_>>()
            };
            let body = format!("[{}]", rows.join(","));
            let result = self.pg.insert("__error_logs", &ERROR_COLUMNS, body).await;
            let mut b = self.errors.lock().expect("journal d'erreurs");
            match result {
                Ok(_) => {
                    b.failures = 0;
                    b.seen.retain(|_, t| t.elapsed() < Duration::from_secs(120));
                }
                Err(e) => {
                    b.failures += 1;
                    log::line(
                        log::WARN,
                        None,
                        "ErrorLogService",
                        &format!("ErrorLog flush failed ({}/3): {e}", b.failures),
                    );
                    if b.failures >= 3 {
                        b.open_until = Some(Instant::now() + Duration::from_secs(60));
                        b.failures = 0;
                        log::line(
                            log::ERROR,
                            None,
                            "ErrorLogService",
                            "ErrorLog circuit breaker tripped — dropping error logs for 60s",
                        );
                    }
                }
            }
        }
    }
}

pub struct Request {
    pub method: String,
    pub target: String,
    /// En-têtes bruts dans l'ordre reçu.
    pub headers: Vec<(String, String)>,
    pub peer: String,
    pub body: Vec<u8>,
    pub body_too_large: bool,
    /// Partagée avec la connexion, qui signale la fermeture par le client.
    pub completion: Arc<Completion>,
}

/// `IncomingMessage.headers` : doublons écartés, joints par `, ` ou `; ` (cookie).
fn header<'a>(req: &'a Request, lower: &str) -> Option<std::borrow::Cow<'a, str>> {
    const FIRST_WINS: [&str; 17] = [
        "age",
        "authorization",
        "content-length",
        "content-type",
        "etag",
        "expires",
        "from",
        "host",
        "if-modified-since",
        "if-unmodified-since",
        "last-modified",
        "location",
        "max-forwards",
        "proxy-authorization",
        "referer",
        "retry-after",
        "user-agent",
    ];
    let mut values = req
        .headers
        .iter()
        .filter(|(n, _)| n.eq_ignore_ascii_case(lower))
        .map(|(_, v)| v.as_str());
    let first = values.next()?;
    if FIRST_WINS.contains(&lower) {
        return Some(first.into());
    }
    let sep = if lower == "cookie" { "; " } else { ", " };
    let rest: Vec<&str> = values.collect();
    if rest.is_empty() {
        Some(first.into())
    } else {
        Some(format!("{first}{sep}{}", rest.join(sep)).into())
    }
}

pub struct Response {
    pub status: u16,
    pub headers: Headers,
    pub body: Vec<u8>,
    pub chunked: bool,
}

struct Ctx<'a> {
    st: &'static State,
    req: &'a Request,
    res: Headers,
    path: String,
    client_ip: String,
    log: Option<ReqCtx>,
    compress: bool,
    set_cookie: Option<String>,
}

impl Ctx<'_> {
    fn h(&self, lower: &str) -> Option<String> {
        header(self.req, lower).map(|c| c.into_owned())
    }

    /// `res.json` puis `res.send` d'Express : ETag faible, fraîcheur, HEAD,
    /// compression puis cookie de session au `writeHead`.
    fn send_json(mut self, status: u16, body: String) -> Response {
        if !self.res.has("content-type") {
            self.res.set("Content-Type", "application/json; charset=utf-8");
        }
        let bytes = body.into_bytes();
        self.res.set("Content-Length", bytes.len().to_string());
        let hash = base64::engine::general_purpose::STANDARD
            .encode(digest::digest(&digest::SHA1_FOR_LEGACY_USE_ONLY, &bytes));
        let etag = format!("W/\"{:x}-{}\"", bytes.len(), &hash[..27]);
        self.res.set("ETag", etag.clone());
        let mut status = status;
        let mut body = bytes;
        if (200..300).contains(&status) && fresh(self.req, &etag) {
            status = 304;
        }
        if status == 304 || status == 204 {
            for h in ["content-type", "content-length", "transfer-encoding"] {
                self.res.remove(h);
            }
            body.clear();
        }
        let mut chunked = false;
        if self.compress && self.res.has("content-type") {
            self.res.vary("Accept-Encoding");
            let head = self.req.method == "HEAD";
            if body.len() >= compress::THRESHOLD
                && !head
                && let Some(method) = compress::negotiate(self.h("accept-encoding").as_deref())
            {
                self.res.set("Content-Encoding", method);
                self.res.remove("content-length");
                body = compress::encode(method, &body);
                chunked = true;
            }
        }
        if let Some(c) = self.set_cookie.take() {
            self.res.set("Set-Cookie", c);
        }
        self.req.completion.finish(status);
        if self.req.method == "HEAD" {
            body.clear();
        }
        Response {
            status,
            headers: self.res,
            body,
            chunked,
        }
    }

    /// `GlobalErrorFilter` : corps, ligne de journal et ligne `__error_logs`.
    fn fail(
        self,
        status: u16,
        message: &str,
        error: &str,
        severity: Option<&str>,
        stack_head: Option<&str>,
    ) -> Response {
        let url = self.req.target.clone();
        let mut body = json::Obj::new();
        body.insert("statusCode".into(), Json::Num(f64::from(status)));
        body.insert("timestamp".into(), Json::Str(session::iso_now()));
        body.insert("path".into(), Json::Str(url.clone()));
        body.insert("method".into(), Json::Str(self.req.method.clone()));
        body.insert("message".into(), Json::Str(message.into()));
        body.insert("error".into(), Json::Str(error.into()));
        // `logger.error(msg, exception.stack)` : pino range `msg` dans `err.message`.
        let msg = format!("{} {url} - {status} - {message}", self.req.method);
        let err = stack_head.map(|s| log::err_json("Error", &msg, s));
        log::line_err(
            log::ERROR,
            self.log.as_ref(),
            "GlobalErrorFilter",
            err.as_deref(),
            &msg,
        );
        if let Some(sev) = severity {
            self.record_error(status, message, error, sev, stack_head.unwrap_or(error));
        }
        self.send_json(status, json::stringify(&Json::Obj(body)))
    }

    fn record_error(&self, status: u16, message: &str, code: &str, severity: &str, stack_head: &str) {
        let st = self.st;
        let now = log::now_ms();
        // Signature `ErrorLogService.build` : sujet, URL et IP du client.
        let dedup = format!("ERROR_{code}|{}|{}", self.req.target, self.client_ip);
        let mut b = st.errors.lock().expect("journal d'erreurs");
        if b.seen
            .get(&dedup)
            .is_some_and(|t| t.elapsed() < Duration::from_secs(60))
        {
            return;
        }
        b.seen.insert(dedup, Instant::now());
        let suffix: String = st
            .random(9)
            .iter()
            .map(|x| char::from_digit(u32::from(*x) % 36, 36).unwrap_or('0'))
            .collect();
        let s = |v: &str| Json::Str(v.into());
        let opt = |v: Option<String>| v.map_or(Json::Null, Json::Str);
        let mut ctx = json::Obj::new();
        ctx.insert("status".into(), Json::Num(f64::from(status)));
        ctx.insert("handled_by".into(), s("GlobalErrorFilter"));
        let mut row = json::Obj::new();
        for (k, v) in [
            ("err_created_at", s(&session::iso_now())),
            ("err_code", s(code)),
            ("err_subject", s(&format!("ERROR_{code}"))),
            ("err_severity", s(severity)),
            ("err_url", s(&self.req.target)),
            ("err_method", s(&self.req.method)),
            ("err_status", Json::Num(f64::from(status))),
            ("err_user_agent", opt(self.h("user-agent"))),
            ("err_ip", s(&self.client_ip)),
            ("err_user_id", Json::Null),
            ("err_session_id", Json::Null),
            ("err_correlation", s(&format!("err_{now}_{suffix}"))),
            ("err_message", s(message)),
            (
                "err_stack",
                s(&format!("{stack_head}\n    at vehicle-models-route")),
            ),
            ("err_context", Json::Obj(ctx.clone())),
            ("err_env", s("production")),
        ] {
            row.insert(k.into(), v);
        }
        if b.rows.len() >= 2000 {
            b.rows.remove(0);
        }
        b.rows.push(json::stringify(&Json::Obj(row)));
    }
}

/// `fresh` 0.5 pour un ETag seul (pas de Last-Modified).
fn fresh(req: &Request, etag: &str) -> bool {
    let inm = header(req, "if-none-match");
    let ims = header(req, "if-modified-since");
    if inm.is_none() && ims.is_none() {
        return false;
    }
    if header(req, "cache-control").is_some_and(|c| c.contains("no-cache")) {
        return false;
    }
    match inm.as_deref() {
        Some("*") => true,
        Some(list) => {
            let strip = |t: &str| t.trim().trim_start_matches("W/").to_owned();
            list.split(',').map(strip).any(|t| t == strip(etag))
        }
        None => false,
    }
}

/// `true` pour le motif routé vers R2 par Caddy (`GET|HEAD` avec année). Une
/// requête valide sans année prendrait chez Node le cache LRU partagé du
/// `VehiclesModule` ; elle reste à Node et R2 la refuse (421) avant tout effet.
pub fn is_route(method: &str, target: &str) -> bool {
    let (path, qs) = target.split_once('?').unwrap_or((target, ""));
    let Some(rest) = path.strip_prefix("/api/vehicles/brands/") else {
        return false;
    };
    let rest = rest.strip_suffix('/').unwrap_or(rest);
    matches!(method, "GET" | "HEAD")
        && rest
            .strip_suffix("/models")
            .is_some_and(|id| !id.is_empty() && !id.contains('/'))
        && !query::validate(&query::parse(qs)).is_ok_and(|q| q.year.is_none())
}

pub async fn handle(st: &'static State, req: Request) -> Response {
    let (path, qs) = req
        .target
        .split_once('?')
        .map_or((req.target.as_str(), ""), |(p, q)| (p, q));
    let tracker_ip = {
        let first = |n: &str| {
            header(&req, n)
                .and_then(|v| v.split(',').next().map(|s| s.trim().to_owned()))
                .filter(|s| !s.is_empty())
        };
        first("cf-connecting-ip")
            .or_else(|| first("x-real-ip"))
            .or_else(|| {
                header(&req, "x-forwarded-for")
                    .and_then(|v| v.rsplit(',').next().map(|s| s.trim().to_owned()))
            })
            .unwrap_or_else(|| req.peer.clone())
    };
    let mut cx = Ctx {
        st,
        req: &req,
        res: Headers::default(),
        path: path.to_owned(),
        client_ip: tracker_ip.clone(),
        log: None,
        compress: false,
        set_cookie: None,
    };
    let qs = qs.to_owned();

    // 1. express-session (avant compression : ses erreurs n'ont pas de Vary).
    let store = SessionStore {
        sessions: &st.sessions,
        redis: &st.redis,
        key: &st.session_key,
        pg: &st.pg,
        users: &st.users,
    };
    let mut sess = match store.load(cx.h("cookie").as_deref()).await {
        Ok(s) => s,
        Err(SessionError::Syntax(m)) => {
            return cx.fail(
                400,
                &m,
                "BadRequestException",
                Some("medium"),
                Some(&format!("BadRequestException: {m}")),
            );
        }
        Err(SessionError::Type(m)) => {
            return cx.fail(
                500,
                &m,
                "TypeError",
                Some("low"),
                Some(&format!("TypeError: {m}")),
            );
        }
        Err(SessionError::Store(m)) => {
            return cx.fail(500, &m, "Error", Some("low"), Some(&format!("Error: {m}")));
        }
    };
    let user = sess.user.take();
    let secure = cx
        .h("x-forwarded-proto")
        .is_some_and(|p| p.split(',').next().is_some_and(|f| f.trim() == "https"));
    if let Some(loaded) = sess.loaded.as_mut() {
        cx.set_cookie = store.set_cookie(loaded, secure);
        store.persist(loaded).await;
    }

    // 2. compression ; 3. corps JSON/urlencoded sur /api/ (limite 10 Mo).
    cx.compress = true;
    if req.body_too_large || req.body.len() > MAX_BODY {
        return cx.fail(
            500,
            "request entity too large",
            "PayloadTooLargeError",
            Some("low"),
            Some("PayloadTooLargeError: request entity too large"),
        );
    }
    let ct = cx.h("content-type").unwrap_or_default().to_ascii_lowercase();
    if !req.body.is_empty() && (ct.starts_with("application/json") || ct.contains("+json")) {
        let text = String::from_utf8_lossy(&req.body);
        if let Err(e) = json::parse(&text) {
            return cx.fail(
                400,
                &e.message,
                "BadRequestException",
                Some("medium"),
                Some(&format!("BadRequestException: {}", e.message)),
            );
        }
    }

    // 4. helmet (nonce CSP), CORS.
    let nonce = base64::engine::general_purpose::STANDARD.encode(st.random(16));
    let (a, b) = &st.csp;
    let fixed = [
        ("Cross-Origin-Opener-Policy", "same-origin"),
        ("Cross-Origin-Resource-Policy", "same-origin"),
        ("Origin-Agent-Cluster", "?1"),
        ("Referrer-Policy", "no-referrer"),
        ("Strict-Transport-Security", "max-age=31536000; includeSubDomains"),
        ("X-Content-Type-Options", "nosniff"),
        ("X-DNS-Prefetch-Control", "off"),
        ("X-Download-Options", "noopen"),
        ("X-Frame-Options", "SAMEORIGIN"),
        ("X-Permitted-Cross-Domain-Policies", "none"),
        ("X-XSS-Protection", "0"),
    ];
    cx.res.set("Content-Security-Policy", format!("{a}{nonce}{b}"));
    for (k, v) in fixed {
        cx.res.set(k, v);
    }
    if let Some(origin) = cx.h("origin").filter(|o| st.cors_origins.iter().any(|a| a == o)) {
        cx.res.set("Access-Control-Allow-Origin", origin);
    }
    cx.res.vary("Origin");
    cx.res.set("Access-Control-Allow-Credentials", "true");

    // 5. Middlewares Nest : décodage des segments, pino-http, X-Request-ID.
    for seg in cx.path.split('/').filter(|s| s.contains('%')) {
        if uri::decode_uri_component(seg).is_err() {
            let m = format!("Failed to decode param '{seg}'");
            return cx.fail(
                400,
                &m,
                "BadRequestException",
                Some("medium"),
                Some(&format!("BadRequestException: {m}")),
            );
        }
    }
    let rid = cx.h("x-request-id").filter(|v| !v.is_empty());
    // `genReqId` de pino-http : l'en-tête, sinon `req-${Date.now()}-${aléa base 36}`
    // (X-Correlation-ID n'y entre pas, contrairement à l'en-tête de réponse).
    let log_id = rid.clone().unwrap_or_else(|| {
        let suffix: String = st
            .random(6)
            .iter()
            .map(|x| char::from_digit(u32::from(*x) % 36, 36).unwrap_or('0'))
            .collect();
        format!("req-{}-{suffix}", log::now_ms())
    });
    let request_id = rid
        .or_else(|| cx.h("x-correlation-id").filter(|v| !v.is_empty()))
        .unwrap_or_else(|| st.uuid());
    let parsed = query::parse(&qs);
    let ctx = ReqCtx {
        method: req.method.clone(),
        url: req.target.clone(),
        id: log_id,
        query: (!parsed.is_empty()).then(|| json::stringify(&Json::Obj(parsed.clone()))),
    };
    req.completion.attach(&ctx);
    cx.log = Some(ctx);
    cx.res.set("X-Request-ID", request_id);

    // 6. BotGuard.
    let ua = cx.h("user-agent").unwrap_or_default();
    let fp_strings = (
        cx.h("cf-connecting-ip"),
        cx.h("x-forwarded-for"),
        cx.h("x-real-ip"),
        cx.h("cf-ipcountry"),
        cx.h("accept-language"),
        cx.h("x-synthetic-probe"),
    );
    let fp = Fingerprint {
        peer: &req.peer,
        cf_ip: fp_strings.0.as_deref(),
        xff: fp_strings.1.as_deref(),
        real_ip: fp_strings.2.as_deref(),
        country: fp_strings.3.as_deref(),
        ua: &ua,
        accept_language: fp_strings.4.as_deref(),
        path: &cx.path,
        method: &req.method,
        probe_header: fp_strings.5.as_deref(),
        authenticated: user.is_some(),
    };
    let (verified_bot, verified_probe) = match st
        .guard
        .check(&fp, &st.probe, &st.redis, cx.log.as_ref().expect("contexte"))
        .await
    {
        Verdict::Block(code) => {
            let mut o = json::Obj::new();
            o.insert("error".into(), Json::Str("Access denied".into()));
            o.insert("code".into(), Json::Str(code.into()));
            return cx.send_json(403, json::stringify(&Json::Obj(o)));
        }
        Verdict::Next {
            verified_bot,
            verified_probe,
        } => (verified_bot, verified_probe),
    };

    // 7. CloudflareThrottlerGuard.
    let forwarded = ["cf-connecting-ip", "x-real-ip", "x-forwarded-for"]
        .iter()
        .any(|h| header(&req, h).is_some());
    let privileged = user.as_ref().is_some_and(|u| u.is_admin || u.level >= 7.0);
    let probe_exempt = verified_probe && !cx.path.starts_with("/api/");
    let loopback =
        is_internal_ip(&req.peer) && matches!(req.peer.as_str(), "127.0.0.1" | "::1" | "::ffff:127.0.0.1");
    if !(verified_bot || probe_exempt || privileged || (loopback && !forwarded)) {
        match st
            .throttler
            .hit(&tracker_ip, cx.log.as_ref().expect("contexte"))
            .await
        {
            Throttle::Headers(hs) => hs.into_iter().for_each(|(k, v)| cx.res.set(&k, v)),
            Throttle::Blocked { headers } => {
                headers.into_iter().for_each(|(k, v)| cx.res.set(&k, v));
                let m = "ThrottlerException: Too Many Requests";
                return cx.fail(
                    429,
                    m,
                    "ThrottlerException",
                    Some("low"),
                    Some(&format!("ThrottlerException: {m}")),
                );
            }
        }
    }

    // 8. SeoHeadersInterceptor ; 9. pipes.
    cx.res.set("X-Robots-Tag", "noindex, nofollow");
    cx.res.set("Cache-Control", "no-cache, no-store, must-revalidate");
    cx.res.set("X-Content-Type-Options", "nosniff");
    let brand_seg = cx
        .path
        .trim_end_matches('/')
        .trim_end_matches("/models")
        .rsplit('/')
        .next()
        .unwrap_or("")
        .to_owned();
    let brand_param = uri::decode_uri_component(&brand_seg).unwrap_or_default();
    let validation = "BadRequestException: Validation failed";
    let Some(brand_id) = query::positive_int_param(&brand_param) else {
        return cx.fail(
            400,
            "Validation failed",
            "BadRequestException",
            Some("high"),
            Some(validation),
        );
    };
    let Ok(q) = query::validate(&parsed) else {
        return cx.fail(
            400,
            "Validation failed",
            "BadRequestException",
            Some("high"),
            Some(validation),
        );
    };

    // 10. Contrôleur et service, sans cache : `is_route` ne laisse passer qu'une
    // année, avec laquelle Node ne lit ni n'écrit son cache.
    cx.res
        .set("X-Cache-Source", "vehicleModelsService.getModelsByBrand");
    cx.res.set(
        "X-Filter-Year",
        q.year.map_or("none".to_owned(), |y| y.to_string()),
    );
    if let Some(y) = q.year {
        log::line(
            log::INFO,
            cx.log.as_ref(),
            "VehicleModelsService",
            &format!(
                "⚠️ Cache désactivé pour test filtrage année {}",
                js::number_to_string(f64::from(y))
            ),
        );
    }
    let request = ModelsRequest {
        brand_id,
        page: q.page,
        limit: q.limit,
        year: q.year,
        search: q.search.clone(),
        include_all: q.include_all,
    };
    let rq = cx.log.as_ref();
    let mut observe = |e: Event<'_>| model_event(rq, brand_id, e);
    let outcome = models_by_brand_observed(&st.pg, &request, st.base.max_type_rows, &mut observe).await;
    match outcome {
        Outcome::Ok(v) => {
            let body = json::stringify_value(&v);
            cx.send_json(200, body)
        }
        other => {
            // Le legacy passe l'erreur en second argument, que pino n'écrit pas ;
            // seuls les refus propres à ce service (Contract, Limit) gardent leur cause.
            let detail = match &other {
                Outcome::Contract(m) | Outcome::Limit(m) => format!(" {m}"),
                Outcome::Ok(_) | Outcome::Thrown(_) => String::new(),
            };
            log::line(
                log::ERROR,
                cx.log.as_ref(),
                "VehicleModelsService",
                &format!("Erreur getModelsByBrand {brand_id}:{detail}"),
            );
            cx.fail(
                500,
                "Erreur interne du serveur",
                "InternalServerError",
                None,
                None,
            )
        }
    }
}

/// Lignes de `VehicleModelsService` émises pendant le calcul, voir [`Event`].
fn model_event(req: Option<&ReqCtx>, brand_id: u32, e: Event<'_>) {
    const CONTEXT: &str = "VehicleModelsService";
    let (level, msg) = match e {
        Event::ModelsError => (log::ERROR, "Erreur récupération modèles:".to_owned()),
        Event::ModelsTotal(n) => (
            log::INFO,
            format!("🔍 DEBUG: {n} modèles totaux pour marque {brand_id}"),
        ),
        Event::TypesError => (log::ERROR, "Erreur récupération types:".to_owned()),
        Event::YearFiltered(year, ids) => {
            let ids: Vec<String> = ids.iter().map(|x| js::number_to_string(*x)).collect();
            (
                log::INFO,
                format!(
                    "🔍 DEBUG année {}: IDs filtrés = [{}...]",
                    js::number_to_string(year),
                    ids.join(", ")
                ),
            )
        }
        Event::MainError => (log::ERROR, "Erreur getModelsByBrand:".to_owned()),
    };
    log::line(level, req, CONTEXT, &msg);
}

#[cfg(test)]
mod tests {
    use super::is_route;

    #[test]
    fn route_requires_a_year_like_caddy() {
        let p = "/api/vehicles/brands/164/models";
        for target in [
            "?year=2008&page=0&limit=100",
            "/?year=2008",
            "?year=%32008",
            // Refus de validation (400 comme Node, qui ne touche pas son cache).
            "?year=1800",
            "?year=2008&year=1990",
            "?year=2008&x=1",
        ] {
            assert!(is_route("GET", &format!("{p}{target}")), "{target}");
        }
        assert!(is_route("HEAD", &format!("{p}?year=2008")));
        // Chemin sans année, servi par le cache de Node : 421.
        for target in ["", "?", "?page=0&limit=100", "?year=", "?year=%20", "?search=a"] {
            assert!(!is_route("GET", &format!("{p}{target}")), "{target}");
        }
        // Au-delà de 1000 paramètres, l'année est ignorée comme par qs.
        let tail = "&".repeat(1000);
        assert!(!is_route("GET", &format!("{p}?{tail}year=2008")));
        assert!(!is_route("POST", &format!("{p}?year=2008")));
        assert!(!is_route("GET", "/api/vehicles/brands/164/types?year=2008"));
    }
}
