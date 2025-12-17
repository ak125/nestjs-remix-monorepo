/**
 * Route de compatibilité /recherche
 *
 * Pourquoi cette route existe :
 * - Le JSON-LD SearchAction de la homepage pointe vers /recherche?q={query}
 * - Sans cette route, les requêtes tombent sur NestJS (potentiel XSS)
 * - Remix intercepte et sert la même page que /search (sans redirection)
 *
 * Pattern utilisé : ré-export des exports de search.tsx
 * L'URL reste /recherche dans le navigateur, le contenu est identique à /search
 *
 * @see frontend/app/routes/_index.tsx - SearchAction urlTemplate
 * @see frontend/app/routes/search.tsx - Page de recherche principale
 */
export { loader, meta, default } from "./search";
