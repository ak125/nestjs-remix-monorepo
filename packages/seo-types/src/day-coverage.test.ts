import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  assessPeriodComparability,
  computeDayCoverage,
} from "./day-coverage.js";

/**
 * Jour présent ≠ jour confirmé (2026-09-11). Une ligne `property_total` peut
 * exister sans que le jour soit certifié : écrite par l'ancien code (qui
 * l'écrivait EN PREMIER, et à zéro quand GSC ne renvoyait rien) ou laissée par
 * une réécriture interrompue (marqueur retiré avant réécriture). Seul le
 * marqueur de commit certifie le jour ; sans lui la fenêtre n'est pas complète.
 */
describe("computeDayCoverage — confirmation des jours", () => {
  const window = { from: "2026-08-10", to: "2026-08-14" };

  it("sans confirmedDates : comportement historique (présent = confirmé)", () => {
    const cov = computeDayCoverage({
      ...window,
      presentDates: ["2026-08-10", "2026-08-11", "2026-08-13", "2026-08-14"],
    });
    assert.deepEqual(cov, {
      ...window,
      daysExpected: 5,
      daysPresent: 4,
      daysConfirmed: 4,
      missingDates: ["2026-08-12"],
      unconfirmedDates: [],
      complete: false,
    });
  });

  it("ligne présente non commitée : ni manquante ni confirmée, fenêtre incomplète", () => {
    const presentDates = [
      "2026-08-10",
      "2026-08-11",
      "2026-08-12",
      "2026-08-13",
      "2026-08-14",
    ];
    const cov = computeDayCoverage({
      ...window,
      presentDates,
      confirmedDates: presentDates.filter((d) => d !== "2026-08-12"),
    });
    assert.equal(cov.daysPresent, 5);
    assert.equal(cov.daysConfirmed, 4);
    assert.deepEqual(cov.missingDates, []);
    assert.deepEqual(cov.unconfirmedDates, ["2026-08-12"]);
    assert.equal(cov.complete, false);
  });

  it("tous les jours présents et commités → complet ; dates hors fenêtre ignorées", () => {
    const presentDates = [
      "2026-08-09",
      "2026-08-10",
      "2026-08-11",
      "2026-08-12",
      "2026-08-13",
      "2026-08-14",
    ];
    const cov = computeDayCoverage({
      ...window,
      presentDates,
      confirmedDates: presentDates,
    });
    assert.equal(cov.daysConfirmed, 5);
    assert.deepEqual(cov.unconfirmedDates, []);
    assert.equal(cov.complete, true);
  });

  it("date confirmée sans ligne présente → entrée incohérente refusée (jamais comptée)", () => {
    assert.throws(
      () =>
        computeDayCoverage({
          ...window,
          presentDates: ["2026-08-10"],
          confirmedDates: ["2026-08-10", "2026-08-11"],
        }),
      /2026-08-11/,
    );
  });

  it("une fenêtre avec un jour non confirmé n'est pas comparable", () => {
    const all = ["2026-08-10", "2026-08-11", "2026-08-12"];
    const previous = computeDayCoverage({
      from: "2026-08-10",
      to: "2026-08-12",
      presentDates: all,
      confirmedDates: all,
    });
    const currentDates = ["2026-08-13", "2026-08-14", "2026-08-15"];
    const current = computeDayCoverage({
      from: "2026-08-13",
      to: "2026-08-15",
      presentDates: currentDates,
      confirmedDates: ["2026-08-13", "2026-08-15"],
    });
    assert.deepEqual(assessPeriodComparability(current, previous), {
      comparable: false,
      reason: "current_incomplete",
    });
  });
});
