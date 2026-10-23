import { act } from "@testing-library/react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { Navbar } from "~/components/Navbar";

vi.mock("~/hooks/useRootData", () => ({
  useOptionalUser: () => null,
  useRootCart: () => null,
}));
vi.mock("~/components/navbar/CartSidebarSimple", () => ({
  CartSidebarSimple: () => null,
}));
vi.mock("~/components/navbar/UserDropdownMenu", () => ({
  UserDropdownMenu: () => null,
}));

/**
 * Les deux formulaires de recherche de l'en-tête n'avaient ni `action` ni
 * `method`, et leur champ s'appelait `search`. Avant l'hydratation (ou sans
 * JS), la soumission native partait donc en GET sur la page courante avec
 * `?search=…` : l'accueil ne montrait aucune pièce, le blog filtrait ses
 * articles. La route `/search` lit `q`.
 *
 * Le rendu serveur est ce que le navigateur soumet tant que React n'a pas
 * repris la main : c'est lui qu'on vérifie.
 */
describe("Navbar — recherche soumise nativement vers /search?q=", () => {
  function serverRenderedForms() {
    const html = renderToString(
      <MemoryRouter initialEntries={["/"]}>
        <Navbar />
      </MemoryRouter>,
    );
    const doc = new DOMParser().parseFromString(html, "text/html");
    return [...doc.querySelectorAll("form")].filter((form) =>
      form.querySelector('input[type="search"]'),
    );
  }

  it("rend les deux formulaires de l'en-tête (mobile et bureau)", () => {
    expect(serverRenderedForms()).toHaveLength(2);
  });

  it("chaque formulaire cible /search en GET avec le champ q", () => {
    for (const form of serverRenderedForms()) {
      expect(form.getAttribute("action")).toBe("/search");
      expect(form.getAttribute("method")).toBe("get");

      const named = [...form.querySelectorAll("input[name]")].map((input) =>
        input.getAttribute("name"),
      );
      expect(named).toEqual(["q"]);
    }
  });
});

/**
 * Champ contrôlé (`value={state}`) : l'hydratation remettait à vide un texte
 * tapé avant elle, puis Entrée ne faisait rien. Mesuré sur DEV : « plaquette »
 * saisi au `load`, valeur `""` une fois l'hydratation faite, URL inchangée.
 */
describe("Navbar — texte saisi avant l'hydratation", () => {
  function SearchProbe() {
    return <p data-probe>{useLocation().search}</p>;
  }

  it("survit à l'hydratation et part vers /search?q=", async () => {
    globalThis.ResizeObserver ??= class {
      observe() {}
      disconnect() {}
      unobserve() {}
    };
    const tree = (
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route path="/" element={<Navbar />} />
          <Route path="/search" element={<SearchProbe />} />
        </Routes>
      </MemoryRouter>
    );
    const container = document.createElement("div");
    container.innerHTML = renderToString(tree);
    document.body.appendChild(container);

    const input = container.querySelector<HTMLInputElement>(
      'input[type="search"]',
    )!;
    input.value = "plaquette";

    await act(async () => {
      hydrateRoot(container, tree);
    });
    expect(input.value).toBe("plaquette");

    await act(async () => {
      input.form!.requestSubmit();
    });
    expect(container.querySelector("[data-probe]")?.textContent).toBe(
      "?q=plaquette",
    );

    container.remove();
  });
});
