/**
 * buildGuideSchemas — FAQPage des pages conseil.
 *
 * La section S8 est affichée telle qu'elle est stockée. Le FAQPage doit donc
 * lire les balisages réellement stockés, pas un seul d'entre eux : sinon une
 * FAQ visible n'a pas de données structurées.
 */
import { describe, expect, it } from "vitest";

import { type GammeConseil } from "~/components/blog/conseil/section-config";
import { buildGuideSchemas } from "~/components/guide/guide-schemas";

const URL =
  "https://www.automecanik.com/blog-pieces-auto/conseils/machoires-de-frein";

const article = {
  title: "Mâchoires de frein",
  meta_description: "Guide",
  publishedAt: "2026-10-30",
  keywords: [],
};

const s8 = (content: string, order = 85): GammeConseil => ({
  title: "Questions fréquentes",
  content,
  sectionType: "S8",
  order,
  qualityScore: null,
  sources: [],
});

const faq = (conseil: GammeConseil[] | null) =>
  buildGuideSchemas(article, conseil, URL).faqSchema as {
    "@type": string;
    "@id": string;
    url: string;
    mainEntity: {
      "@type": string;
      name: string;
      acceptedAnswer: { "@type": string; text: string };
    }[];
  } | null;

const questions = (conseil: GammeConseil[] | null) =>
  faq(conseil)?.mainEntity.map((entity) => entity.name);

describe("buildGuideSchemas — FAQPage, balisages stockés", () => {
  it("lit <details><summary><b> (balisage d'origine, sortie inchangée)", () => {
    const schema = faq([
      s8(
        "<details><summary><b>Mâchoires OE ou adaptables ?</b></summary><p>Les deux conviennent si la référence correspond.</p></details> " +
          "<details><summary><b>Quand les remplacer ?</b></summary><p>Quand la garniture atteint la cote minimale.</p></details> " +
          "<details><summary><b>Faut-il changer le kit ?</b></summary><p>Oui, les ressorts fatiguent avec les garnitures.</p></details>",
      ),
    ]);

    expect(schema).toEqual({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "@id": `${URL}#faq`,
      url: URL,
      mainEntity: [
        {
          "@type": "Question",
          name: "Mâchoires OE ou adaptables ?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Les deux conviennent si la référence correspond.",
          },
        },
        {
          "@type": "Question",
          name: "Quand les remplacer ?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Quand la garniture atteint la cote minimale.",
          },
        },
        {
          "@type": "Question",
          name: "Faut-il changer le kit ?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Oui, les ressorts fatiguent avec les garnitures.",
          },
        },
      ],
    });
  });

  it("lit <summary><strong> dans un conteneur, avec retours à la ligne", () => {
    const content = `<div class="conseil-section">
<details><summary><strong>Mâchoires et plaquettes : quelle différence ?</strong></summary>
<p>Les plaquettes serrent un disque,
les mâchoires s'écartent dans un tambour.</p></details>
<details><summary><strong>Peut-on rouler avec des mâchoires usées ?</strong></summary>
<p>Non : le frein à main ne tient plus.</p></details>
<details><summary><strong>Combien de temps dure le remplacement ?</strong></summary>
<p>Comptez une demi-journée pour un essieu.</p></details>
</div>`;

    const schema = faq([s8(content)]);

    expect(schema?.mainEntity).toHaveLength(3);
    expect(schema?.mainEntity[0].name).toBe(
      "Mâchoires et plaquettes : quelle différence ?",
    );
    expect(schema?.mainEntity[0].acceptedAnswer.text).toBe(
      "Les plaquettes serrent un disque, les mâchoires s'écartent dans un tambour.",
    );
  });

  it("lit une question sans gras et une réponse balisée", () => {
    const schema = faq([
      s8(
        "<details><summary>Comment savoir si la pompe à carburant est HS ?</summary><p>Le moteur cale <strong>à chaud</strong>.</p><p>Il peine en côte.</p></details>" +
          "<details><summary>Quelle est sa durée de vie ?</summary><p>Elle dépend du niveau de carburant habituel.</p></details>" +
          "<details><summary>Peut-on la remplacer soi-même ?</summary><p>Oui, à l'écart de toute flamme.</p></details>",
      ),
    ]);

    expect(schema?.mainEntity).toHaveLength(3);
    expect(schema?.mainEntity[0].acceptedAnswer.text).toBe(
      "Le moteur cale à chaud. Il peine en côte.",
    );
  });

  it("lit <h3> suivi de la réponse, jusqu'à la question suivante", () => {
    const schema = faq([
      s8(
        "<h3>Tous les combien changer le filtre de boîte ?</h3>\n<p>Entre 60 000 et 100 000 km.</p>\n<p>Suivez le carnet d'entretien.</p>\n" +
          "<h3>Faut-il vidanger en même temps ?</h3>\n<p>Oui, le filtre se remplace avec l'huile.</p>\n" +
          "<h3>Quels sont les signes d'un filtre colmaté ?</h3>\n<p>Des passages de rapports lents ou brutaux.</p>",
      ),
    ]);

    expect(
      schema?.mainEntity.map((entity) => [
        entity.name,
        entity.acceptedAnswer.text,
      ]),
    ).toEqual([
      [
        "Tous les combien changer le filtre de boîte ?",
        "Entre 60 000 et 100 000 km. Suivez le carnet d'entretien.",
      ],
      [
        "Faut-il vidanger en même temps ?",
        "Oui, le filtre se remplace avec l'huile.",
      ],
      [
        "Quels sont les signes d'un filtre colmaté ?",
        "Des passages de rapports lents ou brutaux.",
      ],
    ]);
  });

  it("ne compte pas deux fois une question en <h3> dans un <summary>", () => {
    expect(
      questions([
        s8(
          "<details><summary><h3>Première question posée ?</h3></summary><p>Première réponse donnée.</p></details>" +
            "<details><summary><h3>Deuxième question posée ?</h3></summary><p>Deuxième réponse donnée.</p></details>" +
            "<details><summary><h3>Troisième question posée ?</h3></summary><p>Troisième réponse donnée.</p></details>",
        ),
      ]),
    ).toEqual([
      "Première question posée ?",
      "Deuxième question posée ?",
      "Troisième question posée ?",
    ]);
  });

  it("réunit plusieurs sections S8 et retire les marqueurs de lien non résolus", () => {
    expect(
      questions([
        s8(
          "<details><summary>Première question posée ?</summary><p>Voir #LinkGamme_12# pour la pièce.</p></details>" +
            "<details><summary>Deuxième question posée ?</summary><p>Deuxième réponse donnée.</p></details>",
          85,
        ),
        s8(
          "<details><summary>Troisième question posée ?</summary><p>Troisième réponse donnée.</p></details>",
          86,
        ),
      ]),
    ).toHaveLength(3);
    expect(
      faq([
        s8(
          "<details><summary>Première question posée ?</summary><p>Voir #LinkGamme_12# pour la pièce.</p></details>" +
            "<details><summary>Deuxième question posée ?</summary><p>Deuxième réponse donnée.</p></details>" +
            "<details><summary>Troisième question posée ?</summary><p>Troisième réponse donnée.</p></details>",
        ),
      ])?.mainEntity[0].acceptedAnswer.text,
    ).toBe("Voir pour la pièce.");
  });
});

