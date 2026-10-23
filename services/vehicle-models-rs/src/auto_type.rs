//! Étapes 3 et 4 de `getModelsByBrand` (regroupement des types par modèle,
//! filtre d'année, carburants) calculées pendant l'analyse de chaque lot
//! `auto_type`, sans construire l'arbre `Value` des lignes.
//!
//! La sortie est celle du portage v1 (`JSON.parse` puis `String()`,
//! `parseInt`, valeur de vérité et `Set` JavaScript) : les valeurs passent par
//! les mêmes visiteurs que `serde_json::Value` et les champs ignorés sont lus
//! avec la même validation (nombres hors plage, profondeur maximale), donc un
//! lot refusé par `JSON.parse` l'est aussi ici.

use std::borrow::Cow;
use std::collections::HashMap;
use std::fmt;

use serde::de::{self, DeserializeSeed, Deserializer, MapAccess, SeqAccess, Visitor};
use serde_json::{Map, Number, Value};

use crate::js;

/// Forme du `data` d'un lot, telle que l'étape 2 la teste.
#[derive(Debug, PartialEq)]
pub enum Batch {
    /// `!data` : fin de la pagination.
    Falsy,
    /// Valeur vraie qui n'est pas un tableau.
    NonArray,
    /// Tableau de `n` éléments, tous pris en compte dans les groupes.
    Rows(usize),
}

/// Types d'un même `type_modele_id?.toString()`.
#[derive(Debug)]
pub struct Group {
    pub key: String,
    /// Nombre de lignes objet (`motorisationsCount`).
    pub types: usize,
    /// Au moins une ligne couvre l'année demandée (sans objet sans année).
    pub matches_year: bool,
    /// `[...new Set(types.map(t => t.type_fuel).filter(Boolean))]`.
    pub fuels: Vec<Value>,
    seen_fuels: js::JsSet,
}

/// Groupes dans l'ordre de première apparition, comme l'objet `typesByModel`.
pub struct Groups {
    year: Option<f64>,
    index: HashMap<String, usize>,
    groups: Vec<Group>,
    /// Une ligne `null` a été lue : le portage la refuse après la pagination.
    pub null_row: bool,
}

struct Row<'de> {
    key: Option<Cow<'de, str>>,
    year_from: f64,
    year_to: f64,
    /// `None` : clé absente (`undefined`).
    fuel: Option<Fuel<'de>>,
}

enum Fuel<'de> {
    Str(Cow<'de, str>),
    Other(Value),
}

impl Groups {
    pub fn new(year: Option<f64>) -> Self {
        Self {
            year,
            index: HashMap::new(),
            groups: Vec::new(),
            null_row: false,
        }
    }

    pub fn iter(&self) -> impl Iterator<Item = &Group> {
        self.groups.iter()
    }

    pub fn get(&self, key: &str) -> Option<&Group> {
        self.index.get(key).map(|&i| &self.groups[i])
    }

    fn add(&mut self, row: Row<'_>) {
        // `if (!modelId) return;` après `type_modele_id?.toString()`.
        let Some(key) = row.key.filter(|k| !k.is_empty()) else {
            return;
        };
        let index = match self.index.get(key.as_ref()) {
            Some(&i) => i,
            None => {
                let key = key.into_owned();
                self.groups.push(Group {
                    key: key.clone(),
                    types: 0,
                    matches_year: false,
                    fuels: Vec::new(),
                    seen_fuels: js::JsSet::default(),
                });
                self.index.insert(key, self.groups.len() - 1);
                self.groups.len() - 1
            }
        };
        let group = &mut self.groups[index];
        group.types += 1;
        if let Some(year) = self.year {
            let from = if js::number_truthy(row.year_from) {
                row.year_from
            } else {
                0.0
            };
            let to = if js::number_truthy(row.year_to) {
                row.year_to
            } else {
                9999.0
            };
            group.matches_year |= from <= year && year <= to;
        }
        // Valeur vraie et absente du `Set` : ajoutée dans l'ordre de première apparition.
        match row.fuel {
            Some(Fuel::Str(fuel)) if !fuel.is_empty() && group.seen_fuels.insert_str(&fuel) => {
                group.fuels.push(Value::String(fuel.into_owned()));
            }
            Some(Fuel::Other(fuel)) if js::truthy(Some(&fuel)) && group.seen_fuels.insert(&fuel) => {
                group.fuels.push(fuel);
            }
            _ => {}
        }
    }
}

