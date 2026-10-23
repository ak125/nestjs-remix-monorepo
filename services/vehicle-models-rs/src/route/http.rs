//! Serveur HTTP/1.1 de R2 : en-têtes bornés à 16 Ko (431 puis fermeture comme
//! Node), corps borné à 10 Mo, écriture des en-têtes dans l'ordre et la casse
//! de Node. Délais de main.ts : keep-alive 65 s, en-têtes 66 s et requête
//! 300 s (408 puis fermeture). Hors du motif de la route : 421, jamais Node.

use std::sync::Arc;
use std::time::Duration;

use tokio::io::{AsyncRead, AsyncReadExt, AsyncWriteExt};
use tokio::net::{TcpListener, TcpStream};
use tokio::time::Instant;

use super::app::{self, Request, Response, State};
use super::log::Completion;

const MAX_HEAD: usize = 16 * 1024;
const MAX_BODY: usize = 10 * 1024 * 1024;
/// `httpServer.keepAliveTimeout`, `headersTimeout` et `requestTimeout` de main.ts.
const KEEP_ALIVE: Duration = Duration::from_secs(65);
const HEADERS_TIMEOUT: Duration = Duration::from_secs(66);
const REQUEST_TIMEOUT: Duration = Duration::from_secs(300);
const TIMED_OUT: &[u8] = b"HTTP/1.1 408 Request Timeout\r\nConnection: close\r\n\r\n";

pub async fn serve(listener: TcpListener, st: &'static State) {
    loop {
        let Ok((stream, peer)) = listener.accept().await else {
            continue;
        };
        stream.set_nodelay(true).ok();
        tokio::spawn(connection(stream, peer.ip().to_string(), st));
    }
}

fn reason(status: u16) -> &'static str {
    match status {
        200 => "OK",
        204 => "No Content",
        304 => "Not Modified",
        400 => "Bad Request",
        403 => "Forbidden",
        404 => "Not Found",
        421 => "Misdirected Request",
        429 => "Too Many Requests",
        431 => "Request Header Fields Too Large",
        500 => "Internal Server Error",
        _ => "Unknown",
    }
}

async fn connection(mut stream: TcpStream, peer: String, st: &'static State) {
    let mut buf: Vec<u8> = Vec::with_capacity(4096);
    loop {
        // Entre deux requêtes : fermeture sans réponse après 65 s d'inactivité.
        if buf.is_empty()
            && !matches!(
                fill(&mut stream, &mut buf, Instant::now() + KEEP_ALIVE).await,
                Fill::Data
            )
        {
            return;
        }
        let started = Instant::now();
        let head_end = loop {
            if let Some(i) = buf.windows(4).position(|w| w == b"\r\n\r\n") {
                break i + 4;
            }
            if buf.len() > MAX_HEAD {
                stream
                    .write_all(b"HTTP/1.1 431 Request Header Fields Too Large\r\nConnection: close\r\n\r\n")
                    .await
                    .ok();
                return;
            }
            match fill(&mut stream, &mut buf, started + HEADERS_TIMEOUT).await {
                Fill::Data => {}
                Fill::Closed => return,
                Fill::Expired => {
                    stream.write_all(TIMED_OUT).await.ok();
                    return;
                }
            }
        };
        if head_end > MAX_HEAD {
            stream
                .write_all(b"HTTP/1.1 431 Request Header Fields Too Large\r\nConnection: close\r\n\r\n")
                .await
                .ok();
            return;
        }
        let mut raw = [httparse::EMPTY_HEADER; 128];
        let mut parsed = httparse::Request::new(&mut raw);
        let ok = matches!(parsed.parse(&buf[..head_end]), Ok(httparse::Status::Complete(_)));
        let (Some(method), Some(target), true) = (parsed.method, parsed.path, ok) else {
            stream
                .write_all(b"HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n")
                .await
                .ok();
            return;
        };
        let version_10 = parsed.version == Some(0);
        let headers: Vec<(String, String)> = parsed
            .headers
            .iter()
            .map(|h| (h.name.to_owned(), String::from_utf8_lossy(h.value).into_owned()))
            .collect();
        let (method, target) = (method.to_owned(), target.to_owned());
        let get = |n: &str| {
            headers
                .iter()
                .find(|(k, _)| k.eq_ignore_ascii_case(n))
                .map(|(_, v)| v.as_str())
        };
        let chunked = get("transfer-encoding").is_some_and(|v| v.to_ascii_lowercase().contains("chunked"));
        let length = get("content-length").map(|v| v.trim().parse::<usize>());
        if (chunked && length.is_some()) || matches!(length, Some(Err(_))) {
            stream
                .write_all(b"HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n")
                .await
                .ok();
            return;
        }
        let close = get("connection").is_some_and(|v| v.eq_ignore_ascii_case("close")) || version_10;
        buf.drain(..head_end);
        let deadline = started + REQUEST_TIMEOUT;
        let (body, too_large) = match read_body(
            &mut stream,
            &mut buf,
            chunked,
            length.and_then(Result::ok),
            deadline,
        )
        .await
        {
            Body::Read(b, too_large) => (b, too_large),
            Body::Closed => return,
            Body::Expired => {
                stream.write_all(TIMED_OUT).await.ok();
                return;
            }
        };
        let path = target.split('?').next().unwrap_or("");
        let response = if path == "/health" && method == "GET" {
            let mut h = super::headers::Headers::default();
            h.set("Content-Type", "application/json; charset=utf-8");
            h.set("Content-Length", "11");
            Response {
                status: 200,
                headers: h,
                body: b"{\"ok\":true}".to_vec(),
                chunked: false,
            }
        } else if !app::is_route(&method, &target) {
            let mut h = super::headers::Headers::default();
            h.set("Content-Length", "0");
            Response {
                status: 421,
                headers: h,
                body: Vec::new(),
                chunked: false,
            }
        } else {
            let completion = Arc::new(Completion::default());
            let handled = app::handle(
                st,
                Request {
                    method,
                    target,
                    headers,
                    peer: peer.clone(),
                    body,
                    body_too_large: too_large,
                    completion: completion.clone(),
                },
            );
            // Fin de lecture du client pendant le traitement (fermeture ou
            // demi-fermeture) : Node (`httpAllowHalfOpen` faux) émet `close`,
            // poursuit la requête et n'écrit pas de réponse.
            tokio::pin!(handled);
            let (mut watch, mut closed) = (buf.is_empty(), false);
            let mut probe = [0u8; 1];
            let response = loop {
                tokio::select! {
                    r = &mut handled => break r,
                    n = stream.peek(&mut probe), if watch => {
                        watch = false;
                        if !matches!(n, Ok(1..)) {
                            closed = true;
                            completion.close();
                        }
                    }
                }
            };
            if closed {
                return;
            }
            response
        };
        if write(&mut stream, response, close).await.is_err() || close {
            return;
        }
    }
}

