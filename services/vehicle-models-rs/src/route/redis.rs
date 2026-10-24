//! Client RESP2 minimal (une connexion, commandes en pipeline sous verrou) pour
//! les clés que la route partage avec Node : `sess:*`, `session_version:*`,
//! `bot-guard:*`. Deux comportements de panne, ceux des deux clients de Node
//! (voir [`Mode`]).

use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;

use ring::rand::{SecureRandom, SystemRandom};
use tokio::io::{AsyncBufReadExt, AsyncReadExt, AsyncWriteExt, BufReader};
use tokio::net::TcpStream;
use tokio::sync::Mutex;

use super::json::{self, Json};
use super::log::{self, ReqCtx};

#[derive(Debug, Clone, PartialEq)]
pub enum Reply {
    Nil,
    Int(i64),
    Bulk(Vec<u8>),
    Status(String),
    Error(String),
    Array(Vec<Reply>),
}

impl Reply {
    pub fn into_string(self) -> Option<String> {
        match self {
            Reply::Bulk(b) => Some(String::from_utf8_lossy(&b).into_owned()),
            Reply::Status(s) => Some(s),
            _ => None,
        }
    }
}

/// Comportement du client quand Redis ne répond pas.
#[derive(Clone, Copy)]
pub enum Mode {
    /// Appel borné, attente de la connexion comprise ; une panne donne une erreur
    /// explicite (`session_version:*`, `bot-guard:*` : CacheService de Node, qui rend
    /// une valeur absente ; `throttler:*` : RedisThrottlerStorage, qui passe en mémoire).
    Bounded(Duration),
    /// File hors ligne de node-redis 5.12 (`SessionStoreService`, `disableOfflineQueue`
    /// laissé à faux) : sans connexion, la commande attend la reconnexion, tentée sans
    /// fin (`connectTimeout` par tentative, puis min(2^n × 50, 2000) ms + 0–200 ms) et
    /// journalisée à chaque échec ; une commande déjà écrite échoue si la connexion
    /// tombe (`flushWaitingForReply`) ; aucun délai par commande.
    OfflineQueue {
        connect_timeout: Duration,
        context: &'static str,
        msg: &'static str,
        /// Info à la connexion qui suit un échec journalisé (événement `ready`) ; aucune
        /// ligne à la première connexion, ouverte à la première commande.
        ready: &'static str,
    },
}

pub struct Redis {
    addr: String,
    db: Option<String>,
    mode: Mode,
    conn: Mutex<Option<BufReader<TcpStream>>>,
    /// Échec journalisé depuis la dernière connexion (lu sous le verrou `conn`).
    failed: AtomicBool,
}

impl Redis {
    /// `redis://hôte:port[/base]` (sans authentification : Redis local de DEV).
    pub fn new(url: &str, mode: Mode) -> Result<Self, String> {
        Self::from_var("REDIS_URL", url, mode)
    }

    /// Comme `new` ; l'erreur nomme `var`, la variable d'où vient `url`.
    pub fn from_var(var: &str, url: &str, mode: Mode) -> Result<Self, String> {
        let rest = url
            .strip_prefix("redis://")
            .ok_or_else(|| format!("{var} doit commencer par redis://"))?;
        if rest.contains('@') {
            return Err(format!(
                "{var} avec identifiants non pris en charge par la route R2"
            ));
        }
        let (addr, db) = match rest.split_once('/') {
            Some((a, d)) if !d.is_empty() => (a, Some(d.to_owned())),
            Some((a, _)) => (a, None),
            None => (rest, None),
        };
        let addr = if addr.contains(':') {
            addr.to_owned()
        } else {
            format!("{addr}:6379")
        };
        Ok(Self {
            addr,
            db,
            mode,
            conn: Mutex::new(None),
            failed: AtomicBool::new(false),
        })
    }

    /// `hôte:port/base`, comme le journal de démarrage de RedisThrottlerStorage.
    pub fn target(&self) -> String {
        format!("{}/{}", self.addr, self.db.as_deref().unwrap_or("0"))
    }

    pub async fn cmd(&self, args: &[&[u8]]) -> Result<Reply, String> {
        let mut r = self.pipeline(&[args]).await?;
        Ok(r.pop().unwrap_or(Reply::Nil))
    }

