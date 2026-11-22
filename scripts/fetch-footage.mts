/**
 * Fetch official Steam trailer footage for a video, cut into short silent clips.
 *   npm run footage -- <slug> --appid <id> [--min 8]
 * Writes public/<slug>/clips/NN.mp4 (up to 1080p, H.264, no audio) and public/<slug>/clips.json.
 * Everything is staged in public/<slug>/.clips.tmp (same device, so the swap is a rename); public/<slug>/clips is only replaced once enough clips exist.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { publicDir } from "./lib.mts";
import { type ClipPlan, type SteamMovie, clipEncodeArgs, hasNvencEncoder, parseSceneCuts, parseSteamMovies, planClips } from "./footage-core.mts";

/** Steam trailer scenes are cut at ~0.3; download errors still exit 0, so check the file exists. */
const SCENE_THRESHOLD = 0.3;
const TRIED_TRAILERS = 3;
const STEAM_TIMEOUT_MS = 30_000;

const run = (cmd: string, args: string[]) => {
  const r = spawnSync(cmd, args, { encoding: "utf8" });
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(" ")} failed:\n${(r.stderr || r.stdout).trim()}`);
  return r.stderr ?? "";
};

const download = (movie: SteamMovie, out: string) => {
  run("ffmpeg", ["-v", "error", "-y", "-i", movie.hls, "-map", "0:v:0", "-an", "-c", "copy", out]);
  if (!fs.existsSync(out) || fs.statSync(out).size === 0) throw new Error(`Trailer ${movie.id} downloaded nothing`);
};

const duration = (file: string): number => {
  const r = spawnSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", file], { encoding: "utf8" });
  const dur = Number(r.stdout?.trim());
  if (!Number.isFinite(dur) || dur <= 0) throw new Error(`Could not read duration of ${file}`);
  return dur;
};

const sceneCuts = (file: string): number[] =>
  parseSceneCuts(run("ffmpeg", ["-hide_banner", "-i", file, "-vf", `select='gt(scene,${SCENE_THRESHOLD})',showinfo`, "-an", "-f", "null", "-"]));

const cutClips = (file: string, plans: ClipPlan[], dir: string, encode: string[]): string[] =>
  plans.map((p, i) => {
    const name = `${String(i + 1).padStart(2, "0")}.mp4`;
    // shortcut: scene detector keeps burned-in trailer title cards, upgrade with vision/OCR filter if needed
    run("ffmpeg", ["-v", "error", "-y", "-ss", String(p.start), "-t", String(p.dur), "-i", file, "-an", ...encode, path.join(dir, name)]);
    return name;
  });

const main = async () => {
  const positional: string[] = [];
  const opts: Record<string, string> = {};
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    const inline = /^--([a-z]+)=(.*)$/.exec(args[i]);
    if (inline) opts[inline[1]] = inline[2];
    else if (args[i].startsWith("--")) opts[args[i].slice(2)] = args[++i];
    else positional.push(args[i]);
  }
  const [slug] = positional;
  const appId = opts.appid;
  const min = Number(opts.min ?? 8);
  if (!slug || !/^[a-z0-9-]+$/.test(slug) || !appId || !/^\d+$/.test(appId) || !Number.isInteger(min) || min < 1) {
    console.error("Usage: npm run footage -- <slug> --appid <steam-app-id> [--min 8]");
    process.exit(1);
  }

  // Staged inside public/<slug> so the final rename is same-device; removed on any failure.
  const outDir = path.join(publicDir(slug), "clips");
  const clipsJson = path.join(publicDir(slug), "clips.json");
  const stage = path.join(publicDir(slug), ".clips.tmp");
  fs.rmSync(stage, { recursive: true, force: true });
  fs.mkdirSync(stage, { recursive: true });
  const encode = clipEncodeArgs(hasNvencEncoder(spawnSync("ffmpeg", ["-hide_banner", "-encoders"], { encoding: "utf8" }).stdout ?? ""));
  try {
    const res = await fetch(`https://store.steampowered.com/api/appdetails?appids=${appId}&filters=movies`, {
      signal: AbortSignal.timeout(STEAM_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`Steam appdetails HTTP ${res.status} for app ${appId}`);
    const movies = parseSteamMovies(await res.json(), appId).slice(0, TRIED_TRAILERS);

    const plans: (ClipPlan & { file: string })[] = [];
    for (const [ti, movie] of movies.entries()) {
      if (plans.length >= min) break;
      const src = path.join(stage, `trailer-${ti}.mp4`);
      try {
        download(movie, src);
        const batch: (ClipPlan & { file: string })[] = [];
        const dir = path.join(stage, `trailer-${ti}`);
        fs.mkdirSync(dir);
        const plan = planClips(sceneCuts(src), duration(src), ti);
        cutClips(src, plan, dir, encode).forEach((file, i) => batch.push({ ...plan[i], file: path.join(dir, file) }));
        plans.push(...batch);
        fs.rmSync(src);
        console.log(`trailer ${movie.id} "${movie.name}": ${batch.length} clips`);
      } catch (e) {
        console.log(`trailer ${movie.id} "${movie.name}" skipped: ${(e as Error).message.split("\n")[0]}`);
      }
    }

    if (plans.length < min) throw new Error(`Only ${plans.length} clips from ${movies.length} trailers, need ${min}. public/${slug}/clips left untouched.`);

    // Renumber on move so file names are contiguous across trailers.
    const clips = plans.map((p, i) => ({ file: `${String(i + 1).padStart(2, "0")}.mp4`, dur: Number(p.dur.toFixed(3)), trailer: p.trailer, start: Number(p.start.toFixed(3)), src: p.file }));
    const fresh = path.join(stage, "out");
    fs.mkdirSync(fresh);
    for (const c of clips) fs.renameSync(c.src, path.join(fresh, c.file));

    // Swap: stage the index too, keep the old dir and index until both are in place; restore on error.
    const freshJson = path.join(stage, "clips.json");
    fs.writeFileSync(freshJson, JSON.stringify(clips.map(({ file, dur, trailer, start }) => ({ file, dur, trailer, start }))));
    const old = path.join(stage, "old");
    const oldJson = path.join(stage, "clips.json.old");
    const hadOld = fs.existsSync(outDir);
    const hadOldJson = fs.existsSync(clipsJson);
    try {
      if (hadOld) fs.renameSync(outDir, old);
      if (hadOldJson) fs.renameSync(clipsJson, oldJson);
      fs.renameSync(fresh, outDir);
      fs.renameSync(freshJson, clipsJson);
    } catch (e) {
      fs.rmSync(outDir, { recursive: true, force: true });
      if (hadOld) fs.renameSync(old, outDir);
      if (hadOldJson) fs.renameSync(oldJson, clipsJson);
      throw e;
    }
    fs.rmSync(old, { recursive: true, force: true });
    fs.rmSync(oldJson, { force: true });
    console.log(`${clips.length} clips written to public/${slug}/clips and clips.json`);
  } catch (e) {
    console.error((e as Error).message);
    process.exitCode = 1;
  } finally {
    fs.rmSync(stage, { recursive: true, force: true });
  }
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
