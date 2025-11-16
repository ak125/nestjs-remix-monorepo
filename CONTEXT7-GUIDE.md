# Context7 MCP - Guide d'utilisation

Context7 MCP est configuré pour fournir de la documentation à jour directement dans Copilot.

## 🚀 Utilisation rapide

### Méthode 1 : Ajouter "use context7" à votre prompt

```
Crée un service NestJS pour gérer les notifications par email. use context7
```

### Méthode 2 : Utiliser l'ID de bibliothèque directement

```
Implémente un guard d'authentification JWT avec Supabase.
use library /nestjs/nest and /supabase/supabase for API and docs
```

### Méthode 3 : Automatique (recommandé)

Les règles sont configurées dans `.github/.copilot-instructions.md` pour utiliser automatiquement Context7 quand nécessaire.

## 📚 Bibliothèques disponibles

### Backend
- **NestJS**: `/nestjs/nest` - Framework backend
- **Supabase**: `/supabase/supabase` - Base de données et auth
- **TypeORM**: `/typeorm/typeorm` - ORM (si utilisé)
- **Redis**: `/redis/node-redis` - Cache

### Frontend
- **Remix**: `/remix-run/remix` - Framework fullstack
- **React**: `/facebook/react` - UI library
- **TailwindCSS**: `/tailwindlabs/tailwindcss` - Styling

### Utilitaires
- **TypeScript**: `/microsoft/TypeScript` - Langage
- **Zod**: `/colinhacks/zod` - Validation de schémas
- **date-fns**: `/date-fns/date-fns` - Manipulation de dates

## 💡 Exemples concrets pour ce projet

### Créer un nouveau service NestJS

```
Crée un service NestJS pour gérer les notifications push.
Le service doit :
- S'injecter dans NotificationsModule
- Utiliser Supabase pour stocker les tokens
- Envoyer via Firebase Cloud Messaging
use library /nestjs/nest and /supabase/supabase for API and docs
```

### Ajouter une route Remix avec loader

```
Crée une route Remix pour /orders/:id qui :
- Charge les détails de la commande via loader
- Affiche le client et les lignes de commande
- Gère l'état de chargement et les erreurs
use library /remix-run/remix for API and docs
```

### Implémenter un guard NestJS

```
Crée un guard NestJS qui vérifie :
- Token JWT dans les headers Authorization
- Valide le token avec Supabase
- Attache l'utilisateur à la requête
- Retourne 401 si non authentifié
use library /nestjs/nest and /supabase/supabase for API and docs
```

### Ajouter du cache Redis

```
Ajoute du cache Redis dans OrdersService pour :
- Cacher les commandes pendant 2 minutes
- Invalider le cache lors de création/modification
- Utiliser des clés avec préfixe orders:
use library /nestjs/nest and /redis/node-redis for API and docs
```

## 🔧 Configuration avancée

### Augmenter les limites (API key recommandée)

1. Créez un compte sur [context7.com/dashboard](https://context7.com/dashboard)
2. Obtenez votre API key
3. Ajoutez-la dans `.vscode/settings.json` :

```json
{
  "github.copilot.chat.mcp.servers": {
    "context7": {
      "command": "npx",
      "args": ["-y", "@upstash/context7-mcp"],
      "env": {
        "CONTEXT7_API_KEY": "votre_api_key_ici"
      }
    }
  }
}
```

### Limiter les tokens retournés

Par défaut, Context7 retourne jusqu'à 5000 tokens de documentation. Vous pouvez ajuster :

```
Crée un middleware Express pour la validation.
use context7 with max 2000 tokens
```

## 🎯 Bonnes pratiques

1. **Soyez spécifique** : Plus votre prompt est détaillé, meilleure sera la documentation retournée
2. **Mentionnez les versions** : Si vous utilisez une version spécifique (ex: NestJS 10.x)
3. **Combinez les bibliothèques** : `use library /nestjs/nest and /supabase/supabase`
4. **Vérifiez toujours** : La documentation est à jour mais vérifiez l'implémentation
5. **Signalez les problèmes** : Utilisez le bouton "Report" sur context7.com si nécessaire

## 📊 Monitoring

Context7 MCP fonctionne en arrière-plan. Pour vérifier qu'il fonctionne :

1. Ouvrez le panneau Copilot Chat
2. Posez une question avec "use context7"
3. Vous devriez voir Context7 mentionné dans la réponse

## 🆘 Dépannage

### Context7 ne répond pas

1. Vérifiez que MCP est activé : `.vscode/settings.json` → `"github.copilot.chat.mcp.enabled": true`
2. Rechargez VS Code : Cmd/Ctrl + Shift + P → "Reload Window"
3. Vérifiez les logs : Output → "GitHub Copilot Chat"

### Documentation incorrecte

1. Vérifiez l'ID de bibliothèque : `/nestjs/nest` (pas `nestjs` ou `nest`)
2. Spécifiez le sujet : `use context7 for dependency injection`
3. Signalez sur [context7.com](https://context7.com)

### Trop lent

1. Réduisez les tokens : `with max 2000 tokens`
2. Utilisez une API key pour de meilleures performances
3. Soyez plus spécifique dans vos prompts

## 📖 Ressources

- Documentation officielle : [context7.com](https://context7.com)
- Repository GitHub : [upstash/context7](https://github.com/upstash/context7)
- Ajouter des bibliothèques : [Guide de contribution](https://github.com/upstash/context7#-adding-projects)
