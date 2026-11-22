import { PerspectiveCamera, Vector3 } from "three";
import type { CamPose, Ctx, Line, ShotSpan, Timeline, Vec3 } from "./types";

export const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a: number, b: number, x: number) => a + (b - a) * x;
export const smooth = (x: number) => {
  const c = clamp(x);
  return c * c * (3 - 2 * c);
};
/** Smoothstep from 0 (t <= s) to 1 (t >= e). */
export const ramp = (t: number, s: number, e: number) => smooth((t - s) / Math.max(1e-6, e - s));

// ---------- physical motion (all pure functions of progress / time)
/** 0→1 with a damped overshoot: things that snap, land or pop into place (x = progress 0..1). */
export const spring = (x: number) => {
  const c = clamp(x);
  return c >= 1 ? 1 : 1 - Math.exp(-6 * c) * Math.cos(12 * c);
};
/** 0→1 like an object dropped under gravity that bounces to rest (x = progress 0..1). */
export const drop = (x: number) => {
  let c = clamp(x);
  const n = 7.5625, d = 2.75;
  if (c < 1 / d) return n * c * c;
  if (c < 2 / d) return n * (c -= 1.5 / d) * c + 0.75;
  if (c < 2.5 / d) return n * (c -= 2.25 / d) * c + 0.9375;
  return n * (c -= 2.625 / d) * c + 0.984375;
};
/** Organic drift in [-1, 1] (leaves, cables, floating things, water): never visibly repeats, pure in t. */
export const sway = (t: number, seed = 0) =>
  (Math.sin(t * 1.13 + seed * 12.9898) + 0.6 * Math.sin(t * 2.37 + seed * 78.233) + 0.3 * Math.sin(t * 4.71 + seed * 37.719)) / 1.9;

export const lerp3 = (a: Vec3, b: Vec3, x: number): Vec3 => [lerp(a[0], b[0], x), lerp(a[1], b[1], x), lerp(a[2], b[2], x)];

/** Deterministic PRNG (mulberry32). Never use Math.random() in a render. */
export const rng = (seed: number) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

export const makeCtx = (tl: Timeline): Ctx => ({
  tl,
  L: (n) => {
    const l = tl.lines[n - 1];
    if (!l) throw new Error(`Line ${n} not in timeline`);
    return l;
  },
  shot: (id) => {
    const s = tl.shots.find((x) => x.id === id);
    if (!s) throw new Error(`Shot ${id} not in timeline`);
    return s;
  },
});

export const shotAt = (tl: Timeline, t: number) =>
  tl.shots.find((s) => t >= s.s && t < s.e) ?? tl.shots[tl.shots.length - 1];

/**
 * Camera that moves through keyframes [position, target] with smoothstep easing.
 * `times` defaults to evenly spread over the shot.
 */
export const keyframes =
  (ctx: Ctx, shotId: string, keys: [Vec3, Vec3][], times?: () => number[]) =>
  (t: number): CamPose => {
    const S = ctx.shot(shotId);
    const n = keys.length;
    const ts = times ? times() : keys.map((_, i) => lerp(S.s, S.e, i / (n - 1)));
    let i = 0;
    while (i < n - 2 && t > ts[i + 1]) i++;
    const u = smooth((t - ts[i]) / (ts[i + 1] - ts[i]));
    return { position: lerp3(keys[i][0], keys[i + 1][0], u), target: lerp3(keys[i][1], keys[i + 1][1], u) };
  };

/** Slow aerial orbit around a target. */
export const orbit =
  (ctx: Ctx, shotId: string, o: { target: Vec3; from: number; to: number; r: [number, number]; h: [number, number] }) =>
  (t: number): CamPose => {
    const S = ctx.shot(shotId);
    const u = clamp((t - S.s) / (S.e - S.s));
    const a = lerp(o.from, o.to, smooth(u));
    const r = lerp(o.r[0], o.r[1], u);
    return {
      position: [o.target[0] + Math.sin(a) * r, lerp(o.h[0], o.h[1], u), o.target[2] + Math.cos(a) * r],
      target: o.target,
    };
  };

/** Playback position inside a footage clip: follows the shot, holds the last frame when the shot outlasts it. */
export const clipTimeAt = (t: number, spanStart: number, from: number, clipDur: number) =>
  Math.max(from, Math.min(from + (t - spanStart), clipDur - 1 / 30));

/** Slow push-in over a footage shot (the approved sample's zoom). */
export const footageZoom = (t: number, span: ShotSpan) => 1.05 + 0.08 * clamp((t - span.s) / Math.max(1e-6, span.e - span.s));