/// Analyse un corps 2xx `auto_type` et ajoute ses lignes aux groupes.
/// Une erreur d'analyse laisse les groupes partiellement remplis : l'appelant
/// abandonne alors la requête (valeur levée, comme `JSON.parse` en échec).
pub fn parse_batch(text: &str, groups: &mut Groups) -> serde_json::Result<Batch> {
    let mut de = serde_json::Deserializer::from_str(text);
    let batch = BatchSeed { groups }.deserialize(&mut de)?;
    de.end()?;
    Ok(batch)
}

struct BatchSeed<'a> {
    groups: &'a mut Groups,
}

impl<'de> DeserializeSeed<'de> for BatchSeed<'_> {
    type Value = Batch;

    fn deserialize<D: Deserializer<'de>>(self, deserializer: D) -> Result<Batch, D::Error> {
        deserializer.deserialize_any(self)
    }
}

impl<'de> Visitor<'de> for BatchSeed<'_> {
    type Value = Batch;

    fn expecting(&self, f: &mut fmt::Formatter) -> fmt::Result {
        f.write_str("une valeur JSON")
    }

    fn visit_unit<E>(self) -> Result<Batch, E> {
        Ok(Batch::Falsy)
    }

    fn visit_bool<E>(self, v: bool) -> Result<Batch, E> {
        Ok(if v { Batch::NonArray } else { Batch::Falsy })
    }

    fn visit_i64<E>(self, v: i64) -> Result<Batch, E> {
        Ok(if v != 0 { Batch::NonArray } else { Batch::Falsy })
    }

    fn visit_u64<E>(self, v: u64) -> Result<Batch, E> {
        Ok(if v != 0 { Batch::NonArray } else { Batch::Falsy })
    }

    fn visit_f64<E>(self, v: f64) -> Result<Batch, E> {
        // Un flottant non fini deviendrait `null` dans `Value`.
        Ok(if v.is_finite() && js::number_truthy(v) {
            Batch::NonArray
        } else {
            Batch::Falsy
        })
    }

    fn visit_str<E>(self, v: &str) -> Result<Batch, E> {
        Ok(if v.is_empty() {
            Batch::Falsy
        } else {
            Batch::NonArray
        })
    }

    fn visit_map<A: MapAccess<'de>>(self, mut map: A) -> Result<Batch, A::Error> {
        while map.next_entry::<Skip, Skip>()?.is_some() {}
        Ok(Batch::NonArray)
    }

    fn visit_seq<A: SeqAccess<'de>>(self, mut seq: A) -> Result<Batch, A::Error> {
        let mut n = 0;
        while seq
            .next_element_seed(RowSeed {
                groups: &mut *self.groups,
            })?
            .is_some()
        {
            n += 1;
        }
        Ok(Batch::Rows(n))
    }
}

struct RowSeed<'a> {
    groups: &'a mut Groups,
}

impl<'de> DeserializeSeed<'de> for RowSeed<'_> {
    type Value = ();

    fn deserialize<D: Deserializer<'de>>(self, deserializer: D) -> Result<(), D::Error> {
        deserializer.deserialize_any(self)
    }
}

/// Une ligne non objet n'a pas de `type_modele_id` (`undefined`) et ne compte
/// dans aucun groupe ; une ligne `null` est signalée.
impl<'de> Visitor<'de> for RowSeed<'_> {
    type Value = ();

    fn expecting(&self, f: &mut fmt::Formatter) -> fmt::Result {
        f.write_str("une ligne auto_type")
    }

    fn visit_unit<E>(self) -> Result<(), E> {
        self.groups.null_row = true;
        Ok(())
    }

    fn visit_bool<E>(self, _: bool) -> Result<(), E> {
        Ok(())
    }

    fn visit_i64<E>(self, _: i64) -> Result<(), E> {
        Ok(())
    }

    fn visit_u64<E>(self, _: u64) -> Result<(), E> {
        Ok(())
    }

    fn visit_f64<E>(self, _: f64) -> Result<(), E> {
        Ok(())
    }

    fn visit_str<E>(self, _: &str) -> Result<(), E> {
        Ok(())
    }

    fn visit_seq<A: SeqAccess<'de>>(self, mut seq: A) -> Result<(), A::Error> {
        while seq.next_element::<Skip>()?.is_some() {}
        Ok(())
    }

    fn visit_map<A: MapAccess<'de>>(self, mut map: A) -> Result<(), A::Error> {
        let mut row = Row {
            key: None,
            year_from: f64::NAN,
            year_to: f64::NAN,
            fuel: None,
        };
        // Clé répétée : la dernière valeur l'emporte, comme dans `JSON.parse`.
        while let Some(field) = map.next_key::<Field>()? {
            match field {
                Field::ModeleId => row.key = map.next_value_seed(JsText)?,
                Field::YearFrom => row.year_from = parse_year(map.next_value_seed(JsText)?),
                Field::YearTo => row.year_to = parse_year(map.next_value_seed(JsText)?),
                Field::Fuel => row.fuel = Some(map.next_value_seed(FuelSeed)?),
                Field::Other => {
                    map.next_value::<Skip>()?;
                }
            }
        }
        self.groups.add(row);
        Ok(())
    }
}

