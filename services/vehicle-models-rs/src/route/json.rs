//! JSON au sens de JavaScript : `JSON.parse` de V8 (messages d'erreur compris, ordre
//! des clés d'objet) et `JSON.stringify`. Les messages servent tels quels dans les
//! réponses 400 et les journaux ; ils sont vérifiés contre Node par le test
//! différentiel `bench/json-diff.mjs`.
//!
//! Positions et extraits sont comptés en unités UTF-16, comme dans V8. Une demi-paire
//! de substitution isolée devient U+FFFD (une `String` Rust ne peut la porter).

use serde_json::Value;

use crate::js::{number_as_f64, number_to_string};

#[derive(Clone, Debug, PartialEq)]
pub enum Json {
    Null,
    Bool(bool),
    Num(f64),
    Str(String),
    Arr(Vec<Json>),
    Obj(Obj),
}

/// Objet JavaScript ordinaire : clés d'index de tableau d'abord, croissantes, puis
/// les autres dans l'ordre de création ; redéfinir une clé garde sa place.
#[derive(Clone, Debug, Default, PartialEq)]
pub struct Obj(Vec<(String, Json)>);

/// Index de tableau (ECMAScript) : forme canonique d'un entier de 0 à 2³² − 2.
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

impl Obj {
    pub fn new() -> Self {
        Self(Vec::new())
    }

    pub fn get(&self, key: &str) -> Option<&Json> {
        self.0.iter().find(|(k, _)| k == key).map(|(_, v)| v)
    }

    pub fn get_mut(&mut self, key: &str) -> Option<&mut Json> {
        self.0.iter_mut().find(|(k, _)| k == key).map(|(_, v)| v)
    }

    pub fn contains(&self, key: &str) -> bool {
        self.get(key).is_some()
    }

    pub fn insert(&mut self, key: String, value: Json) {
        if let Some(slot) = self.get_mut(&key) {
            *slot = value;
            return;
        }
        match array_index(&key) {
            Some(index) => {
                let at = self
                    .0
                    .iter()
                    .position(|(k, _)| array_index(k).is_none_or(|other| other > index))
                    .unwrap_or(self.0.len());
                self.0.insert(at, (key, value));
            }
            None => self.0.push((key, value)),
        }
    }

    pub fn remove(&mut self, key: &str) -> Option<Json> {
        let at = self.0.iter().position(|(k, _)| k == key)?;
        Some(self.0.remove(at).1)
    }

    pub fn iter(&self) -> impl Iterator<Item = (&String, &Json)> {
        self.0.iter().map(|(k, v)| (k, v))
    }

    pub fn len(&self) -> usize {
        self.0.len()
    }

    pub fn is_empty(&self) -> bool {
        self.0.is_empty()
    }
}

impl Json {
    pub fn as_obj(&self) -> Option<&Obj> {
        match self {
            Json::Obj(o) => Some(o),
            _ => None,
        }
    }

    pub fn as_str(&self) -> Option<&str> {
        match self {
            Json::Str(s) => Some(s),
            _ => None,
        }
    }

    /// Valeur de vérité JavaScript.
    pub fn truthy(&self) -> bool {
        match self {
            Json::Null => false,
            Json::Bool(b) => *b,
            Json::Num(x) => !(x.is_nan() || *x == 0.0),
            Json::Str(s) => !s.is_empty(),
            Json::Arr(_) | Json::Obj(_) => true,
        }
    }

    /// `String(v)`.
    pub fn to_js_string(&self) -> String {
        match self {
            Json::Null => "null".into(),
            Json::Bool(b) => b.to_string(),
            Json::Num(x) => number_to_string(*x),
            Json::Str(s) => s.clone(),
            Json::Arr(items) => items
                .iter()
                .map(|item| match item {
                    Json::Null => String::new(),
                    other => other.to_js_string(),
                })
                .collect::<Vec<_>>()
                .join(","),
            Json::Obj(_) => "[object Object]".into(),
        }
    }
}

