select t.type_id, m.modele_name, t.type_name from auto_type t join auto_modele m on m.modele_id::text=t.type_modele_id::text
where t.type_id in ('16102','16108','17989','15903','11056','2132','19352','57281','19052','371') order by 1;