/// `parseInt(String(v), 10)` ; `null` et `undefined` donnent `NaN`.
fn parse_year(text: Option<Cow<'_, str>>) -> f64 {
    text.map_or(f64::NAN, |t| js::parse_int(&t, Some(10)))
}

enum Field {
    ModeleId,
    YearFrom,
    YearTo,
    Fuel,
    Other,
}

impl<'de> de::Deserialize<'de> for Field {
    fn deserialize<D: Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        deserializer.deserialize_any(FieldVisitor)
    }
}

struct FieldVisitor;

impl Visitor<'_> for FieldVisitor {
    type Value = Field;

    fn expecting(&self, f: &mut fmt::Formatter) -> fmt::Result {
        f.write_str("un nom de colonne")
    }

    fn visit_str<E>(self, v: &str) -> Result<Field, E> {
        Ok(match v {
            "type_modele_id" => Field::ModeleId,
            "type_year_from" => Field::YearFrom,
            "type_year_to" => Field::YearTo,
            "type_fuel" => Field::Fuel,
            _ => Field::Other,
        })
    }
}

/// `String(v)` d'une valeur présente ; `None` pour `null` (et pour un
/// flottant non fini, que `Value` changerait en `null`).
struct JsText;

impl<'de> DeserializeSeed<'de> for JsText {
    type Value = Option<Cow<'de, str>>;

    fn deserialize<D: Deserializer<'de>>(self, deserializer: D) -> Result<Self::Value, D::Error> {
        deserializer.deserialize_any(self)
    }
}

impl<'de> Visitor<'de> for JsText {
    type Value = Option<Cow<'de, str>>;

    fn expecting(&self, f: &mut fmt::Formatter) -> fmt::Result {
        f.write_str("une valeur JSON")
    }

    fn visit_unit<E>(self) -> Result<Self::Value, E> {
        Ok(None)
    }

    fn visit_bool<E>(self, v: bool) -> Result<Self::Value, E> {
        Ok(Some(Cow::Borrowed(if v { "true" } else { "false" })))
    }

    fn visit_i64<E>(self, v: i64) -> Result<Self::Value, E> {
        Ok(Some(Cow::Owned(js::number_to_string(v as f64))))
    }

    fn visit_u64<E>(self, v: u64) -> Result<Self::Value, E> {
        Ok(Some(Cow::Owned(js::number_to_string(v as f64))))
    }

    fn visit_f64<E>(self, v: f64) -> Result<Self::Value, E> {
        Ok(v.is_finite().then(|| Cow::Owned(js::number_to_string(v))))
    }

    fn visit_borrowed_str<E>(self, v: &'de str) -> Result<Self::Value, E> {
        Ok(Some(Cow::Borrowed(v)))
    }

    fn visit_str<E>(self, v: &str) -> Result<Self::Value, E> {
        Ok(Some(Cow::Owned(v.to_owned())))
    }

    fn visit_string<E>(self, v: String) -> Result<Self::Value, E> {
        Ok(Some(Cow::Owned(v)))
    }

    fn visit_seq<A: SeqAccess<'de>>(self, seq: A) -> Result<Self::Value, A::Error> {
        let items = collect_array(seq)?;
        Ok(Some(Cow::Owned(js::to_js_string(Some(&items)))))
    }

    fn visit_map<A: MapAccess<'de>>(self, mut map: A) -> Result<Self::Value, A::Error> {
        while map.next_entry::<Skip, Skip>()?.is_some() {}
        Ok(Some(Cow::Borrowed("[object Object]")))
    }
}

/// `type_fuel` présent : chaîne empruntée quand c'est possible, sinon la
/// `Value` que `serde_json` aurait construite.
struct FuelSeed;

impl<'de> DeserializeSeed<'de> for FuelSeed {
    type Value = Fuel<'de>;

