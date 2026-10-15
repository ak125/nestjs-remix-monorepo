// Ephemeral PostgreSQL only; no network, environment secrets or shared database.
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
const sql = (name) =>
  "BEGIN;\n" +
  readFileSync(
    new URL(`../../backend/supabase/migrations/${name}.sql`, import.meta.url),
    "utf8",
  ) +
  "\nCOMMIT;";
const db = new PGlite();
const id = "56a0c18a-3b41-48fb-9879-6ae4bd5e349a";
const stamp = "2026-10-14T10:00:00Z";
let checks = 0;
const check = async (name, fn) => {
  await fn();
  console.log("PASS", name);
  checks++;
};
await db.exec(`
 CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
 CREATE TABLE public.__marketing_social_posts (
 id bigint PRIMARY KEY, week_iso text, channels jsonb NOT NULL, primary_channel text,
 channels_list text[], status text DEFAULT 'generated', approved_by text, approved_at timestamptz,
 published_at timestamptz, gate_summary jsonb, brand_gate_level text, compliance_gate_level text,
 quality_score numeric, updated_at timestamptz DEFAULT now());
 GRANT SELECT,INSERT,UPDATE ON public.__marketing_social_posts TO service_role;
 INSERT INTO public.__marketing_social_posts(id,week_iso,channels,primary_channel,channels_list)
 VALUES (1,'2026-W42','{"facebook":{"caption":"Plaquettes"},"instagram":{"caption":"IG"}}','facebook',ARRAY['facebook','instagram']),
 (2,'2026-W42','{"instagram":{"caption":"IG"}}','instagram',ARRAY['instagram']);
`);
// Execute the real brief table, constraints, timestamp trigger and RLS policy, excluding unrelated tables.
const phase = sql("20260430_marketing_layer_phase1");
await db.exec(
  phase.slice(
    phase.indexOf("CREATE TABLE IF NOT EXISTS public.__marketing_brief"),
    phase.indexOf("-- ── 2."),
  ),
);
await db.exec(`GRANT SELECT,INSERT,UPDATE ON __marketing_brief TO service_role;
 INSERT INTO __marketing_brief(id,agent_id,business_unit,channel,conversion_goal,cta,target_segment,payload,coverage_manifest,
 status,reviewed_by,reviewed_at,approved_by,approved_at,brand_gate_level,compliance_gate_level,gate_summary,updated_at)
 VALUES ('${id}','lead','ECOMMERCE','social_facebook','ORDER','Vérifier la compatibilité','automobilistes','{"caption":"Source"}','{}',
 'approved','reviewer',now(),'owner',now(),'PASS','WARN','{"can_approve":true,"blocking_issues":[]}','${stamp}');`);
await db.exec(sql("20261014010000_marketing_social_reviews"));
// TRUNCATE bypasses RLS: checking INSERT/UPDATE alone is insufficient.
// Run the actual migration preflight inside a rolled-back transaction.
for (const [migration, table, permission] of [
  [
    "20261014010000_marketing_social_reviews",
    "__marketing_social_posts",
    "TRUNCATE",
  ],
  ["20261014172953_marketing_brief_social_link", "__marketing_brief", "DELETE"],
  [
    "20261014172953_marketing_brief_social_link",
    "__marketing_brief",
    "TRUNCATE",
  ],
]) {
  for (const role of ["anon", "authenticated"]) {
    await check(
      `${role} ${permission} on ${table} blocks migration`,
      async () => {
        await db.exec(`GRANT ${permission} ON ${table} TO ${role}`);
        const migrationSql = sql(migration);
        const preflight = migrationSql.slice(
          0,
          migrationSql.indexOf("END $$;") + "END $$;".length,
        );
        try {
          await assert.rejects(
            db.exec(preflight),
            /Reconcile.*write privileges/,
          );
        } finally {
          await db.exec("ROLLBACK");
          await db.exec(`REVOKE ${permission} ON ${table} FROM ${role}`);
        }
      },
    );
  }
}
await db.exec(sql("20261014091855_marketing_publication_preparations"));
await db.exec(sql("20261014172953_marketing_brief_social_link"));
const post = async () =>
  (await db.query("SELECT * FROM __marketing_social_posts WHERE id=1")).rows[0];
