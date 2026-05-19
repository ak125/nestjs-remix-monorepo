import type { MetaFunction } from "@remix-run/node";

export const meta: MetaFunction = () => [
  { title: "Page" },
  { tagName: "link", rel: "canonical", href: "https://example.com/old-path" },
];

export default function Page() {
  return <div />;
}
