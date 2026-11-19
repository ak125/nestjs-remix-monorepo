-- Lecture seule, décomptes uniquement (aucune donnée client). Relevé 2026-11-18 23:50:27–23:50:34 UTC.
select count(*) filter (where ord_date !~ '^\d{4}-\d{2}-\d{2}') dates_non_iso from ___xtr_order;
select count(distinct o.ord_id) commandes_12m,
       count(distinct o.ord_id) filter (where o.ord_is_pay = '1') payees_12m,
       count(*) lignes_12m
  from ___xtr_order o join ___xtr_order_line l on l.orl_ord_id = o.ord_id
 where (l.orl_pm_id = '2590' or l.orl_pm_name ilike 'klaxcar') and o.ord_date >= '2025-11-19';
select count(distinct o.ord_id) commandes_total
  from ___xtr_order o join ___xtr_order_line l on l.orl_ord_id = o.ord_id
 where (l.orl_pm_id = '2590' or l.orl_pm_name ilike 'klaxcar');
select left(max(o.ord_date),10) derniere_commande
  from ___xtr_order o join ___xtr_order_line l on l.orl_ord_id = o.ord_id
 where (l.orl_pm_id = '2590' or l.orl_pm_name ilike 'klaxcar');