enum Fill {
    Data,
    Closed,
    Expired,
}

async fn fill<S: AsyncRead + Unpin>(stream: &mut S, buf: &mut Vec<u8>, deadline: Instant) -> Fill {
    let mut chunk = [0u8; 65536];
    match tokio::time::timeout_at(deadline, stream.read(&mut chunk)).await {
        Ok(Ok(n)) if n > 0 => {
            buf.extend_from_slice(&chunk[..n]);
            Fill::Data
        }
        Ok(_) => Fill::Closed,
        Err(_) => Fill::Expired,
    }
}

enum Body {
    Read(Vec<u8>, bool),
    /// Connexion fermée ou encodage chunked invalide : fermeture sans réponse.
    Closed,
    /// Requête non reçue entière avant `requestTimeout`.
    Expired,
}

/// Corps borné : au-delà de 10 Mo, la suite est lue sans être gardée, comme
/// body-parser (`dump` puis 413→500 une fois la requête finie) ; la connexion
/// reste alors utilisable. Lecture au fil de l'eau : un bloc chunked n'est
/// jamais gardé entier en mémoire au-delà de la borne.
async fn read_body<S: AsyncRead + Unpin>(
    stream: &mut S,
    buf: &mut Vec<u8>,
    chunked: bool,
    length: Option<usize>,
    deadline: Instant,
) -> Body {
    macro_rules! fill {
        () => {
            match fill(stream, buf, deadline).await {
                Fill::Data => {}
                Fill::Closed => return Body::Closed,
                Fill::Expired => return Body::Expired,
            }
        };
    }
    let mut body = Vec::new();
    let mut too_large = false;
    // Copie (ou ignore au-delà de la borne) `n` octets du flux.
    macro_rules! take {
        ($n:expr) => {{
            let mut left: usize = $n;
            while left > 0 {
                if buf.is_empty() {
                    fill!();
                }
                let k = left.min(buf.len());
                too_large |= body.len() + k > MAX_BODY;
                if too_large {
                    body = Vec::new();
                } else {
                    body.extend_from_slice(&buf[..k]);
                }
                buf.drain(..k);
                left -= k;
            }
        }};
    }
    // Ligne terminée par CRLF, bornée comme les extensions de bloc de Node.
    macro_rules! line {
        () => {{
            loop {
                if let Some(i) = buf.windows(2).position(|w| w == b"\r\n") {
                    let l = String::from_utf8_lossy(&buf[..i]).into_owned();
                    buf.drain(..i + 2);
                    break l;
                }
                if buf.len() > MAX_HEAD {
                    return Body::Closed;
                }
                fill!();
            }
        }};
    }
    if !chunked {
        take!(length.unwrap_or(0));
        return Body::Read(body, too_large);
    }
    loop {
        let size_line = line!();
        let Ok(size) = usize::from_str_radix(size_line.split(';').next().unwrap_or("").trim(), 16) else {
            return Body::Closed;
        };
        if size == 0 {
            while !line!().is_empty() {}
            return Body::Read(body, too_large);
        }
        take!(size);
        if !line!().is_empty() {
            return Body::Closed;
        }
    }
}

