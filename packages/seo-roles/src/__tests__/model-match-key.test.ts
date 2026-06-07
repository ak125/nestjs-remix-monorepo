/**
 * modelMatchKey — match robuste keyword ↔ catalogue (accents, roman↔arabe, espaces/tirets).
 *
 * Cause racine SCÉNIC (blocked-plan 2026-06-07) : « scenic 2 » (keyword) ne matchait pas
 * « SCÉNIC II » (auto_modele.modele_name) → champion BLOCKED en PARSER_MISS. Ces tests gèlent
 * la normalisation GÉNÉRIQUE (pas un hardcode Scénic).
 *
 * @see ../text-normalize.ts (modelMatchKey)
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { modelMatchKey } from "../index";

const match = (a: string, b: string) => modelMatchKey(a) === modelMatchKey(b);

describe("modelMatchKey — roman↔arabe + accents (générique)", () => {
  test("scenic 2 ↔ SCÉNIC II", () => {
    assert.ok(match("scenic 2", "SCÉNIC II"));
    assert.equal(modelMatchKey("SCÉNIC II"), "scenic 2");
  });

  test("scenic 3 ↔ SCÉNIC III", () => {
    assert.ok(match("scenic 3", "SCÉNIC III"));
  });

  test("scenic 1 ↔ SCÉNIC I", () => {
    assert.ok(match("scenic 1", "SCÉNIC I"));
  });

  test("c4 picasso reste C4 Picasso (pas de faux roman sur c4)", () => {
    assert.ok(match("c4 picasso", "C4 Picasso"));
    assert.equal(modelMatchKey("C4 Picasso"), "c4 picasso");
  });

  test("clio 2 ↔ Clio II", () => {
    assert.ok(match("clio 2", "Clio II"));
  });

  test("clio 3 ↔ Clio III", () => {
    assert.ok(match("clio 3", "Clio III"));
  });

  test("générique : pas de hardcode — golf v ↔ GOLF 5, mégane iii ↔ MEGANE 3", () => {
    assert.ok(match("golf v", "GOLF 5"));
    assert.ok(match("mégane iii", "MEGANE 3"));
    assert.ok(match("208 i", "208 I"));
  });

  test("tirets/espaces unifiés : c4-picasso ↔ C4 PICASSO", () => {
    assert.ok(match("c4-picasso", "C4 PICASSO"));
  });

  test("ne convertit PAS un sous-mot romain (vti, tdi restent)", () => {
    assert.equal(modelMatchKey("clio iii 1.5 dci"), "clio 3 1 5 dci");
    assert.equal(modelMatchKey("a3 vti"), "a3 vti"); // 'vti' n'est pas un token romain pur
  });

  test("idempotent", () => {
    const k = modelMatchKey("SCÉNIC III");
    assert.equal(modelMatchKey(k), k);
  });
});
