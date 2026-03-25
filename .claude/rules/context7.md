# Context7 MCP — Usage frugal

1. **Uniquement** pour API/syntaxe specifique d'une lib (NestJS, Remix, Supabase, Zod). Pas pour logique/archi/debug.
2. Cibler 1 seule lib avec son ID direct + parametre `topic`. Tokens max : 5000 (3000 pour verif rapide).
3. **Max 1 appel par question.** Reformuler plutot que relancer.
4. **Jamais** pour : deps internes (@fafa/*, @repo/*), Docker, .env, code metier.
5. Resumer 5-10 points max. Cache mental si deja recupere dans la conversation.
6. **Pas d'auto-invoke** — uniquement sur demande explicite ou risque d'hallucination API recente.
