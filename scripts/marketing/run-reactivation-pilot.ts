import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { runPilot } from "./reactivation-pilot";
import { runWorkbench } from "./workbench-cli";

const args = process.argv.slice(2);
const v2 = [
  "--help",
  "--scenario",
  "--all-scenarios",
  "--segment",
  "--opportunities",
  "--import-preview",
  "--operations",
  "--report",
  "--capabilities",
];
try {
  const root = path.resolve(__dirname, "../..");
  if (path.resolve(process.cwd()) !== root) throw new Error("WORKDIR_MISMATCH");
  const origin = execFileSync("git", ["remote", "get-url", "origin"], {
    cwd: root,
    encoding: "utf8",
    timeout: 5000,
    windowsHide: true,
  }).trim();
  if (
    ![
      "https://github.com/ak125/nestjs-remix-monorepo.git",
      "https://github.com/ak125/nestjs-remix-monorepo",
      "git@github.com:ak125/nestjs-remix-monorepo.git",
    ].includes(origin)
  )
    throw new Error("REPOSITORY_MISMATCH");
  if (v2.includes(args[0])) {
    process.stdout.write(
      JSON.stringify(
        {
          schema_version: "2.0.0",
          project: "automecanik",
          environment: "DEV",
          synthetic: true,
          real_execution: false,
          result: runWorkbench(args),
        },
        null,
        2,
      ) + "\n",
    );
  } else {
    const input = JSON.parse(
      readFileSync(__dirname + "/fixtures/reactivation.synthetic.json", "utf8"),
    );
    for (let i = 0; i < args.length; i++) {
      if (
        args[i] === "--inactive-days" &&
        args[i + 1] &&
        /^[0-9]+$/.test(args[i + 1])
      )
        input.rules.inactive_days = Number(args[++i]);
      else if (args[i] === "--cancel") input.cancelled = true;
      else throw new Error("INVALID_ARGUMENT");
    }
    // Never import AppModule or read credentials. No live mode exists.
    process.stdout.write(JSON.stringify(runPilot(input), null, 2) + "\n");
  }
} catch (error) {
  // Public refusal codes only: never forward arbitrary messages or stack traces.
  const allowed = new Set([
    "INVALID_ARGUMENT",
    "INVALID_INPUT",
    "INVALID_OUTPUT",
    "FUTURE_DATA",
    "STALE_DATA",
    "CONTACT_LIMIT",
    "CONFLICTING_IDENTITY",
    "CONFLICTING_EVENT",
    "CONFLICTING_ORDER",
    "UNRECONCILED_REFUND",
    "CONFLICTING_SOURCE",
    "WORKDIR_MISMATCH",
    "REPOSITORY_MISMATCH",
    "INVALID_WORKBENCH_INPUT",
    "STALE_WORKBENCH_DATA",
    "FUTURE_WORKBENCH_DATA",
    "CONTACT_UNKNOWN",
    "SCENARIO_UNKNOWN",
    "SOURCE_UNVERIFIED",
    "TEMPLATE_VARIABLE_MISSING",
    "CONFLICTING_RECEIPT",
    "INVALID_REPORT_PERIOD",
    "INVALID_DENOMINATOR",
    "SEGMENT_LIMIT",
    "DUPLICATE_OBJECT",
    "AMBIGUOUS_CONTACT_IDENTITY",
    "CONFLICTING_PURCHASE",
    "CONFLICTING_VEHICLE",
    "MERGED_CONTACT_INVALID",
    "TIMEZONE_INVALID",
    "INVALID_WINDOW",
    "UNSUPPORTED_CALENDAR_WINDOW",
    "DUPLICATE_PROPOSAL",
    "PROPOSAL_RECEIPT_MISMATCH",
    "CONFLICTING_ECONOMIC_EVENT",
    "REFUND_UNRECONCILED",
    "REFUND_CURRENCY",
    "REFUND_BEFORE_ORDER",
    "REFUND_EXCEEDS_ORDER",
    "DUPLICATE_EXPERIMENT_UNIT",
    "EXPERIMENT_CONTAMINATION",
  ]);
  const code =
    error instanceof Error && allowed.has(error.message)
      ? error.message
      : "PILOT_FAILED";
  process.stderr.write(
    (v2.includes(args[0])
      ? JSON.stringify({
          schema_version: "2.0.0",
          error: { code },
          real_execution: false,
        })
      : code) + "\n",
  );
  process.exitCode = 1;
}
