import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import EquipementiersSection from "~/components/pieces/EquipementiersSection";

afterEach(() => {
  cleanup();
});

/**
 * Régression — la section équipementiers des pages gamme (R1) fabriquait des
 * liens `/pieces-{marque}.html` (ex. /pieces-monroe.html). Aucune page ne
 * correspond à ce motif : le catch-all le classe « ancien lien équipementier »
 * (PR #133), et le payload backend ne porte aucune URL. Chaque page gamme
 * envoyait donc jusqu'à 6 liens internes vers des pages inexistantes
 * (constaté en PROD le 2026-10-10 sur /pieces/amortisseur-854.html).
 */
describe("EquipementiersSection — aucune URL inventée", () => {
  const renderSection = () =>
    render(
      <MemoryRouter>
        <EquipementiersSection
          equipementiers={{
            title: "Équipementiers",
            items: [
              {
                pm_id: 0,
                pm_name: "MONROE",
                pm_logo: "/logos/monroe.webp",
                title: "MONROE",
                image: "",
                description: "120 références disponibles",
              },
              {
                pm_id: 1,
                pm_name: "MANN-FILTER",
                pm_logo: "/logos/mann.webp",
                title: "MANN-FILTER",
                image: "",
                description: "80 références disponibles",
              },
            ],
          }}
        />
      </MemoryRouter>,
    );

  it("ne rend aucun lien", () => {
    const { container } = renderSection();

    expect(container.querySelectorAll("a")).toHaveLength(0);
  });

  it("garde les marques et leur description", () => {
    renderSection();

    expect(screen.getByText("MONROE")).toBeTruthy();
    expect(screen.getByText("120 références disponibles")).toBeTruthy();
    expect(screen.getByText("MANN-FILTER")).toBeTruthy();
  });
});
