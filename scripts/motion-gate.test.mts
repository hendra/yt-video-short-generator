import assert from "node:assert/strict";
import { describe, test } from "node:test";
import React from "react";
import { Group, Mesh, Scene } from "three";
import type { Timeline, VideoDefMotion } from "../src/engine/types.ts";
import {
  THRESHOLDS,
  countNodes,
  findForbidden,
  lineCoverage,
  motionProblems,
  snapshotMotion,
  snapshotWorld,
} from "./motion-gate-core.mts";

describe("lineCoverage", () => {
  test("counts distinct L(n) references, aliases included", () => {
    assert.equal(lineCoverage("L(1); L(2); L(2);", 4).covered, 2);
    assert.ok(Math.abs(lineCoverage("L(1); L(2);", 4).ratio - 0.5) < 1e-9);
    assert.equal(lineCoverage("ctx.L(3)", 4).covered, 1);
  });

  test("ignores line numbers outside 1..lineCount", () => {
    assert.equal(lineCoverage("L(0); L(9); L(3)", 4).covered, 1);
    assert.equal(lineCoverage("no cues here", 4).ratio, 0);
  });

  test("counts every line when all are used", () => {
    assert.equal(lineCoverage("L(1) L(2) L(3)", 3).ratio, 1);
  });
});

describe("findForbidden", () => {
  test("flags nondeterminism and accepts clean source", () => {
    assert.deepEqual(findForbidden("const x = 1;"), []);
    assert.equal(findForbidden("Math.random()").length, 1);
    assert.equal(findForbidden("Date.now()").length, 1);
    assert.equal(findForbidden("Math.random() + Date.now()").length, 2);
  });
});

describe("countNodes", () => {
  test("counts meshes and ignores plain groups", () => {
    const root = new Group();
    assert.equal(countNodes(root), 0);
    root.add(new Mesh());
    const g = new Group();
    g.add(new Mesh(), new Mesh());
    root.add(g);
    assert.equal(countNodes(root), 3);
  });
});

describe("motionProblems", () => {
  const staticShot = { shot: "s1", cameraMoved: false, sceneMoved: false, nodes: 40 };
  const movingShot = { shot: "s1", cameraMoved: true, sceneMoved: false, nodes: 40 };

  test("rejects a shot whose scene never moves, even when the camera pans", () => {
    assert.ok(motionProblems({ account: "3d", source: "L(1)", lineCount: 1, world: [staticShot], motion: [] }).length > 0);
    assert.ok(
      motionProblems({ account: "3d", source: "L(1)", lineCount: 1, world: [movingShot], motion: [] }).some((p) => p.includes("objek")),
      "a camera-only pan over a frozen scene must still fail",
    );
    const alive = { shot: "s1", cameraMoved: true, sceneMoved: true, nodes: 40 };
    assert.deepEqual(motionProblems({ account: "3d", source: "L(1)", lineCount: 1, world: [alive], motion: [] }), []);
  });

  test("rejects a thin scene", () => {
    const thin = { shot: "s1", cameraMoved: true, sceneMoved: true, nodes: THRESHOLDS.minNodes - 1 };
    assert.ok(motionProblems({ account: "3d", source: "L(1)", lineCount: 1, world: [thin], motion: [] }).some((p) => p.includes("mesh")));
  });

  test("rejects a frozen 2D shot", () => {
    assert.ok(motionProblems({ account: "motion", source: "L(1)", lineCount: 1, world: [], motion: [{ shot: "s1", changed: false }] }).length > 0);
    assert.deepEqual(motionProblems({ account: "motion", source: "L(1)", lineCount: 1, world: [], motion: [{ shot: "s1", changed: true }] }), []);
  });

  test("rejects low line coverage and reports the ratio", () => {
    const problems = motionProblems({ account: "3d", source: "L(1)", lineCount: 10, world: [], motion: [] });
    assert.ok(problems.some((p) => p.includes("cakupan baris")), problems.join("; "));
  });

  test("footage shots bring their own motion: no world/motion samples needed", () => {
    assert.deepEqual(motionProblems({ account: "footage", source: "L(1) L(2)", lineCount: 2, world: [], motion: [] }), []);
  });

  test("footage is still held to line coverage and determinism", () => {
    const coverage = motionProblems({ account: "footage", source: "L(1)", lineCount: 10, world: [], motion: [] });
    assert.ok(coverage.some((p) => p.includes("cakupan baris")), coverage.join("; "));
    const forbidden = motionProblems({ account: "footage", source: "Math.random(); L(1)", lineCount: 1, world: [], motion: [] });
    assert.ok(forbidden.some((p) => p.includes("Math.random")), forbidden.join("; "));
  });

  test("reports every nondeterministic call", () => {
    const problems = motionProblems({ account: "3d", source: "Math.random(); L(1)", lineCount: 1, world: [{ shot: "s1", cameraMoved: true, sceneMoved: true, nodes: 40 }], motion: [] });
    assert.ok(problems.some((p) => p.includes("Math.random")));
  });
});

