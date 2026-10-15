// Isolated engine only. Pass the captured schema and prepared SQL artifact.
// The metadata fixture contains no shared data; no connection/env is consumed.
import { PGlite } from "../../output/sql-test-runtime/node_modules/@electric-sql/pglite/dist/index.js";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
const [schemaPath, planPath] = process.argv.slice(2);
if (!schemaPath || !planPath)
  throw new Error("Usage: test captured-schema.sql prerequisite.sql");
const schema = readFileSync(schemaPath, "utf8");
const plan = readFileSync(planPath, "utf8");
const db = new PGlite();
let checks = 0;
const check = async (name, fn) => {
  await fn();
  console.log("PASS", name);
  checks++;
};
const scalar = async (sql) => Object.values((await db.query(sql)).rows[0])[0];
await db.exec(schema);
const unchanged = async () => {
  assert.equal(
    await scalar("SELECT to_regclass('public.__marketing_brief') IS NULL"),
    true,
  );
  assert.equal(
    await scalar(
      "SELECT has_table_privilege('anon','__marketing_social_posts','TRUNCATE')",
    ),
    true,
  );
};
// Each failure must rollback both the new table and the direct ACL revocation.
for (const [name, setup, cleanup, error] of [
  [
    "existing brief",
    "CREATE TABLE __marketing_brief(id int)",
    "DROP TABLE __marketing_brief",
    /Brief already exists/,
  ],
  [
    "orphan trigger function",
    "CREATE FUNCTION fn_marketing_brief_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NEW; END $$",
    "DROP FUNCTION fn_marketing_brief_updated_at()",
    /Brief already exists/,
  ],
  [
    "RLS disabled",
    "ALTER TABLE __marketing_social_posts DISABLE ROW LEVEL SECURITY",
    "ALTER TABLE __marketing_social_posts ENABLE ROW LEVEL SECURITY",
    /RLS contract changed/,
  ],
  [
    "public policy",
    "CREATE POLICY unexpected ON __marketing_social_posts FOR SELECT TO anon USING(true)",
    "DROP POLICY unexpected ON __marketing_social_posts",
    /RLS contract changed/,
  ],
  [
    "service privilege missing",
    "REVOKE UPDATE ON __marketing_social_posts FROM service_role",
    "GRANT UPDATE ON __marketing_social_posts TO service_role",
    /service_role privileges missing/,
  ],
  [
    "PUBLIC inherited TRUNCATE",
    "GRANT TRUNCATE ON __marketing_social_posts TO PUBLIC",
    "REVOKE TRUNCATE ON __marketing_social_posts FROM PUBLIC",
    /Residual public write privilege/,
  ],
  [
    "role inherited DELETE",
    "CREATE ROLE inherited_writer; GRANT DELETE ON __marketing_social_posts TO inherited_writer; GRANT inherited_writer TO authenticated",
    "REVOKE inherited_writer FROM authenticated; REVOKE DELETE ON __marketing_social_posts FROM inherited_writer; DROP ROLE inherited_writer",
    /Residual public write privilege/,
  ],
  [
    "PUBLIC column UPDATE",
    "GRANT UPDATE(channels) ON __marketing_social_posts TO PUBLIC",
    "REVOKE UPDATE(channels) ON __marketing_social_posts FROM PUBLIC",
    /Residual public column write privilege/,
  ],
]) {
  await check(`${name} refuses and rolls back`, async () => {
    await db.exec(setup);
    try {
      await assert.rejects(db.exec(plan), error);
    } finally {
      await db.exec("ROLLBACK");
      await db.exec(cleanup);
    }
    await unchanged();
  });
}
await check(
  "canonical prerequisite preserves unrelated objects and read privileges",
  async () => {
    const weekly = await scalar(
      "SELECT relacl::text FROM pg_class WHERE oid='__marketing_weekly_plans'::regclass",
    );
    await db.exec(plan);
    assert.equal(
      await scalar(
        "SELECT relacl::text FROM pg_class WHERE oid='__marketing_weekly_plans'::regclass",
      ),
      weekly,
    );
    assert.equal(
      await scalar(
        "SELECT to_regclass('public.__retention_trigger_rules') IS NULL",
      ),
      true,
    );
    assert.equal(
      await scalar(
        "SELECT has_table_privilege('dev_readonly','__marketing_social_posts','SELECT')",
      ),
      true,
    );
    for (const role of ["anon", "authenticated"]) {
      assert.equal(
        await scalar(
          `SELECT has_table_privilege('${role}','__marketing_social_posts','INSERT,UPDATE,DELETE,TRUNCATE')`,
        ),
        false,
      );
    }
    await db.exec(
      "SET ROLE service_role; INSERT INTO __marketing_brief(agent_id,business_unit,channel,conversion_goal,cta,target_segment,payload,coverage_manifest) VALUES('fixture','ECOMMERCE','social_facebook','ORDER','Choisir','test','{}','{}'); RESET ROLE",
    );
  },
);
await check("replay refuses without losing an existing brief", async () => {
  await assert.rejects(db.exec(plan), /Brief already exists/);
  await db.exec("ROLLBACK");
  assert.equal(await scalar("SELECT count(*)::int FROM __marketing_brief"), 1);
});
for (const name of [
  "20261014091855_marketing_publication_preparations",
  "20261014172953_marketing_brief_social_link",
]) {
  await check(`${name} refuses before social reviews`, async () => {
    const source = readFileSync(
      new URL(`../../backend/supabase/migrations/${name}.sql`, import.meta.url),
      "utf8",
    );
    await assert.rejects(
      db.exec("BEGIN;\n" + source + "\nCOMMIT;"),
      /Apply the social review migration/,
    );
    await db.exec("ROLLBACK");
    assert.equal(
      await scalar(
        "SELECT to_regclass('public.__marketing_publication_preparations') IS NULL",
      ),
      true,
    );
    assert.equal(
      await scalar(
        "SELECT count(*)::int FROM information_schema.columns WHERE table_name='__marketing_social_posts' AND column_name='source_brief'",
      ),
      0,
    );
  });
}
await check(
  "all three existing candidate migrations accept prepared schema",
  async () => {
    for (const name of [
      "20261014010000_marketing_social_reviews",
      "20261014091855_marketing_publication_preparations",
      "20261014172953_marketing_brief_social_link",
    ]) {
      await db.exec(
        "BEGIN;\n" +
          readFileSync(
            new URL(
              `../../backend/supabase/migrations/${name}.sql`,
              import.meta.url,
            ),
            "utf8",
          ) +
          "\nCOMMIT;",
      );
    }
    assert.equal(
      await scalar(
        "SELECT to_regprocedure('public.link_marketing_brief_social(uuid,bigint,timestamptz,bigint,bigint,text)') IS NOT NULL",
      ),
      true,
    );
  },
);
await db.close();
console.log(JSON.stringify({ checks, status: "VALIDATED_FOR_SCOPE_ONLY" }));
