/**
 * Normalisation React Router v8 « single-fetch ».
 *
 * Sur une navigation CLIENT, RR8 requête les données de la route à
 * `<pathname>.data`. Le framework retire ce suffixe pour le MATCHING de route
 * (donc `params.*` est toujours propre), mais l'objet `request` passé au loader
 * conserve le suffixe sur `request.url`. Tout loader qui dérive un pathname de
 * `request.url` pour le passer à un résolveur interne (substitution, redirects,
 * migration legacy) DOIT retirer ce suffixe — sinon le résolveur reçoit une URL
 * inexistante et échoue silencieusement : 404 sur une page valide, ou 301 legacy
 * qui ne se déclenche pas en navigation client.
 *
 * Incident 2026-06-25 :
 *   - R1 `/pieces/<gamme>-<id>.html` → 404 en navigation client (substitution).
 *   - catch-all `$.tsx` → 301 legacy (`/blog`, `/pieces-auto/*`) non déclenchés.
 *
 * ⚠️ Préserve l'encodage : opère sur le pathname BRUT (encodé), ne décode rien.
 * Les pipelines qui attendent un pathname encodé (détection garbage base64,
 * gestion `%20`, `encodeURIComponent` côté appel API) restent intacts — seul le
 * suffixe `.data` final est retiré.
 *
 * NB : ne gère que la forme `<path>.data` (routes non-index). La route index
 * (`/` → `/_root.data`) n'utilise pas ce helper.
 */
const SINGLE_FETCH_SUFFIX = /\.data$/;

export function stripSingleFetchSuffix(pathname: string): string {
  return pathname.replace(SINGLE_FETCH_SUFFIX, "");
}
