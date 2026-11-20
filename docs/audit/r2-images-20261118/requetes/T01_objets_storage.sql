\copy (select name, coalesce((metadata->>'size')::bigint,-1), created_at from storage.objects where bucket_id='rack-images') to '<DIR>/data/objects_rack.csv' csv
\copy (select name, coalesce((metadata->>'size')::bigint,-1), coalesce(metadata->>'mimetype',''), created_at from storage.objects where bucket_id='tecdoc-drop-backup-2026-09-11') to '<DIR>/data/objects_backup.csv' csv