// ---------------------------------------------------------------------------
// JSON.stringify

pub fn quote_into(out: &mut String, s: &str) {
    out.push('"');
    for c in s.chars() {
        match c {
            '"' => out.push_str("\\\""),
            '\\' => out.push_str("\\\\"),
            '\u{8}' => out.push_str("\\b"),
            '\u{c}' => out.push_str("\\f"),
            '\n' => out.push_str("\\n"),
            '\r' => out.push_str("\\r"),
            '\t' => out.push_str("\\t"),
            c if (c as u32) < 0x20 => out.push_str(&format!("\\u{:04x}", c as u32)),
            c => out.push(c),
        }
    }
    out.push('"');
}

pub fn quote(s: &str) -> String {
    let mut out = String::with_capacity(s.len() + 2);
    quote_into(&mut out, s);
    out
}

fn number_into(out: &mut String, x: f64) {
    if x.is_finite() {
        out.push_str(&number_to_string(x));
    } else {
        out.push_str("null");
    }
}

pub fn stringify_into(out: &mut String, v: &Json) {
    match v {
        Json::Null => out.push_str("null"),
        Json::Bool(b) => out.push_str(if *b { "true" } else { "false" }),
        Json::Num(x) => number_into(out, *x),
        Json::Str(s) => quote_into(out, s),
        Json::Arr(items) => {
            out.push('[');
            for (i, item) in items.iter().enumerate() {
                if i > 0 {
                    out.push(',');
                }
                stringify_into(out, item);
            }
            out.push(']');
        }
        Json::Obj(obj) => {
            out.push('{');
            for (i, (k, item)) in obj.iter().enumerate() {
                if i > 0 {
                    out.push(',');
                }
                quote_into(out, k);
                out.push(':');
                stringify_into(out, item);
            }
            out.push('}');
        }
    }
}

pub fn stringify(v: &Json) -> String {
    let mut out = String::new();
    stringify_into(&mut out, v);
    out
}

/// `JSON.stringify` d'une valeur lue par postgrest-js (`JSON.parse`) : nombres en
/// double, clés d'index de tableau d'abord.
pub fn stringify_value_into(out: &mut String, v: &Value) {
    match v {
        Value::Null => out.push_str("null"),
        Value::Bool(b) => out.push_str(if *b { "true" } else { "false" }),
        Value::Number(n) => number_into(out, number_as_f64(n)),
        Value::String(s) => quote_into(out, s),
        Value::Array(items) => {
            out.push('[');
            for (i, item) in items.iter().enumerate() {
                if i > 0 {
                    out.push(',');
                }
                stringify_value_into(out, item);
            }
            out.push(']');
        }
        Value::Object(map) => {
            out.push('{');
            let mut keys: Vec<&String> = map.keys().collect();
            if keys.iter().any(|k| array_index(k).is_some()) {
                keys.sort_by_key(|k| match array_index(k) {
                    Some(i) => (0, i),
                    None => (1, 0),
                });
            }
            for (i, k) in keys.into_iter().enumerate() {
                if i > 0 {
                    out.push(',');
                }
                quote_into(out, k);
                out.push(':');
                stringify_value_into(out, &map[k]);
            }
            out.push('}');
        }
    }
}

pub fn stringify_value(v: &Value) -> String {
    let mut out = String::new();
    stringify_value_into(&mut out, v);
    out
}

// ---------------------------------------------------------------------------
// JSON.parse (port de v8/src/json/json-parser.cc)

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum Tok {
    Str,
    Num,
    True,
    False,
    Null,
    Ws,
    Colon,
    Comma,
    LBrack,
    LBrace,
    RBrack,
    RBrace,
    Illegal,
    Eos,
}

