import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it } from "vitest";

import { NewsletterCTA } from "~/components/blog/NewsletterCTA";

afterEach(cleanup);

/**
 * Le bloc de fin de l'index blog affichait un formulaire « Je m'abonne » sans
 * traitement : `<Form>` sans action ni méthode (GET de la page courante), champ
 * e-mail sans `name`. Aucun endpoint d'abonnement ni aucun envoi d'articles
 * n'existe : l'adresse saisie était perdue et la page se rechargeait. Les
 * chiffres affichés (« plus de 10 000 passionnés », « 1 email/semaine ») ne
 * reposaient sur rien.
 *
 * Le bloc ne propose plus d'abonnement ; il garde les deux accès réels.
 */
describe("NewsletterCTA — aucun abonnement simulé", () => {
  function renderCta() {
    return render(
      <MemoryRouter>
        <NewsletterCTA />
      </MemoryRouter>,
    );
  }

  it("ne rend ni formulaire ni champ e-mail", () => {
    const { container } = renderCta();

    expect(container.querySelector("form")).toBeNull();
    expect(container.querySelector('input[type="email"]')).toBeNull();
    expect(screen.queryByRole("button", { name: /abonne/i })).toBeNull();
  });

  it("n'affiche aucune promesse ni chiffre sans source", () => {
    const { container } = renderCta();
    const text = container.textContent ?? "";

    expect(text).not.toMatch(/10 000/);
    expect(text).not.toMatch(/email\/semaine/i);
    expect(text).not.toMatch(/boîte mail/i);
  });

  it("garde les accès contact et catalogue", () => {
    renderCta();

    const hrefs = screen
      .getAllByRole("link")
      .map((link) => link.getAttribute("href"));
    expect(hrefs).toEqual(["/contact", "/catalogue"]);
  });
});