    fn deserialize<D: Deserializer<'de>>(self, deserializer: D) -> Result<Self::Value, D::Error> {
        deserializer.deserialize_any(self)
    }
}

impl<'de> Visitor<'de> for FuelSeed {
    type Value = Fuel<'de>;

    fn expecting(&self, f: &mut fmt::Formatter) -> fmt::Result {
        f.write_str("une valeur JSON")
    }

    fn visit_unit<E>(self) -> Result<Self::Value, E> {
        Ok(Fuel::Other(Value::Null))
    }

    fn visit_bool<E>(self, v: bool) -> Result<Self::Value, E> {
        Ok(Fuel::Other(Value::Bool(v)))
    }

    fn visit_i64<E>(self, v: i64) -> Result<Self::Value, E> {
        Ok(Fuel::Other(Value::Number(v.into())))
    }

    fn visit_u64<E>(self, v: u64) -> Result<Self::Value, E> {
        Ok(Fuel::Other(Value::Number(v.into())))
    }

    fn visit_f64<E>(self, v: f64) -> Result<Self::Value, E> {
        Ok(Fuel::Other(
            Number::from_f64(v).map_or(Value::Null, Value::Number),
        ))
    }

    fn visit_borrowed_str<E>(self, v: &'de str) -> Result<Self::Value, E> {
        Ok(Fuel::Str(Cow::Borrowed(v)))
    }

    fn visit_str<E>(self, v: &str) -> Result<Self::Value, E> {
        Ok(Fuel::Str(Cow::Owned(v.to_owned())))
    }

    fn visit_string<E>(self, v: String) -> Result<Self::Value, E> {
        Ok(Fuel::Str(Cow::Owned(v)))
    }

    fn visit_seq<A: SeqAccess<'de>>(self, seq: A) -> Result<Self::Value, A::Error> {
        Ok(Fuel::Other(collect_array(seq)?))
    }

    fn visit_map<A: MapAccess<'de>>(self, mut map: A) -> Result<Self::Value, A::Error> {
        // Comme le visiteur de `Value` : insertion, la dernière clé répétée l'emporte.
        let mut object = Map::new();
        while let Some((key, value)) = map.next_entry::<String, Value>()? {
            object.insert(key, value);
        }
        Ok(Fuel::Other(Value::Object(object)))
    }
}

fn collect_array<'de, A: SeqAccess<'de>>(mut seq: A) -> Result<Value, A::Error> {
    let mut items = Vec::new();
    while let Some(item) = seq.next_element::<Value>()? {
        items.push(item);
    }
    Ok(Value::Array(items))
}

/// Valeur lue puis oubliée, par `deserialize_any` comme `Value` (mêmes erreurs
/// de nombre et de profondeur), sans allocation.
struct Skip;

impl<'de> de::Deserialize<'de> for Skip {
    fn deserialize<D: Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        deserializer.deserialize_any(Skip)
    }
}

impl<'de> Visitor<'de> for Skip {
    type Value = Skip;

    fn expecting(&self, f: &mut fmt::Formatter) -> fmt::Result {
        f.write_str("une valeur JSON")
    }

    fn visit_unit<E>(self) -> Result<Skip, E> {
        Ok(Skip)
    }

    fn visit_bool<E>(self, _: bool) -> Result<Skip, E> {
        Ok(Skip)
    }

    fn visit_i64<E>(self, _: i64) -> Result<Skip, E> {
        Ok(Skip)
    }

    fn visit_u64<E>(self, _: u64) -> Result<Skip, E> {
        Ok(Skip)
    }

    fn visit_f64<E>(self, _: f64) -> Result<Skip, E> {
        Ok(Skip)
    }

    fn visit_str<E>(self, _: &str) -> Result<Skip, E> {
        Ok(Skip)
    }

