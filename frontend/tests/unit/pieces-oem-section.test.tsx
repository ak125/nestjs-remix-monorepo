import { type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PiecesOemSection } from "~/components/pieces/PiecesOemSection";

type Props = ComponentProps<typeof PiecesOemSection>;

const vehicle: Props["vehicle"] = {
  marque: "DACIA",
  modele: "LOGAN I",
  type: "1.4 MPI",
  typeId: 18389,
  marqueId: 47,
  modeleId: 47017,
};
const gamme: Props["gamme"] = {
  id: 10,
  name: "Courroie d'accessoire",
  alias: "courroie-d-accessoire",
  description: "",
};

function renderSection(groupedPieces: Props["groupedPieces"]) {
  const container = document.createElement("div");
  container.innerHTML = renderToStaticMarkup(
    <PiecesOemSection
      groupedPieces={groupedPieces}
      vehicle={vehicle}
      gamme={gamme}
    />,
  );
  return container;
}

describe("PiecesOemSection — references without unsupported advice", () => {
  it("does not append braking advice or a quality promise to a belt reference", () => {
    const container = renderSection([
      { title_h2: "Courroie", oemRefs: ["OEM-COURROIE-TEST"] },
    ]);

    expect(container.textContent).not.toMatch(/Sécurité freinage|ECE R90/);
    expect(container.textContent).not.toMatch(
      /Équivalences de qualité|même niveau de qualité|voire supérieur/,
    );
    expect(
      container.querySelector('[title="Référence OEM DACIA - Courroie"]')
        ?.textContent,
    ).toBe("OEM-COURROIE-TEST");
  });

  it("preserves each reference under its source group and the vehicle context", () => {
    const container = renderSection([
      { title_h2: "Groupe Avant", oemRefs: ["OEM-AV-A", "OEM-AV-B"] },
      { title_h2: "Sans référence", oemRefs: [] },
      { title_h2: "Groupe Arrière", oemRefs: ["OEM-AR-A"] },
    ]);

    expect(container.querySelector("h2")?.textContent).toBe(
      "Références constructeur (OEM) DACIA",
    );
    expect(container.textContent).toContain("DACIA LOGAN I 1.4 MPI");
    const groups = Array.from(container.querySelectorAll("h3"));
    expect(groups.map((heading) => heading.textContent)).toEqual([
      "Références OEM Groupe Avant LOGAN I2 réfs",
      "Références OEM Groupe Arrière LOGAN I1 réf",
    ]);
    expect(
      groups.map((heading) =>
        Array.from(heading.parentElement!.querySelectorAll("span[title]")).map(
          (reference) => reference.textContent,
        ),
      ),
    ).toEqual([["OEM-AV-A", "OEM-AV-B"], ["OEM-AR-A"]]);
    expect(container.querySelector("details summary")?.textContent).toContain(
      "Qu'est-ce qu'une référence OEM ?",
    );
  });

  it.each<{ groups: Props["groupedPieces"] }>([
    { groups: [] },
    { groups: [{}] },
    { groups: [{ oemRefs: [] }] },
  ])(
    "renders no section when the catalog has no OEM references: $groups",
    ({ groups }) => {
      expect(renderSection(groups).innerHTML).toBe("");
    },
  );
});
