//! Configuration lue dans l'environnement, une seule fois au démarrage.

use std::net::SocketAddr;
use std::time::Duration;

pub struct Config {
    pub bind: SocketAddr,
    pub supabase_url: String,
    pub api_key: String,
    /// Nom de la variable qui a fourni la clé (journalisé, jamais la valeur).
    pub key_source: &'static str,
    pub upstream_concurrency: usize,
    pub max_inflight: usize,
    pub upstream_timeout: Duration,
    pub request_deadline: Duration,
    pub max_body_bytes: usize,
    pub max_type_rows: usize,
    pub worker_threads: usize,
    pub log_level: tracing::Level,
}

impl Config {
    pub fn from_env() -> Result<Self, String> {
        Self::from_lookup(|key| std::env::var(key).ok())
    }

    pub fn from_lookup(env: impl Fn(&str) -> Option<String>) -> Result<Self, String> {
        let get = |key: &str| env(key).filter(|v| !v.is_empty());

        let supabase_url = get("SUPABASE_URL").ok_or("SUPABASE_URL absent")?;
        let (api_key, key_source) = resolve_key(&get)?;

        let bind: SocketAddr = get("VEHICLE_MODELS_RS_BIND")
            .unwrap_or_else(|| "127.0.0.1:3110".to_owned())
            .parse()
            .map_err(|e| format!("VEHICLE_MODELS_RS_BIND invalide : {e}"))?;
        // Le service n'authentifie pas ses appelants : lot DEV, boucle locale seulement.
        if !bind.ip().is_loopback() {
            return Err(format!(
                "VEHICLE_MODELS_RS_BIND doit être une adresse de boucle locale (reçu {bind})"
            ));
        }

        let number = |key: &str, default: usize, max: usize| -> Result<usize, String> {
            match get(key) {
                None => Ok(default),
                Some(raw) => match raw.parse::<usize>() {
                    Ok(n) if (1..=max).contains(&n) => Ok(n),
                    _ => Err(format!(
                        "{key} doit être un entier entre 1 et {max} (reçu {raw:?})"
                    )),
                },
            }
        };

        let log_level = match get("VEHICLE_MODELS_RS_LOG").as_deref() {
            None | Some("info") => tracing::Level::INFO,
            Some("error") => tracing::Level::ERROR,
            Some("warn") => tracing::Level::WARN,
            Some("debug") => tracing::Level::DEBUG,
            Some(other) => return Err(format!("VEHICLE_MODELS_RS_LOG inconnu : {other:?}")),
        };

        Ok(Self {
            bind,
            supabase_url,
            api_key,
            key_source,
            // 20 = sémaphore global de SupabaseBaseService.
            upstream_concurrency: number("VEHICLE_MODELS_RS_UPSTREAM_CONCURRENCY", 20, 256)?,
            max_inflight: number("VEHICLE_MODELS_RS_MAX_INFLIGHT", 256, 65_536)?,
            upstream_timeout: Duration::from_millis(number(
                "VEHICLE_MODELS_RS_UPSTREAM_TIMEOUT_MS",
                15_000,
                120_000,
            )? as u64),
            request_deadline: Duration::from_millis(
                number("VEHICLE_MODELS_RS_DEADLINE_MS", 30_000, 300_000)? as u64,
            ),
            max_body_bytes: 16 * 1024 * 1024,
            max_type_rows: 200_000,
            // 1 : moins de CPU par requête que 2 sur le banc à 2 CPU partagés avec Node.
            worker_threads: number("VEHICLE_MODELS_RS_WORKER_THREADS", 1, 256)?,
            log_level,
        })
    }
}

/// Même choix de clé que `SupabaseBaseService` : rôle service, sinon clé anon
/// en `READ_ONLY=true`, puis clé `DEV_SUPABASE_KEY` si le kill-switch DEV est
/// actif hors production.
fn resolve_key(get: &impl Fn(&str) -> Option<String>) -> Result<(String, &'static str), String> {
    let read_only = get("READ_ONLY").as_deref() == Some("true");
    let (mut key, mut source) = match (get("SUPABASE_SERVICE_ROLE_KEY"), get("SUPABASE_ANON_KEY")) {
        (Some(service), _) => (service, "SUPABASE_SERVICE_ROLE_KEY"),
        (None, Some(anon)) if read_only => (anon, "SUPABASE_ANON_KEY"),
        _ if read_only => {
            return Err(
                "READ_ONLY=true exige SUPABASE_ANON_KEY quand SUPABASE_SERVICE_ROLE_KEY est absente".into(),
            );
        }
        _ => return Err("SUPABASE_SERVICE_ROLE_KEY absente".into()),
    };
    let kill_switch =
        get("NODE_ENV").as_deref() != Some("production") && get("DEV_KILL_SWITCH").as_deref() == Some("true");
    if kill_switch && let Some(dev) = get("DEV_SUPABASE_KEY") {
        key = dev;
        source = "DEV_SUPABASE_KEY";
    }
    Ok((key, source))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    fn config(vars: &[(&str, &str)]) -> Result<Config, String> {
        let map: HashMap<String, String> = vars
            .iter()
            .map(|(k, v)| ((*k).to_owned(), (*v).to_owned()))
            .collect();
        Config::from_lookup(|k| map.get(k).cloned())
    }

    #[test]
    fn key_resolution_matches_supabase_base_service() {
        let base = [("SUPABASE_URL", "http://127.0.0.1:1")];
        let c = config(&[
            base[0],
            ("SUPABASE_SERVICE_ROLE_KEY", "s"),
            ("SUPABASE_ANON_KEY", "a"),
        ])
        .unwrap();
        assert_eq!(
            (c.api_key.as_str(), c.key_source),
            ("s", "SUPABASE_SERVICE_ROLE_KEY")
        );
        let c = config(&[base[0], ("SUPABASE_ANON_KEY", "a"), ("READ_ONLY", "true")]).unwrap();
        assert_eq!(c.key_source, "SUPABASE_ANON_KEY");
        assert!(config(&[base[0], ("SUPABASE_ANON_KEY", "a")]).is_err());
        let dev = [
            base[0],
            ("SUPABASE_SERVICE_ROLE_KEY", "s"),
            ("DEV_KILL_SWITCH", "true"),
            ("DEV_SUPABASE_KEY", "d"),
        ];
        assert_eq!(config(&dev).unwrap().key_source, "DEV_SUPABASE_KEY");
        let mut prod = dev.to_vec();
        prod.push(("NODE_ENV", "production"));
        assert_eq!(config(&prod).unwrap().key_source, "SUPABASE_SERVICE_ROLE_KEY");
    }

    #[test]
    fn bind_must_be_loopback() {
        let base = [
            ("SUPABASE_URL", "http://127.0.0.1:1"),
            ("SUPABASE_SERVICE_ROLE_KEY", "s"),
        ];
        assert!(config(&[base[0], base[1], ("VEHICLE_MODELS_RS_BIND", "0.0.0.0:3110")]).is_err());
        assert_eq!(config(&base).unwrap().bind.port(), 3110);
    }
}
