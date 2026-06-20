import { redirect, type LoaderFunctionArgs } from "react-router";

/**
 * Redirect legacy /client/orders/:id URLs to /account/orders/:id
 * Old emails contained these URLs — keep redirect for backwards compat
 */
export function loader({ params }: LoaderFunctionArgs) {
  return redirect(`/account/orders/${params.id}`, 301);
}
