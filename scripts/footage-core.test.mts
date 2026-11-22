import assert from "node:assert/strict";
import { test } from "node:test";
import { clipEncodeArgs, hasNvencEncoder, parseSceneCuts, parseSteamMovies, planClips } from "./footage-core.mts";

const appId = "2947440";
const fixture = {
  [appId]: {
    success: true,
    data: {
      movies: [
        { id: 1, name: "a", highlight: false, hls_h264: "u1" },
        { id: 2, name: "b", highlight: true, hls_h264: "u2" },
      ],
    },
  },
};

test("parseSteamMovies lists highlighted trailers first", () => {
  const movies = parseSteamMovies(fixture, appId);
  assert.deepEqual(
    movies.map((m) => m.id),
    [2, 1],
  );
  assert.deepEqual(movies[0], { id: 2, name: "b", highlight: true, hls: "u2" });
});

test("parseSteamMovies throws naming the app id when the response fails", () => {
  assert.throws(() => parseSteamMovies({ [appId]: { success: false } }, appId), new RegExp(appId));
  assert.throws(() => parseSteamMovies({ [appId]: { success: true, data: {} } }, appId), new RegExp(appId));
});

test("planClips keeps usable segments inside the trim bounds", () => {
  const clips = planClips([2, 5, 5.8, 9, 14, 120], 126, 0);
  for (const c of clips) {
    assert.ok(c.start >= 3, `starts at ${c.start}`);
    assert.ok(c.start + c.dur <= 120 + 1e-9, `ends at ${c.start + c.dur}`);
    assert.ok(c.dur <= 4 + 1e-9);
    assert.equal(c.trailer, 0);
  }
  assert.deepEqual(
    clips.find((c) => c.start === 9),
    { trailer: 0, start: 9, dur: 4 },
  );
  assert.equal(
    clips.some((c) => c.start === 5),
    false,
    "the 0.8 s segment is dropped",
  );
});

test("parseSceneCuts reads pts_time values from showinfo", () => {
  const stderr = "[Parsed_showinfo_1] n:0 pts:847345 pts_time:28.244883\n[Parsed_showinfo_1] n:1 pts:882345 pts_time:29.41\n";
  assert.deepEqual(parseSceneCuts(stderr), [28.244883, 29.41]);
  assert.deepEqual(parseSceneCuts("no cuts here"), []);
});

test("clipEncodeArgs keeps full height and picks the encoder available", () => {
  const gpu = clipEncodeArgs(true);
  assert.deepEqual(gpu.slice(0, 2), ["-vf", "scale=-2:'min(1080,ih)'"]);
  assert.ok(gpu.includes("h264_nvenc"));
  assert.ok(!gpu.includes("libx264"));
  const cpu = clipEncodeArgs(false);
  assert.ok(cpu.includes("libx264"));
  assert.ok(cpu.includes("16"));
  assert.ok(!cpu.includes("h264_nvenc"));
});

test("hasNvencEncoder only matches the real encoder name", () => {
  assert.equal(hasNvencEncoder(" V..... h264_nvenc           NVIDIA NVENC H.264 encoder"), true);
  assert.equal(hasNvencEncoder(" V..... libx264              libx264 H.264"), false);
  assert.equal(hasNvencEncoder(" V..... h264_amf             AMD AMF H.264"), false);
});
