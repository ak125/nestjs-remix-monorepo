# Context7 Configuration - Stack PostgreSQL/Supabase

## Configuration MCP optimisée pour votre projet

```json
{
  "mcpServers": {
    "context7": {
      "type": "http",
      "url": "https://mcp.context7.com/mcp",
      "tools": [
        "get-library-docs",
        "resolve-library-id"
      ],
      "metadata": {
        "project": "nestjs-remix-supabase",
        "database": "postgresql",
        "cloud_provider": "supabase",
        "auth_strategy": "passport-local-session"
      }
    }
  }
}
```

## Stack technique détectée

### Database & Backend
- **PostgreSQL** via Supabase Cloud
- **NestJS** avec TypeScript
- **Passport Local** + Sessions Redis
- **Supabase REST API** pour les requêtes

### Configuration actuelle
- **Supabase URL**: `https://cxpojprgwgubzjyqzmoq.supabase.co`
- **Database**: Connection directe PostgreSQL
- **Tables**: `___config_admin`, `___xtr_customer`
- **Auth**: Hybrid Passport + Supabase

## Questions optimisées pour Context7

Avec cette configuration, vous pouvez demander :

### 🛡️ **Authentification**
- "Comment intégrer Passport Local avec Supabase Auth dans NestJS ?"
- "Best practices pour les sessions Redis avec PostgreSQL ?"
- "Comment sécuriser les routes NestJS avec LocalAuthGuard ?"

### 🗄️ **Base de données**
- "Optimiser les requêtes PostgreSQL avec Supabase REST API"
- "Comment gérer les transactions PostgreSQL dans NestJS ?"
- "Patterns de cache Redis pour les données Supabase"

### 🚀 **Architecture**
- "Structure modulaire NestJS avec Supabase"
- "Intégration Remix SSR avec authentification NestJS"
- "Gestion des erreurs PostgreSQL dans un monorepo"

### 🔍 **Debugging actuel**
- "Résoudre les conflits de routes entre NestJS et Remix"
- "Troubleshooting erreurs 403 avec LocalAuthGuard"
- "Optimiser les performances PostgreSQL + Redis"

## Contexte de votre problème actuel

Avec Context7, l'IA aura accès à :
- Documentation complète de LocalAuthGuard
- Best practices pour les routes `/admin/*` vs `/api/*`
- Patterns d'authentification session-based avec PostgreSQL
- Configuration optimale Passport + Supabase
