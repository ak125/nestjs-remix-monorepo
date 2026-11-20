select c.conrelid::regclass::text src, c.confrelid::regclass::text tgt, c.conname from pg_constraint c
where c.contype='f' and (c.conrelid::regclass::text not like '%.%' or c.confrelid::regclass::text not like '%.%') order by 1;
