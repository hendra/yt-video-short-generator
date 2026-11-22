import { Audio, Video } from "@remotion/media";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import React, { useLayoutEffect, useMemo } from "react";
import { AbsoluteFill, Freeze, getRemotionEnvironment, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { NeutralToneMapping, PCFSoftShadowMap, PerspectiveCamera } from "three";
import { loadFonts } from "./fonts";
import { applyPose, blendPose, clamp, clipTimeAt, cutProgress, footageZoom, makeCtx, shotAt } from "./math";
import { MotionStage } from "./motion/MotionStage";
import { BLUEPRINT_BG, Overlays, themeOf } from "./overlays/Overlays";
import { VIDEOS } from "../videos/registry";
import type { CamPose, Ctx, ShotSpan, VideoDef, VideoDef3D, VideoDefFootage, VideoDefMotion } from "./types";

loadFonts();

const getVideo = (id: string): VideoDef => {
  const v = VIDEOS[id];
  if (!v) throw new Error(`Unknown video "${id}" — add it to src/videos/registry.ts`);
  return v;
};

/** Lives inside <ThreeCanvas>: owns the imperative world and drives it from the frame time. */
const World: React.FC<{ video: VideoDef3D; ctx: Ctx; t: number; shotId: string; pose: CamPose }> = ({ video, ctx, t, shotId, pose }) => {
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const size = useThree((s) => s.size);
  const world = useMemo(() => video.createWorld(ctx), [video, ctx]);

  useLayoutEffect(() => {
    scene.add(world.root);
    return () => {
      scene.remove(world.root);
    };
  }, [scene, world]);

  // Deterministic per-frame update: everything is a pure function of t.
  useLayoutEffect(() => {
    applyPose(camera, pose, video.fov, size.width / size.height);
    world.update(t, shotId, pose, scene);
  });
  return null;
};

// `--scale=2` renders the page at devicePixelRatio 2: follow it so the 3D layer is as sharp as the text
// overlays (2160x3840). Studio stays at 1 to keep the preview fast on HiDPI screens.
const canvasDpr = () => (getRemotionEnvironment().isRendering && typeof window !== "undefined" ? window.devicePixelRatio : 1);

const MotionExplainer: React.FC<{
  video: VideoDefMotion;
  ctx: Ctx;
  span: ShotSpan;
  t: number;
  audio: React.ReactNode;
}> = ({ video, ctx, span, t, audio }) => {
  const shots = useMemo(() => video.shots(ctx), [video, ctx]);
  const shot = shots[span.id];
  if (!shot) throw new Error(`No MotionShotDef for shot "${span.id}"`);
  return (
    <AbsoluteFill style={{ backgroundColor: "#0b0f17" }}>
      <MotionStage video={video} ctx={ctx} t={t} />
      <Overlays video={video} shot={shot} shotStart={span.s} t={t} theme={themeOf(video)} />
      {audio}
    </AbsoluteFill>
  );
};

const FootageExplainer: React.FC<{
  video: VideoDefFootage;
  ctx: Ctx;
  span: ShotSpan;
  t: number;
  audio: React.ReactNode;
}> = ({ video, ctx, span, t, audio }) => {
  const fps = useVideoConfig().fps;
  const shots = useMemo(() => video.shots(ctx), [video, ctx]);
  const shot = shots[span.id];
  if (!shot) throw new Error(`No FootageShotDef for shot "${span.id}"`);
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {video.timeline.shots.map((sp) => {
        const sh = shots[sp.id];
        if (!sh) return null;
        const from = sh.from ?? 0;
        // Local second at which playback must stop: the clip's last frame, or the shot's end if shorter.
        const hold = Math.round((clipTimeAt(sp.e, sp.s, from, sh.clipDur) - from) * fps);
        return (
          <Sequence key={sp.id} from={Math.round(sp.s * fps)} durationInFrames={Math.max(1, Math.round((sp.e - sp.s) * fps) + 1)}>
            <AbsoluteFill style={{ opacity: clamp((t - sp.s) / 0.15), transform: `scale(${footageZoom(t, sp)})` }}>
              <Freeze frame={hold} active={t - sp.s > hold / fps}>
                <Video src={staticFile(sh.clip)} muted objectFit="cover" trimBefore={Math.round(from * fps)} style={{ width: "100%", height: "100%" }} />
              </Freeze>
            </AbsoluteFill>
          </Sequence>
        );
      })}
      <AbsoluteFill style={{ background: "linear-gradient(rgba(0,0,0,0) 55%, rgba(0,0,0,.55) 100%)" }} />
      <Overlays video={video} shot={shot} shotStart={span.s} t={t} theme={themeOf(video)} />
      {audio}
    </AbsoluteFill>
  );
};

const ThreeExplainer: React.FC<{
  video: VideoDef3D;
  ctx: Ctx;
  span: ShotSpan;
  t: number;
  width: number;
  height: number;
  audio: React.ReactNode;
}> = ({ video, ctx, span, t, width, height, audio }) => {
  const shots = useMemo(() => video.shots(ctx), [video, ctx]);
  const shot = shots[span.id];
  if (!shot) throw new Error(`No ShotDef for shot "${span.id}"`);
  const spans = video.timeline.shots;
  const prev = shots[spans[spans.indexOf(span) - 1]?.id];
  const u = cutProgress(t, span);
  // Prev pose is sampled at the fixed cut time, so the blend stays a pure function of t.
  const pose = prev && u < 1 ? blendPose(prev.camera(span.s), shot.camera(t), u) : shot.camera(t);
  return (
    <AbsoluteFill style={themeOf(video) === "blueprint" ? BLUEPRINT_BG : { backgroundColor: "#dfe9ec" }}>
      <ThreeCanvas
        width={width}
        height={height}
        dpr={canvasDpr()}
        shadows={{ type: PCFSoftShadowMap }}
        // Neutral tone mapping keeps palette colours true while rolling off highlights from the sun.
        gl={{ antialias: true, preserveDrawingBuffer: true, toneMapping: NeutralToneMapping }}
      >
        <World video={video} ctx={ctx} t={t} shotId={span.id} pose={pose} />
      </ThreeCanvas>
      <Overlays video={video} shot={shot} shotStart={span.s} t={t} pose={pose} theme={themeOf(video)} />
      {audio}
    </AbsoluteFill>
  );
};

/**
 * `audioOnly` (CI: `--props='{"videoId":"<id>","audioOnly":true}'` with a .wav output) renders just the sound
 * mix. Remotion still visits every frame for an audio render, so skipping the 3D scene makes it take seconds
 * instead of as long as the full video.
 */
export const Explainer: React.FC<{ videoId: string; audioOnly?: boolean }> = ({ videoId, audioOnly }) => {
  const video = getVideo(videoId);
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const t = frame / fps;
  const ctx = useMemo(() => makeCtx(video.timeline), [video]);

  const audio = (
    <>
      <Audio src={staticFile(video.voice)} />
      {video.music ? <Audio src={staticFile(video.music.src)} volume={video.music.volume} /> : null}
    </>
  );
  if (audioOnly) return audio;

  const span = shotAt(video.timeline, t);
  if (video.mode === "motion") {
    return <MotionExplainer video={video} ctx={ctx} span={span} t={t} audio={audio} />;
  }
  if (video.mode === "footage") {
    return <FootageExplainer video={video} ctx={ctx} span={span} t={t} audio={audio} />;
  }
  return <ThreeExplainer video={video} ctx={ctx} span={span} t={t} width={width} height={height} audio={audio} />;
};
