import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import {
  RoleId,
  tolerantRoleSchema,
  canonicalRoleSchema,
} from "../index";

describe("tolerantRoleSchema — accepts canonical and legacy", () => {
  test("parses canonical R3_CONSEILS", () => {
    const result = tolerantRoleSchema.parse("R3_CONSEILS");
    assert.equal(result, RoleId.R3_CONSEILS);
  });

  test("parses legacy R3_BLOG → R3_CONSEILS", () => {
    const result = tolerantRoleSchema.parse("R3_BLOG");
    assert.equal(result, RoleId.R3_CONSEILS);
  });

  test("parses legacy R3_guide → R6_GUIDE_ACHAT", () => {
    const result = tolerantRoleSchema.parse("R3_guide");
    assert.equal(result, RoleId.R6_GUIDE_ACHAT);
  });

  test("parses legacy R1_pieces → R1_ROUTER", () => {
    const result = tolerantRoleSchema.parse("R1_pieces");
    assert.equal(result, RoleId.R1_ROUTER);
  });

  test("parses worker page_type R3_guide_howto → R3_CONSEILS", () => {
    const result = tolerantRoleSchema.parse("R3_guide_howto");
    assert.equal(result, RoleId.R3_CONSEILS);
  });

  test("rejects bare R3", () => {
    assert.throws(() => tolerantRoleSchema.parse("R3"), z.ZodError);
  });

  test("rejects bare R6", () => {
    assert.throws(() => tolerantRoleSchema.parse("R6"), z.ZodError);
  });

  test("rejects unknown string", () => {
    assert.throws(() => tolerantRoleSchema.parse("NONSENSE"), z.ZodError);
  });

  test("rejects non-string", () => {
    assert.throws(() => tolerantRoleSchema.parse(42), z.ZodError);
  });

  test("works inside z.object() for DB row parsing", () => {
    const RowSchema = z.object({
      role: tolerantRoleSchema,
      name: z.string(),
    });
    const parsed = RowSchema.parse({ role: "R3_BLOG", name: "test" });
    assert.equal(parsed.role, RoleId.R3_CONSEILS);
    assert.equal(parsed.name, "test");
  });
});

describe("canonicalRoleSchema — strict canonical only", () => {
  test("parses canonical roles", () => {
    assert.equal(canonicalRoleSchema.parse("R3_CONSEILS"), RoleId.R3_CONSEILS);
    assert.equal(
      canonicalRoleSchema.parse("R6_GUIDE_ACHAT"),
      RoleId.R6_GUIDE_ACHAT,
    );
    assert.equal(canonicalRoleSchema.parse("R6_SUPPORT"), RoleId.R6_SUPPORT);
  });

  test("rejects legacy R3_BLOG (must use tolerantRoleSchema for inputs)", () => {
    assert.throws(() => canonicalRoleSchema.parse("R3_BLOG"), z.ZodError);
  });

  test("rejects legacy R3_guide", () => {
    assert.throws(() => canonicalRoleSchema.parse("R3_guide"), z.ZodError);
  });

  test("rejects bare R3 / R6 / R9", () => {
    assert.throws(() => canonicalRoleSchema.parse("R3"), z.ZodError);
    assert.throws(() => canonicalRoleSchema.parse("R6"), z.ZodError);
    assert.throws(() => canonicalRoleSchema.parse("R9"), z.ZodError);
  });

  test("rejects deprecated R9_GOVERNANCE in output", () => {
    assert.throws(
      () => canonicalRoleSchema.parse("R9_GOVERNANCE"),
      z.ZodError,
    );
  });

  test("rejects deprecated R3_GUIDE in output", () => {
    assert.throws(() => canonicalRoleSchema.parse("R3_GUIDE"), z.ZodError);
  });
});

describe("schema integration — request → response pipeline", () => {
  test("DB row → tolerant input → canonical output round trip", () => {
    const InputSchema = z.object({ role: tolerantRoleSchema });
    const OutputSchema = z.object({ role: canonicalRoleSchema });

    // Simulate DB row with legacy value
    const dbRow = { role: "R3_BLOG" };
    const normalized = InputSchema.parse(dbRow);
    assert.equal(normalized.role, RoleId.R3_CONSEILS);

    // Pass normalized to output schema — must accept canonical
    const output = OutputSchema.parse(normalized);
    assert.equal(output.role, RoleId.R3_CONSEILS);
  });

  test("Output schema rejects un-normalized DB row", () => {
    const OutputSchema = z.object({ role: canonicalRoleSchema });
    const dbRow = { role: "R3_BLOG" }; // not normalized
    assert.throws(() => OutputSchema.parse(dbRow), z.ZodError);
  });
});
