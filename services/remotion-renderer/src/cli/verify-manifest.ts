import { readFileSync } from "fs";
import { verifyRenderManifest } from "../lib/render-manifest";

try {
  const [manifestPath, mediaPath, ...extra] = process.argv.slice(2);
  if (!manifestPath || !mediaPath || extra.length)
    throw new Error(
      "Usage: npm run verify:manifest -- <manifest.json> <video.mp4>",
    );
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  console.log(
    JSON.stringify(verifyRenderManifest(manifest, mediaPath), null, 2),
  );
} catch (error) {
  console.error(
    JSON.stringify({
      status: "TECHNICAL_MISMATCH",
      error: (error as Error).message,
    }),
  );
  process.exitCode = 1;
}
