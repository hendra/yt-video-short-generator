import React from "react";
import { AbsoluteFill } from "remotion";
import { FONT } from "../fonts";
import { clamp, makeProjector } from "../math";
import { safeStageTop } from "../motion/math";
import type { CamPose, OverlayTheme, ShotDef, Timeline, VideoDef } from "../types";

const INK = "#1d2328";
const CREAM = "#f4f1ea";
const GREEN = "#1f9e6e";
const MINT = "#7fe3c4";
const UPWAYYY_RED = "#ff2a2a";

/** Theme accent: red for upwayyy, the mint dark-tech has always used. */
export const accentOf = (theme: OverlayTheme): string => (theme === "upwayyy" ? UPWAYYY_RED : MINT);
const accentBorder = (theme: OverlayTheme, a: number): string => `rgba(${theme === "upwayyy" ? "255, 42, 42" : "127, 227, 196"}, ${a})`;
/** Chip/tag accents: cyan on dark-tech, red on upwayyy. */
const skyAccent = (theme: OverlayTheme): string => (theme === "upwayyy" ? UPWAYYY_RED : "#38bdf8");
/** The softer accent used on chip/tag/caption-box borders (upwayyy is a touch stronger). */
const skyBorder = (theme: OverlayTheme): string => (theme === "upwayyy" ? "rgba(255, 42, 42, 0.4)" : "rgba(56, 189, 248, 0.3)");

/** Both dark layouts: white ink on dark panels. */
const isDark = (theme: OverlayTheme): boolean => theme === "dark-tech" || theme === "upwayyy";

// SASTRA MESIN "blueprint" look: light drafting paper, navy ink, cyan = flow/energy, orange = heat/moving parts.
const BP = { paper: "#F4F5F6", navy: "#101820", cyan: "#20C9C3", orange: "#FF8A36", steel: "#81909C", red: "#d6453a" };
const GRID = "rgba(32,201,195,0.13)";
export const BLUEPRINT_BG: React.CSSProperties = {
  backgroundColor: BP.paper,
  backgroundImage: `linear-gradient(${GRID} 2px, transparent 2px), linear-gradient(90deg, ${GRID} 2px, transparent 2px), linear-gradient(rgba(32,201,195,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(32,201,195,0.06) 1px, transparent 1px)`,
  backgroundSize: "120px 120px, 120px 120px, 30px 30px, 30px 30px",
};
const BP_HEADER_SHIFT = 64; // brand row sits above the title

type OverlayShot = Pick<ShotDef, "label" | "title" | "tag" | "chip" | "callouts">;

/** "Pintu air *ditutup*\nbaris dua" -> spans with highlighted words. */
const Title: React.FC<{ text: string; highlightColor: string }> = ({ text, highlightColor }) => (
  <>
    {text.split("\n").map((line, i) => (
      <div key={i}>
        {line.split(/(\*[^*]+\*)/).map((seg, j) =>
          seg.startsWith("*") ? (
            <span key={j} style={{ color: highlightColor }}>
              {seg.slice(1, -1)}
            </span>
          ) : (
            <span key={j}>{seg}</span>
          ),
        )}
      </div>
    ))}
  </>
);

const Header: React.FC<{ shot: OverlayShot; local: number; theme: OverlayTheme }> = ({ shot, local, theme }) => {
  const k = clamp(local / 0.35);
  const dark = isDark(theme);
  return (
    <div style={{ alignSelf: "stretch", opacity: k, transform: `translateY(${(1 - k) * 24}px)` }}>
      <div style={{ font: `600 30px ${FONT.mono}`, letterSpacing: 5, color: dark ? accentOf(theme) : "#5c6670", textTransform: "uppercase" }}>{shot.label}</div>
      <div style={{ font: `800 66px/1.05 ${FONT.display}`, letterSpacing: -1.5, color: dark ? "#f8fafc" : INK, marginTop: 10 }}>
        <Title text={shot.title} highlightColor={dark ? accentOf(theme) : GREEN} />
      </div>
    </div>
  );
};

