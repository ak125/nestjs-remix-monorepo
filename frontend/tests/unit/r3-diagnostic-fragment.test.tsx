import { render, cleanup } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import { type GammeConseil } from "~/components/blog/conseil/section-config";
import { MiniDiagnosticTable } from "~/components/guide/MiniDiagnosticTable";
import { PageRoleValidatorService } from "../../../backend/src/modules/seo/validation/page-role-validator.service";

afterEach(cleanup);

const diagnostic: GammeConseil = {
  title: "Diagnostic rapide du disque de frein",
  content:
    "<table><tbody><tr><td>Vibration au freinage</td><td>Controle du disque</td></tr></tbody></table>",
  sectionType: "S2_DIAG",
  order: 7,
  qualityScore: null,
  sources: [],
  anchor: "diagnostic-rapide",
  legacyAnchor: "diagnostic-rapide-du-disque-de-frein",
};

function renderDiagnostic(section: GammeConseil) {
  return render(
    <MemoryRouter>
      <MiniDiagnosticTable section={section} />
    </MemoryRouter>,
  );
}

describe("R3 diagnostic — destination des anciennes URL R5", () => {
  it("le fragment de redirection et l'ancien fragment atteignent le meme tableau reel", () => {
    const { container } = renderDiagnostic(diagnostic);
    for (const anchor of [diagnostic.anchor, diagnostic.legacyAnchor]) {
      const nodes = container.querySelectorAll(`[id="${anchor}"]`);
      expect(nodes).toHaveLength(1);
      expect(nodes[0].querySelector("table")?.textContent).toContain(
        "Vibration au freinage",
      );
      expect(nodes[0].querySelector("h2")?.textContent).toBe(diagnostic.title);
    }
    expect(container.querySelectorAll("table")).toHaveLength(1);
    expect(
      container.querySelectorAll('[data-r3-section="S2_DIAG"]'),
    ).toHaveLength(1);
    expect(container.querySelector('[data-r3-section="S2_DIAG"]')?.id).toBe(
      "diagnostic-rapide",
    );
  });

  it("ne duplique pas un identifiant deja canonique", () => {
    const { container } = renderDiagnostic({
      ...diagnostic,
      legacyAnchor: diagnostic.anchor,
    });
    expect(container.querySelectorAll('[id="diagnostic-rapide"]')).toHaveLength(
      1,
    );
  });

  it("accepte les sections sans ancien fragment", () => {
    const { container } = renderDiagnostic({
      ...diagnostic,
      legacyAnchor: undefined,
    });
    expect(container.querySelectorAll('[id="diagnostic-rapide"]')).toHaveLength(
      1,
    );
    expect(container.querySelectorAll("table")).toHaveLength(1);
  });
});

// Cross the real renderer/validator boundary: the fixture is sanitized and
// composed by MiniDiagnosticTable/HtmlContent before the backend sees HTML.
describe("R3 diagnostic — SSR vers validation HTML", () => {
  it("valide le vrai rendu a trois colonnes et refuse une destination cassee", () => {
    const section = {
      ...diagnostic,
      content:
        "<table><thead><tr><th>Symptome</th><th>Cause</th><th>Action</th></tr></thead><tbody><tr><td>Bruit anormal</td><td>Usure possible</td><td>Verifier le signal</td></tr></tbody></table>",
    };
    const markup = renderToStaticMarkup(
      <MemoryRouter>
        <article>
          <MiniDiagnosticTable section={section} />
        </article>
      </MemoryRouter>,
    );
    const url = "/blog-pieces-auto/conseils/disque-de-frein";
    const html = `<html><head><link rel="canonical" href="${url}"></head><body>${markup}</body></html>`;
    const validator = new PageRoleValidatorService();
    expect(validator.validatePageWithHtml(url, "", html).isValid).toBe(true);
    expect(
      validator.validatePageWithHtml(
        url,
        "",
        html.replace('id="diagnostic-rapide"', 'id="fragment-casse"'),
      ).isValid,
    ).toBe(false);
  });
});
