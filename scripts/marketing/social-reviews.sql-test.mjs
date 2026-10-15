// Ephemeral PostgreSQL (PGlite), never connects to Supabase or reads .env.
// PGlite is a pinned development dependency; no app runtime dependency.
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const db = new PGlite();
const migration =
  "BEGIN;\n" +
  readFileSync(
    new URL(
      "../../backend/supabase/migrations/20261014010000_marketing_social_reviews.sql",
      import.meta.url,
    ),
    "utf8",
  ) +
  "\nCOMMIT;";
await db.exec(`
 CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
 CREATE TABLE public.__marketing_social_posts (
 id bigint PRIMARY KEY, week_iso text, day_of_week integer, slot_label text,
 channels jsonb NOT NULL, primary_channel text, channels_list text[], source_url text,
 utm_campaign text, status text DEFAULT 'generated', approved_by text, approved_at timestamptz,
 published_at timestamptz, gate_summary jsonb, brand_gate_level text, compliance_gate_level text,
 quality_score numeric, actual_clicks integer, updated_at timestamptz DEFAULT now(),
 CHECK(status IN ('draft','generated','gate_pending','gate_passed','gate_failed','approved','published','archived'))
 );
 GRANT SELECT,INSERT,UPDATE ON public.__marketing_social_posts TO service_role;
 INSERT INTO public.__marketing_social_posts(id,channels,primary_channel,channels_list,status,approved_by)
 VALUES (1,'{"facebook":{"caption":"Initial"},"instagram":{"caption":"Initial IG"}}','facebook',ARRAY['facebook','instagram'],'approved','legacy');
`);
const gate = {
  brand: { level: "PASS" },
  compliance: { level: "PASS" },
  can_approve: true,
  blocking_issues: [],
};
const row = async () =>
  (await db.query("SELECT * FROM __marketing_social_posts WHERE id=1")).rows[0];
const review = (channel, rev, version, action, g = gate) =>
  db.query("SELECT review_marketing_social_post(1,$1,$2,$3,$4,$5,$6)", [
    channel,
    rev,
    version,
    action,
    "admin:42",
    g,
  ]);