    /// `CacheService.get` : valeur JSON de `key`, `None` si la clé est absente ou vide.
    /// Un échec (connexion, délai, réponse d'erreur, JSON invalide) est journalisé
    /// comme dans Node (`Cache GET ${key} error: ${error}`, ERROR, CacheService), puis
    /// rendu comme une clé absente : la panne reste visible, la conséquence inchangée.
    pub async fn cache_get(&self, key: &str, req: Option<&ReqCtx>) -> Option<Json> {
        let error = match self.cmd(&[b"GET", key.as_bytes()]).await {
            Ok(Reply::Bulk(b)) if !b.is_empty() => match json::parse(&String::from_utf8_lossy(&b)) {
                Ok(v) => return Some(v),
                Err(e) => format!("SyntaxError: {}", e.message),
            },
            Ok(Reply::Error(e)) => format!("ReplyError: {e}"),
            Ok(_) => return None,
            Err(e) => e,
        };
        log::line(
            log::ERROR,
            req,
            "CacheService",
            &format!("Cache GET {key} error: {error}"),
        );
        None
    }

    /// Envoie les commandes d'un bloc et lit autant de réponses.
    pub async fn pipeline(&self, cmds: &[&[&[u8]]]) -> Result<Vec<Reply>, String> {
        let mut buf = Vec::new();
        for args in cmds {
            encode(&mut buf, args);
        }
        // Le verrou de tokio est équitable : les commandes passent dans l'ordre
        // d'arrivée, y compris pendant l'attente de reconnexion.
        match self.mode {
            Mode::Bounded(timeout) => {
                let deadline = tokio::time::Instant::now() + timeout;
                let expired = || format!("Redis : délai de {} ms dépassé", timeout.as_millis());
                // Attente du verrou comprise dans le délai : derrière un Redis figé,
                // les appels en file échouent à temps au lieu de s'additionner.
                let Ok(mut guard) = tokio::time::timeout_at(deadline, self.conn.lock()).await else {
                    return Err(expired());
                };
                let run = async {
                    if guard.is_none() {
                        *guard = Some(self.open().await?);
                    }
                    exchange(guard.as_mut().expect("connexion ouverte"), &buf, cmds.len()).await
                };
                match tokio::time::timeout_at(deadline, run).await {
                    Ok(Ok(r)) => Ok(r),
                    Ok(Err(e)) => {
                        *guard = None;
                        Err(format!("Redis : {e}"))
                    }
                    Err(_) => {
                        *guard = None;
                        Err(expired())
                    }
                }
            }
            Mode::OfflineQueue {
                connect_timeout,
                context,
                msg,
                ready,
            } => {
                let mut guard = self.conn.lock().await;
                let fail = || {
                    log::line(log::ERROR, None, context, msg);
                    self.failed.store(true, Ordering::Relaxed);
                };
                if guard.as_ref().is_some_and(closed_by_peer) {
                    *guard = None;
                    fail();
                }
                let mut retries = 0;
                while guard.is_none() {
                    match tokio::time::timeout(connect_timeout, self.open()).await {
                        Ok(Ok(conn)) => {
                            if self.failed.swap(false, Ordering::Relaxed) {
                                log::line(log::INFO, None, context, ready);
                            }
                            *guard = Some(conn);
                        }
                        Ok(Err(_)) | Err(_) => {
                            fail();
                            tokio::time::sleep(reconnect_delay(retries)).await;
                            retries += 1;
                        }
                    }
                }
                let conn = guard.as_mut().expect("connexion ouverte");
                match exchange(conn, &buf, cmds.len()).await {
                    Ok(r) => Ok(r),
                    Err(e) => {
                        *guard = None;
                        fail();
                        Err(format!("Redis : {e}"))
                    }
                }
            }
        }
    }

    async fn open(&self) -> Result<BufReader<TcpStream>, String> {
        let stream = TcpStream::connect(&self.addr).await.map_err(|e| e.to_string())?;
        stream.set_nodelay(true).ok();
        let mut conn = BufReader::new(stream);
        if let Some(db) = &self.db {
            let mut sel = Vec::new();
            encode(&mut sel, &[b"SELECT", db.as_bytes()]);
            conn.get_mut().write_all(&sel).await.map_err(|e| e.to_string())?;
            read_reply(&mut conn).await?;
        }
        Ok(conn)
    }
}

/// Connexion inactive déjà refermée par Redis (fin de flux reçue) ou désynchronisée :
/// node-redis l'apprend par l'événement de fermeture, avant toute nouvelle commande.
fn closed_by_peer(conn: &BufReader<TcpStream>) -> bool {
    let mut probe = [0u8; 1];
    !conn.buffer().is_empty()
        || !matches!(conn.get_ref().try_read(&mut probe),
                     Err(e) if e.kind() == std::io::ErrorKind::WouldBlock)
}

