-- Mandat EH : contrôle après application, lecture seule (sweep-psql ou éditeur SQL).
-- Attendu après la migration : 0 ligne. Après le .down.sql : comparer à nom_releve / meta_releve.
with attendu(type_id, nom_releve, meta_releve, nom_cible, meta_cible) as (values
  (33063, '320 CDI 4-Matic', '320 CDI 350 BlueTEC 4Matic', '350 BlueTEC 4-Matic', '350 BlueTEC 4Matic'),
  (33593, '2.0 D Multijet', '2.0 JTD', '2.2 D Multijet', '2.2 D Multijet'),
  (60342, '2.0 45 TFSI', '2.0 TFSI', '2.0 TFSI', '2.0 TFSI'),
  (73442, '200 D', '220 d', '220 D', '220 d')
)
select a.type_id, t.type_name, t.type_name_meta, a.nom_cible, a.meta_cible
  from attendu a
  left join public.auto_type t on t.type_id = a.type_id::text
 where (t.type_name, t.type_name_meta) is distinct from (a.nom_cible, a.meta_cible)
 order by a.type_id;
