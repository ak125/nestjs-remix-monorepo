//! Sémantique JavaScript dont dépend la sortie du chemin legacy
//! (`VehicleModelsService.getModelsByBrand`) : `parseInt`, `String()`,
//! `trim()`, valeur de vérité, `Number#toString` et égalité des `Set`.

use std::collections::HashSet;

use serde_json::{Number, Value};

/// `StrWhiteSpaceChar` d'ECMAScript (WhiteSpace + LineTerminator), utilisé par
/// `parseInt` et `String#trim`. Diffère de `char::is_whitespace` (U+0085, U+FEFF).
pub fn is_js_whitespace(c: char) -> bool {
    matches!(
        c,
        '\u{0009}'..='\u{000D}'
            | '\u{0020}'
            | '\u{00A0}'
            | '\u{1680}'
            | '\u{2000}'..='\u{200A}'
            | '\u{2028}'
            | '\u{2029}'
            | '\u{202F}'
            | '\u{205F}'
            | '\u{3000}'
            | '\u{FEFF}'
    )
}

/// `!s.trim()` en JavaScript.
pub fn trims_to_empty(s: &str) -> bool {
    s.chars().all(is_js_whitespace)
}

/// `parseInt(s, radix)` ; `radix = None` reproduit l'appel sans second argument
/// (préfixe `0x` accepté).
pub fn parse_int(s: &str, radix: Option<u32>) -> f64 {
    let s = s.trim_start_matches(is_js_whitespace);
    let (negative, s) = match s.as_bytes().first() {
        Some(b'-') => (true, &s[1..]),
        Some(b'+') => (false, &s[1..]),
        _ => (false, s),
    };
    let mut radix = radix.unwrap_or(0);
    let mut strip_prefix = true;
    if radix != 0 {
        if !(2..=36).contains(&radix) {
            return f64::NAN;
        }
        if radix != 16 {
            strip_prefix = false;
        }
    } else {
        radix = 10;
    }
    let mut s = s;
    if strip_prefix && (s.starts_with("0x") || s.starts_with("0X")) {
        s = &s[2..];
        radix = 16;
    }
    let end = s.find(|c: char| !c.is_digit(radix)).unwrap_or(s.len());
    let digits = &s[..end];
    if digits.is_empty() {
        return f64::NAN;
    }
    let magnitude = if radix == 10 {
        // Chiffres ASCII seuls : l'analyse arrondie au plus proche ne peut échouer.
        digits.parse::<f64>().unwrap_or(f64::NAN)
    } else {
        digits.chars().fold(0.0, |acc, c| {
            acc * f64::from(radix) + f64::from(c.to_digit(radix).unwrap_or(0))
        })
    };
    if negative { -magnitude } else { magnitude }
}

/// `Number.prototype.toString()` (base 10).
pub fn number_to_string(x: f64) -> String {
    if x.is_nan() {
        return "NaN".to_owned();
    }
    if x == 0.0 {
        return "0".to_owned();
    }
    if x.is_infinite() {
        return if x > 0.0 { "Infinity" } else { "-Infinity" }.to_owned();
    }
    if x < 0.0 {
        return format!("-{}", number_to_string(-x));
    }
    // `{:e}` donne les chiffres significatifs les plus courts qui
    // reconstruisent la valeur, comme l'exige l'algorithme ECMAScript.
    let sci = format!("{x:e}");
    let (mantissa, exponent) = sci.split_once('e').unwrap_or((&sci, "0"));
    let digits: String = mantissa.chars().filter(char::is_ascii_digit).collect();
    let k = digits.len() as i32;
    let n = exponent.parse::<i32>().unwrap_or(0) + 1;
    if k <= n && n <= 21 {
        format!("{digits}{}", "0".repeat((n - k) as usize))
    } else if 0 < n && n <= 21 {
        let (int, frac) = digits.split_at(n as usize);
        format!("{int}.{frac}")
    } else if -6 < n && n <= 0 {
        format!("0.{}{digits}", "0".repeat((-n) as usize))
    } else {
        let e = n - 1;
        let sign = if e < 0 { '-' } else { '+' };
        let (first, rest) = digits.split_at(1);
        if rest.is_empty() {
            format!("{first}e{sign}{}", e.abs())
        } else {
            format!("{first}.{rest}e{sign}{}", e.abs())
        }
    }
}