fn one_char_token(c: u16) -> Tok {
    match c {
        0x22 => Tok::Str,
        0x30..=0x39 | 0x2d => Tok::Num,
        0x5b => Tok::LBrack,
        0x7b => Tok::LBrace,
        0x5d => Tok::RBrack,
        0x7d => Tok::RBrace,
        0x74 => Tok::True,
        0x66 => Tok::False,
        0x6e => Tok::Null,
        0x20 | 0x09 | 0x0d | 0x0a => Tok::Ws,
        0x3a => Tok::Colon,
        0x2c => Tok::Comma,
        _ => Tok::Illegal,
    }
}

fn is_number_part(c: u16) -> bool {
    matches!(c, 0x2e | 0x65 | 0x45 | 0x30..=0x39 | 0x2d | 0x2b)
}

fn is_digit(c: Option<u16>) -> bool {
    matches!(c, Some(0x30..=0x39))
}

#[derive(Clone, Copy)]
enum Msg {
    UnterminatedString,
    ExpectedPropNameOrRBrace,
    ExpectedCommaOrRBrack,
    ExpectedCommaOrRBrace,
    NonWhitespaceAfter,
    BadEscapedCharacter,
    BadControlCharacter,
    BadUnicodeEscape,
    NoNumberAfterMinusSign,
    ExpectedColonAfterPropertyName,
    UnterminatedFractionalNumber,
    ExponentPartMissingNumber,
    ExpectedDoubleQuotedPropertyName,
}

impl Msg {
    fn text(self) -> &'static str {
        match self {
            Msg::UnterminatedString => "Unterminated string in JSON",
            Msg::ExpectedPropNameOrRBrace => "Expected property name or '}' in JSON",
            Msg::ExpectedCommaOrRBrack => "Expected ',' or ']' after array element in JSON",
            Msg::ExpectedCommaOrRBrace => "Expected ',' or '}' after property value in JSON",
            Msg::NonWhitespaceAfter => "Unexpected non-whitespace character after JSON",
            Msg::BadEscapedCharacter => "Bad escaped character in JSON",
            Msg::BadControlCharacter => "Bad control character in string literal in JSON",
            Msg::BadUnicodeEscape => "Bad Unicode escape in JSON",
            Msg::NoNumberAfterMinusSign => "No number after minus sign in JSON",
            Msg::ExpectedColonAfterPropertyName => "Expected ':' after property name in JSON",
            Msg::UnterminatedFractionalNumber => "Unterminated fractional number in JSON",
            Msg::ExponentPartMissingNumber => "Exponent part is missing a number in JSON",
            Msg::ExpectedDoubleQuotedPropertyName => "Expected double-quoted property name in JSON",
        }
    }
}

const MAX_CONTEXT: usize = 10;
const MIN_LENGTH_FOR_CONTEXT: usize = MAX_CONTEXT * 2 + 1;

/// Erreur `SyntaxError` de `JSON.parse` ; `message` est celui de V8.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct SyntaxError {
    pub message: String,
}

struct Parser<'a> {
    s: &'a [u16],
    i: usize,
}

enum Cont {
    Arr(Vec<Json>),
    Obj(Obj, String),
}

