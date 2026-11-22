/**
 * Pure checks behind `scripts/check-motion.mts` — no I/O, no env access, so they unit-test directly.
 *
 * The gate exists to catch a scene that is technically valid but visually dead (a single slow pan over a
 * frozen diorama, or a 2D card that never changes inside its shot) BEFORE the 40-minute shard render.
 */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Scene, type Object3D } from "three";
import type { Timeline, VideoDef3D, VideoDefMotion } from "../src/engine/types";

export const THRESHOLDS = {
  /** Share of script lines that must be wired to an animation cue. */
  lineCoverage: 0.7,
  /** A shot with fewer meshes than this reads as a bare box scene. */
  minNodes: 15,
  /** Metres the camera must travel (or turn) inside a shot. */
  cameraEps: 0.02,
  /** World-matrix / material delta that counts as the scene moving. */
  sceneEps: 0.005,
  /** Timestamps sampled inside every shot. */
  samples: [0.1, 0.5, 0.9] as const,
} as const;

/** Distinct `L(n)` / `ctx.L(n)` references, limited to the lines the script actually has. */
export const lineCoverage = (source: string, lineCount: number): { covered: number; ratio: number } => {
  const seen = new Set<number>();
  for (const m of source.matchAll(/\.?L\((\d+)\)/g)) {
    const n = Number(m[1]);
    if (n >= 1 && n <= lineCount) seen.add(n);
  }
  const covered = seen.size;
  return { covered, ratio: lineCount > 0 ? covered / lineCount : 0 };
};

