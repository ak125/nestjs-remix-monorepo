# Context7 MCP — Regles d'usage frugal

> Context7 fournit la doc a jour des librairies via MCP. Ces regles evitent de gaspiller des tokens.

1. **N'utilise Context7 QUE si** la question porte sur une API/syntaxe specifique d'une bibliotheque (NestJS, Remix, Supabase, Zod, etc.). Pour les questions de logique, architecture ou debogage -> pas de Context7.

2. **Si la question est generale** ("comment structurer un module NestJS"), reponds avec tes connaissances. Context7 = uniquement pour verifier une API precise ou une syntaxe recente.

3. **Si une bibliotheque precise est mentionnee**, cible UNIQUEMENT cette bibliotheque avec son ID direct (ex: `/supabase/supabase`, `/vercel/next.js`). Ne resous jamais plusieurs bibliotheques a la fois.

4. **Toujours utiliser le parametre `topic`** pour cibler un sous-sujet (ex: topic="routing", topic="auth", topic="hooks") plutot que charger toute la doc.

5. **Limiter les tokens a 5000 max** (au lieu du defaut 10000). Utiliser `tokens: 3000` pour des verifications rapides de signature/syntaxe.

6. **Maximum 1 appel Context7 par question.** Si le premier resultat ne suffit pas, reformuler la query plutot que relancer.

7. **Ne jamais appeler Context7 pour** : les dependances internes du projet (@fafa/ui, @repo/database-types, @monorepo/shared-types), la config Docker, les fichiers .env, ou le code metier AutoMecanik.

8. **Resumer et ne garder que 5-10 points** de la doc retournee. Ne jamais injecter la doc brute complete dans la reponse.

9. **Cache mental** : si une info de doc a deja ete recuperee dans la conversation en cours, la reutiliser sans rappeler Context7.

10. **Skip auto-invoke** : ne PAS invoquer Context7 automatiquement. Ne l'appeler que sur demande explicite ("use context7") ou quand l'IA detecte un risque d'hallucination sur une API recente.