const brief = async () =>
  (await db.query("SELECT * FROM __marketing_brief WHERE id=$1", [id])).rows[0];
const link = (
  target = 1,
  updated = stamp,
  revision = 1,
  review = 0,
  actor = "admin:42",
) =>
  db.query("SELECT link_marketing_brief_social($1,$2,$3,$4,$5,$6) AS result", [
    id,
    target,
    updated,
    revision,
    review,
    actor,
  ]);
const rejects = (fn, code = "23514") => assert.rejects(fn, { code });
const gate = {
  brand: { level: "PASS" },
  compliance: { level: "PASS" },
  can_approve: true,
  blocking_issues: [],
};
const review = async (channel, action) => {
  const p = await post();
  return db.query("SELECT review_marketing_social_post(1,$1,$2,$3,$4,$5,$6)", [
    channel,
    p.content_revision,
    p.review_version,
    action,
    "social-reviewer",
    gate,
  ]);
};
try {
  await check(
    "nonmatching channel refused without changing either row",
    async () => {
      await rejects(() => link(2));
      assert.equal((await brief()).social_post_id, null);
      assert.equal((await post()).content_revision, 1);
    },
  );
  await check("stale brief or content or review rejected", async () => {
    await rejects(() => link(1, "2026-10-13T00:00:00Z"), "40001");
    await rejects(() => link(1, stamp, 2), "40001");
    await rejects(() => link(1, stamp, 1, 2), "40001");
  });
  await check("draft and missing approval evidence refused", async () => {
    for (const change of [
      "status='draft'",
      "status='archived'",
      "approved_by=NULL",
      "reviewed_at=NULL",
      "brand_gate_level='FAIL'",
      "gate_summary='{}'",
    ]) {
      await db.exec("BEGIN");
      await db.exec(`UPDATE __marketing_brief SET ${change}`);
      await rejects(async () => link(1, (await brief()).updated_at));
      await db.exec("ROLLBACK");
    }
  });
  await review("facebook", "gate");
  await review("facebook", "approve");
  const before = await post();
  await check(
    "legacy FK is adopted only through an explicit approved-source association",
    async () => {
      await db.exec("BEGIN");
      await db.exec("UPDATE __marketing_brief SET social_post_id=1");
      await link(
        1,
        (await brief()).updated_at,
        before.content_revision,
        before.review_version,
      );
      assert.equal((await post()).source_brief.brief.id, id);
      await db.exec("ROLLBACK");
      assert.equal((await post()).source_brief, null);
    },
  );
  await check(
    "another existing brief association prevents ambiguous provenance",
    async () => {
      await db.exec("BEGIN");
      await db.exec(`INSERT INTO __marketing_brief(id,agent_id,business_unit,channel,conversion_goal,cta,target_segment,payload,coverage_manifest,social_post_id)
      VALUES ('00000000-0000-4000-8000-000000000002','other','ECOMMERCE','social_facebook','ORDER','Other','drivers','{}','{}',1)`);
      await rejects(
        () => link(1, stamp, before.content_revision, before.review_version),
        "40001",
      );
      await db.exec("ROLLBACK");
    },
  );
  await check("link is atomic when the brief write fails", async () => {
    await db.exec(`CREATE FUNCTION reject_brief_write() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture failure'; END $$;
   CREATE TRIGGER reject_brief_write BEFORE UPDATE ON __marketing_brief FOR EACH ROW EXECUTE FUNCTION reject_brief_write();`);
    await rejects(
      () => link(1, stamp, before.content_revision, before.review_version),
      "P0001",
    );
    assert.equal((await post()).source_brief, null);
    assert.equal((await post()).content_revision, 1);
    await db.exec("DROP TRIGGER reject_brief_write ON __marketing_brief");
  });
  await db.exec("SET ROLE service_role");
  await check(
    "approved source becomes an immutable version and resets social decisions",
    async () => {
      await link(1, stamp, before.content_revision, before.review_version);
      const p = await post();
      assert.equal(p.content_revision, 2);
      assert.deepEqual(p.channel_reviews, {});
      assert.equal(p.source_brief.brief.id, id);
      assert.equal(p.source_brief.brief.approved_by, "owner");
      assert.equal(p.source_brief.linked_content_revision, 2);
      assert.equal(p.source_brief.linked_by, "admin:42");
      assert.equal((await brief()).social_post_id, 1);
      const history = await db.query(
        "SELECT snapshot FROM __marketing_social_post_history WHERE post_id=1 AND content_revision=2",
      );
      assert.deepEqual(history.rows[0].snapshot.source_brief, p.source_brief);
    },
  );
  await check(
    "approval of each network still requires its own current gate",
    async () => {
      await rejects(() => review("facebook", "approve"));
      await review("facebook", "gate");
      await review("facebook", "approve");
      await rejects(() => review("instagram", "approve"));
      assert.notEqual((await post()).status, "approved");
      await review("instagram", "gate");
      await review("instagram", "approve");
      assert.equal((await post()).status, "approved");
    },
  );
  await check(
    "exact replay retains newer approvals and creates no history",
    async () => {
      const p = await post();
      const history = await db.query(
        "SELECT count(*) FROM __marketing_social_post_history",
      );
      await link(1, stamp, before.content_revision, before.review_version);
      assert.deepEqual(await post(), p);
      assert.deepEqual(
        await db.query("SELECT count(*) FROM __marketing_social_post_history"),
        history,
      );
    },
  );
  await check(
    "existing publication preparation retains approved source and network decision",
    async () => {
      const p = await post();
      const result = await db.query(
        "SELECT prepare_marketing_publication($1,$2,$3,$4,$5,$6,$7,$8) AS record",
        [
          1,
          "00000000-0000-4000-8000-000000000001",
          "facebook",
          p.content_revision,
          p.review_version,
          { external_id: "fixture-account", label: "Fixture account" },
          [
            {
              bucket: "private-fixture",
              path: "image.png",
              sha256: "a".repeat(64),
              role: "image",
            },
          ],
          "admin:42",
        ],
      );
      assert.deepEqual(
        result.rows[0].record.editorial_snapshot.source_brief,
        p.source_brief,
      );
      assert.equal(
        result.rows[0].record.approval_snapshot.actor,
        "social-reviewer",
      );
    },
  );
  await check(
    "another actor or target is not an idempotent replay",
    async () => {
      await rejects(
        () =>
          link(
            1,
            stamp,
            before.content_revision,
            before.review_version,
            "other",
          ),
        "40001",
      );
      await rejects(
        () => link(2, stamp, before.content_revision, before.review_version),
        "40001",
      );
    },
  );
  await check(
    "later editorial changes retain source and invalidate approvals",
    async () => {
      const source = (await post()).source_brief;
      await db.exec(
        `UPDATE __marketing_social_posts SET channels=jsonb_set(channels,'{facebook,caption}','"Correction"') WHERE id=1`,
      );
      assert.equal((await post()).content_revision, 3);
      assert.deepEqual((await post()).source_brief, source);
      assert.deepEqual((await post()).channel_reviews, {});
      await rejects(() =>
        db.exec(
          "UPDATE __marketing_social_posts SET source_brief=NULL WHERE id=1",
        ),
      );
    },
  );
  await check("untrusted roles cannot invoke the association", async () => {
    await db.exec("RESET ROLE; SET ROLE anon");
    await rejects(() => link(), "42501");
    await db.exec("RESET ROLE");
  });
  console.log(`${checks} SQL checks passed`);
} finally {
  await db.close();
}
