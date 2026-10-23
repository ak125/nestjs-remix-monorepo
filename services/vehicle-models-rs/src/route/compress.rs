//! `compression` 1.8 (seuil 1024, gzip/deflate niveau 6, br qualité 4) et la
//! négociation `Negotiator.encoding(['br','gzip','deflate','identity'],
//! ['br','gzip'])`. Les octets compressés diffèrent de zlib ; le corps décodé non.

use std::io::Write;

const SUPPORTED: [&str; 4] = ["br", "gzip", "deflate", "identity"];
const PREFERRED: [&str; 2] = ["br", "gzip"];
pub const THRESHOLD: usize = 1024;

struct Spec {
    encoding: String,
    q: f64,
    i: usize,
}

fn parse(header: &str) -> Vec<Spec> {
    let mut out = Vec::new();
    let mut has_identity = false;
    let mut min_q = 1.0_f64;
    for (i, part) in header.split(',').enumerate() {
        let mut params = part.trim().split(';');
        let encoding = params.next().unwrap_or("").trim();
        if encoding.is_empty() {
            continue;
        }
        let mut q = 1.0;
        for p in params {
            if let Some((k, v)) = p.trim().split_once('=')
                && k.trim() == "q"
            {
                q = v.trim().parse::<f64>().unwrap_or(f64::NAN);
            }
        }
        has_identity |= encoding.eq_ignore_ascii_case("identity");
        min_q = min_q.min(q);
        out.push(Spec {
            encoding: encoding.to_owned(),
            q,
            i,
        });
    }
    if !has_identity {
        out.push(Spec {
            encoding: "identity".into(),
            q: min_q,
            i: out.len(),
        });
    }
    out
}

/// Encodage retenu, ou `None` (identité ou rien d'acceptable).
pub fn negotiate(accept_encoding: Option<&str>) -> Option<&'static str> {
    let accepted = parse(accept_encoding.unwrap_or(""));
    // (s, q, o, i) de `getEncodingPriority` pour chaque encodage proposé.
    let mut ranked: Vec<(i32, f64, usize, usize)> = SUPPORTED
        .iter()
        .enumerate()
        .filter_map(|(i, enc)| {
            let mut best: Option<(i32, f64, usize)> = None;
            for spec in &accepted {
                let s = if spec.encoding.eq_ignore_ascii_case(enc) {
                    1
                } else if spec.encoding == "*" {
                    0
                } else {
                    continue;
                };
                let better = best.is_none_or(|(bs, bq, bo)| {
                    let d = if bs != s {
                        f64::from(bs - s)
                    } else if bq != spec.q {
                        bq - spec.q
                    } else {
                        bo as f64 - spec.i as f64
                    };
                    d < 0.0
                });
                if better {
                    best = Some((s, spec.q, spec.i));
                }
            }
            best.map(|(s, q, o)| (s, q, o, i))
        })
        .filter(|(_, q, _, _)| *q > 0.0)
        .collect();
    ranked.sort_by(|a, b| {
        if a.1 != b.1 {
            return b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal);
        }
        let pa = PREFERRED.iter().position(|p| *p == SUPPORTED[a.3]);
        let pb = PREFERRED.iter().position(|p| *p == SUPPORTED[b.3]);
        match (pa, pb) {
            (None, None) => b.0.cmp(&a.0).then(a.2.cmp(&b.2)).then(a.3.cmp(&b.3)),
            (Some(x), Some(y)) => x.cmp(&y),
            (Some(_), None) => std::cmp::Ordering::Less,
            (None, Some(_)) => std::cmp::Ordering::Greater,
        }
    });
    ranked
        .first()
        .map(|r| SUPPORTED[r.3])
        .filter(|e| *e != "identity")
}

pub fn encode(method: &str, body: &[u8]) -> Vec<u8> {
    match method {
        "br" => {
            let mut out = Vec::new();
            let params = brotli::enc::BrotliEncoderParams {
                quality: 4,
                lgwin: 22,
                ..Default::default()
            };
            brotli::BrotliCompress(&mut &body[..], &mut out, &params).ok();
            out
        }
        "gzip" => {
            let mut e = flate2::write::GzEncoder::new(Vec::new(), flate2::Compression::new(6));
            e.write_all(body).ok();
            e.finish().unwrap_or_default()
        }
        _ => {
            let mut e = flate2::write::ZlibEncoder::new(Vec::new(), flate2::Compression::new(6));
            e.write_all(body).ok();
            e.finish().unwrap_or_default()
        }
    }
}

#[cfg(test)]
mod tests {
    use super::negotiate;

    #[test]
    fn negotiator_order() {
        assert_eq!(negotiate(Some("gzip, deflate, br")), Some("br"));
        assert_eq!(negotiate(Some("gzip, deflate, br, zstd")), Some("br"));
        assert_eq!(negotiate(Some("deflate, gzip;q=0.5")), Some("deflate"));
        assert_eq!(negotiate(Some("*")), Some("br"));
        assert_eq!(negotiate(Some("identity")), None);
        assert_eq!(negotiate(Some("br;q=0, *;q=0.1")), Some("gzip"));
        assert_eq!(negotiate(None), None);
    }
}
