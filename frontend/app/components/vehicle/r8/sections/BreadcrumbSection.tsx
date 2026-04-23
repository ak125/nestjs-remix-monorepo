// 🍞 R8 Vehicle — S_BREADCRUMB
// Schema.org BreadcrumbList microdata (for Google rich snippets).

import { type LoaderData } from "../r8.types";

interface Props {
  vehicle: LoaderData["vehicle"];
  breadcrumb: LoaderData["breadcrumb"];
}

export function BreadcrumbSection({ vehicle, breadcrumb }: Props) {
  return (
    <nav
      className="bg-white border-b border-gray-200 py-3"
      aria-label="Breadcrumb"
      data-section="S_BREADCRUMB"
    >
      <div className="container mx-auto px-4">
        <ol
          className="flex items-center gap-2 text-sm"
          itemScope
          itemType="https://schema.org/BreadcrumbList"
        >
          <li
            itemProp="itemListElement"
            itemScope
            itemType="https://schema.org/ListItem"
          >
            <a href="/" itemProp="item" className="hover:underline text-brand">
              <span itemProp="name">Accueil</span>
            </a>
            <meta itemProp="position" content="1" />
          </li>
          <li>
            <span className="text-gray-400">→</span>
          </li>
          <li
            itemProp="itemListElement"
            itemScope
            itemType="https://schema.org/ListItem"
          >
            <a
              href="/constructeurs"
              itemProp="item"
              className="hover:underline text-brand"
            >
              <span itemProp="name">Constructeurs</span>
            </a>
            <meta itemProp="position" content="2" />
          </li>
          <li>
            <span className="text-gray-400">→</span>
          </li>
          <li
            itemProp="itemListElement"
            itemScope
            itemType="https://schema.org/ListItem"
          >
            <a
              href={`/constructeurs/${vehicle.marque_alias}-${vehicle.marque_id}.html`}
              itemProp="item"
              className="hover:underline text-brand"
            >
              <span itemProp="name">{breadcrumb.brand}</span>
            </a>
            <meta itemProp="position" content="3" />
          </li>
          <li>
            <span className="text-gray-400">→</span>
          </li>
          <li
            itemProp="itemListElement"
            itemScope
            itemType="https://schema.org/ListItem"
          >
            <span itemProp="name" className="text-gray-600">
              {breadcrumb.model}
            </span>
            <meta itemProp="position" content="4" />
          </li>
          <li>
            <span className="text-gray-400">→</span>
          </li>
          <li
            itemProp="itemListElement"
            itemScope
            itemType="https://schema.org/ListItem"
          >
            <span itemProp="name" className="font-semibold text-gray-900">
              {vehicle.type_name} {vehicle.type_power_ps} ch
            </span>
            <meta itemProp="position" content="5" />
          </li>
        </ol>
      </div>
    </nav>
  );
}