async fn write(stream: &mut TcpStream, r: Response, close: bool) -> std::io::Result<()> {
    let mut out = format!("HTTP/1.1 {} {}\r\n", r.status, reason(r.status));
    for (k, v) in r.headers.iter() {
        out.push_str(k);
        out.push_str(": ");
        out.push_str(v);
        out.push_str("\r\n");
    }
    out.push_str(&format!(
        "Date: {}\r\n",
        httpdate::fmt_http_date(std::time::SystemTime::now())
    ));
    out.push_str(if close {
        "Connection: close\r\n"
    } else {
        "Connection: keep-alive\r\nKeep-Alive: timeout=65\r\n"
    });
    if r.chunked {
        out.push_str("Transfer-Encoding: chunked\r\n\r\n");
        let mut bytes = out.into_bytes();
        if !r.body.is_empty() {
            bytes.extend_from_slice(format!("{:x}\r\n", r.body.len()).as_bytes());
            bytes.extend_from_slice(&r.body);
            bytes.extend_from_slice(b"\r\n");
        }
        bytes.extend_from_slice(b"0\r\n\r\n");
        return stream.write_all(&bytes).await;
    }
    out.push_str("\r\n");
    let mut bytes = out.into_bytes();
    bytes.extend_from_slice(&r.body);
    stream.write_all(&bytes).await
}

#[cfg(test)]
mod tests {
    use super::{Body, Instant, MAX_BODY, MAX_HEAD, read_body};
    use std::time::Duration;
    use tokio::io::AsyncWriteExt;

    /// Écrit `parts` dans un tube, puis lit le corps comme le ferait la connexion.
    async fn read(
        parts: Vec<Vec<u8>>,
        chunked: bool,
        length: Option<usize>,
        wait: Duration,
    ) -> (Body, Vec<u8>) {
        let (mut client, mut server) = tokio::io::duplex(1 << 16);
        let writer = tokio::spawn(async move {
            for p in parts {
                client.write_all(&p).await.unwrap();
            }
            client
        });
        let mut buf = Vec::new();
        let body = read_body(&mut server, &mut buf, chunked, length, Instant::now() + wait).await;
        drop(writer);
        (body, buf)
    }

    const NEXT: &[u8] = b"GET /health HTTP/1.1\r\n\r\n";
    const LONG: Duration = Duration::from_secs(5);

    #[tokio::test]
    async fn oversized_length_is_drained_and_connection_stays_usable() {
        let n = MAX_BODY + 24;
        let (body, rest) = read(vec![vec![b'x'; n], NEXT.to_vec()], false, Some(n), LONG).await;
        assert!(matches!(body, Body::Read(ref b, true) if b.is_empty()));
        assert_eq!(rest, NEXT);
    }

    #[tokio::test]
    async fn oversized_chunk_is_drained() {
        let size = MAX_BODY + 1;
        let parts = vec![
            format!("{size:x}\r\n").into_bytes(),
            vec![b'x'; size],
            b"\r\n0\r\n\r\n".to_vec(),
            NEXT.to_vec(),
        ];
        let (body, rest) = read(parts, true, None, LONG).await;
        assert!(matches!(body, Body::Read(ref b, true) if b.is_empty()));
        assert_eq!(rest, NEXT);
    }

    #[tokio::test]
    async fn chunked_body_with_trailer_is_kept() {
        let parts = vec![
            b"3;ext=1\r\nabc\r\n2\r\nde\r\n0\r\nX-T: 1\r\n\r\n".to_vec(),
            NEXT.to_vec(),
        ];
        let (body, rest) = read(parts, true, None, LONG).await;
        assert!(matches!(body, Body::Read(ref b, false) if b == b"abcde"));
        assert_eq!(rest, NEXT);
    }

    #[tokio::test]
    async fn exact_limit_is_accepted() {
        let (body, _) = read(vec![vec![b'x'; MAX_BODY]], false, Some(MAX_BODY), LONG).await;
        assert!(matches!(body, Body::Read(ref b, false) if b.len() == MAX_BODY));
    }

    #[tokio::test]
    async fn incomplete_body_expires_at_deadline() {
        let (client, mut server) = tokio::io::duplex(1 << 16);
        let mut client = client;
        client.write_all(b"abc").await.unwrap();
        let mut buf = Vec::new();
        let start = Instant::now();
        let body = read_body(
            &mut server,
            &mut buf,
            false,
            Some(10),
            start + Duration::from_millis(100),
        )
        .await;
        assert!(matches!(body, Body::Expired));
        assert!(start.elapsed() >= Duration::from_millis(100));
        drop(client);
    }

    #[tokio::test]
    async fn invalid_chunk_framing_closes() {
        let (body, _) = read(vec![b"zz\r\n".to_vec()], true, None, LONG).await;
        assert!(matches!(body, Body::Closed));
        let (body, _) = read(vec![b"3\r\nabcX\r\n".to_vec()], true, None, LONG).await;
        assert!(matches!(body, Body::Closed));
        let (body, _) = read(vec![vec![b'1'; MAX_HEAD + 2]], true, None, LONG).await;
        assert!(matches!(body, Body::Closed));
    }
}