    fn visit_seq<A: SeqAccess<'de>>(self, mut seq: A) -> Result<Skip, A::Error> {
        while seq.next_element::<Skip>()?.is_some() {}
        Ok(Skip)
    }

    fn visit_map<A: MapAccess<'de>>(self, mut map: A) -> Result<Skip, A::Error> {
        while map.next_entry::<Skip, Skip>()?.is_some() {}
        Ok(Skip)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Oracle : étapes 3, 4 et enrichissement du portage v1, sur `Value`.
    #[derive(Debug, PartialEq)]
    struct Expected {
        batch: Batch,
        null_row: bool,
        /// (clé, nombre de types, année couverte, carburants sérialisés)
        groups: Vec<(String, usize, bool, String)>,
    }

    fn oracle(text: &str, year: Option<f64>) -> Option<Expected> {
        let data: Value = serde_json::from_str(text).ok()?;
        let mut expected = Expected {
            batch: Batch::Falsy,
            null_row: false,
            groups: Vec::new(),
        };
        if !js::truthy(Some(&data)) {
            return Some(expected);
        }
        let Value::Array(rows) = data else {
            expected.batch = Batch::NonArray;
            return Some(expected);
        };
        expected.batch = Batch::Rows(rows.len());
        let mut index: HashMap<String, usize> = HashMap::new();
        let mut groups: Vec<(String, Vec<&Map<String, Value>>)> = Vec::new();
        for t in &rows {
            let t = match t {
                Value::Object(o) => o,
                Value::Null => {
                    expected.null_row = true;
                    continue;
                }
                _ => continue,
            };
            let key = match t.get("type_modele_id") {
                None | Some(Value::Null) => continue,
                Some(v) => js::to_js_string(Some(v)),
            };
            if key.is_empty() {
                continue;
            }
            let i = *index.entry(key.clone()).or_insert_with(|| {
                groups.push((key, Vec::new()));
                groups.len() - 1
            });
            groups[i].1.push(t);
        }
        for (key, types) in &groups {
            let matches = year.is_some_and(|year| {
                types.iter().any(|t| {
                    let from = js::parse_int(&js::to_js_string(t.get("type_year_from")), Some(10));
                    let to = js::parse_int(&js::to_js_string(t.get("type_year_to")), Some(10));
                    let from = if js::number_truthy(from) { from } else { 0.0 };
                    let to = if js::number_truthy(to) { to } else { 9999.0 };
                    from <= year && year <= to
                })
            });
            let fuels = js::dedup_values(
                types
                    .iter()
                    .filter_map(|t| t.get("type_fuel"))
                    .filter(|fuel| js::truthy(Some(*fuel))),
            );
            expected.groups.push((
                key.clone(),
                types.len(),
                matches,
                serde_json::to_string(&fuels).unwrap(),
            ));
        }
        Some(expected)
    }

    fn streamed(text: &str, year: Option<f64>) -> Option<Expected> {
        let mut groups = Groups::new(year);
        let batch = parse_batch(text, &mut groups).ok()?;
        Some(Expected {
            batch,
            null_row: groups.null_row,
            groups: groups
                .iter()
                .map(|g| {
                    let fuels = serde_json::to_string(&g.fuels).unwrap();
                    (g.key.clone(), g.types, g.matches_year, fuels)
                })
                .collect(),
        })
    }

    fn assert_same(text: &str) {
        for year in [None, Some(1995.0), Some(2008.0), Some(2018.0)] {
            assert_eq!(
                streamed(text, year),
                oracle(text, year),
                "année {year:?}, lot {text}"
            );
        }
    }

    #[test]
    fn real_shape_rows() {
        assert_same(
            r#"[{"type_id":1,"type_modele_id":"140001","type_year_from":"2004","type_year_to":"2010","type_fuel":"Diesel"},
                {"type_id":2,"type_modele_id":"140001","type_year_from":"2008","type_year_to":null,"type_fuel":"Essence"},
                {"type_id":3,"type_modele_id":"140002","type_year_from":"1990","type_year_to":"1996","type_fuel":"Diesel"},
                {"type_id":4,"type_modele_id":"140001","type_year_from":"2012","type_year_to":"","type_fuel":"Diesel"}]"#,
        );
    }

    #[test]
    fn falsy_non_array_and_invalid_batches() {
        for text in ["null", "false", "0", "-0", "0.0", "\"\"", "[]", " [ ] "] {
            assert_same(text);
        }
        for text in ["true", "1", "-2.5", "\"x\"", "{}", "{\"a\":[1,{\"b\":2}]}"] {
            assert_same(text);
            assert_eq!(streamed(text, None).unwrap().batch, Batch::NonArray, "{text}");
        }
        // Refus identiques à `JSON.parse` / `Value`, y compris dans un champ ignoré.
        for text in [
            "",
            "[",
            "[{}] x",
            "[{\"type_id\":1e400}]",
            "[{\"type_id\":\"\\ud800\"}]",
            "[{\"type_fuel\":[1,]}]",
            "[{\"type_modele_id\":01}]",
        ] {
            assert_eq!(streamed(text, None), None, "{text}");
            assert_eq!(oracle(text, None), None, "{text}");
        }
        let deep = format!("[{{\"type_id\":{}{}}}]", "[".repeat(200), "]".repeat(200));
        assert_eq!(streamed(&deep, None), None);
        assert_eq!(oracle(&deep, None), None);
    }

    #[test]
    fn null_and_non_object_rows() {
        assert_same(r#"[{"type_modele_id":"1"},null,5,"7",[1],true,{"type_modele_id":"1"}]"#);
        assert!(streamed("[null]", None).unwrap().null_row);
    }

    #[test]
    fn field_value_types_and_duplicates() {
        assert_same(
            r#"[{"type_modele_id":1,"type_fuel":1},{"type_modele_id":1.0,"type_fuel":1.0},
                {"type_modele_id":"1","type_fuel":"1"},{"type_modele_id":[1],"type_fuel":[1]},
                {"type_modele_id":true,"type_fuel":true},{"type_modele_id":{},"type_fuel":{}},
                {"type_modele_id":[null],"type_fuel":{"b":1,"a":2,"b":3}},{"type_modele_id":""},
                {"type_modele_id":"5","type_modele_id":null},{"type_modele_id":null,"type_modele_id":"5"},
                {"type_modele_id":"\u0035","type_fuel":"D\u00e9sel","type_fuel":"Gaz"},
                {"type_fuel":"Diesel","type_modele_id":"5","type_year_from":2010,"type_year_to":2010.9},
                {"type_modele_id":"6","type_year_from":"0x7D0","type_year_to":"1e4"},
                {"type_modele_id":"6","type_year_from":" 2018abc","type_year_to":[2018]},
                {"type_modele_id":-0.0,"type_fuel":-0.0},{"type_modele_id":12345678901234567890}]"#,
        );
    }

    /// Générateur xorshift64 déterministe (pas de dépendance aléatoire).
    struct Rng(u64);

    impl Rng {
        fn next(&mut self) -> u64 {
            self.0 ^= self.0 << 13;
            self.0 ^= self.0 >> 7;
            self.0 ^= self.0 << 17;
            self.0
        }

        fn pick<'a>(&mut self, items: &[&'a str]) -> &'a str {
            items[(self.next() % items.len() as u64) as usize]
        }
    }

    const VALUES: &[&str] = &[
        "null",
        "true",
        "false",
        "0",
        "-0",
        "0.0",
        "1",
        "2",
        "10",
        "2008",
        "-1",
        "1.5",
        "2008.7",
        "1e21",
        "1e-7",
        "18446744073709551615",
        "-9223372036854775808",
        "\"\"",
        "\" \"",
        "\"1\"",
        "\"01\"",
        "\"2\"",
        "\"10\"",
        "\"1995\"",
        "\"2008\"",
        "\"2018\"",
        "\" 2008\"",
        "\"2008abc\"",
        "\"0x10\"",
        "\"abc\"",
        "\"Diesel\"",
        "\"Essence\"",
        "\"D\\u00e9sel\"",
        "\"\\u0032008\"",
        "\"\\\"q\\\"\"",
        "[]",
        "[1]",
        "[null]",
        "[2008]",
        "[1,\"a\"]",
        "[[1,2],3]",
        "{}",
        "{\"a\":1}",
        "{\"a\":1,\"a\":2}",
    ];
    const FIELDS: &[&str] = &[
        "type_modele_id",
        "type_year_from",
        "type_year_to",
        "type_fuel",
        "type_id",
        "type_\\u006dodele_id",
    ];
    const ROWS: &[&str] = &["null", "5", "\"x\"", "[1,{\"type_modele_id\":\"1\"}]", "true"];

    fn random_batch(rng: &mut Rng) -> String {
        let n = rng.next() % 40;
        let mut rows = Vec::new();
        for _ in 0..n {
            if rng.next().is_multiple_of(20) {
                rows.push(rng.pick(ROWS).to_owned());
                continue;
            }
            let k = rng.next() % 7;
            let fields: Vec<String> = (0..k)
                .map(|_| format!("\"{}\": {}", rng.pick(FIELDS), rng.pick(VALUES)))
                .collect();
            rows.push(format!("{{{}}}", fields.join(",")));
        }
        format!("[{}]", rows.join(", "))
    }

    #[test]
    fn differential_against_value_oracle() {
        let mut rng = Rng(0x9E37_79B9_7F4A_7C15);
        for _ in 0..5000 {
            let text = random_batch(&mut rng);
            assert_same(&text);
        }
    }
}