/** Seconds a 3D cut eases from the previous shot's camera into the new one (cheap stand-in for motion blur). */
export const CUT_BLEND = 0.3;

/** 0→1 blend progress into a shot; the window shrinks for shots shorter than CUT_BLEND so each ends at its own pose. */
export const cutProgress = (t: number, span: ShotSpan) => clamp((t - span.s) / Math.max(1e-4, Math.min(CUT_BLEND, span.e - span.s)));

export const blendPose = (from: CamPose, to: CamPose, u: number): CamPose => {
  const k = smooth(u);
  return { position: lerp3(from.position, to.position, k), target: lerp3(from.target, to.target, k) };
};

export const applyPose = (cam: PerspectiveCamera, pose: CamPose, fov: number, aspect: number) => {
  cam.fov = fov;
  cam.aspect = aspect;
  cam.near = 0.1;
  cam.far = 500;
  cam.position.set(...pose.position);
  cam.lookAt(new Vector3(...pose.target));
  cam.updateProjectionMatrix();
  cam.updateMatrixWorld();
};

/** World -> screen px for the overlay layer (same pose/fov as the 3D camera). */
export const makeProjector = (pose: CamPose, fov: number, width: number, height: number) => {
  const cam = new PerspectiveCamera();
  applyPose(cam, pose, fov, width / height);
  return (p: Vec3) => {
    const v = new Vector3(...p).project(cam);
    return { x: ((v.x + 1) / 2) * width, y: ((1 - v.y) / 2) * height, behind: v.z > 1 };
  };
};

// ---------- line beats: bind animation to the spoken script line instead of raw seconds
/** 0 before the line starts, ramps smoothly to 1 over `lead` seconds as it begins, then stays 1. */
export const beat = (t: number, line: Line, lead = 0.28) => ramp(t, line.s, line.s + Math.max(1e-6, lead));

/** 1 only while this line is being spoken (fades in/out by `fade`), 0 outside it. */
export const pulse = (t: number, line: Line, fade = 0.22) =>
  clamp(Math.min(ramp(t, line.s, line.s + fade), 1 - ramp(t, line.e - fade, line.e)));

/** 1 while the span from `from.s` to `to.e` is being spoken; fades at both ends. */
export const between = (t: number, from: Line, to: Line, fade = 0.25) =>
  clamp(Math.min(ramp(t, from.s, from.s + fade), 1 - ramp(t, to.e - fade, to.e)));

/** Index of the latest line that has started (-1 before the first). */
export const stepIndex = (t: number, lines: readonly Line[]): number => {
  let idx = -1;
  for (let i = 0; i < lines.length; i++) if (lines[i].s <= t) idx = i;
  return idx;
};

/**
 * Integrated time for continuous motion (flow particles, spinning parts) that speeds up on a line and never
 * reverses. Never pass `t * rate` to a motion phase: multiplying t by a ramping rate teleports the object and
 * runs it backwards. Here the rate ramps from 1 to (1 + boost), so this function only ever increases.
 */
export const flowPhase = (t: number, line?: Line, o: { lead?: number; boost?: number } = {}): number => {
  const { lead = 0.28, boost = 1.5 } = o;
  if (!line || t <= line.s) return t;
  const u = clamp((t - line.s) / Math.max(1e-6, lead));
  // integral of the smoothstep ramp over the lead window: u^3 - u^4/2 (extra speed is never lost)
  return t + boost * lead * (u * u * u - (u * u * u * u) / 2);
};

/** A camera nudge towards the part being explained: offsets blend in over `transition` seconds. */
export type FocusCue = { at: number; offset: Vec3; targetOffset?: Vec3 };

const add3 = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const ZERO: Vec3 = [0, 0, 0];

export const focusOffset = (base: CamPose, t: number, cues: readonly FocusCue[], transition = 0.35): CamPose => {
  let cur = -1;
  for (let i = 0; i < cues.length; i++) if (cues[i].at <= t) cur = i;
  if (cur < 0) return base;
  const prev = cur > 0 ? cues[cur - 1] : undefined;
  const u = ramp(t, cues[cur].at, cues[cur].at + transition);
  const fromPos = add3(base.position, prev?.offset ?? ZERO);
  const toPos = add3(base.position, cues[cur].offset);
  const fromTarget = add3(base.target, prev?.targetOffset ?? ZERO);
  const toTarget = add3(base.target, cues[cur].targetOffset ?? ZERO);
  return { position: lerp3(fromPos, toPos, u), target: lerp3(fromTarget, toTarget, u) };
};

export const fmtID = (v: number, dec = 0) =>
  v.toLocaleString("id-ID", { minimumFractionDigits: dec, maximumFractionDigits: dec });
