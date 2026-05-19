import type { MetaFunction } from "@remix-run/node";

/**
 * Renders a marketing page with SEO defaults.
 *
 * @returns A simple page element.
 */
export const meta: MetaFunction = () => [
  // Page title shown in tab + serp
  { title: "Page" },
  { name: "description", content: "Lorem ipsum" },
];

export default function Page() {
  return <div>hello</div>;
}