impl Parser<'_> {
    fn cur(&self) -> Option<u16> {
        self.s.get(self.i).copied()
    }

    fn next_char(&mut self) -> Option<u16> {
        self.i += 1;
        self.cur()
    }

    fn peek(&self) -> Tok {
        self.cur().map_or(Tok::Eos, one_char_token)
    }

    fn skip_ws(&mut self) {
        while self.peek() == Tok::Ws {
            self.i += 1;
        }
    }

    fn check(&mut self, t: Tok) -> bool {
        self.skip_ws();
        if self.peek() == t {
            self.i += 1;
            true
        } else {
            false
        }
    }

    fn expect(&mut self, t: Tok, msg: Msg) -> Result<(), SyntaxError> {
        if self.peek() == t {
            self.i += 1;
            Ok(())
        } else {
            Err(self.report(self.peek(), Some(msg)))
        }
    }

    fn expect_next(&mut self, t: Tok, msg: Msg) -> Result<(), SyntaxError> {
        self.skip_ws();
        self.expect(t, msg)
    }

    fn location(&self) -> (usize, usize) {
        let mut line = 1;
        let mut last_break = 0;
        let end = self.i.min(self.s.len());
        let mut c = 0;
        while c < end {
            if self.s[c] == 0x0d && c + 1 < end && self.s[c + 1] == 0x0a {
                c += 1;
            }
            if self.s[c] == 0x0d || self.s[c] == 0x0a {
                line += 1;
                last_break = c + 1;
            }
            c += 1;
        }
        (line, 1 + c - last_break)
    }

    fn is_special_string(&self) -> bool {
        ["[object Object]", "undefined", "Infinity", "NaN"]
            .iter()
            .any(|special| special.encode_utf16().eq(self.s.iter().copied()))
    }

    fn report_char(&self, c: Option<u16>) -> SyntaxError {
        let t = match c {
            None => Tok::Eos,
            Some(c) if c <= 0xff => one_char_token(c),
            Some(_) => Tok::Illegal,
        };
        self.report(t, None)
    }

    fn report(&self, t: Tok, msg: Option<Msg>) -> SyntaxError {
        let pos = self.i;
        let (line, column) = self.location();
        let at = format!("at position {pos} (line {line} column {column})");
        let message = match (msg, t) {
            (Some(m), _) => format!("{} {at}", m.text()),
            (None, Tok::Eos) => "Unexpected end of JSON input".to_owned(),
            (None, Tok::Num) => format!("Unexpected number in JSON {at}"),
            (None, Tok::Str) => format!("Unexpected string in JSON {at}"),
            (None, _) => {
                let whole = String::from_utf16_lossy(self.s);
                if self.is_special_string() {
                    format!("\"{whole}\" is not valid JSON")
                } else {
                    let token = String::from_utf16_lossy(&self.s[pos..(pos + 1).min(self.s.len())]);
                    let len = self.s.len();
                    if len < MIN_LENGTH_FOR_CONTEXT {
                        format!("Unexpected token '{token}', \"{whole}\" is not valid JSON")
                    } else if pos < MAX_CONTEXT {
                        let part = String::from_utf16_lossy(&self.s[..(pos + MAX_CONTEXT).min(len)]);
                        format!("Unexpected token '{token}', \"{part}\"... is not valid JSON")
                    } else if pos < len - MAX_CONTEXT {
                        let part = String::from_utf16_lossy(&self.s[pos - MAX_CONTEXT..pos + MAX_CONTEXT]);
                        format!("Unexpected token '{token}', ...\"{part}\"... is not valid JSON")
                    } else {
                        let part = String::from_utf16_lossy(&self.s[pos - MAX_CONTEXT..]);
                        format!("Unexpected token '{token}', ...\"{part}\" is not valid JSON")
                    }
                }
            }
        };
        SyntaxError { message }
    }

    fn scan_literal(&mut self, lit: &[u8]) -> Result<(), SyntaxError> {
        let n = lit.len();
        let remaining = self.s.len() - self.i;
        if remaining >= n
            && lit[1..]
                .iter()
                .zip(&self.s[self.i + 1..self.i + n])
                .all(|(a, b)| u16::from(*a) == *b)
        {
            self.i += n;
            return Ok(());
        }
        self.i += 1;
        for k in 0..(n - 1).min(remaining - 1) {
            if u16::from(lit[1 + k]) != self.s[self.i] {
                return Err(self.report_char(self.cur()));
            }
            self.i += 1;
        }
        Err(self.report(Tok::Eos, None))
    }

    fn advance_to_non_decimal(&mut self) {
        while is_digit(self.cur()) {
            self.i += 1;
        }
    }

    fn parse_number(&mut self) -> Result<f64, SyntaxError> {
        let start = self.i;
        let mut c = self.cur();
        let mut negative = false;
        if c == Some(0x2d) {
            negative = true;
            c = self.next_char();
        }
        if c == Some(0x30) {
            c = self.next_char();
            match c {
                Some(d) if d <= 0xff && is_number_part(d) => {
                    if is_digit(c) {
                        return Err(self.report(Tok::Num, None));
                    }
                }
                _ if !negative => return Ok(0.0),
                _ => {}
            }
        } else {
            let smi_start = self.i;
            let stop = (self.i + 9).min(self.s.len());
            while self.i < stop && is_digit(self.cur()) {
                self.i += 1;
            }
            if smi_start == self.i {
                return Err(self.report(Tok::Illegal, Some(Msg::NoNumberAfterMinusSign)));
            }
            match self.cur() {
                Some(d) if d <= 0xff && is_number_part(d) => self.advance_to_non_decimal(),
                _ => return Ok(self.number_from(start)),
            }
        }
        if self.cur() == Some(0x2e) {
            let c = self.next_char();
            if !is_digit(c) {
                return Err(self.report(Tok::Illegal, Some(Msg::UnterminatedFractionalNumber)));
            }
            self.advance_to_non_decimal();
        }
        if matches!(self.cur(), Some(0x65 | 0x45)) {
            let mut c = self.next_char();
            if matches!(c, Some(0x2d | 0x2b)) {
                c = self.next_char();
            }
            if !is_digit(c) {
                return Err(self.report(Tok::Illegal, Some(Msg::ExponentPartMissingNumber)));
            }
            self.advance_to_non_decimal();
        }
        Ok(self.number_from(start))
    }

    fn number_from(&self, start: usize) -> f64 {
        let text: String = self.s[start..self.i].iter().map(|u| *u as u8 as char).collect();
        text.parse::<f64>().unwrap_or(f64::NAN)
    }

    /// Le guillemet ouvrant est déjà consommé.
    fn scan_string(&mut self) -> Result<String, SyntaxError> {
        let mut out: Vec<u16> = Vec::new();
        loop {
            let start = self.i;
            while let Some(c) = self.cur() {
                if c < 0x20 || c == 0x22 || c == 0x5c {
                    break;
                }
                self.i += 1;
            }
            out.extend_from_slice(&self.s[start..self.i]);
            let Some(c) = self.cur() else {
                return Err(self.report(Tok::Illegal, Some(Msg::UnterminatedString)));
            };
            if c == 0x22 {
                self.i += 1;
                return Ok(String::from_utf16_lossy(&out));
            }
            if c == 0x5c {
                let c = self.next_char();
                let Some(e) = c.filter(|e| *e <= 0xff) else {
                    return Err(self.report_char(c));
                };
                match e {
                    0x62 => out.push(0x08),
                    0x74 => out.push(0x09),
                    0x6e => out.push(0x0a),
                    0x66 => out.push(0x0c),
                    0x72 => out.push(0x0d),
                    0x22 | 0x5c | 0x2f => out.push(e),
                    0x75 => {
                        let mut value: u16 = 0;
                        for _ in 0..4 {
                            let digit = self
                                .next_char()
                                .and_then(|d| char::from_u32(u32::from(d)))
                                .and_then(|d| d.to_digit(16));
                            let Some(digit) = digit else {
                                return Err(self.report(Tok::Illegal, Some(Msg::BadUnicodeEscape)));
                            };
                            value = value * 16 + digit as u16;
                        }
                        out.push(value);
                    }
                    _ => return Err(self.report(Tok::Illegal, Some(Msg::BadEscapedCharacter))),
                }
                self.i += 1;
                continue;
            }
            return Err(self.report(Tok::Illegal, Some(Msg::BadControlCharacter)));
        }
    }

    fn parse_value(&mut self) -> Result<Json, SyntaxError> {
        let mut stack: Vec<Cont> = Vec::new();
        loop {
            let mut value = loop {
                self.skip_ws();
                match self.peek() {
                    Tok::Str => {
                        self.i += 1;
                        break Json::Str(self.scan_string()?);
                    }
                    Tok::Num => break Json::Num(self.parse_number()?),
                    Tok::LBrace => {
                        self.i += 1;
                        if self.check(Tok::RBrace) {
                            break Json::Obj(Obj::new());
                        }
                        self.expect_next(Tok::Str, Msg::ExpectedPropNameOrRBrace)?;
                        let key = self.scan_string()?;
                        self.expect_next(Tok::Colon, Msg::ExpectedColonAfterPropertyName)?;
                        stack.push(Cont::Obj(Obj::new(), key));
                    }
                    Tok::LBrack => {
                        self.i += 1;
                        if self.check(Tok::RBrack) {
                            break Json::Arr(Vec::new());
                        }
                        stack.push(Cont::Arr(Vec::new()));
                    }
                    Tok::True => {
                        self.scan_literal(b"true")?;
                        break Json::Bool(true);
                    }
                    Tok::False => {
                        self.scan_literal(b"false")?;
                        break Json::Bool(false);
                    }
                    Tok::Null => {
                        self.scan_literal(b"null")?;
                        break Json::Null;
                    }
                    t => return Err(self.report(t, None)),
                }
            };
            loop {
                match stack.last_mut() {
                    None => return Ok(value),
                    Some(Cont::Obj(obj, key)) => {
                        obj.insert(std::mem::take(key), value);
                        if self.check(Tok::Comma) {
                            self.expect_next(Tok::Str, Msg::ExpectedDoubleQuotedPropertyName)?;
                            *key = self.scan_string()?;
                            self.expect_next(Tok::Colon, Msg::ExpectedColonAfterPropertyName)?;
                            break;
                        }
                        self.expect(Tok::RBrace, Msg::ExpectedCommaOrRBrace)?;
                        let Some(Cont::Obj(obj, _)) = stack.pop() else {
                            unreachable!()
                        };
                        value = Json::Obj(obj);
                    }
                    Some(Cont::Arr(items)) => {
                        items.push(value);
                        if self.check(Tok::Comma) {
                            break;
                        }
                        self.expect(Tok::RBrack, Msg::ExpectedCommaOrRBrack)?;
                        let Some(Cont::Arr(items)) = stack.pop() else {
                            unreachable!()
                        };
                        value = Json::Arr(items);
                    }
                }
            }
        }
    }
}

