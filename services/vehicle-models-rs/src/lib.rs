//! Modèles par marque, `GET /api/vehicles/brands/:brandId/models`.
//! - `route` : route complète R2 (binaire `vehicle-models-route`), avec année ;
//!   servie seulement sur le banc (`bench/Caddyfile.route`).
//! - `api` : calcul du lot 1 (binaire `vehicle-models-rs`), appelé par Node via
//!   `VEHICLE_MODELS_RS_ENABLED` sur la branche du lot 1 ; cette délégation n'est
//!   pas livrée ici, le binaire n'a donc pas de consommateur.

pub mod api;
pub mod auto_type;
pub mod config;
pub mod js;
pub mod models;
pub mod postgrest;
pub mod route;
