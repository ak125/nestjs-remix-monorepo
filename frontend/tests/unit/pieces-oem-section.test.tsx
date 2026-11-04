import { type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PiecesOemSection } from "~/components/pieces/PiecesOemSection";

import pilot from "./fixtures/oem-filtre-huile-7-type-19052.json";

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

describe("PiecesOemSection — source-backed mounting position", () => {
  it("does not invent a rear mounting position for the real pg7/type19052 payload", () => {
    const html = renderToStaticMarkup(<PiecesOemSection {...pilot} />);
    const container = document.createElement("div");
    container.innerHTML = html;
    expect(container.textContent).not.toMatch(/à l'avant|à l'arrière/);
    expect(container.textContent).toContain("Filtre à huile");
    expect(container.textContent).toContain("CLIO III");
    // FH-7 : pas d'équipementiers de freinage cités en exemple sur un filtre à huile.
    expect(container.textContent).not.toMatch(/Bosch|TRW|Brembo/);
    expect(container.querySelectorAll("span[title]")).toHaveLength(
      pilot.groupedPieces[0].oemRefs.length,
    );
    expect(
      Array.from(
        container.querySelectorAll("span[title]"),
        (x) => x.textContent,
      ),
    ).toEqual(pilot.groupedPieces[0].oemRefs);
  });

  it.each<{ fields: Props["groupedPieces"][number]; expected: string }>([
    { fields: { filtre_side: "Avant" }, expected: "à l'avant" },
    { fields: { filtre_side: "Arrière" }, expected: "à l'arrière" },
    { fields: { title_h2: "Disques avant" }, expected: "à l'avant" },
    { fields: { title_h2: "Disques arrière" }, expected: "à l'arrière" },
  ])(
    "preserves explicit mounting positions $fields",
    ({ fields, expected }) => {
      expect(
        renderSection([{ ...fields, oemRefs: ["OEM-TEST"] }]).textContent,
      ).toContain(expected);
    },
  );

  it.each([
    {},
    { filtre_side: "" },
    { filtre_side: "Non renseigné" },
    { filtre_side: "Avant et arrière" },
    { filtre_side: "Avant", title_h2: "Disques arrière" },
  ])("omits a position when absent or contradictory %j", (fields) => {
    expect(
      renderSection([{ ...fields, oemRefs: ["OEM-TEST"] }]).textContent,
    ).not.toMatch(/à l'avant|à l'arrière/);
  });

  it("takes the example from a populated source group instead of inventing a reference", () => {
    const container = renderSection([
      { oemRefs: [] },
      { oemRefs: ["OEM-REAL-SECOND-GROUP"] },
    ]);
    expect(container.querySelector("details code")?.textContent).toBe(
      "OEM-REAL-SECOND-GROUP",
    );
    expect(container.textContent).not.toContain("41 06 003 79R");
  });
});
