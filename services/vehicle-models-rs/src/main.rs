use std::process::ExitCode;
use std::sync::Arc;

use tokio::sync::Semaphore;
use vehicle_models_rs::api::{AppState, router};
use vehicle_models_rs::config::Config;
use vehicle_models_rs::postgrest::Postgrest;

fn main() -> ExitCode {
    let cfg = match Config::from_env() {
        Ok(cfg) => cfg,
        Err(message) => {
            eprintln!("vehicle-models-rs: configuration invalide : {message}");
            return ExitCode::from(2);
        }
    };
    tracing_subscriber::fmt()
        .with_max_level(cfg.log_level)
        .with_target(false)
        .init();
    if rustls::crypto::ring::default_provider()
        .install_default()
        .is_err()
    {
        tracing::error!("fournisseur TLS déjà installé");
        return ExitCode::FAILURE;
    }

    let runtime = match tokio::runtime::Builder::new_multi_thread()
        .worker_threads(cfg.worker_threads)
        .enable_all()
        .build()
    {
        Ok(runtime) => runtime,
        Err(e) => {
            tracing::error!(error = %e, "démarrage du runtime impossible");
            return ExitCode::FAILURE;
        }
    };
    match runtime.block_on(run(cfg)) {
        Ok(()) => ExitCode::SUCCESS,
        Err(message) => {
            tracing::error!(%message, "arrêt sur erreur");
            ExitCode::FAILURE
        }
    }
}

async fn run(cfg: Config) -> Result<(), String> {
    let state = Arc::new(AppState {
        pg: Postgrest::new(&cfg)?,
        inflight: Arc::new(Semaphore::new(cfg.max_inflight)),
        deadline: cfg.request_deadline,
        max_type_rows: cfg.max_type_rows,
    });
    let listener = tokio::net::TcpListener::bind(cfg.bind)
        .await
        .map_err(|e| format!("écoute sur {} impossible : {e}", cfg.bind))?;
    tracing::info!(
        bind = %cfg.bind,
        key_source = cfg.key_source,
        upstream_concurrency = cfg.upstream_concurrency,
        max_inflight = cfg.max_inflight,
        worker_threads = cfg.worker_threads,
        "vehicle-models-rs prêt"
    );
    axum::serve(listener, router(state))
        .with_graceful_shutdown(shutdown_signal())
        .await
        .map_err(|e| format!("serveur : {e}"))?;
    tracing::info!("arrêt propre");
    Ok(())
}

/// SIGTERM ou SIGINT : plus de nouvelles connexions, requêtes en cours terminées
/// (bornées par l'échéance de requête).
async fn shutdown_signal() {
    let mut term = match tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate()) {
        Ok(signal) => signal,
        Err(e) => {
            tracing::error!(error = %e, "SIGTERM non surveillé");
            let _ = tokio::signal::ctrl_c().await;
            return;
        }
    };
    tokio::select! {
        _ = term.recv() => {},
        _ = tokio::signal::ctrl_c() => {},
    }
    tracing::info!("signal d'arrêt reçu");
}
