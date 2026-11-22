import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, test } from "node:test";
import { CERPENEK_MOODS, MOODS_BY_ACCOUNT, ffmpegMusicArgs, musicDirFor, readVideoAccount, resolveMusicTrack } from "./music.mts";

describe("resolveMusicTrack", () => {
  test("returns null when config.music is omitted for any account", () => {
    assert.equal(resolveMusicTrack(undefined, "ai-labs", "/tmp/m", () => true), null);
    assert.equal(resolveMusicTrack(undefined, "kali-aja", "/tmp/m", () => true), null);
  });

  test("resolves each valid mood per account to its MP3 path", () => {
    for (const [account, moods] of Object.entries(MOODS_BY_ACCOUNT) as [keyof typeof MOODS_BY_ACCOUNT, readonly string[]][]) {
      for (const mood of moods) {
        const p = resolveMusicTrack(mood, account, `/tmp/${account}`, () => true);
        assert.equal(p, path.join(`/tmp/${account}`, `${mood}.mp3`));
      }
    }
    assert.deepEqual(CERPENEK_MOODS, MOODS_BY_ACCOUNT.cerpenek);
    assert.ok(musicDirFor("ai-labs").endsWith(path.join("public", "ai-labs", "music")));
  });

  test("rejects unknown, empty, or cross-channel mood strings with the account mood list", () => {
    assert.throws(() => resolveMusicTrack("seram", "cerpenek", "/tmp/m", () => true), /ceria, hangat, petualang, nusantara, ajaib/);
    assert.throws(() => resolveMusicTrack("ceria", "ai-labs", "/tmp/m", () => true), /build, debug, showcase/);
    assert.throws(() => resolveMusicTrack("build", "kali-aja", "/tmp/m", () => true), /teknik, misteri, fenomena/);
    assert.throws(() => resolveMusicTrack("teknik", "sastra-mesin", "/tmp/m", () => true), /rakit, aliran, rahasia/);
    assert.throws(() => resolveMusicTrack("teknik", "upwayyy", "/tmp/m", () => true), /mencekam, misteri, klimaks/);
    assert.throws(() => resolveMusicTrack("", "ai-labs", "/tmp/m", () => true), /build, debug, showcase/);
  });

  test("rejects valid mood when MP3 file does not exist", () => {
    assert.throws(() => resolveMusicTrack("build", "ai-labs", "/tmp/m", () => false), /build\.mp3/);
  });
});

describe("readVideoAccount", () => {
  test("reads publish.json.account when present, falls back to kali-aja when absent, and throws on invalid account", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "music-acct-"));
    try {
      assert.equal(readVideoAccount("v", tmp), "kali-aja");
      fs.writeFileSync(path.join(tmp, "publish.json"), JSON.stringify({ account: "ai-labs" }));
      assert.equal(readVideoAccount("v", tmp), "ai-labs");
      fs.writeFileSync(path.join(tmp, "publish.json"), JSON.stringify({ account: "unknown" }));
      assert.throws(() => readVideoAccount("v", tmp), /Unknown account/);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});

describe("ffmpegMusicArgs", () => {
  test("loops, trims to dur, normalizes, fades in 0.5s and out 2.0s, and outputs 44.1kHz stereo WAV", () => {
    const args = ffmpegMusicArgs("/in/hangat.mp3", "/out/music.wav", 72.5);
    assert.equal(args.includes("-stream_loop"), true);
    assert.equal(args[args.indexOf("-stream_loop") + 1], "-1");
    assert.equal(args[args.indexOf("-t") + 1], "72.500");
    const af = args[args.indexOf("-af") + 1];
    assert.match(af, /afade=t=in:st=0:d=0\.500/);
    assert.match(af, /afade=t=out:st=70\.500:d=2\.000/);
    assert.match(af, /loudnorm=/);
    assert.equal(args[args.indexOf("-ar") + 1], "44100");
    assert.equal(args[args.indexOf("-ac") + 1], "2");
    assert.equal(args[args.length - 1], "/out/music.wav");
  });

  test("clamps fade durations safely when video duration is shorter than 2.5s or non-finite", () => {
    const shortArgs = ffmpegMusicArgs("/in/ceria.mp3", "/out/music.wav", 1.5);
    const shortAf = shortArgs[shortArgs.indexOf("-af") + 1];
    assert.match(shortAf, /afade=t=in:st=0:d=0\.500/);
    assert.match(shortAf, /afade=t=out:st=0\.500:d=1\.000/);

    const nanArgs = ffmpegMusicArgs("/in/ceria.mp3", "/out/music.wav", Number.NaN);
    assert.equal(nanArgs[nanArgs.indexOf("-t") + 1], "0.100");
    assert.doesNotMatch(nanArgs[nanArgs.indexOf("-af") + 1], /NaN/);
  });
});
