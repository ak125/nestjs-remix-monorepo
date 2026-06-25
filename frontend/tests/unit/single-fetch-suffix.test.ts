import { describe, it, expect } from "vitest";

import { stripSingleFetchSuffix } from "~/utils/single-fetch";

describe("stripSingleFetchSuffix — retire le suffixe RR8 single-fetch", () => {
  it("retire `.data` (navigation client)", () => {
    expect(stripSingleFetchSuffix("/pieces/filtre-a-huile-7.html.data")).toBe(
      "/pieces/filtre-a-huile-7.html",
    );
    expect(stripSingleFetchSuffix("/blog.data")).toBe("/blog");
    expect(stripSingleFetchSuffix("/pieces-auto/filtre-a-huile.data")).toBe(
      "/pieces-auto/filtre-a-huile",
    );
  });

  it("ne touche pas un pathname document (F5)", () => {
    expect(stripSingleFetchSuffix("/blog")).toBe("/blog");
    expect(stripSingleFetchSuffix("/pieces/filtre-a-huile-7.html")).toBe(
      "/pieces/filtre-a-huile-7.html",
    );
  });

  it("préserve l'encodage (aucun decode)", () => {
    expect(stripSingleFetchSuffix("/pi%C3%A8ces/test.data")).toBe(
      "/pi%C3%A8ces/test",
    );
    expect(stripSingleFetchSuffix("/blog%20space")).toBe("/blog%20space");
  });

  it("ne retire que le suffixe FINAL (un `.data` au milieu reste)", () => {
    expect(stripSingleFetchSuffix("/foo.data/bar")).toBe("/foo.data/bar");
  });
});
