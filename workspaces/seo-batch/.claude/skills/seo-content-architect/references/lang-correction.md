# Correction Linguistique (OBLIGATOIRE)

> Référencée depuis `SKILL.md`. Toute sortie doit être irréprochable en français — y compris pour les données provenant de la BDD ou du RAG.

## Périmètre de correction

| Source | Action |
|--------|--------|
| Contenu rédigé par le skill | Corriger systématiquement avant livraison |
| Données BDD (titres, descriptions, FAQ, symptômes) | Corriger dans le contenu généré. Signaler les erreurs d'origine pour correction en base |
| Données RAG (knowledge docs) | Corriger dans le contenu généré. Signaler les erreurs d'origine |
| Données utilisateur | Corriger silencieusement sauf si le sens change |

## Règles de correction

1. **Orthographe** — Aucune faute tolérée (accents, doubles consonnes, mots composés)
   - ❌ "freinage d'urgance" → ✅ "freinage d'urgence"
   - ❌ "ammortisseur" → ✅ "amortisseur"

2. **Grammaire** — Accords (genre, nombre, participes), prépositions, syntaxe
   - ❌ "les plaquette de frein est usé" → ✅ "les plaquettes de frein sont usées"

3. **Conjugaison** — Temps, modes, accords du participe passé
   - ❌ "le disque à été changé" → ✅ "le disque a été changé"

4. **Typographie française** — Espaces insécables, guillemets « », ponctuation

## Si une erreur vient de la BDD ou du RAG

Générer des **requêtes MCP prêtes à exécuter** (pas de signalement passif) :

```
⚠️ Corrections BDD — requêtes MCP prêtes à exécuter :

mcp__claude_ai_Supabase__execute_sql:
  project_id: cxpojprgwgubzjyqzmoq
  query: UPDATE pieces_gamme SET label = 'Disque de frein' WHERE label = 'Disque de Freins';

Validation : SELECT pg_id, label FROM pieces_gamme WHERE pg_alias = 'disque-de-frein';
```

Pour les erreurs dans les knowledge docs RAG :

```
⚠️ Correction RAG — action Edit :
- Fichier : /opt/automecanik/rag/knowledge/gammes/{slug}.md
- Ligne {N} : "{erroné}" → "{corrigé}"
- Action : Edit tool sur le fichier source
```

> Ne JAMAIS publier du contenu avec des fautes, même si la source en contient.
> Toujours fournir la requête de correction ET la requête de validation.
