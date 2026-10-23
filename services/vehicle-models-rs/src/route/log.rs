//! Lignes JSON au format pino de `nestjs-pino` (clés dans l'ordre observé sur
//! A2) : `level, time, pid, hostname, [req], [context], [res, err,
//! responseTime], msg`. Écrites sur la sortie standard par une tâche dédiée.

use std::io::Write;
use std::sync::{Mutex, OnceLock};
use std::time::{Instant, SystemTime, UNIX_EPOCH};

use tokio::sync::mpsc;

use super::json::quote_into;

pub const INFO: u8 = 30;
pub const WARN: u8 = 40;
pub const ERROR: u8 = 50;

static SINK: OnceLock<Sink> = OnceLock::new();

struct Sink {
    tx: mpsc::UnboundedSender<String>,
    prefix: String,
}

/// Contexte `req` de pino-http : `{method, url, id[, query]}`.
#[derive(Clone)]
pub struct ReqCtx {
    pub method: String,
    pub url: String,
    pub id: String,
    /// `req.query` déjà sérialisé, présent seulement s'il est non vide.
    pub query: Option<String>,
}

impl ReqCtx {
    fn write(&self, out: &mut String) {
        out.push_str(",\"req\":{\"method\":");
        quote_into(out, &self.method);
        out.push_str(",\"url\":");
        quote_into(out, &self.url);
        out.push_str(",\"id\":");
        quote_into(out, &self.id);
        if let Some(q) = &self.query {
            out.push_str(",\"query\":");
            out.push_str(q);
        }
        out.push('}');
    }
}

pub fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_or(0, |d| d.as_millis() as u64)
}

/// Démarre l'écrivain ; à appeler une fois dans le runtime tokio.
pub fn init(hostname: &str) {
    let (tx, mut rx) = mpsc::unbounded_channel::<String>();
    let mut prefix = format!(",\"pid\":{},\"hostname\":", std::process::id());
    quote_into(&mut prefix, hostname);
    if SINK.set(Sink { tx, prefix }).is_ok() {
        tokio::spawn(async move {
            let mut buf = Vec::with_capacity(8192);
            while let Some(line) = rx.recv().await {
                buf.extend_from_slice(line.as_bytes());
                while let Ok(more) = rx.try_recv() {
                    buf.extend_from_slice(more.as_bytes());
                }
                let mut out = std::io::stdout().lock();
                out.write_all(&buf).ok();
                out.flush().ok();
                buf.clear();
            }
        });
    }
}

fn emit(line: String) {
    if let Some(s) = SINK.get() {
        s.tx.send(line).ok();
    }
}

fn head(level: u8) -> String {
    let mut out = String::with_capacity(256);
    out.push_str("{\"level\":");
    out.push_str(&level.to_string());
    out.push_str(",\"time\":");
    out.push_str(&now_ms().to_string());
    if let Some(s) = SINK.get() {
        out.push_str(&s.prefix);
    }
    out
}

/// `this.logger.<niveau>(msg)` d'un service Nest (`context`), avec ou sans `req`.
pub fn line(level: u8, req: Option<&ReqCtx>, context: &str, msg: &str) {
    line_err(level, req, context, None, msg);
}

/// Idem avec un `err` sérialisé (`{"type","message","stack"}`).
pub fn line_err(level: u8, req: Option<&ReqCtx>, context: &str, err: Option<&str>, msg: &str) {
    let mut out = head(level);
    if let Some(r) = req {
        r.write(&mut out);
    }
    if !context.is_empty() {
        out.push_str(",\"context\":");
        quote_into(&mut out, context);
    }
    if let Some(e) = err {
        out.push_str(",\"err\":");
        out.push_str(e);
    }
    out.push_str(",\"msg\":");
    quote_into(&mut out, msg);
    out.push_str("}\n");
    emit(out);
}

/// `err` de pino : `{"type","message","stack"}` ; la pile JavaScript n'est pas
/// reproductible, seule sa première ligne (`stack_head`) l'est.
pub fn err_json(kind: &str, message: &str, stack_head: &str) -> String {
    let mut out = String::from("{\"type\":");
    quote_into(&mut out, kind);
    out.push_str(",\"message\":");
    quote_into(&mut out, message);
    out.push_str(",\"stack\":");
    quote_into(&mut out, &format!("{stack_head}\n    at vehicle-models-route"));
    out.push('}');
    out
}

