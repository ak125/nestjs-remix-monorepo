import { redirect } from "react-router";

/**
 * Redirect legacy /client/orders to /account/orders
 * Old emails contained these URLs — keep redirect for backwards compat
 */
export function loader() {
  return redirect("/account/orders", 301);
}
