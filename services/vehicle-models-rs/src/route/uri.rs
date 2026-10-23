//! Décodage d'URL au sens de JavaScript : `decodeURIComponent` (paramètre de chemin
//! d'Express, décodage `qs`, valeurs de cookie) et lecture des octets de la ligne de
//! requête comme le fait Node (`latin1`, un caractère par octet).

/// Chaîne JavaScript obtenue par Node pour des octets d'URL ou d'en-tête.
pub fn latin1(bytes: &[u8]) -> String {
    bytes.iter().map(|&b| char::from(b)).collect()
}

fn hex(b: u8) -> Option<u8> {
    match b {
        b'0'..=b'9' => Some(b - b'0'),
        b'a'..=b'f' => Some(b - b'a' + 10),
        b'A'..=b'F' => Some(b - b'A' + 10),
        _ => None,
    }
}

fn octet(s: &[u8], at: usize) -> Option<u8> {
    if s.get(at) != Some(&b'%') {
        return None;
    }
    Some(hex(*s.get(at + 1)?)? << 4 | hex(*s.get(at + 2)?)?)
}

/// `decodeURIComponent(s)` ; `Err(())` là où JavaScript lève `URIError`.
// L'échec ne porte aucune information côté JavaScript (zod/URIError).
#[allow(clippy::result_unit_err)]
pub fn decode_uri_component(s: &str) -> Result<String, ()> {
    if !s.contains('%') {
        return Ok(s.to_owned());
    }
    let b = s.as_bytes();
    let mut out = String::with_capacity(s.len());
    let mut plain = 0;
    let mut i = 0;
    while i < b.len() {
        if b[i] != b'%' {
            i += 1;
            continue;
        }
        out.push_str(&s[plain..i]);
        let first = octet(b, i).ok_or(())?;
        i += 3;
        if first < 0x80 {
            out.push(char::from(first));
        } else {
            let n = first.leading_ones() as usize;
            if !(2..=4).contains(&n) {
                return Err(());
            }
            let mut seq = vec![first];
            for _ in 1..n {
                let next = octet(b, i).ok_or(())?;
                if next & 0xC0 != 0x80 {
                    return Err(());
                }
                seq.push(next);
                i += 3;
            }
            // RFC 3629 : ni forme trop longue, ni substitut, ni au-delà de U+10FFFF.
            out.push_str(std::str::from_utf8(&seq).map_err(|_| ())?);
        }
        plain = i;
    }
    out.push_str(&s[plain..]);
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn like_javascript() {
        assert_eq!(decode_uri_component("a%20b%2B%2f"), Ok("a b+/".into()));
        assert_eq!(decode_uri_component("%C3%A9%F0%9F%98%80"), Ok("é😀".into()));
        assert_eq!(decode_uri_component("é%41"), Ok("éA".into()));
        for bad in [
            "%",
            "%Z1",
            "%C3",
            "%C3%41",
            "%80",
            "%C0%80",
            "%ED%A0%80",
            "%F8%80%80%80",
        ] {
            assert_eq!(decode_uri_component(bad), Err(()), "{bad}");
        }
        assert_eq!(latin1(&[0x61, 0xE9]), "aé");
    }
}