/// `String(v)` ; `None` représente `undefined` (clé absente).
pub fn to_js_string(v: Option<&Value>) -> String {
    match v {
        None => "undefined".to_owned(),
        Some(Value::Null) => "null".to_owned(),
        Some(Value::Bool(b)) => b.to_string(),
        Some(Value::Number(n)) => number_to_string(number_as_f64(n)),
        Some(Value::String(s)) => s.clone(),
        Some(Value::Array(items)) => items
            .iter()
            .map(|item| match item {
                Value::Null => String::new(),
                other => to_js_string(Some(other)),
            })
            .collect::<Vec<_>>()
            .join(","),
        Some(Value::Object(_)) => "[object Object]".to_owned(),
    }
}

/// Valeur d'un nombre JSON après `JSON.parse` (double IEEE 754).
pub fn number_as_f64(n: &Number) -> f64 {
    n.as_f64().unwrap_or(f64::NAN)
}

/// Valeur de vérité JavaScript ; `None` représente `undefined`.
pub fn truthy(v: Option<&Value>) -> bool {
    match v {
        None | Some(Value::Null) => false,
        Some(Value::Bool(b)) => *b,
        Some(Value::Number(n)) => number_truthy(number_as_f64(n)),
        Some(Value::String(s)) => !s.is_empty(),
        Some(Value::Array(_) | Value::Object(_)) => true,
    }
}

pub fn number_truthy(x: f64) -> bool {
    !(x.is_nan() || x == 0.0)
}

/// Nombre JavaScript tel que `JSON.stringify` l'écrirait (`Infinity` → `null`).
pub fn number_value(x: f64) -> Value {
    if !x.is_finite() {
        return Value::Null;
    }
    if x.fract() == 0.0 && x.abs() <= 9_007_199_254_740_992.0 {
        return Value::from(x as i64);
    }
    Number::from_f64(x).map_or(Value::Null, Value::Number)
}

/// Clé d'égalité SameValueZero (`Set`) : NaN égal à NaN, -0 égal à 0.
fn number_key(x: f64) -> u64 {
    if x.is_nan() {
        0x7ff8_0000_0000_0000
    } else if x == 0.0 {
        0
    } else {
        x.to_bits()
    }
}

/// `[...new Set(values)]` pour des nombres.
pub fn dedup_numbers(values: impl IntoIterator<Item = f64>) -> Vec<f64> {
    let mut seen = HashSet::new();
    values
        .into_iter()
        .filter(|x| seen.insert(number_key(*x)))
        .collect()
}

/// Ensemble JavaScript (`Set`) de valeurs JSON : égalité SameValueZero pour
/// les primitives, par référence pour les objets et tableaux (jamais égaux).
#[derive(Debug, Default)]
pub struct JsSet {
    null: bool,
    bools: [bool; 2],
    numbers: HashSet<u64>,
    strings: HashSet<String>,
}

impl JsSet {
    /// `set.add(v)` ; vrai si la valeur n'y était pas.
    pub fn insert(&mut self, v: &Value) -> bool {
        match v {
            Value::Null => !std::mem::replace(&mut self.null, true),
            Value::Bool(b) => !std::mem::replace(&mut self.bools[usize::from(*b)], true),
            Value::Number(n) => self.numbers.insert(number_key(number_as_f64(n))),
            Value::String(s) => self.insert_str(s),
            Value::Array(_) | Value::Object(_) => true,
        }
    }

    /// `insert` d'une chaîne, sans construire de `Value`.
    pub fn insert_str(&mut self, s: &str) -> bool {
        if self.strings.contains(s) {
            return false;
        }
        self.strings.insert(s.to_owned());
        true
    }
}

