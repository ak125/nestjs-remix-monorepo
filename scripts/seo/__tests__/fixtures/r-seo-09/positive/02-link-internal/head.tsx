import type { MetaFunction } from "@remix-run/node";
import { Link } from "@remix-run/react";

export const meta: MetaFunction = () => [
  { title: "Catalog" },
  { tagName: "link", rel: "canonical", href: "https://example.com/catalog" },
];

export default function CatalogRoute() {
  return (
    <nav>
      <Link to="/products/new-slug">Products</Link>
      <Link to="/about-us">About</Link>
    </nav>
  );
}
