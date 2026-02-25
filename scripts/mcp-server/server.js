#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration Supabase
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requis');
  process.exit(1);
}

// Charger le schéma des tables
const schemaPath = join(__dirname, '../supabase-all-97-tables.json');
let schema = {};
try {
  schema = JSON.parse(readFileSync(schemaPath, 'utf-8'));
} catch (error) {
  console.error('Erreur lors du chargement du schéma:', error);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

class SupabaseMCPServer {
  constructor() {
    this.server = new Server(
      {
        name: "supabase-local",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
    
    // Error handling
    this.server.onerror = (error) => console.error("[MCP Error]", error);
    process.on("SIGINT", async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: "list_tables",
          description: "Liste toutes les tables disponibles dans Supabase",
          inputSchema: {
            type: "object",
            properties: {
              filter: {
                type: "string",
                description: "Filtre optionnel pour rechercher des tables (ex: 'auto', 'pieces', 'sitemap')"
              }
            }
          },
        },
        {
          name: "describe_table",
          description: "Affiche les colonnes et la structure d'une table",
          inputSchema: {
            type: "object",
            properties: {
              table: {
                type: "string",
                description: "Nom de la table à décrire"
              }
            },
            required: ["table"],
          },
        },
        {
          name: "query_table",
          description: "Exécute une requête SELECT sur une table",
          inputSchema: {
            type: "object",
            properties: {
              table: {
                type: "string",
                description: "Nom de la table"
              },
              select: {
                type: "string",
                description: "Colonnes à sélectionner (ex: '*' ou 'id,name')",
                default: "*"
              },
              filter: {
                type: "object",
                description: "Filtres au format PostgREST (ex: {id: 'eq.1'})"
              },
              limit: {
                type: "number",
                description: "Nombre maximum de résultats",
                default: 10
              }
            },
            required: ["table"],
          },
        },
        {
          name: "count_rows",
          description: "Compte le nombre de lignes dans une table",
          inputSchema: {
            type: "object",
            properties: {
              table: {
                type: "string",
                description: "Nom de la table"
              },
              filter: {
                type: "object",
                description: "Filtres optionnels"
              }
            },
            required: ["table"],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        const { name, arguments: args } = request.params;

        switch (name) {
          case "list_tables": {
            const tables = schema.table_names || [];
            let filtered = tables;
            
            if (args.filter) {
              filtered = tables.filter(t => 
                t.toLowerCase().includes(args.filter.toLowerCase())
              );
            }

            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify({
                    total: filtered.length,
                    tables: filtered
                  }, null, 2),
                },
              ],
            };
          }

          case "describe_table": {
            const tableName = args.table;
            const columns = schema.tables?.[tableName];

            if (!columns) {
              throw new Error(`Table '${tableName}' non trouvée`);
            }

            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify({
                    table: tableName,
                    columns: columns,
                    column_count: columns.length
                  }, null, 2),
                },
              ],
            };
          }

          case "query_table": {
            const { table, select = '*', filter, limit = 10 } = args;

            let query = supabase.from(table).select(select).limit(limit);

            if (filter) {
              Object.entries(filter).forEach(([key, value]) => {
                query = query.filter(key, 'eq', value);
              });
            }

            const { data, error } = await query;

            if (error) {
              throw new Error(`Erreur Supabase: ${error.message}`);
            }

            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify({
                    table,
                    count: data.length,
                    data
                  }, null, 2),
                },
              ],
            };
          }

          case "count_rows": {
            const { table, filter } = args;

            let query = supabase.from(table).select('*', { count: 'exact', head: true });

            if (filter) {
              Object.entries(filter).forEach(([key, value]) => {
                query = query.filter(key, 'eq', value);
              });
            }

            const { count, error } = await query;

            if (error) {
              throw new Error(`Erreur Supabase: ${error.message}`);
            }

            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify({
                    table,
                    count
                  }, null, 2),
                },
              ],
            };
          }

          default:
            throw new Error(`Outil inconnu: ${name}`);
        }
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Erreur: ${error.message}`,
            },
          ],
          isError: true,
        };
      }
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("Serveur MCP Supabase démarré");
  }
}

const server = new SupabaseMCPServer();
server.run().catch(console.error);
