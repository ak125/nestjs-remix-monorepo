import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import {
  NoProductsAlternatives,
  type NoProductsData,
} from "~/components/pieces/NoProductsAlternatives";

// Mock @remix-run/react Link as a plain <a> tag
vi.mock("@remix-run/react", () => ({
  Link: ({
    to,
    children,
    className,
  }: {
    to: string;
    children: React.ReactNode;
    className?: string;
  }) => (
    <a href={to} className={className}>
      {children}
    </a>
  ),
}));

// Mock sub-components that may have their own routing/data dependencies
vi.mock("~/components/errors/ErrorSearchBar", () => ({
  ErrorSearchBar: ({ placeholder }: { placeholder?: string }) => (
    <input placeholder={placeholder} />
  ),
}));

vi.mock("~/components/errors/PopularCategories", () => ({
  PopularCategories: ({ title }: { title?: string }) => (
    <div data-testid="popular-categories">{title}</div>
  ),
}));

function fixture(over: Partial<NoProductsData> = {}): NoProductsData {
  return {
    noProducts: true,
    gammeId: 3859,
    gammeAlias: "kit-de-freins-arriere",
    gammeName: "Kit de freins arrière",
    vehicleLabel: "BMW Série 5 525 d",
    vehicleContext: {
      marqueName: "BMW",
      modeleName: "Série 5 (F10-F18)",
      typeName: "525 d",
      typeFuel: "Diesel",
      typePowerPs: "218",
      yearFrom: "2011",
      yearTo: "2016",
    },
    alternativeVehicles: [
      {
        type_id: "11838",
        type_name: "530 d",
        type_alias: "3-0-530-d",
        type_fuel: "Diesel",
        type_power_ps: "258",
        type_year_from: "2011",
        type_year_to: "2016",
        modele_id: 33053,
        modele_name: "Série 5 (F10-F18)",
        modele_alias: "serie-5-f10-f18",
        marque_id: 33,
        marque_name: "BMW",
        marque_alias: "bmw",
        tier: 1,
      },
    ],
    alternativeGammes: [
      {
        pg_id: 3860,
        pg_name: "Disques arrière",
        pg_alias: "disques-arriere",
        pg_pic: null,
        piece_count: 42,
        tier: 1,
      },
    ],
    relatedModels: [
      {
        modele_id: 33054,
        modele_name: "Série 5 (G30-G31)",
        modele_alias: "serie-5-g30-g31",
        marque_id: 33,
        marque_name: "BMW",
        marque_alias: "bmw",
        representative_type_id: "12345",
        representative_type_alias: "3-0-530-d-g30",
      },
    ],
    ...over,
  };
}

describe("NoProductsAlternatives — 3 blocs hiérarchisés", () => {
  it("rend H1 contextualisé avec gamme + véhicule", () => {
    const { container } = render(<NoProductsAlternatives data={fixture()} />);
    const h1 = container.querySelector("h1");
    expect(h1).not.toBeNull();
    expect(h1!.textContent).toMatch(/Kit de freins arrière/);
    expect(h1!.textContent).toMatch(/BMW|525/);
  });

  it("affiche le bloc 1 — autres motorisations frères", () => {
    const { getAllByText } = render(
      <NoProductsAlternatives data={fixture()} />,
    );
    // h2 du bloc 1 doit évoquer "motorisations"
    const matches = getAllByText(/motorisations/i);
    expect(matches.length).toBeGreaterThan(0);
  });

  it("affiche le bloc 2 — gammes compatibles", () => {
    const { getByText } = render(<NoProductsAlternatives data={fixture()} />);
    expect(getByText(/Disques arrière/)).toBeDefined();
  });

  it("affiche le bloc 3 — autres générations (relatedModels)", () => {
    const { getAllByText } = render(
      <NoProductsAlternatives data={fixture()} />,
    );
    // h2 du bloc 3 contient "générations" et le lien contient "G30-G31"
    const matches = getAllByText(/G30-G31|autres générations/i);
    expect(matches.length).toBeGreaterThan(0);
  });

  it("contient un lien lead capture /contact?ref=soft-404 avec gamme & type", () => {
    const { container } = render(<NoProductsAlternatives data={fixture()} />);
    const lead = container.querySelector('a[href^="/contact?ref=soft-404"]');
    expect(lead).not.toBeNull();
    expect(lead!.getAttribute("href")!).toMatch(/gamme=3859/);
    expect(lead!.getAttribute("href")!).toMatch(/type=/);
  });

  it("si relatedModels est vide, le bloc 3 n'apparaît pas", () => {
    const { queryByText } = render(
      <NoProductsAlternatives data={fixture({ relatedModels: [] })} />,
    );
    expect(queryByText(/autres générations|G30-G31/i)).toBeNull();
  });
});