const Chip: React.FC<{ shot: OverlayShot; t: number; theme: OverlayTheme }> = ({ shot, t, theme }) => {
  const c = shot.chip?.(t);
  if (!c) return null;
  if (isDark(theme)) {
    const border = c.red ? "#f87171" : skyAccent(theme);
    return (
      <div style={{ marginTop: 17 }}>
        <span style={{ display: "inline-block", padding: "8px 14px", border: `2px solid ${border}`, borderBottom: "none", borderRadius: "8px 8px 0 0", background: "#0b0f17", font: `400 22px ${FONT.mono}`, letterSpacing: 3, color: border }}>
          {c.key}
        </span>
        <span style={{ display: "block", padding: "12px 20px", border: `2px solid ${border}`, borderRadius: "0 12px 12px 12px", background: "rgba(15, 23, 42, 0.9)", color: "#f8fafc", font: `800 52px ${FONT.display}`, whiteSpace: "nowrap" }}>
          {c.value}
          {c.unit ? <small style={{ font: `600 26px ${FONT.ui}`, color: c.red ? "#fecaca" : "#94a3b8", marginLeft: 8 }}>{c.unit}</small> : null}
        </span>
      </div>
    );
  }
  const color = c.red ? "#c8352b" : INK;
  return (
    <div style={{ marginTop: 17 }}>
      <span style={{ display: "inline-block", padding: "8px 14px", border: `2px solid ${color}`, borderBottom: "none", borderRadius: "8px 8px 0 0", background: CREAM, font: `400 22px ${FONT.mono}`, letterSpacing: 3, color }}>
        {c.key}
      </span>
      <span style={{ display: "block", padding: "12px 20px", borderRadius: "0 12px 12px 12px", background: color, color: "#fff", font: `800 52px ${FONT.display}`, whiteSpace: "nowrap" }}>
        {c.value}
        {c.unit ? <small style={{ font: `600 26px ${FONT.ui}`, color: c.red ? "#ffd9d4" : "#9fb0bd", marginLeft: 8 }}>{c.unit}</small> : null}
      </span>
    </div>
  );
};

/* ---------- callout layout: no label may overlap another label, the header/chip/CTA or the captions ---------- */

const LABEL_FONT = `700 32px ${FONT.ui}`;
const LABEL_PAD_X = 20 + 3; // padding + border
const LABEL_H = 32 * 1.25 + 2 * 10 + 6; // line + padding + border
const GAP = 16; // minimum gap between label boxes
const EDGE = 36; // keep labels this far from the frame edge
const CAPTION_TOP = 1270;
const CAPTION_CLEAR = CAPTION_TOP - 28; // labels, leader lines and dots stay above this

let measureCtx: CanvasRenderingContext2D | null = null;
const textWidth = (text: string) => {
  if (!measureCtx) measureCtx = document.createElement("canvas").getContext("2d");
  if (!measureCtx) return text.length * 17;
  measureCtx.font = LABEL_FONT;
  return measureCtx.measureText(text).width;
};

type Placed = { ax: number; ay: number; x: number; y: number; w: number; h: number; e: number; idx: number; edge: boolean };

/**
 * Deterministic overlap removal (pure function of the inputs -> stable across frames/renders).
 * 1. clamp each label inside [EDGE..1080-EDGE] x [top..CAPTION_CLEAR]
 * 2. relax pairwise overlaps, mostly vertically (labels sit beside 3D objects), sideways when stuck on a bound
 */
export const layoutLabels = (items: Placed[], top: number): Placed[] => {
  const bx = (p: Placed) => [EDGE + p.w / 2, 1080 - EDGE - p.w / 2] as const;
  const by = (p: Placed) => [top + p.h / 2, CAPTION_CLEAR - p.h / 2] as const;
  const fit = (p: Placed) => {
    const [x0, x1] = bx(p);
    const [y0, y1] = by(p);
    p.x = clamp(p.x, x0, x1);
    p.y = clamp(p.y, y0, y1);
  };
  items.forEach(fit);
  for (let it = 0; it < 60; it++) {
    let moved = false;
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const a = items[i];
        const b = items[j];
        const ox = (a.w + b.w) / 2 + GAP - Math.abs(a.x - b.x);
        const oy = (a.h + b.h) / 2 + GAP - Math.abs(a.y - b.y);
        if (ox <= 0 || oy <= 0) continue;
        moved = true;
        // push along the axis that needs the smaller move; prefer vertical
        if (oy <= ox * 1.5) {
          const s = a.y < b.y || (a.y === b.y && i < j) ? -1 : 1;
          a.y += (s * oy) / 2 + s * 0.5;
          b.y -= (s * oy) / 2 + s * 0.5;
        } else {
          const s = a.x < b.x || (a.x === b.x && i < j) ? -1 : 1;
          a.x += (s * ox) / 2 + s * 0.5;
          b.x -= (s * ox) / 2 + s * 0.5;
        }
        fit(a);
        fit(b);
      }
    }
    if (!moved) break;
  }
  return items;
};

