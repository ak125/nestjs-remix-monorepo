#!/usr/bin/env python3
"""
Génère les types TypeScript depuis le schéma Supabase découvert
"""

import json

# Charger le schéma
with open('/workspaces/nestjs-remix-monorepo/scripts/supabase-all-97-tables.json', 'r') as f:
    schema = json.load(f)

# Mapping types SQL -> TypeScript
TYPE_MAPPING = {
    'integer': 'number',
    'bigint': 'number',
    'smallint': 'number',
    'decimal': 'number',
    'numeric': 'number',
    'real': 'number',
    'double precision': 'number',
    'serial': 'number',
    'bigserial': 'number',
    'text': 'string',
    'character varying': 'string',
    'character': 'string',
    'varchar': 'string',
    'char': 'string',
    'boolean': 'boolean',
    'timestamp': 'string',
    'timestamp without time zone': 'string',
    'timestamp with time zone': 'string',
    'date': 'string',
    'time': 'string',
    'json': 'any',
    'jsonb': 'any',
    'uuid': 'string',
}

def to_pascal_case(snake_str):
    """Convertit snake_case en PascalCase"""
    components = snake_str.split('_')
    return ''.join(x.title() for x in components)

def generate_typescript_interface(table_name, columns):
    """Génère une interface TypeScript pour une table"""
    interface_name = to_pascal_case(table_name)
    
    lines = [f"export interface {interface_name} {{"]
    
    for col in columns:
        # Type par défaut: any
        ts_type = 'string | null'
        lines.append(f"  {col}: {ts_type};")
    
    lines.append("}\n")
    
    return '\n'.join(lines)

def generate_all_types():
    """Génère tous les types"""
    output = []
    
    output.append("/**")
    output.append(" * Types TypeScript générés automatiquement depuis le schéma Supabase")
    output.append(f" * {schema['total_tables']} tables découvertes")
    output.append(" * Généré automatiquement - NE PAS MODIFIER MANUELLEMENT")
    output.append(" */\n")
    
    # Tables principales (sans les préfixes ___  et __)
    main_tables = {k: v for k, v in schema['tables'].items() if not k.startswith('__')}
    system_tables = {k: v for k, v in schema['tables'].items() if k.startswith('__')}
    
    output.append("// ===== TABLES PRINCIPALES =====\n")
    for table, columns in sorted(main_tables.items()):
        if columns:  # Seulement les tables non vides
            output.append(generate_typescript_interface(table, columns))
    
    output.append("\n// ===== TABLES SYSTÈME/INTERNES =====\n")
    for table, columns in sorted(system_tables.items()):
        if columns:
            output.append(generate_typescript_interface(table, columns))
    
    # Type union pour toutes les tables
    output.append("\n// ===== TYPES UTILITAIRES =====\n")
    output.append("export type TableName = ")
    table_names = [f"'{name}'" for name in sorted(schema['tables'].keys())]
    output.append("  | ".join(table_names) + ";\n")
    
    # Map de toutes les tables
    output.append("\nexport interface Database {")
    for table in sorted(schema['tables'].keys()):
        interface_name = to_pascal_case(table)
        output.append(f"  '{table}': {interface_name};")
    output.append("}\n")
    
    # Helper types
    output.append("\n// Helper types pour les requêtes")
    output.append("export type TableRow<T extends TableName> = Database[T];")
    output.append("export type TableInsert<T extends TableName> = Partial<Database[T]>;")
    output.append("export type TableUpdate<T extends TableName> = Partial<Database[T]>;\n")
    
    return '\n'.join(output)

# Générer et sauvegarder
typescript_code = generate_all_types()

output_path = '/workspaces/nestjs-remix-monorepo/backend/src/database/types/database.types.ts'
with open(output_path, 'w', encoding='utf-8') as f:
    f.write(typescript_code)

print(f"✅ Types TypeScript générés: {output_path}")
print(f"📊 {schema['total_tables']} interfaces créées")
print(f"📝 {len([t for t, c in schema['tables'].items() if c])} tables avec colonnes")