/** Non-deterministic calls: Remotion renders frames out of order across parallel shards. */
export const findForbidden = (source: string): string[] => {
  const hits: string[] = [];
  for (const [name, re] of [
    ["Math.random", /\bMath\.random\s*\(/g],
    ["Date.now", /\bDate\.now\s*\(/g],
  ] as const) {
    const n = source.match(re)?.length ?? 0;
    for (let i = 0; i < n; i++) hits.push(name);
  }
  return hits;
};

/** Meshes only: a bare group renders nothing, so it must not count towards scene richness. */
export const countNodes = (root: Object3D): number => {
  let n = 0;
  root.traverse((o) => {
    if ((o as { isMesh?: boolean }).isMesh) n++;
  });
  return n;
};

const flat = (v: { x: number; y: number; z: number }) => [v.x, v.y, v.z];
const differs = (a: readonly number[], b: readonly number[], eps: number) => a.some((v, i) => Math.abs(v - b[i]) > eps);

const worldSignature = (root: Object3D): number[] => {
  const sig: number[] = [];
  root.updateMatrixWorld(true);
  root.traverse((o) => {
    sig.push(...flat(o.position), ...flat(o.rotation), ...flat(o.scale));
    sig.push(...o.matrixWorld.elements);
    const inst = o as { isInstancedMesh?: boolean; instanceMatrix?: { array: ArrayLike<number> } };
    if (inst.isInstancedMesh && inst.instanceMatrix) {
      // a few samples are enough: any real flow changes the first instances too
      for (let i = 0; i < Math.min(48, inst.instanceMatrix.array.length); i++) sig.push(inst.instanceMatrix.array[i]);
    }
    const mat = (o as { material?: { emissiveIntensity?: number } }).material;
    if (mat && typeof mat.emissiveIntensity === "number") sig.push(mat.emissiveIntensity);
    sig.push(o.visible ? 1 : 0);
  });
  return sig;
};

export type WorldSample = { shot: string; cameraMoved: boolean; sceneMoved: boolean; nodes: number };

/**
 * Drives the real world in Node (Three.js scene graphs need no WebGL) and reports, per shot, whether the
 * camera and the scene actually change inside it.
 */
export const snapshotWorld = (video: VideoDef3D, tl: Timeline): WorldSample[] => {
  const ctx = { tl, L: (n: number) => tl.lines[n - 1], shot: (id: string) => tl.shots.find((s) => s.id === id)! };
  const world = video.createWorld(ctx);
  const scene = new Scene();
  const shots = video.shots(ctx);
  return tl.shots.map((span) => {
    const shot = shots[span.id];
    if (!shot) return { shot: span.id, cameraMoved: false, sceneMoved: false, nodes: countNodes(world.root) };
    const dur = Math.max(1e-6, span.e - span.s);
    let cameraMoved = false;
    let sceneMoved = false;
    let prevPose: ReturnType<typeof shot.camera> | null = null;
    let prevSig: number[] | null = null;
    for (const u of THRESHOLDS.samples) {
      const t = span.s + dur * u;
      const pose = shot.camera(t);
      world.update(t, span.id, pose, scene);
      if (prevPose) {
        if (differs([...pose.position, ...pose.target], [...prevPose.position, ...prevPose.target], THRESHOLDS.cameraEps)) cameraMoved = true;
      }
      const sig = worldSignature(world.root);
      if (prevSig && differs(sig, prevSig, THRESHOLDS.sceneEps)) sceneMoved = true;
      prevPose = pose;
      prevSig = sig;
    }
    return { shot: span.id, cameraMoved, sceneMoved, nodes: countNodes(world.root) };
  });
};

export type MotionSample = { shot: string; changed: boolean };

/** Renders each 2D shot at the same timestamps and compares normalized markup. */
export const snapshotMotion = (video: VideoDefMotion, tl: Timeline): MotionSample[] => {
  const ctx = { tl, L: (n: number) => tl.lines[n - 1], shot: (id: string) => tl.shots.find((s) => s.id === id)! };
  const shots = video.shots(ctx);
  return tl.shots.map((span) => {
    const shot = shots[span.id];
    if (!shot) return { shot: span.id, changed: false };
    const dur = Math.max(1e-6, span.e - span.s);
    const seen = THRESHOLDS.samples.map((u) => {
      const local = dur * u;
      const html = renderToStaticMarkup(shot.render({ t: span.s + local, local, dur, progress: u }) as React.ReactElement);
      // useId values differ per render pass: strip them or every shot looks animated
      return html.replace(/id="[^"]*"/g, "").replace(/url\(#[^)]*\)/g, "");
    });
    return { shot: span.id, changed: new Set(seen).size > 1 };
  });
};

export const motionProblems = (opts: {
  /** "footage" shots bring their own motion (a trailer plays), so no samples are passed for them. */
  account: "3d" | "motion" | "footage";
  source: string;
  lineCount: number;
  world: WorldSample[];
  motion: MotionSample[];
}): string[] => {
  const problems: string[] = [];
  const { covered, ratio } = lineCoverage(opts.source, opts.lineCount);
  if (opts.lineCount > 0 && ratio < THRESHOLDS.lineCoverage) {
    problems.push(
      `cakupan baris terlalu rendah: ${covered}/${opts.lineCount} (${(ratio * 100).toFixed(0)}%) — ikat animasi ke L(n) baris yang sedang diucapkan, minimal ${(THRESHOLDS.lineCoverage * 100).toFixed(0)}%`,
    );
  }
  for (const hit of findForbidden(opts.source)) {
    problems.push(`${hit}() dilarang: render frame berjalan tidak berurutan, pakai rng()/t`);
  }
  for (const s of opts.world) {
    if (s.nodes < THRESHOLDS.minNodes) {
      problems.push(`shot ${s.shot}: hanya ${s.nodes} mesh (minimal ${THRESHOLDS.minNodes}) — adegan terlalu kosong`);
    }
    // Camera motion alone is not enough: a slow pan over a frozen diorama is exactly the "static, boring"
    // look this gate exists to stop. Something in the scene must move too.
    if (!s.sceneMoved) {
      problems.push(`shot ${s.shot}: objek tidak bergerak sepanjang shot (kamera saja tidak cukup) — ikat bagian yang diceritakan ke L(n)`);
    }
  }
  for (const s of opts.motion) {
    if (!s.changed) problems.push(`shot ${s.shot}: kartu motion tidak berubah sepanjang shot — tambahkan beat dari L(n)`);
  }
  return problems;
};
