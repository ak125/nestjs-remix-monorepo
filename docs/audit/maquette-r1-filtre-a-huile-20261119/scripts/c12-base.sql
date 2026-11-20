select count(*) as types,
 count(*) filter (where coalesce(trim(type_year_from),'')<>'' and coalesce(trim(type_year_to),'')='') as debut_seul,
 count(*) filter (where coalesce(trim(type_year_from),'')='' and coalesce(trim(type_year_to),'')<>'') as fin_seule,
 count(*) filter (where coalesce(trim(type_year_from),'')='' and coalesce(trim(type_year_to),'')='') as aucune,
 count(*) filter (where coalesce(trim(type_year_from),'')<>'' and trim(type_year_from)=trim(type_year_to)) as egales
from auto_type;
