//! Portage de `executeQuery` dans `VehicleModelsService.getModelsByBrand`
//! (backend/src/modules/vehicles/services/data/vehicle-models.service.ts).
//! Mêmes requêtes PostgREST, dans le même ordre, et même objet de retour.

use serde_json::{Value, json};

use crate::auto_type::{Batch, Groups, parse_batch};
use crate::js;
use crate::postgrest::{Data, PgResponse, Postgrest, Query, in_filter};

const TYPES_SELECT: &str = "type_id,type_modele_id,type_year_from,type_year_to,type_fuel";
const TYPES_BATCH: usize = 1000;

/// Options déjà validées (contrat zod du contrôleur).
#[derive(Debug, Default)]
pub struct ModelsRequest {
    pub brand_id: u32,
    pub page: Option<u32>,
    pub limit: Option<u32>,
    pub year: Option<u16>,
    pub search: Option<String>,
    pub include_all: bool,
}

#[derive(Debug)]
pub enum Outcome {
    /// Objet que le legacy retourne.
    Ok(Value),
    /// Valeur que le legacy lève telle quelle (`throw modelsError`…).
    Thrown(Value),
    /// Réponse amont qu'aucune donnée réelle ne produit et que ce portage
    /// refuse explicitement au lieu d'émuler une `TypeError` JavaScript.
    Contract(String),
    /// Borne de sécurité propre à ce service.
    Limit(String),
}

/// Lignes que le legacy journalise pendant le calcul, au point exact où il
/// le fait (`this.logger.log` / `this.logger.error` de `executeQuery`).
#[derive(Debug)]
pub enum Event<'a> {
    /// `error('Erreur récupération modèles:', modelsError)`.
    ModelsError,
    /// `log('🔍 DEBUG: ${allModelIds.length} modèles totaux pour marque ${marqueId}')`.
    ModelsTotal(usize),
    /// `error('Erreur récupération types:', typesError)`.
    TypesError,
    /// `log('🔍 DEBUG année ${year}: IDs filtrés = [${ids.slice(0, 5).join(', ')}...]')`.
    YearFiltered(f64, &'a [f64]),
    /// `error('Erreur getModelsByBrand:', error)` (requête principale).
    MainError,
}

fn thrown_if_error<D>(r: &PgResponse<D>) -> Option<Outcome> {
    js::truthy(Some(&r.error)).then(|| Outcome::Thrown(r.error.clone()))
}

pub async fn models_by_brand(pg: &Postgrest, req: &ModelsRequest, max_type_rows: usize) -> Outcome {
    models_by_brand_observed(pg, req, max_type_rows, &mut |_| {}).await
}

