//! En-têtes de réponse tenus comme `OutgoingMessage` de Node : table ordonnée par
//! nom en minuscules ; redéfinir un nom garde sa place (la dernière casse gagne),
//! le retirer puis le remettre le place à la fin.

#[derive(Clone, Default, Debug)]
pub struct Headers {
    entries: Vec<Entry>,
}

#[derive(Clone, Debug)]
struct Entry {
    name: String,
    lower: String,
    values: Vec<String>,
}

impl Headers {
    pub fn set(&mut self, name: &str, value: impl Into<String>) {
        self.set_all(name, vec![value.into()]);
    }

    pub fn set_all(&mut self, name: &str, values: Vec<String>) {
        let lower = name.to_ascii_lowercase();
        match self.entries.iter_mut().find(|e| e.lower == lower) {
            Some(e) => {
                e.name = name.to_owned();
                e.values = values;
            }
            None => self.entries.push(Entry {
                name: name.to_owned(),
                lower,
                values,
            }),
        }
    }

    /// Valeur de `getHeader(name)` (tableau joint par `, ` comme le fait `vary`).
    pub fn get(&self, lower: &str) -> Option<String> {
        self.entries
            .iter()
            .find(|e| e.lower == lower)
            .map(|e| e.values.join(", "))
    }

    pub fn has(&self, lower: &str) -> bool {
        self.entries.iter().any(|e| e.lower == lower)
    }

    pub fn remove(&mut self, lower: &str) {
        self.entries.retain(|e| e.lower != lower);
    }

    /// `vary(res, field)` du paquet `vary` 1.1.2.
    pub fn vary(&mut self, field: &str) {
        let header = self.get("vary").unwrap_or_default();
        if let Some(value) = vary_append(&header, field) {
            self.set("Vary", value);
        }
    }

    pub fn iter(&self) -> impl Iterator<Item = (&str, &str)> {
        self.entries
            .iter()
            .flat_map(|e| e.values.iter().map(move |v| (e.name.as_str(), v.as_str())))
    }
}

fn vary_parse(header: &str) -> Vec<&str> {
    let b = header.as_bytes();
    let (mut start, mut end) = (0, 0);
    let mut list = Vec::new();
    for (i, &c) in b.iter().enumerate() {
        match c {
            b' ' => {
                if start == end {
                    start = i + 1;
                    end = i + 1;
                }
            }
            b',' => {
                list.push(&header[start..end]);
                start = i + 1;
                end = i + 1;
            }
            _ => end = i + 1,
        }
    }
    list.push(&header[start..end]);
    list
}

fn vary_append(header: &str, field: &str) -> Option<String> {
    if header == "*" {
        return Some(header.to_owned());
    }
    let fields = vary_parse(field);
    let lowered = header.to_ascii_lowercase();
    let mut vals: Vec<String> = vary_parse(&lowered).into_iter().map(str::to_owned).collect();
    if fields.contains(&"*") || vals.iter().any(|v| v == "*") {
        return Some("*".to_owned());
    }
    let mut out = header.to_owned();
    for f in fields {
        let lower = f.to_ascii_lowercase();
        if !vals.contains(&lower) {
            vals.push(lower);
            out = if out.is_empty() {
                f.to_owned()
            } else {
                format!("{out}, {f}")
            };
        }
    }
    (!out.is_empty()).then_some(out)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn node_ordering_and_vary() {
        let mut h = Headers::default();
        h.set("A", "1");
        h.set("Vary", "Origin");
        h.set("B", "2");
        h.set("a", "3");
        h.vary("Accept-Encoding");
        h.vary("accept-encoding");
        let got: Vec<_> = h.iter().collect();
        assert_eq!(got, [("a", "3"), ("Vary", "Origin, Accept-Encoding"), ("B", "2")]);
        h.remove("a");
        h.set("A", "4");
        assert_eq!(h.iter().last(), Some(("A", "4")));
        let mut e = Headers::default();
        e.vary("Accept-Encoding");
        assert_eq!(e.get("vary").as_deref(), Some("Accept-Encoding"));
    }
}
