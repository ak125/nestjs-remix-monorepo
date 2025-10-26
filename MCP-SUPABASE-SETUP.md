# 🔧 Configuration MCP Supabase

## 📋 Credentials Supabase

**URL Supabase :**
```
https://cxpojprgwgubzjyqzmoq.supabase.co
```

**Service Role Key :** (dans .env backend)

---

## 🚀 Installation MCP Supabase

### Option 1 : Via GitHub Copilot Settings (Recommandé)

1. Ouvrir les settings GitHub Copilot dans VS Code
2. Chercher "MCP Servers" ou "Model Context Protocol"
3. Ajouter un nouveau serveur :
   - **Nom :** `supabase`
   - **Command :** `npx`
   - **Args :** `["-y", "@modelcontextprotocol/server-supabase"]`
   - **Env :**
     - `SUPABASE_URL`: `https://cxpojprgwgubzjyqzmoq.supabase.co`
     - `SUPABASE_SERVICE_ROLE_KEY`: (copier depuis `.env`)

### Option 2 : Configuration manuelle

Créer/éditer le fichier de configuration MCP (localisation selon votre OS) :

**macOS/Linux :**
```bash
~/.config/Code/User/globalStorage/github.copilot-chat/mcp-settings.json
```

**Windows :**
```
%APPDATA%\Code\User\globalStorage\github.copilot-chat\mcp-settings.json
```

**Contenu :**
```json
{
  "mcpServers": {
    "supabase": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-supabase"],
      "env": {
        "SUPABASE_URL": "https://cxpojprgwgubzjyqzmoq.supabase.co",
        "SUPABASE_SERVICE_ROLE_KEY": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN4cG9qcHJnd2d1YnpqeXF6bW9xIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjUzNDU5NSwiZXhwIjoyMDY4MTEwNTk1fQ.ta_KmARDalKoBf6pIKNwZM0e6cBGO3F15CEgfw0lkzY"
      }
    }
  }
}
```

### Option 3 : Variables d'environnement Codespaces

Ajouter dans les secrets GitHub Codespaces :

1. Aller sur GitHub → Settings → Codespaces
2. Ajouter secrets :
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`

---

## ✅ Vérification installation

Une fois MCP Supabase configuré, je pourrai :

```
# Lister toutes les tables
mcp supabase list_tables

# Voir le schéma d'une table
mcp supabase describe_table pieces_gamme

# Exécuter des requêtes
mcp supabase query "SELECT pg_id, pg_alias FROM pieces_gamme LIMIT 5"
```

---

## 🎯 Bénéfices immédiats

Avec MCP Supabase actif, je pourrai :

1. ✅ **Voir automatiquement** toutes vos tables
2. ✅ **Connaître les colonnes** exactes (plus besoin de demander)
3. ✅ **Générer le code** avec les bons noms
4. ✅ **Tester les requêtes** avant de les mettre dans le code
5. ✅ **Corriger le sitemap** en utilisant les vraies données DB

---

## 🚀 Prochaine étape

**Une fois MCP Supabase configuré** (dites-moi quand c'est fait), je pourrai :

1. Lister vos tables automatiquement
2. Voir le schéma exact de `pieces_gamme`, `auto_marque`, etc.
3. Corriger le `sitemap.service.ts` avec les VRAIES colonnes
4. Générer un sitemap parfait avec toutes les URLs

---

**Voulez-vous que je vous guide pour l'installation MCP Supabase ?** 

Ou préférez-vous que je corrige le sitemap manuellement en vous demandant les noms de colonnes exacts ?
