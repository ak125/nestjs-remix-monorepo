-- Classement des images, exécuté sur un PostgreSQL 17 jetable (aucune écriture en base massdoc).
-- Entrées : obj (T01, storage.objects du bucket rack-images), vend (T02), served (T03), img (T04), gr (T06).
-- url_name       = nom servi aujourd'hui (regex des fonctions servies, sans bmp)
-- url_name_after = nom servi après la migration (regex + bmp)
create table cls as
select i.*,
  case when i.name ~* '\.(webp|jpg|jpeg|png|gif)$'     then i.name else i.name||'.webp' end as url_name,
  case when i.name ~* '\.(webp|jpg|jpeg|png|gif|bmp)$' then i.name else i.name||'.webp' end as url_name_after
from img i;
alter table cls add column classe text, add column present_after bool, add column ci_match bool, add column recup text;
update cls c set classe = case
  when c.folder='' then 'dossier_vide'
  when exists (select 1 from obj o where o.name = c.folder||'/'||c.url_name) then 'presente'
  when exists (select 1 from obj o where o.name = c.folder||'/'||c.name)     then 'absente_extension'
  when not exists (select 1 from obj o where o.folder = c.folder)            then 'dossier_absent'
  else 'fichier_absent' end;
update cls c set present_after = c.folder<>'' and exists (select 1 from obj o where o.name = c.folder||'/'||c.url_name_after);
-- contrôle : aucun fichier_absent ne s'explique par la casse seule (résultat 0)
update cls c set ci_match = exists (select 1 from obj o where lower(o.name) = lower(c.folder||'/'||c.name)) where classe='fichier_absent';
-- A3 : référence TecDoc connue (dossier = source_dlnr, nom sans extension = bildname) => 'inconnu', sinon 'non'
update cls c set recup = case when exists (select 1 from gr where gr.dlnr = c.folder::int and lower(gr.bildname) = lower(regexp_replace(c.name, '\.[A-Za-z0-9]{1,5}$', ''))) then 'inconnu' else 'non' end
 where classe in ('fichier_absent','dossier_absent');
-- lot vendable servi en R2
create table r2 as select c.* from cls c join vend v on v.piece_id = c.piece_id::int join served s on s.piece_id = v.piece_id where s.served and v.v3_ok;
