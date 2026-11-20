select version, coalesce(name,'') name, array_to_string(statements,' ') stm from supabase_migrations.schema_migrations;