describe("snapshotWorld", () => {
  const tl: Timeline = { dur: 6, lines: [], chunks: [], shots: [{ id: "s1", s: 0, e: 6 }] };

  test("sees a moving camera and a moving object", () => {
    const world = {
      root: new Group(),
      update: (t: number) => {
        world.root.rotation.y = t;
      },
    };
    world.root.add(new Mesh());
    const video = {
      id: "t",
      brand: { prefix: "A", accent: "B" },
      timeline: tl,
      voice: "x/vo.mp3",
      fov: 40,
      shots: () => ({ s1: { label: "", title: "", camera: (t: number) => ({ position: [0, 5, 10 + t] as [number, number, number], target: [0, 0, 0] as [number, number, number] }) } }),
      createWorld: () => world,
    } as unknown as Parameters<typeof snapshotWorld>[0];
    const [sample] = snapshotWorld(video, tl);
    assert.equal(sample.cameraMoved, true);
    assert.equal(sample.sceneMoved, true);
    assert.equal(sample.nodes, 1);
  });

  test("reports a frozen camera and a frozen scene", () => {
    const video = {
      id: "t",
      brand: { prefix: "A", accent: "B" },
      timeline: tl,
      voice: "x/vo.mp3",
      fov: 40,
      shots: () => ({ s1: { label: "", title: "", camera: () => ({ position: [0, 5, 10] as [number, number, number], target: [0, 0, 0] as [number, number, number] }) } }),
      createWorld: () => ({ root: new Group(), update: () => {} }),
    } as unknown as Parameters<typeof snapshotWorld>[0];
    const [sample] = snapshotWorld(video, tl);
    assert.equal(sample.cameraMoved, false);
    assert.equal(sample.sceneMoved, false);
  });

  test("passes a throwaway Scene straight through to update", () => {
    const seen: { scene?: Scene } = {};
    const video = {
      id: "t",
      brand: { prefix: "A", accent: "B" },
      timeline: tl,
      voice: "x/vo.mp3",
      fov: 40,
      shots: () => ({ s1: { label: "", title: "", camera: () => ({ position: [0, 0, 1] as [number, number, number], target: [0, 0, 0] as [number, number, number] }) } }),
      createWorld: () => ({ root: new Group(), update: (_t: number, _s: string, _p: unknown, scene: Scene) => (seen.scene = scene) }),
    } as unknown as Parameters<typeof snapshotWorld>[0];
    snapshotWorld(video, tl);
    assert.ok(seen.scene instanceof Scene);
  });
});

describe("snapshotMotion", () => {
  const tl: Timeline = { dur: 6, lines: [], chunks: [], shots: [{ id: "s1", s: 0, e: 6 }] };

  test("ignores React useId noise so a frozen card is still frozen", () => {
    let n = 0;
    const shots = new Map([
      ["s1", { label: "", title: "", render: () => React.createElement("svg", { id: `r${n++}` }, React.createElement("circle", { cx: 1 })) }],
    ]);
    const video = { shots: () => Object.fromEntries(shots) } as unknown as VideoDefMotion;
    const [sample] = snapshotMotion(video, tl);
    assert.equal(sample.changed, false);
  });

  test("sees a card that animates between samples", () => {
    const shots = new Map([
      ["s1", { label: "", title: "", render: (f: { t: number }) => React.createElement("div", null, String(Math.round(f.t * 10))) }],
    ]);
    const video = { shots: () => Object.fromEntries(shots) } as unknown as VideoDefMotion;
    const [sample] = snapshotMotion(video, tl);
    assert.equal(sample.changed, true);
  });
});