describe("buildGuideSchemas — FAQPage, pas d'émission", () => {
  it("n'émet rien sans section S8, sans contenu ou sans sections", () => {
    expect(faq(null)).toBeNull();
    expect(faq([])).toBeNull();
    expect(faq([s8("")])).toBeNull();
    expect(
      faq([
        {
          ...s8("<h3>Question posée ici ?</h3><p>Réponse.</p>"),
          sectionType: "S7",
        },
      ]),
    ).toBeNull();
  });

  it("n'émet rien en dessous de trois paires", () => {
    expect(
      faq([
        s8(
          "<details><summary>Première question posée ?</summary><p>Première réponse donnée.</p></details>" +
            "<details><summary>Deuxième question posée ?</summary><p>Deuxième réponse donnée.</p></details>",
        ),
      ]),
    ).toBeNull();
    expect(
      faq([
        s8(
          "<h3>Première question posée ?</h3><p>Première réponse donnée.</p>" +
            "<h3>Deuxième question posée ?</h3><p>Deuxième réponse donnée.</p>",
        ),
      ]),
    ).toBeNull();
  });

  it("écarte les paires dont la question ou la réponse est vide", () => {
    expect(
      faq([
        s8(
          "<details><summary>Première question posée ?</summary><p>Première réponse donnée.</p></details>" +
            "<details><summary>Deuxième question posée ?</summary><p>Deuxième réponse donnée.</p></details>" +
            "<details><summary>Troisième question posée ?</summary><p> </p></details>" +
            "<details><summary> ? </summary><p>Réponse sans question.</p></details>",
        ),
      ]),
    ).toBeNull();
  });

  it("ne devine pas une FAQ dans un balisage qu'il ne connaît pas", () => {
    expect(
      faq([
        s8(
          "<p><strong>La chaîne s'use-t-elle ?</strong><br/>Oui, elle s'allonge.</p>" +
            "<p><strong>Quand la remplacer ?</strong><br/>Au premier bruit de cliquetis.</p>" +
            "<p><strong>Faut-il changer le tendeur ?</strong><br/>Oui, avec la chaîne.</p>",
        ),
      ]),
    ).toBeNull();
    expect(
      faq([
        s8(
          "<ul><li><strong>Faut-il changer émetteur et récepteur ?</strong> Pas obligatoirement.</li>" +
            "<li><strong>Quel liquide utiliser ?</strong> Celui du constructeur.</li>" +
            "<li><strong>Faut-il purger ?</strong> Oui, toujours.</li></ul>",
        ),
      ]),
    ).toBeNull();
  });
});
