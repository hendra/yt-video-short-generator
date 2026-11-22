/**
 * Gate: a generated video must actually move and actually follow its narration, before the 40-minute
 * shard render.
 *
 *   npm run check-motion -- <slug>
 *
 * Checks (deterministic, no browser, no WebGL):
 * - no Math.random()/Date.now() in the video source
 * - at least 70% of the script lines are wired to an animation cue (L(n))
 * - every 3D shot has >= 15 meshes and changes (camera or scene) inside the shot
 * - every 2D motion shot renders different markup inside the shot
 */
import fs from "node:fs";
import path from "node:path";
import { lineCoverage, motionProblems, snapshotMotion, snapshotWorld } from "./motion-gate-core.mts";
import { readScript, videoDir } from "./lib.mts";
import type { VideoDef, VideoDef3D } from "../src/engine/types";

const slug = process.argv[2];
if (!slug) {
  console.error("Usage: npx tsx scripts/check-motion.mts <slug>");
  process.exit(1);
}

const dir = videoDir(slug);
if (!fs.existsSync(dir)) {
  console.error(`Missing src/videos/${slug} — nothing to check.`);
  process.exit(1);
}

const SOURCES = ["index.ts", "world.ts", "state.ts", "shots.ts", "shots.tsx"];
const source = SOURCES.map((f) => {
  const p = path.join(dir, f);
  return fs.existsSync(p) ? fs.readFileSync(p, "utf8") : "";
}).join("\n");
const lineCount = readScript(slug).length;

// The registry is the single lookup for a composition (see src/engine/Explainer.tsx).
const { VIDEOS } = await import("../src/videos/registry.ts");
const video = VIDEOS[slug] as VideoDef | undefined;
if (!video) {
  console.error(`Video "${slug}" is not registered in src/videos/registry.ts — the render would fail.`);
  process.exit(1);
}

const world = video.mode === "3d" || video.mode === undefined ? snapshotWorld(video as VideoDef3D, video.timeline) : [];
const motion = video.mode === "motion" ? snapshotMotion(video, video.timeline) : [];
const problems = motionProblems({
  account: video.mode ?? "3d",
  source,
  lineCount,
  world,
  motion,
});

if (problems.length) {
  console.error(`check-motion DITOLAK (${slug}, ${problems.length} masalah):`);
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}

const shots = video.timeline.shots.length;
const { covered, ratio } = lineCoverage(source, lineCount);
const moving =
  video.mode === "footage"
    ? `${shots} shot cuplikan`
    : `${(video.mode === "motion" ? motion.filter((m) => m.changed) : world.filter((w) => w.cameraMoved || w.sceneMoved)).length}/${shots} shot bergerak`;
console.log(`check-motion OK: ${slug} — ${moving}, ${covered}/${lineCount} baris (${(ratio * 100).toFixed(0)}%) terikat animasi`);