async fn exchange(conn: &mut BufReader<TcpStream>, buf: &[u8], n: usize) -> Result<Vec<Reply>, String> {
    conn.get_mut().write_all(buf).await.map_err(|e| e.to_string())?;
    let mut out = Vec::with_capacity(n);
    for _ in 0..n {
        out.push(read_reply(conn).await?);
    }
    Ok(out)
}

/// `defaultReconnectStrategy` de node-redis 5.12 (`socket.js`).
fn reconnect_delay(retries: u32) -> Duration {
    let mut b = [0u8; 2];
    let jitter = match SystemRandom::new().fill(&mut b) {
        Ok(()) => u64::from(u16::from_le_bytes(b)) % 200,
        Err(_) => 0,
    };
    Duration::from_millis(2u64.saturating_pow(retries).saturating_mul(50).min(2000) + jitter)
}

fn encode(buf: &mut Vec<u8>, args: &[&[u8]]) {
    buf.extend_from_slice(format!("*{}\r\n", args.len()).as_bytes());
    for a in args {
        buf.extend_from_slice(format!("${}\r\n", a.len()).as_bytes());
        buf.extend_from_slice(a);
        buf.extend_from_slice(b"\r\n");
    }
}

async fn read_line(conn: &mut BufReader<TcpStream>) -> Result<String, String> {
    let mut line = Vec::new();
    let n = conn
        .read_until(b'\n', &mut line)
        .await
        .map_err(|e| e.to_string())?;
    if n == 0 || !line.ends_with(b"\r\n") {
        return Err("connexion fermée".into());
    }
    line.truncate(line.len() - 2);
    Ok(String::from_utf8_lossy(&line).into_owned())
}

fn read_reply(
    conn: &mut BufReader<TcpStream>,
) -> std::pin::Pin<Box<dyn Future<Output = Result<Reply, String>> + Send + '_>> {
    Box::pin(async move {
        let line = read_line(conn).await?;
        let (kind, rest) = line.split_at(1.min(line.len()));
        let int = || {
            rest.parse::<i64>()
                .map_err(|_| format!("réponse RESP invalide : {line}"))
        };
        Ok(match kind {
            "+" => Reply::Status(rest.to_owned()),
            "-" => Reply::Error(rest.to_owned()),
            ":" => Reply::Int(int()?),
            "$" => match int()? {
                n if n < 0 => Reply::Nil,
                n => {
                    let mut data = vec![0; n as usize + 2];
                    conn.read_exact(&mut data).await.map_err(|e| e.to_string())?;
                    data.truncate(n as usize);
                    Reply::Bulk(data)
                }
            },
            "*" => match int()? {
                n if n < 0 => Reply::Nil,
                n => {
                    let mut items = Vec::with_capacity(n as usize);
                    for _ in 0..n {
                        items.push(read_reply(conn).await?);
                    }
                    Reply::Array(items)
                }
            },
            _ => return Err(format!("réponse RESP invalide : {line}")),
        })
    })
}

#[cfg(test)]
mod tests {
    use super::{Json, Mode, Redis, Reply, reconnect_delay};
    use std::time::Duration;
    use tokio::io::{AsyncReadExt, AsyncWriteExt};
    use tokio::net::TcpListener;

    #[test]
    fn reconnect_delay_follows_node_redis() {
        for (n, base) in [(0, 50), (1, 100), (5, 1600), (6, 2000), (40, 2000)] {
            let d = reconnect_delay(n).as_millis() as u64;
            assert!((base..base + 200).contains(&d), "{n} : {d} ms");
        }
    }

    async fn free_addr() -> std::net::SocketAddr {
        let probe = TcpListener::bind("127.0.0.1:0").await.unwrap();
        probe.local_addr().unwrap()
    }

    /// Sans Redis, la commande attend ; elle aboutit quand Redis revient.
    #[tokio::test]
    async fn offline_queue_waits_for_reconnection() {
        let addr = free_addr().await;
        let mode = Mode::OfflineQueue {
            connect_timeout: Duration::from_millis(500),
            context: "test",
            msg: "test",
            ready: "test",
        };
        let redis = Redis::new(&format!("redis://{addr}"), mode).unwrap();
        let cmd = tokio::spawn(async move { redis.cmd(&[b"PING"]).await });
        tokio::time::sleep(Duration::from_millis(400)).await;
        assert!(!cmd.is_finished());
        let server = TcpListener::bind(addr).await.unwrap();
        let (mut sock, _) = server.accept().await.unwrap();
        let mut buf = [0u8; 64];
        let n = sock.read(&mut buf).await.unwrap();
        assert_eq!(&buf[..n], b"*1\r\n$4\r\nPING\r\n");
        sock.write_all(b"+PONG\r\n").await.unwrap();
        assert_eq!(cmd.await.unwrap(), Ok(Reply::Status("PONG".into())));
    }