/// `JSON.parse(text)` sur des unités UTF-16.
pub fn parse_utf16(s: &[u16]) -> Result<Json, SyntaxError> {
    let mut p = Parser { s, i: 0 };
    let value = p.parse_value()?;
    if !p.check(Tok::Eos) {
        return Err(p.report(p.peek(), Some(Msg::NonWhitespaceAfter)));
    }
    Ok(value)
}

/// `JSON.parse(text)`.
pub fn parse(text: &str) -> Result<Json, SyntaxError> {
    let units: Vec<u16> = text.encode_utf16().collect();
    parse_utf16(&units)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn err(s: &str) -> String {
        parse(s).unwrap_err().message
    }

    #[test]
    fn messages_seen_on_node() {
        assert_eq!(
            err("{bad"),
            "Expected property name or '}' in JSON at position 1 (line 1 column 2)"
        );
        assert_eq!(
            err("not json"),
            "Unexpected token 'o', \"not json\" is not valid JSON"
        );
        assert_eq!(err(""), "Unexpected end of JSON input");
    }

    #[test]
    fn js_key_order_and_numbers() {
        let v = parse(r#"{"b":1,"1":2,"0":3,"b":4,"x":1e400,"y":-0,"z":1.50}"#).unwrap();
        assert_eq!(stringify(&v), r#"{"0":3,"1":2,"b":4,"x":null,"y":0,"z":1.5}"#);
    }

    #[test]
    fn escapes_like_stringify() {
        assert_eq!(quote("a\"\\\u{1}\n\u{7f}é"), "\"a\\\"\\\\\\u0001\\n\u{7f}é\"");
    }
}
