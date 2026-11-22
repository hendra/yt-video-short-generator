/** Pure helpers for the Steam trailer footage fetcher (scripts/fetch-footage.mts): no network, no ffmpeg. */

export type SteamMovie = { id: number; name: string; highlight: boolean; hls: string };

/** Trailers from a Steam `appdetails&filters=movies` response; highlighted ones first. */
export const parseSteamMovies = (json: unknown, appId: string): SteamMovie[] => {
  const entry = (json as Record<string, { success?: boolean; data?: { movies?: unknown[] } }> | null)?.[appId];
  if (!entry?.success) throw new Error(`Steam appdetails failed for app ${appId}`);
  const movies = entry.data?.movies;
  if (!Array.isArray(movies)) throw new Error(`No movies in Steam appdetails for app ${appId}`);
  const parsed = movies.flatMap((m) => {
    const o = m as Record<string, unknown>;
    return typeof o.hls_h264 === "string" && o.hls_h264
      ? [{ id: Number(o.id), name: String(o.name ?? ""), highlight: o.highlight === true, hls: o.hls_h264 }]
      : [];
  });
  if (!parsed.length) throw new Error(`No trailer with hls_h264 for app ${appId}`);
  return parsed.sort((a, b) => Number(b.highlight) - Number(a.highlight));
};

export type ClipPlan = { trailer: number; start: number; dur: number };

/** One clip per segment between scene cuts, inside [trimHead, trailerDur − trimTail]; short segments dropped, long ones capped. */
export const planClips = (
  cuts: number[],
  trailerDur: number,
  trailer: number,
  opts: { trimHead?: number; trimTail?: number; minDur?: number; maxDur?: number } = {},
): ClipPlan[] => {
  const { trimHead = 3, trimTail = 6, minDur = 1.5, maxDur = 4 } = opts;
  const from = trimHead, to = trailerDur - trimTail;
  const marks = [...new Set([from, ...cuts.filter((c) => c > from && c < to), to])].sort((a, b) => a - b);
  const plans: ClipPlan[] = [];
  for (let i = 0; i < marks.length - 1; i++) {
    const dur = marks[i + 1] - marks[i];
    if (dur < minDur) continue;
    plans.push({ trailer, start: marks[i], dur: Math.min(dur, maxDur) });
  }
  return plans;
};

/** Scene change times from FFmpeg's `select=gt(scene,0.3),showinfo` stderr. */
export const parseSceneCuts = (ffmpegStderr: string): number[] =>
  [...ffmpegStderr.matchAll(/pts_time:([\d.]+)/g)].map((m) => Number(m[1]));

/**
 * Clip output as ffmpeg args. Full 1080p-equivalent height is kept: 1920x1080 stays 1920x1080 and 4K
 * is scaled to 1080p. NVENC is used when the local machine has it; CI falls back to libx264 CRF 16.
 */
export const clipEncodeArgs = (hasNvenc: boolean): string[] => [
  "-vf",
  "scale=-2:'min(1080,ih)'",
  ...(hasNvenc
    ? ["-c:v", "h264_nvenc", "-preset", "p5", "-cq", "16", "-pix_fmt", "yuv420p"]
    : ["-c:v", "libx264", "-crf", "16", "-pix_fmt", "yuv420p"]),
];

/** True when this ffmpeg advertises the NVENC H.264 encoder. */
export const hasNvencEncoder = (ffmpegEncodersOutput: string): boolean => ffmpegEncodersOutput.includes("h264_nvenc");
