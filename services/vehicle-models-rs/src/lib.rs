//! Lot Rust n°1 : calcul non caché de `GET /api/vehicles/brands/:brandId/models`.
//! Le backend Node garde la route, la validation, le cache et le filtre
//! d'erreurs ; il délègue ici `executeQuery` quand `VEHICLE_MODELS_RS_ENABLED=true`.

pub mod api;
pub mod auto_type;
pub mod config;
pub mod js;
pub mod models;
pub mod postgrest;
pub mod route;
