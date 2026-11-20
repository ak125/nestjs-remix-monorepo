/**
 * Cartes véhicule R1 (MotorisationsSection, variant « R1 ») — ligne de faits « Fabrication ».
 *
 * Source : auto_type.type_year_from / type_year_to. Une date de fin absente veut dire
 * « inconnue », pas « encore fabriqué » : la carte n'écrit donc pas « dès AAAA »
 * (complément n° 11 au mandat DS, constat DU §19).
 */
import { cleanup, render, screen } from "@testing-library/react";
import { createRoutesStub } from "react-router";
import { afterEach, describe, expect, it } from "vitest";

import MotorisationsSection from "~/components/pieces/MotorisationsSection";

afterEach(cleanup);

const item = (
  title: string,
  type_year_from: string | null,
  type_year_to: string | null,
) => ({
  title,
  marque_name: "DACIA",
  modele_name: title,
  type_name: "1.5 dCi",
  puissance: "68 ch",
  periode: "",
  type_year_from,
  type_year_to,
  image: "",
  link: `/pieces/filtre-a-huile-7/dacia-1/${title.toLowerCase()}-1/1-5-dci-1.html`,
  description: "",
  advice: "",
});

const ITEMS = [
  item("DEBUTETFIN", "2005", "2012"),
  item("DEBUTSEUL", "2008", null),
  item("FINSEULE", null, "2012"),
  item("AUCUNE", null, null),
  item("EGALES", "2011", "2011"),
];

function renderCards() {
  const Stub = createRoutesStub([
    {
      path: "/",
      Component: () => (
        <MotorisationsSection
          variant="R1"
          motorisations={{ title: "Motorisations", items: ITEMS }}
        />
      ),
    },
  ]);
  return render(<Stub initialEntries={["/"]} />);
}

/** Texte de la ligne de faits d'une carte (espaces insécables normalisés), ou null. */
async function ligne(title: string): Promise<string | null> {
  const h3 = await screen.findByRole("heading", { name: new RegExp(title) });
  const carte = h3.closest("a");
  expect(carte).not.toBeNull();
  const p = [...carte!.querySelectorAll("p")].find((e) =>
    /fabrication/i.test(e.textContent ?? ""),
  );
  return p ? (p.textContent ?? "").replace(/\s+/g, " ").trim() : null;
}

describe("cartes véhicule R1 — ligne « Fabrication »", () => {
  it("début et fin : « Fabrication : début–fin »", async () => {
    renderCards();
    expect(await ligne("DEBUTETFIN")).toBe("Fabrication : 2005–2012");
  });

  it("début seul : « Début de fabrication : AAAA », jamais « dès »", async () => {
    renderCards();
    const t = await ligne("DEBUTSEUL");
    expect(t).toBe("Début de fabrication : 2008");
    expect(t).not.toMatch(/dès|depuis/i);
  });

  it("fin seule : « Fin de fabrication : AAAA »", async () => {
    renderCards();
    expect(await ligne("FINSEULE")).toBe("Fin de fabrication : 2012");
  });

  it("aucune date : pas de ligne", async () => {
    renderCards();
    expect(await ligne("AUCUNE")).toBeNull();
  });

  it("années égales : « Fabrication : AAAA »", async () => {
    renderCards();
    expect(await ligne("EGALES")).toBe("Fabrication : 2011");
  });
});
