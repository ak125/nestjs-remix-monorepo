# 🚀 Déploiement Fonction RPC Bestsellers

## Étape 1 : Déployer sur Supabase

### Via Supabase Dashboard
1. Ouvrir https://supabase.com/dashboard
2. Sélectionner votre projet
3. Aller dans **SQL Editor**
4. Créer une nouvelle query
5. Copier/coller le contenu ci-dessous :

```sql
-- ⚡ FONCTION RPC OPTIMISÉE : Bestsellers par marque
CREATE OR REPLACE FUNCTION get_brand_bestsellers_optimized(
  p_marque_id INTEGER,
  p_limit_vehicles INTEGER DEFAULT 12,
  p_limit_parts INTEGER DEFAULT 12
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_build_object(
    'vehicles', (
      SELECT json_agg(
        json_build_object(
          'cgc_type_id', cgc.cgc_type_id,
          'type_id', at.type_id,
          'type_alias', at.type_alias,
          'type_name', at.type_name,
          'type_name_meta', at.type_name_meta,
          'type_power_ps', at.type_power_ps,
          'type_fuel', at.type_fuel,
          'type_year_from', at.type_year_from,
          'type_month_from', at.type_month_from,
          'type_year_to', at.type_year_to,
          'type_month_to', at.type_month_to,
          'modele_id', am.modele_id,
          'modele_alias', am.modele_alias,
          'modele_name', am.modele_name,
          'modele_name_meta', am.modele_name_meta,
          'modele_pic', am.modele_pic,
          'marque_id', amb.marque_id,
          'marque_alias', amb.marque_alias,
          'marque_name', amb.marque_name,
          'marque_name_meta', amb.marque_name_meta,
          'marque_name_meta_title', amb.marque_name_meta_title
        )
      )
      FROM (
        SELECT DISTINCT ON (cgc.cgc_type_id) 
          cgc.cgc_type_id,
          cgc.cgc_modele_id
        FROM __cross_gamme_car_new cgc
        WHERE cgc.cgc_level = '2'
        ORDER BY cgc.cgc_type_id, cgc.cgc_id DESC
        LIMIT p_limit_vehicles * 2
      ) cgc
      INNER JOIN auto_type at ON at.type_id = cgc.cgc_type_id::INTEGER
      INNER JOIN auto_modele am ON am.modele_id::TEXT = at.type_modele_id
      INNER JOIN auto_marque amb ON amb.marque_id = am.modele_marque_id
      WHERE amb.marque_id = p_marque_id
        AND am.modele_display = 1
        AND at.type_display = 1
      ORDER BY at.type_id DESC
      LIMIT p_limit_vehicles
    ),
    'parts', (
      SELECT json_agg(
        json_build_object(
          'cgc_pg_id', cgc.cgc_pg_id,
          'pg_id', pg.pg_id,
          'pg_alias', pg.pg_alias,
          'pg_name', pg.pg_name,
          'pg_name_meta', pg.pg_name_meta,
          'pg_pic', pg.pg_pic,
          'pg_img', pg.pg_img,
          'pg_top', pg.pg_top,
          'cgc_type_id', cgc.cgc_type_id,
          'type_name', at.type_name,
          'type_power_ps', at.type_power_ps,
          'modele_id', am.modele_id,
          'modele_name', am.modele_name,
          'modele_alias', am.modele_alias,
          'marque_id', amb.marque_id,
          'marque_name', amb.marque_name,
          'marque_alias', amb.marque_alias
        )
      )
      FROM (
        SELECT DISTINCT ON (cgc.cgc_pg_id) 
          cgc.cgc_pg_id,
          cgc.cgc_type_id
        FROM __cross_gamme_car_new cgc
        WHERE cgc.cgc_level = '1'
        ORDER BY cgc.cgc_pg_id, cgc.cgc_id DESC
        LIMIT p_limit_parts * 3
      ) cgc
      INNER JOIN pieces_gamme pg ON pg.pg_id = cgc.cgc_pg_id::INTEGER
      INNER JOIN auto_type at ON at.type_id = cgc.cgc_type_id::INTEGER
      INNER JOIN auto_modele am ON am.modele_id::TEXT = at.type_modele_id
      INNER JOIN auto_marque amb ON amb.marque_id = am.modele_marque_id
      WHERE amb.marque_id = p_marque_id
        AND pg.pg_activ = '1'
        AND am.modele_display = 1
      ORDER BY pg.pg_top DESC, pg.pg_id DESC
      LIMIT p_limit_parts
    )
  ) INTO v_result;

  RETURN v_result;
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'vehicles', json_build_array(),
      'parts', json_build_array(),
      'error', SQLERRM
    );
END;
$$;
```

6. Cliquer sur **Run** (ou Ctrl+Enter)
7. Vérifier qu'il n'y a pas d'erreur

## Étape 2 : Tester la fonction SQL

Dans le SQL Editor, exécuter :

```sql
-- Test BMW (marque_id = 33)
SELECT get_brand_bestsellers_optimized(33, 12, 12);

-- Test Renault (marque_id = 70)
SELECT get_brand_bestsellers_optimized(70, 10, 10);

-- Test structure retournée
SELECT 
  jsonb_array_length(result->'vehicles') as nb_vehicles,
  jsonb_array_length(result->'parts') as nb_parts
FROM (
  SELECT get_brand_bestsellers_optimized(33, 12, 12)::jsonb as result
) t;
```

### Résultat attendu
```json
{
  "vehicles": [
    {
      "cgc_type_id": "123456",
      "type_id": 123456,
      "type_alias": "bmw-serie-3-318d-143-cv-...",
      "type_name": "BMW Série 3 318d 143 CV",
      "marque_alias": "bmw",
      ...
    }
  ],
  "parts": [
    {
      "cgc_pg_id": "789",
      "pg_id": 789,
      "pg_alias": "filtre-a-huile",
      "pg_name": "Filtre à huile",
      "marque_alias": "bmw",
      ...
    }
  ]
}
```

## ✅ Validation

- [ ] Fonction créée sans erreur
- [ ] Test BMW retourne des véhicules
- [ ] Test BMW retourne des pièces
- [ ] Structure JSON correcte

---
**Prochaine étape :** Tester l'endpoint backend NestJS
