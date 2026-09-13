import { existsSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import CatalogueSection from "~/components/pieces/CatalogueSection";
import EquipementiersSection from "~/components/pieces/EquipementiersSection";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const cases = [
  {
    name: "catalogue",
    component: (
      <CatalogueSection
        catalogueMameFamille={{
          title: "Freinage",
          items: [
            {
              name: "Disque",
              link: "/pieces/disque.html",
              image: "/missing-piece.jpg",
              description: "",
              meta_description: "",
            },
          ],
        }}
      />
    ),
  },
  {
    name: "equipementier",
    component: (
      <EquipementiersSection
        equipementiers={{
          title: "Marques",
          items: [
            {
              pm_id: 1,
              pm_name: "Bosch",
              pm_logo: "/missing-logo.jpg",
              title: "Bosch",
              image: "",
              description: "",
            },
          ],
        }}
      />
    ),
  },
];

describe("catalogue image failure is bounded", () => {
  it.each(cases)(
    "$name tries a shipped fallback once, even when it also fails",
    ({ component }) => {
      const { container } = render(<MemoryRouter>{component}</MemoryRouter>);
      const image = container.querySelector("img")!;
      const alt = image.alt;
      const link = image.closest("a")!.getAttribute("href");
      const setSource = vi.spyOn(HTMLImageElement.prototype, "src", "set");
      fireEvent.error(image);
      const fallback = image.getAttribute("src")!;
      expect(
        existsSync(new URL(`../../public${fallback}`, import.meta.url)),
      ).toBe(true);
      for (let i = 0; i < 100; i++) fireEvent.error(image);
      expect(setSource).toHaveBeenCalledTimes(1);
      expect(image.alt).toBe(alt);
      expect(image.closest("a")!.getAttribute("href")).toBe(link);
    },
  );
});
