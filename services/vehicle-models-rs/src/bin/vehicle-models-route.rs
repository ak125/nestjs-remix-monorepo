//! R2 : route complète `GET /api/vehicles/brands/:brandId/models` (DEV isolé).
//! Écoute sur `ROUTE_LISTEN` (boucle locale uniquement) ; Caddy y envoie la route.

use std::net::SocketAddr;
use std::process::ExitCode;

use vehicle_models_rs::route::{app::State, http, log};

fn main() -> ExitCode {
    let env = |k: &str| std::env::var(k).ok();
    let listen: SocketAddr = match env("ROUTE_LISTEN")
        .unwrap_or_else(|| "127.0.0.1:3150".into())
        .parse::<SocketAddr>()
    {
        Ok(a) if std::net::IpAddr::is_loopback(&a.ip()) => a,
        _ => {
            eprintln!("ROUTE_LISTEN doit être une adresse de boucle locale");
            return ExitCode::FAILURE;
        }
    };
    if rustls::crypto::ring::default_provider()
        .install_default()
        .is_err()
    {
        eprintln!("fournisseur TLS déjà installé");
        return ExitCode::FAILURE;
    }
    let state = match State::from_env(&env) {
        Ok(s) => s,
        Err(e) => {
            eprintln!("configuration refusée : {e}");
            return ExitCode::FAILURE;
        }
    };
    let runtime = tokio::runtime::Builder::new_multi_thread()
        .worker_threads(state.base.worker_threads)
        .enable_all()
        .build();
    let Ok(runtime) = runtime else {
        eprintln!("démarrage du runtime impossible");
        return ExitCode::FAILURE;
    };
    runtime.block_on(async move {
        let hostname = std::fs::read_to_string("/proc/sys/kernel/hostname").unwrap_or_default();
        log::init(hostname.trim());
        state.log_start();
        let listener = match tokio::net::TcpListener::bind(listen).await {
            Ok(l) => l,
            Err(e) => {
                eprintln!("écoute sur {listen} impossible : {e}");
                return ExitCode::FAILURE;
            }
        };
        tokio::spawn(state.flush_errors_forever());
        let mut term = match tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate()) {
            Ok(s) => s,
            Err(_) => return ExitCode::FAILURE,
        };
        tokio::select! {
            _ = http::serve(listener, state) => {}
            _ = term.recv() => {}
            _ = tokio::signal::ctrl_c() => {}
        }
        ExitCode::SUCCESS
    })
}