/// Ligne de fin de pino-http, au plus une par requête. Le middleware démarre
/// le chronomètre et pose ses écouteurs `finish`/`close` à son passage, après
/// la session (main.ts) : une fermeture du client antérieure ne produit aucune
/// ligne ; une fermeture postérieure la produit aussitôt, avec le statut 200
/// d'Express encore par défaut. La requête se poursuit dans les deux cas.
#[derive(Default)]
pub struct Completion(Mutex<Phase>);

#[derive(Default)]
enum Phase {
    #[default]
    Before,
    Attached(ReqCtx, Instant),
    Closed,
    Done,
}

impl Completion {
    /// Passage de pino-http.
    pub fn attach(&self, req: &ReqCtx) {
        if let Ok(mut p) = self.0.lock() {
            *p = match *p {
                Phase::Before => Phase::Attached(req.clone(), Instant::now()),
                _ => Phase::Done,
            };
        }
    }

    /// `finish` : réponse produite avec `status`.
    pub fn finish(&self, status: u16) {
        self.end(status, true, Phase::Done);
    }

    /// `close` : connexion fermée par le client avant la réponse, en-têtes non envoyés.
    pub fn close(&self) {
        self.end(200, false, Phase::Closed);
    }

    fn end(&self, status: u16, sent: bool, before: Phase) {
        if let Some((req, ms)) = self.settle(before) {
            completion(&req, status, sent, ms);
        }
    }

    /// Contexte et durée de la ligne à écrire, une seule fois.
    fn settle(&self, before: Phase) -> Option<(ReqCtx, u64)> {
        let mut p = self.0.lock().ok()?;
        match std::mem::take(&mut *p) {
            Phase::Attached(req, started) => {
                *p = Phase::Done;
                Some((req, started.elapsed().as_millis() as u64))
            }
            Phase::Before => {
                *p = before;
                None
            }
            other => {
                *p = other;
                None
            }
        }
    }
}

/// Ligne de fin de requête de pino-http (`customLogLevel` : 40 dès 400, 50 dès 500).
/// `res.statusCode` sérialisé vaut `null` tant que les en-têtes ne sont pas envoyés
/// (`headersSent`), le message gardant le statut Express.
pub fn completion(req: &ReqCtx, status: u16, sent: bool, response_time_ms: u64) {
    let level = match status {
        500.. => ERROR,
        400.. => WARN,
        _ => INFO,
    };
    let mut out = head(level);
    req.write(&mut out);
    out.push_str(",\"res\":{\"statusCode\":");
    out.push_str(&if sent { status.to_string() } else { "null".into() });
    out.push('}');
    if status >= 500 {
        out.push_str(",\"err\":");
        let message = format!("failed with status code {status}");
        out.push_str(&err_json("Error", &message, &format!("Error: {message}")));
    }
    out.push_str(",\"responseTime\":");
    out.push_str(&response_time_ms.to_string());
    out.push_str(",\"msg\":");
    // `customSuccessMessage`, ou `customErrorMessage` dès 500.
    let suffix = if status >= 500 { " - Error" } else { "" };
    quote_into(&mut out, &format!("{} {} {status}{suffix}", req.method, req.url));
    out.push_str("}\n");
    emit(out);
}

#[cfg(test)]
mod tests {
    use super::{Completion, Phase, ReqCtx};

    fn ctx() -> ReqCtx {
        ReqCtx {
            method: "GET".into(),
            url: "/api/vehicles/brands/1/models".into(),
            id: "req-1".into(),
            query: None,
        }
    }

    #[test]
    fn finish_after_attach_writes_once() {
        let c = Completion::default();
        c.attach(&ctx());
        assert!(c.settle(Phase::Done).is_some());
        assert!(c.settle(Phase::Closed).is_none());
    }

    #[test]
    fn close_after_attach_writes_once_then_finish_is_silent() {
        let c = Completion::default();
        c.attach(&ctx());
        assert!(c.settle(Phase::Closed).is_some());
        assert!(c.settle(Phase::Done).is_none());
    }

    #[test]
    fn close_before_attach_never_writes() {
        let c = Completion::default();
        assert!(c.settle(Phase::Closed).is_none());
        c.attach(&ctx());
        assert!(c.settle(Phase::Done).is_none());
    }

    #[test]
    fn finish_without_attach_never_writes() {
        let c = Completion::default();
        assert!(c.settle(Phase::Done).is_none());
        c.attach(&ctx());
        assert!(c.settle(Phase::Done).is_none());
    }
}
