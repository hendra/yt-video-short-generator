/**
 * Discover the slug this CI run produced: folders under src/videos newer than the marker,
 * narrowed to those registered in registry.ts.
 *   npx tsx scripts/discover-slug.mts "$RUNNER_TEMP/.ci-start"
 * Prints only the slug on stdout; ignored folders go to stderr.
 */
import fs from "node:fs";
import path from "node:path";
import { pickSlug } from "./discover-core.mts";
import { ROOT } from "./lib.mts";

const marker = process.argv[2];
if (!marker || !fs.existsSync(marker)) {
  console.error("Usage: npx tsx scripts/discover-slug.mts <marker-file>");
  process.exit(1);
}

const videosDir = path.join(ROOT, "src", "videos");
const since = fs.statSync(marker).mtimeMs;
const newFolders = fs
  .readdirSync(videosDir, { withFileTypes: true })
  .filter((d) => d.isDirectory() && fs.statSync(path.join(videosDir, d.name)).mtimeMs > since)
  .map((d) => d.name);

const { VIDEOS } = await import("../src/videos/registry.ts");
const pick = pickSlug(newFolders, Object.keys(VIDEOS));
if ("error" in pick) {
  console.error(pick.error);
  process.exit(1);
}
for (const f of pick.ignored) console.error(`ignoring unregistered folder src/videos/${f}`);
console.log(pick.slug);