let checks = 0;
const check = async (name, fn) => {
  await fn();
  checks++;
  console.log("PASS", name);
};
try {
  await db.exec("GRANT UPDATE ON __marketing_social_posts TO anon");
  await check(
    "unsafe existing write grants abort migration without partial columns",
    async () => {
      await assert.rejects(
        db.exec(migration),
        /Reconcile social post write privileges/,
      );
      await db.exec("ROLLBACK");
      const columns = await db.query(
        "SELECT column_name FROM information_schema.columns WHERE table_name='__marketing_social_posts' AND column_name='content_revision'",
      );
      assert.equal(columns.rows.length, 0);
    },
  );
  await db.exec("REVOKE UPDATE ON __marketing_social_posts FROM anon");
  await db.exec(migration);
  await check("legacy approval retained only in history", async () => {
    assert.equal((await row()).status, "generated");
    assert.deepEqual((await row()).channel_reviews, {});
    assert.equal(
      (
        await db.query(
          "SELECT snapshot->>'approved_by' AS actor FROM __marketing_social_post_history",
        )
      ).rows[0].actor,
      "legacy",
    );
  });
  await check("approval without channel gate refused", async () =>
    assert.rejects(review("facebook", 1, 0, "approve"), { code: "23514" }),
  );
  await db.exec("SET ROLE service_role");
  await check(
    "service RPC creates gate and approval with exact revision",
    async () => {
      await review("facebook", 1, 0, "gate");
      await review("facebook", 1, 1, "approve");
      const p = await row();
      assert.equal(p.channel_reviews.facebook.state, "approved");
      assert.equal(p.status, "gate_passed");
    },
  );
  await check("secondary network requires its own gate", async () =>
    assert.rejects(review("instagram", 1, 2, "approve"), { code: "23514" }),
  );
  await check("stale tab cannot reject newer decision", async () =>
    assert.rejects(review("facebook", 1, 1, "reject"), { code: "40001" }),
  );
  await check(
    "reject clears approval; stale gate cannot undo rejection",
    async () => {
      await review("facebook", 1, 2, "reject");
      await assert.rejects(review("facebook", 1, 2, "gate"), { code: "40001" });
      await assert.rejects(review("facebook", 1, 3, "approve"), {
        code: "23514",
      });
    },
  );
  await check("metadata update preserves revisions", async () => {
    await db.exec(
      "UPDATE __marketing_social_posts SET actual_clicks=12 WHERE id=1",
    );
    assert.equal((await row()).content_revision, 1);
    assert.equal((await row()).review_version, 3);
  });
  await check(
    "content edit resets all decisions and preserves snapshot",
    async () => {
      await db.exec(
        `UPDATE __marketing_social_posts SET channels=jsonb_set(channels,'{facebook,caption}','"Edited"') WHERE id=1`,
      );
      const p = await row();
      assert.equal(p.content_revision, 2);
      assert.equal(p.review_version, 4);
      assert.deepEqual(p.channel_reviews, {});
      await assert.rejects(review("facebook", 1, 3, "gate"), { code: "40001" });
    },
  );
  await check("caller cannot forge revision or global approval", async () => {
    await db.exec(
      `UPDATE __marketing_social_posts SET content_revision=999,review_version=999,status='approved',approved_by='forged' WHERE id=1`,
    );
    const p = await row();
    assert.equal(p.content_revision, 2);
    assert.equal(p.review_version, 4);
    assert.equal(p.status, "generated");
    assert.equal(p.approved_by, null);
  });
  await check("second-network review and aggregate approval", async () => {
    await review("facebook", 2, 4, "gate");
    await review("facebook", 2, 5, "approve");
    await review("instagram", 2, 6, "gate");
    await review("instagram", 2, 7, "approve");
    assert.equal((await row()).status, "approved");
  });
  await check(
    "source URL edit invalidates approval even if captions unchanged",
    async () => {
      await db.exec(
        `UPDATE __marketing_social_posts SET source_url='https://example.test/new' WHERE id=1`,
      );
      assert.equal((await row()).content_revision, 3);
      assert.deepEqual((await row()).channel_reviews, {});
    },
  );
  await check("contradictory gate cannot approve", async () => {
    await review("facebook", 3, 9, "gate", {
      ...gate,
      brand: { level: "FAIL" },
    });
    await assert.rejects(review("facebook", 3, 10, "approve"), {
      code: "23514",
    });
  });
  await check("missing target and unavailable channel refused", async () => {
    await assert.rejects(review("youtube", 3, 10, "gate"), { code: "23514" });
    await assert.rejects(
      db.query(
        "SELECT review_marketing_social_post(999,'facebook',1,0,'gate','admin',$1)",
        [gate],
      ),
      { code: "P0002" },
    );
  });
  await check("publication cannot bypass review workflow", async () =>
    assert.rejects(
      db.exec(
        "UPDATE __marketing_social_posts SET status='published' WHERE id=1",
      ),
      { code: "23514" },
    ),
  );
  await check("service cannot alter history", async () =>
    assert.rejects(db.exec("DELETE FROM __marketing_social_post_history"), {
      code: "42501",
    }),
  );
  await db.exec("RESET ROLE");
  await check("owner cannot rewrite history", async () =>
    assert.rejects(
      db.exec("UPDATE __marketing_social_post_history SET snapshot='{}'"),
      /append-only/,
    ),
  );
  for (const role of ["anon", "authenticated"]) {
    await db.exec(`SET ROLE ${role}`);
    await check(`${role} cannot execute review or read history`, async () => {
      await assert.rejects(review("facebook", 3, 10, "gate"), {
        code: "42501",
      });
      await assert.rejects(
        db.query("SELECT * FROM __marketing_social_post_history"),
        { code: "42501" },
      );
    });
    await db.exec("RESET ROLE");
  }
  console.log(
    `${checks} SQL checks passed; fixture schema, no network or shared DB; concurrent sessions not simulated.`,
  );
} finally {
  await db.close();
}