    /// Redis referme la connexion entre deux commandes : la suivante se reconnecte au
    /// lieu d'échouer comme une commande en vol.
    #[tokio::test]
    async fn offline_queue_reconnects_after_peer_close() {
        let server = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = server.local_addr().unwrap();
        let mode = Mode::OfflineQueue {
            connect_timeout: Duration::from_millis(500),
            context: "test",
            msg: "test",
            ready: "test",
        };
        let redis = std::sync::Arc::new(Redis::new(&format!("redis://{addr}"), mode).unwrap());
        for round in 0..2 {
            let client = redis.clone();
            let cmd = tokio::spawn(async move { client.cmd(&[b"PING"]).await });
            let (mut sock, _) = tokio::time::timeout(Duration::from_secs(2), server.accept())
                .await
                .unwrap_or_else(|_| panic!("tour {round} : pas de reconnexion, {:?}", cmd.is_finished()))
                .unwrap();
            let mut buf = [0u8; 64];
            let n = sock.read(&mut buf).await.unwrap();
            assert_eq!(&buf[..n], b"*1\r\n$4\r\nPING\r\n", "tour {round}");
            sock.write_all(b"+PONG\r\n").await.unwrap();
            assert_eq!(cmd.await.unwrap(), Ok(Reply::Status("PONG".into())));
            drop(sock);
            tokio::time::sleep(Duration::from_millis(100)).await;
        }
    }

    #[tokio::test]
    async fn bounded_mode_fails_without_waiting() {
        let addr = free_addr().await;
        let redis = Redis::new(&format!("redis://{addr}"), Mode::Bounded(Duration::from_secs(2))).unwrap();
        let r = redis.cmd(&[b"PING"]).await;
        assert!(r.is_err_and(|e| e.starts_with("Redis : ")));
    }

    /// Redis accepte la connexion sans jamais répondre : chaque appel en file échoue
    /// dans son délai, attente du verrou comprise, au lieu d'attendre les précédents.
    #[tokio::test]
    async fn bounded_mode_bounds_lock_wait_behind_a_frozen_redis() {
        let server = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = server.local_addr().unwrap();
        let _frozen = tokio::spawn(async move {
            let mut socks = Vec::new();
            while let Ok((s, _)) = server.accept().await {
                socks.push(s);
            }
        });
        let redis = std::sync::Arc::new(
            Redis::new(
                &format!("redis://{addr}"),
                Mode::Bounded(Duration::from_millis(200)),
            )
            .unwrap(),
        );
        let start = std::time::Instant::now();
        let calls: Vec<_> = (0..5)
            .map(|_| {
                let r = redis.clone();
                tokio::spawn(async move { r.cmd(&[b"PING"]).await })
            })
            .collect();
        for c in calls {
            assert_eq!(c.await.unwrap(), Err("Redis : délai de 200 ms dépassé".into()));
        }
        assert!(
            start.elapsed() < Duration::from_millis(600),
            "{:?}",
            start.elapsed()
        );
    }

    /// `cache_get` rend ce que rendait la lecture directe : la valeur JSON, ou rien
    /// pour une clé absente ou vide, une réponse d'erreur, un JSON invalide, une panne.
    #[tokio::test]
    async fn cache_get_returns_value_or_none() {
        let server = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = server.local_addr().unwrap();
        let replies: [&[u8]; 5] = [
            b"$4\r\ntrue\r\n",
            b"$-1\r\n",
            b"$0\r\n\r\n",
            b"-WRONGTYPE x\r\n",
            b"$3\r\n{x}\r\n",
        ];
        let _server = tokio::spawn(async move {
            let (mut sock, _) = server.accept().await.unwrap();
            let mut buf = [0u8; 256];
            for r in replies {
                let _ = sock.read(&mut buf).await.unwrap();
                sock.write_all(r).await.unwrap();
            }
        });
        let redis = Redis::new(&format!("redis://{addr}"), Mode::Bounded(Duration::from_secs(2))).unwrap();
        assert_eq!(redis.cache_get("k", None).await, Some(Json::Bool(true)));
        for _ in 0..4 {
            assert_eq!(redis.cache_get("k", None).await, None);
        }
        let down = Redis::new(
            &format!("redis://{}", free_addr().await),
            Mode::Bounded(Duration::from_millis(200)),
        )
        .unwrap();
        assert_eq!(down.cache_get("k", None).await, None);
    }
}
