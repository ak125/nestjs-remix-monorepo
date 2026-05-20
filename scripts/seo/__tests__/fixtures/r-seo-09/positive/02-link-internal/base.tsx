import type { MetaFunction } from "@remix-run/node";
import { Link } from "@remix-run/react";

export const meta: MetaFunction = () => [
  { title: "Catalog" },
  { tagName: "link", rel: "canonical", href: "https://example.com/catalog" },
];

export default function CatalogRoute() {
  return (
    <nav>
      <Link to="/products/old-slug">Products</Link>
      <Link to="/about">About</Link>
    </nav>
  );
}