const overlaps = (a: Placed, b: Placed) => Math.abs(a.x - b.x) < (a.w + b.w) / 2 + 2 && Math.abs(a.y - b.y) < (a.h + b.h) / 2 + 2;

const Callouts: React.FC<{ shot: OverlayShot; t: number; pose: CamPose; fov: number; top: number; bp?: boolean }> = ({ shot, t, pose, fov, top, bp }) => {
  const project = makeProjector(pose, fov, 1080, 1920);
  const defs = (shot.callouts ?? []).filter((c) => t >= c.at && (c.until === undefined || t <= c.until));
  const raw: Placed[] = [];
  defs.forEach((c, idx) => {
    const a = project(c.anchor(t));
    if (a.behind) return;
    // anchor outside the visible zone (off-frame, under the header, behind the captions): pin it to the zone edge,
    // draw the leader line towards it without the dot -> nothing is ever drawn over the header or the captions
    const ax = clamp(a.x, 12, 1068);
    const ay = clamp(a.y, top - 40, CAPTION_CLEAR);
    const edge = ax !== a.x || ay !== a.y;
    const e = clamp((t - c.at) / 0.3);
    raw.push({ ax, ay, x: a.x + c.dx, y: a.y + c.dy * e, w: textWidth(c.text) + 2 * LABEL_PAD_X + (bp ? 56 : 0), h: LABEL_H, e, idx, edge });
  });
  // layout with entry scale ignored (full size) so boxes never collide mid-animation
  const placed = layoutLabels(raw, top);
  // last resort: if a label is still overlapping an earlier one (too many for the space), hide it
  const shown = placed.filter((p, k) => !placed.slice(0, k).some((q) => overlaps(p, q)));
  if (bp) {
    const tone = (v?: string) => (v === "orange" ? BP.orange : v === "red" ? BP.red : BP.cyan);
    return (
      <>
        <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
          {shown.map((p) => (
            <g key={p.idx} opacity={p.e}>
              <line x1={p.ax} y1={p.ay} x2={p.x} y2={p.y} stroke={BP.navy} strokeWidth={2} strokeDasharray="10 6" />
              {p.edge ? null : <circle cx={p.ax} cy={p.ay} r={8} fill={tone(defs[p.idx].variant)} stroke="#fff" strokeWidth={3} />}
            </g>
          ))}
        </svg>
        {shown.map((p) => {
          const c = defs[p.idx];
          return (
            <div key={p.idx} style={{
              position: "absolute", left: p.x, top: p.y, opacity: p.e, transform: `translate(-50%,-50%) scale(${0.7 + 0.3 * p.e})`,
              display: "flex", alignItems: "center", gap: 14, padding: "10px 20px 10px 12px", background: "#fff",
              borderLeft: `8px solid ${tone(c.variant)}`, boxShadow: "0 3px 0 rgba(16,24,32,0.12)", borderRadius: 4,
              font: LABEL_FONT, lineHeight: 1.25, color: BP.navy, whiteSpace: "nowrap",
            }}>
              <span style={{ width: 42, height: 42, borderRadius: 21, background: BP.navy, color: "#fff", font: `700 24px ${FONT.mono}`, display: "flex", alignItems: "center", justifyContent: "center" }}>{p.idx + 1}</span>
              {c.text}
            </div>
          );
        })}
      </>
    );
  }
  return (
    <>
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        {shown.map((p) => (
          <g key={p.idx} opacity={p.e}>
            <line x1={p.ax} y1={p.ay} x2={p.x} y2={p.y} stroke={INK} strokeWidth={3} />
            {p.edge ? null : <circle cx={p.ax} cy={p.ay} r={9} fill="#fff" stroke={INK} strokeWidth={3} />}
          </g>
        ))}
      </svg>
      {shown.map((p) => {
        const c = defs[p.idx];
        const bg = c.variant === "orange" ? "#e8622c" : c.variant === "red" ? "#c8352b" : "#fff";
        return (
          <div
            key={p.idx}
            style={{
              position: "absolute", left: p.x, top: p.y, opacity: p.e,
              transform: `translate(-50%,-50%) scale(${0.7 + 0.3 * p.e})`,
              padding: "10px 20px", borderRadius: 14, background: bg,
              border: `3px solid ${c.variant ? bg : INK}`, color: c.variant ? "#fff" : INK,
              font: LABEL_FONT, lineHeight: 1.25, whiteSpace: "nowrap",
            }}
          >
            {c.text}
          </div>
        );
      })}
    </>
  );
};

