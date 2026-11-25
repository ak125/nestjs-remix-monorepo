import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, it, expect, vi } from "vitest";

import { MaybeLink } from "~/routes/blog-pieces-auto.conseils.$pg_alias";

vi.mock("~/utils/logger", () => ({
  logger: { log: vi.fn(), error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

/**
 * Carte R4 de la page conseils (mandat ER, C11 de la contre-vérification EV) :
 * page R4 redirigée vers cette page même → `canonicalUrl` null → carte gardée
 * sans lien (ni lien vers une 301, ni lien vers soi) ; sinon lien inchangé.
 */
const CLASS = "flex items-start gap-3 group";

function renderCard(to: string | null) {
  return render(
    <MemoryRouter>
      <MaybeLink to={to} className={CLASS}>
        <p>Disque de frein</p>
      </MaybeLink>
    </MemoryRouter>,
  );
}

describe("MaybeLink — carte R4 de la page conseils", () => {
  it("cible null → aucun lien, contenu gardé, classe group retirée", () => {
    const { container, getByText } = renderCard(null);
    expect(container.querySelector("a")).toBeNull();
    expect(getByText("Disque de frein")).toBeTruthy();
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.tagName).toBe("DIV");
    expect(wrapper.className).toBe("flex items-start gap-3");
  });

  it("cible présente → lien vers la cible, classe inchangée", () => {
    const { container } = renderCard("/reference-auto/alternateur");
    const a = container.querySelector("a");
    expect(a?.getAttribute("href")).toBe("/reference-auto/alternateur");
    expect(a?.className).toBe(CLASS);
    expect(a?.textContent).toBe("Disque de frein");
  });
});