/// `[...new Set(values)]` pour des valeurs JSON.
pub fn dedup_values<'a>(values: impl IntoIterator<Item = &'a Value>) -> Vec<Value> {
    let mut seen = JsSet::default();
    values.into_iter().filter(|v| seen.insert(v)).cloned().collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn parse_int_matches_ecmascript() {
        assert_eq!(parse_int("2010", Some(10)), 2010.0);
        assert_eq!(parse_int("  \u{FEFF}\u{3000}42abc", Some(10)), 42.0);
        assert_eq!(parse_int("+7", Some(10)), 7.0);
        assert_eq!(parse_int("-12", Some(10)), -12.0);
        assert!(parse_int("-0", Some(10)).is_sign_negative());
        assert!(parse_int("null", Some(10)).is_nan());
        assert!(parse_int("undefined", Some(10)).is_nan());
        assert!(parse_int("", Some(10)).is_nan());
        assert!(parse_int("\u{0085}5", Some(10)).is_nan());
        assert!(parse_int("0x1A", Some(10)) == 0.0);
        assert_eq!(parse_int("0x1A", None), 26.0);
        assert_eq!(parse_int("1.9e3", Some(10)), 1.0);
        assert_eq!(parse_int("123", None), 123.0);
        assert!(parse_int(&"9".repeat(400), Some(10)).is_infinite());
    }

    #[test]
    fn number_to_string_matches_ecmascript() {
        let cases = [
            (0.0, "0"),
            (-0.0, "0"),
            (5.0, "5"),
            (-5.0, "-5"),
            (1.5, "1.5"),
            (0.1, "0.1"),
            (0.000001, "0.000001"),
            (0.0000001, "1e-7"),
            (123e-20, "1.23e-18"),
            (1e21, "1e+21"),
            (1.5e300, "1.5e+300"),
            (4_611_686_014_132_420_609.0, "4611686014132420600"),
            (2_147_483_647.0, "2147483647"),
            (f64::NAN, "NaN"),
            (f64::INFINITY, "Infinity"),
        ];
        for (x, expected) in cases {
            assert_eq!(number_to_string(x), expected, "{x}");
        }
    }

    #[test]
    fn string_conversion_matches_ecmascript() {
        assert_eq!(to_js_string(None), "undefined");
        assert_eq!(to_js_string(Some(&json!(null))), "null");
        assert_eq!(to_js_string(Some(&json!(12))), "12");
        assert_eq!(to_js_string(Some(&json!(12.0))), "12");
        assert_eq!(to_js_string(Some(&json!("12"))), "12");
        assert_eq!(to_js_string(Some(&json!([1, null, "a"]))), "1,,a");
        assert_eq!(to_js_string(Some(&json!({"a": 1}))), "[object Object]");
    }

    #[test]
    fn truthiness_and_trim() {
        assert!(!truthy(None));
        assert!(!truthy(Some(&json!(""))));
        assert!(!truthy(Some(&json!(0))));
        assert!(!truthy(Some(&json!(false))));
        assert!(truthy(Some(&json!("0"))));
        assert!(truthy(Some(&json!([]))));
        assert!(trims_to_empty(" \u{2028}\u{00A0}"));
        assert!(!trims_to_empty("\u{0085}"));
    }

    #[test]
    fn set_semantics() {
        assert_eq!(dedup_numbers([1.0, f64::NAN, f64::NAN, -0.0, 0.0, 1.0]).len(), 3);
        let values = [
            json!("Diesel"),
            json!("Diesel"),
            json!(1),
            json!(1.0),
            json!({}),
            json!({}),
        ];
        assert_eq!(
            dedup_values(values.iter()),
            vec![json!("Diesel"), json!(1), json!({}), json!({})]
        );
        let mut set = JsSet::default();
        assert!(set.insert(&json!(null)) && !set.insert(&json!(null)));
        assert!(set.insert(&json!(false)) && set.insert(&json!(true)) && !set.insert(&json!(false)));
        assert!(set.insert(&json!(-0.0)) && !set.insert(&json!(0)));
        assert!(set.insert_str("1") && !set.insert(&json!("1")) && set.insert(&json!(1)));
        assert!(set.insert(&json!([])) && set.insert(&json!([])));
    }

    #[test]
    fn number_value_matches_json_stringify() {
        assert_eq!(number_value(12.0), json!(12));
        assert_eq!(number_value(f64::INFINITY), json!(null));
        assert_eq!(number_value(1.5), json!(1.5));
    }
}