/** The overlay look a video renders with: its own `theme`, else the mode's long-standing default. */
export const themeOf = (video: VideoDef): OverlayTheme => video.theme ?? (video.mode === "motion" ? "dark-tech" : video.mode === "footage" ? "upwayyy" : "cream");

export const shouldShowCaptions = (captions?: boolean): boolean => captions !== false;

export const captionBoxStyle = (theme: OverlayTheme): React.CSSProperties => {
  if (theme === "blueprint") {
    return {
      display: "inline-block",
      padding: "14px 26px",
      background: "#fff",
      border: `3px solid ${BP.navy}`,
      borderRadius: 8,
      font: `800 60px ${FONT.ui}`,
      lineHeight: 1.32,
      color: BP.navy,
    };
  }
  const dark = isDark(theme);
  return {
    display: "inline-block",
    padding: "14px 26px",
    background: dark ? "rgba(11, 15, 23, 0.92)" : "rgba(24,30,34,.88)",
    border: dark ? `1px solid ${skyBorder(theme)}` : undefined,
    borderRadius: 14,
    font: `800 60px ${FONT.ui}`,
    lineHeight: 1.32,
    color: "#fff",
  };
};

/** Karaoke captions: one short phrase at a time, current word highlighted. */
const Captions: React.FC<{ tl: Timeline; t: number; theme: OverlayTheme }> = ({ tl, t, theme }) => {
  const i = tl.chunks.findIndex((c, k) => {
    const next = tl.chunks[k + 1];
    const end = next ? Math.min(next.s - 0.05, c.e + 0.6) : c.e + 0.6;
    return t >= c.s - 0.05 && t < end;
  });
  if (i < 0) return null;
  const ch = tl.chunks[i];
  const bp = theme === "blueprint";
  return (
    <div style={{ position: "absolute", left: 90, right: 90, top: CAPTION_TOP, textAlign: "center" }}>
      <span style={captionBoxStyle(theme)}>
        {ch.words.map((w, k) => {
          const on = t >= w.s && t < w.e + 0.02;
          const activeStyle: React.CSSProperties | undefined = on
            ? bp
              ? { textDecoration: "underline", textDecorationColor: BP.cyan, textDecorationThickness: 8, textUnderlineOffset: 8 }
              : { color: accentOf(theme), textDecoration: "underline", textDecorationThickness: 5, textUnderlineOffset: 8 }
            : undefined;
          return (
            <React.Fragment key={k}>
              <span style={activeStyle}>{w.w}</span>
              {k < ch.words.length - 1 ? " " : ""}
            </React.Fragment>
          );
        })}
      </span>
    </div>
  );
};

