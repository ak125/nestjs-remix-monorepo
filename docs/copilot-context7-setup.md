# GitHub Copilot Coding Agent Configuration

## MCP Server Configuration

Pour utiliser Context7 avec le Coding Agent, ajoutez cette configuration dans :
**Repository Settings → Copilot → Coding agent → MCP configuration**

```json
{
  "mcpServers": {
    "context7": {
      "type": "http",
      "url": "https://mcp.context7.com/mcp",
      "tools": [
        "get-library-docs",
        "resolve-library-id"
      ]
    }
  }
}
```

## Avantages pour ce projet

### 1. Documentation automatique
- **NestJS**: Accès instantané aux docs des décorateurs, modules, guards
- **Remix**: Documentation des loaders, actions, composants
- **Zod**: Schémas de validation et types TypeScript
- **Redis**: Configuration et méthodes de cache
- **Supabase**: Client PostgreSQL, auth, et real-time features

### 2. Résolution de dépendances
- Identification automatique des versions compatibles
- Suggestions d'imports optimisés
- Détection de conflits de dépendances

### 3. Contexte enrichi pour l'IA
- Compréhension approfondie de l'architecture NestJS/Remix
- Suggestions de code plus précises pour l'authentification
- Meilleure gestion des erreurs et des patterns

## Utilisation recommandée

1. **Pour les contrôleurs NestJS** : Context7 fournira la documentation des décorateurs et guards
2. **Pour les routes Remix** : Documentation des patterns loader/action
3. **Pour l'authentification** : Exemples de configuration Passport + Supabase Auth
4. **Pour Redis** : Patterns de cache et session management
5. **Pour Supabase** : Requêtes PostgreSQL optimisées et real-time subscriptions

## Test de la configuration

Une fois configuré, testez avec des questions comme :
- "Comment configurer un LocalAuthGuard NestJS avec Supabase ?"
- "Quels sont les patterns Remix pour l'authentification PostgreSQL ?"
- "Comment optimiser les requêtes Redis avec ioredis ?"
- "Comment intégrer Supabase Auth avec Passport dans NestJS ?"
