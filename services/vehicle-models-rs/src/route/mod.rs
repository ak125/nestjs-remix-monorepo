//! Route complète `GET /api/vehicles/brands/:brandId/models` (R2) : serveur HTTP
//! autonome qui reproduit la chaîne Express/Nest de cette route (voir
//! `docs/route-contract.md`).

pub mod app;
pub mod compress;
pub mod guard;
pub mod headers;
pub mod http;
pub mod json;
pub mod log;
pub mod query;
pub mod redis;
pub mod session;
pub mod uri;