export const Overlays: React.FC<{
  video: VideoDef;
  shot: OverlayShot;
  shotStart: number;
  t: number;
  pose?: CamPose;
  theme?: OverlayTheme;
}> = ({ video, shot, shotStart, t, pose, theme = "cream" }) => {
  const tl = video.timeline;
  if (theme === "blueprint") return <BlueprintOverlays video={video} shot={shot} shotStart={shotStart} t={t} pose={pose} />;
  const dark = isDark(theme);
  const cuts = tl.shots.filter((s) => s.s > 0).map((s) => s.s);
  const flash = dark ? 0 : Math.max(0, ...cuts.map((c) => 1 - Math.abs(t - c) / 0.16));
  const ctaOn = Boolean(video.cta && t > tl.lines[video.cta.fromLine - 1].s - 0.1);
  return (
    <AbsoluteFill>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 0,
          height: 460,
          background: dark
            ? "linear-gradient(#0b0f17 0%, rgba(11,15,23,0.96) 58%, rgba(11,15,23,0) 100%)"
            : `linear-gradient(${CREAM} 0%, rgba(244,241,234,.95) 58%, rgba(244,241,234,0) 100%)`,
        }}
      />
      {pose && shot.callouts?.length && "fov" in video ? (
        <Callouts shot={shot} t={t} pose={pose} fov={video.fov} top={safeStageTop(shot.title, ctaOn ? "cta" : shot.chip?.(t) ? "chip" : null)} />
      ) : null}
      <div style={{ position: "absolute", left: 72, right: 300, top: 178, display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
        <Header shot={shot} local={t - shotStart} theme={theme} />
        {ctaOn ? null : <Chip shot={shot} t={t} theme={theme} />}
        {ctaOn && video.cta ? (
          <div
            style={{
              marginTop: 21,
              padding: "16px 26px",
              borderRadius: 16,
              background: dark ? "rgba(15, 23, 42, 0.92)" : "#fff",
              border: dark ? `2px solid ${accentBorder(theme, 0.55)}` : `3px solid ${INK}`,
              font: `700 34px ${FONT.ui}`,
              color: dark ? "#f8fafc" : INK,
            }}
          >
            <svg width={34} height={34} viewBox="0 0 24 24" style={{ verticalAlign: -6, marginRight: 10 }}>
              <path d="M4 4h16v11H9l-5 4z" fill="none" stroke={dark ? accentOf(theme) : INK} strokeWidth={2.4} strokeLinejoin="round" />
            </svg>
            {video.cta.text}
          </div>
        ) : null}
      </div>
      <div
        style={{
          position: "absolute",
          right: 60,
          top: 178,
          padding: "10px 18px",
          borderRadius: 12,
          background: dark ? "#111a2b" : INK,
          border: dark ? `1px solid ${accentBorder(theme, 0.35)}` : undefined,
          color: "#fff",
          font: `700 26px ${FONT.ui}`,
        }}
      >
        {video.brand.prefix}
        <span style={{ color: accentOf(theme) }}>{video.brand.accent}</span>
      </div>
      {shot.tag ? (
        <div
          style={{
            position: "absolute",
            right: 60,
            top: 250,
            padding: "6px 12px",
            borderRadius: 8,
            background: dark ? "rgba(15, 23, 42, 0.85)" : "rgba(29,35,40,.75)",
            border: dark ? `1px solid ${skyBorder(theme)}` : undefined,
            color: dark ? "#bae6fd" : "#fff",
            font: `400 20px ${FONT.mono}`,
            letterSpacing: 2,
          }}
        >
          {shot.tag}
        </div>
      ) : null}
      {shouldShowCaptions(video.captions) ? <Captions tl={tl} t={t} theme={theme} /> : null}
      {dark ? null : <AbsoluteFill style={{ background: CREAM, opacity: clamp(flash) * 0.85 }} />}
    </AbsoluteFill>
  );
};

const Gear: React.FC<{ size: number }> = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24">
    <path d="M12 2l1.6 2.6 3-.7.5 3 2.9 1-1 2.9L21 13l-2.6 1.6.7 3-3 .5-1 2.9-2.9-1L11 22l-1.6-2.6-3 .7-.5-3-2.9-1 1-2.9L2 11l2.6-1.6-.7-3 3-.5 1-2.9 2.9 1z" fill={BP.navy} />
    <circle cx={12} cy={12} r={3.6} fill={BP.cyan} />
  </svg>
);

export const blueprintTitleRight = (tag?: string): number => (tag ? 280 : 160);

