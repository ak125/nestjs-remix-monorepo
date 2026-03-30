import { type LoaderFunctionArgs, redirect } from "@remix-run/node";

/**
 * GET /auth/register → 301 redirect to /register
 * The frontend registration page lives at /register (_public+/register.tsx).
 * This redirect catches external links, bookmarks, or crawlers hitting /auth/register.
 */
export function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const target = new URL("/register", url.origin);
  // Preserve query params (e.g. ?redirectTo=...)
  url.searchParams.forEach((value, key) => target.searchParams.set(key, value));
  return redirect(target.toString(), 301);
}