/// Même calcul, en signalant chaque [`Event`] à `observe`.
pub async fn models_by_brand_observed(
    pg: &Postgrest,
    req: &ModelsRequest,
    max_type_rows: usize,
    observe: &mut (dyn FnMut(Event<'_>) + Send),
) -> Outcome {
    // `const { page = 0, limit = 50 } = options; const offset = page * limit;`
    let page = req.page.unwrap_or(0);
    let limit = req.limit.unwrap_or(50);
    let offset = f64::from(page) * f64::from(limit);
    let brand_eq = format!("eq.{}", req.brand_id);

    // Étape 1 : tous les modèles de la marque.
    let mut q = Query::new("auto_modele");
    q.set("select", "modele_id".into());
    q.append("modele_marque_id", brand_eq.clone());
    let r = pg.get(&q).await;
    if js::truthy(Some(&r.error)) || !js::truthy(Some(&r.data)) {
        observe(Event::ModelsError);
        return Outcome::Thrown(r.error);
    }
    let Value::Array(models) = &r.data else {
        return Outcome::Contract("auto_modele (étape 1) : data n'est pas un tableau".into());
    };
    let mut model_ids = Vec::with_capacity(models.len());
    for m in models {
        match m.as_object().and_then(|o| o.get("modele_id")) {
            Some(id) if !id.is_null() => model_ids.push(js::to_js_string(Some(id))),
            _ => return Outcome::Contract("auto_modele (étape 1) : modele_id absent".into()),
        }
    }
    observe(Event::ModelsTotal(model_ids.len()));

    // Étapes 2 et 3 : les types de ces modèles, par lots de 1000 (max-rows
    // PostgREST) en ordre total `(type_modele_id, type_id)`, regroupés par
    // `type_modele_id?.toString()` pendant l'analyse.
    let year = req.year.map(f64::from).filter(|y| js::number_truthy(*y));
    let mut groups = Groups::new(year);
    let types_filter = in_filter(model_ids.iter().map(String::as_str));
    let mut type_rows = 0usize;
    let mut types_offset = 0usize;
    loop {
        let mut q = Query::new("auto_type");
        q.set("select", TYPES_SELECT.into());
        q.append("type_modele_id", types_filter.clone());
        q.set("order", "type_modele_id.asc,type_id.asc".into());
        q.set("offset", types_offset.to_string());
        q.set("limit", TYPES_BATCH.to_string());
        let r = pg.get_with(&q, |text| parse_batch(text, &mut groups)).await;
        if let Some(thrown) = thrown_if_error(&r) {
            observe(Event::TypesError);
            return thrown;
        }
        let n = match r.data {
            Data::Null | Data::Parsed(Batch::Falsy) => break,
            Data::Parsed(Batch::NonArray) => {
                return Outcome::Contract("auto_type : data n'est pas un tableau".into());
            }
            Data::EmptyArray => 0,
            Data::Parsed(Batch::Rows(n)) => n,
        };
        if n == 0 {
            break;
        }
        if type_rows + n > max_type_rows {
            return Outcome::Limit(format!(
                "plus de {max_type_rows} types pour la marque {}",
                req.brand_id
            ));
        }
        type_rows += n;
        if n < TYPES_BATCH {
            break;
        }
        types_offset += TYPES_BATCH;
    }
    if groups.null_row {
        return Outcome::Contract("auto_type : ligne null".into());
    }

    // Étape 4 : modèles ayant au moins une motorisation (pour l'année demandée).
    let ids_with_types: Vec<f64> = groups
        .iter()
        .filter(|g| year.is_none() || g.matches_year)
        .map(|g| js::parse_int(&g.key, Some(10)))
        .collect();
    if let Some(y) = year {
        observe(Event::YearFiltered(
            y,
            &ids_with_types[..ids_with_types.len().min(5)],
        ));
    }

    if ids_with_types.is_empty() {
        return Outcome::Ok(json!({ "success": true, "data": [], "total": 0, "page": page, "limit": limit }));
    }

    // Requête principale :
    // `.limit(limit).range(offset, offset + limit - 1).order('modele_name').order('modele_id')`.
    let id_strings: Vec<String> = js::dedup_numbers(ids_with_types)
        .into_iter()
        .map(js::number_to_string)
        .collect();
    let mut q = Query::new("auto_modele").count_exact();
    q.set("select", "*".into());
    q.append("modele_marque_id", brand_eq);
    q.append("modele_id", in_filter(id_strings.iter().map(String::as_str)));
    if !req.include_all {
        q.append("modele_display", "eq.1".into());
    }
    if let Some(search) = req.search.as_deref().filter(|s| !js::trims_to_empty(s)) {
        q.append(
            "or",
            format!("(modele_alias.ilike.%{search}%,modele_name.ilike.%{search}%)"),
        );
    }
    let limit_f = f64::from(limit);
    let to = offset + limit_f - 1.0;
    q.set("limit", js::number_to_string(limit_f));
    q.set("offset", js::number_to_string(offset));
    q.set("limit", js::number_to_string(to - offset + 1.0));
    q.set("order", "modele_name.asc,modele_id.asc".into());
    let r = pg.get(&q).await;
    if let Some(thrown) = thrown_if_error(&r) {
        observe(Event::MainError);
        return thrown;
    }
    let total = r.count.filter(|c| js::number_truthy(*c)).unwrap_or(0.0);
    let rows = match r.data {
        data if !js::truthy(Some(&data)) => Vec::new(),
        Value::Array(rows) => rows,
        _ => return Outcome::Contract("auto_modele : data n'est pas un tableau".into()),
    };

    // Enrichissement : `{ ...model, motorisationsCount, modele_fuel_types }`.
    let mut data = Vec::with_capacity(rows.len());
    for row in rows {
        let Value::Object(mut model) = row else {
            return Outcome::Contract("auto_modele : ligne non objet".into());
        };
        let key = js::to_js_string(model.get("modele_id"));
        let (types, fuels) = groups
            .get(&key)
            .map_or((0, Vec::new()), |g| (g.types, g.fuels.clone()));
        model.insert("motorisationsCount".into(), json!(types));
        model.insert("modele_fuel_types".into(), Value::Array(fuels));
        data.push(Value::Object(model));
    }

    Outcome::Ok(json!({
        "success": true,
        "data": data,
        "total": js::number_value(total),
        "page": page,
        "limit": limit,
    }))
}