/** SASTRA MESIN: technical-drawing frame — brand row, navy title with a cyan keyword, title-block chip, numbered labels, scan-line cut. */
const BlueprintOverlays: React.FC<{ video: VideoDef; shot: OverlayShot; shotStart: number; t: number; pose?: CamPose }> = ({ video, shot, shotStart, t, pose }) => {
  const tl = video.timeline;
  const k = clamp((t - shotStart) / 0.35);
  const ctaOn = Boolean(video.cta && t > tl.lines[video.cta.fromLine - 1].s - 0.1);
  const c = ctaOn ? null : shot.chip?.(t);
  const scan = clamp((t - shotStart) / 0.45); // cyan scan line sweeps down after every cut
  const top = safeStageTop(shot.title, ctaOn ? "cta" : c ? "chip" : null) + BP_HEADER_SHIFT;
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: 520, background: `linear-gradient(${BP.paper} 0%, rgba(244,245,246,.94) 62%, rgba(244,245,246,0) 100%)` }} />
      {pose && shot.callouts?.length && "fov" in video ? <Callouts shot={shot} t={t} pose={pose} fov={video.fov} top={top} bp /> : null}
      <div style={{ position: "absolute", left: 72, right: 72, top: 172, display: "flex", alignItems: "center", gap: 12, font: `700 28px ${FONT.mono}`, letterSpacing: 4 }}>
        <Gear size={38} />
        <span style={{ color: BP.navy }}>{video.brand.prefix.trim().toUpperCase()}</span>
        <span style={{ color: BP.cyan, marginLeft: -2 }}>{video.brand.accent.toUpperCase()}</span>
        <span style={{ marginLeft: "auto", color: BP.steel, font: `600 24px ${FONT.mono}`, letterSpacing: 4 }}>{shot.label}</span>
      </div>
      <div style={{ position: "absolute", left: 72, right: blueprintTitleRight(shot.tag), top: 178 + BP_HEADER_SHIFT, opacity: k, transform: `translateY(${(1 - k) * 24}px)` }}>
        <div style={{ font: `800 66px/1.05 ${FONT.display}`, letterSpacing: -1.5, color: BP.navy }}>
          <Title text={shot.title} highlightColor={BP.cyan} />
        </div>
        <div style={{ width: 96 * k, height: 8, background: BP.orange, marginTop: 14 }} />
        {c ? (
          <div style={{ marginTop: 18, display: "inline-flex", border: `2px solid ${c.red ? BP.red : BP.navy}`, background: "#fff" }}>
            <span style={{ padding: "10px 14px", borderRight: `2px solid ${c.red ? BP.red : BP.navy}`, font: `600 22px ${FONT.mono}`, letterSpacing: 3, color: BP.steel, writingMode: "vertical-rl", transform: "rotate(180deg)" }}>{c.key}</span>
            <span style={{ padding: "10px 22px", font: `800 56px ${FONT.display}`, color: c.red ? BP.red : BP.navy, whiteSpace: "nowrap" }}>
              {c.value}
              {c.unit ? <small style={{ font: `600 28px ${FONT.ui}`, color: BP.orange, marginLeft: 8 }}>{c.unit}</small> : null}
            </span>
          </div>
        ) : null}
        {ctaOn && video.cta ? (
          <div style={{ marginTop: 21, padding: "16px 24px", background: "#fff", borderLeft: `8px solid ${BP.cyan}`, font: `700 34px ${FONT.ui}`, color: BP.navy }}>{video.cta.text}</div>
        ) : null}
      </div>
      {shot.tag ? (
        <div style={{ position: "absolute", right: 72, top: 236, padding: "6px 12px", border: `2px solid ${BP.steel}`, color: BP.steel, font: `600 20px ${FONT.mono}`, letterSpacing: 2 }}>{shot.tag}</div>
      ) : null}
      {shouldShowCaptions(video.captions) ? <Captions tl={tl} t={t} theme="blueprint" /> : null}
      {scan < 1 && shotStart > 0 ? (
        <div style={{ position: "absolute", left: 0, right: 0, top: scan * 1920 - 3, height: 6, background: BP.cyan, boxShadow: `0 0 28px 8px rgba(32,201,195,0.45)`, opacity: 1 - scan * 0.4 }} />
      ) : null}
    </AbsoluteFill>
  );
};
