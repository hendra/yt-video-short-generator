import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { clipTimeAt, footageZoom } from "../src/engine/math.ts";
import type { ShotSpan } from "../src/engine/types.ts";

const FPS = 30;

describe("clipTimeAt", () => {
  test("advances with time inside the shot", () => assert.equal(clipTimeAt(5, 4, 0.5, 3), 1.5));
  test("holds the last frame when the shot outlasts the clip", () =>
    assert.ok(Math.abs(clipTimeAt(10, 4, 0, 3) - (3 - 1 / FPS)) < 1e-9));
  test("never goes below the clip's start offset", () => assert.equal(clipTimeAt(3, 4, 0.5, 3), 0.5));
});

describe("footageZoom", () => {
  const span: ShotSpan = { id: "s1", s: 4, e: 10 };
  test("starts at 1.05", () => assert.equal(footageZoom(4, span), 1.05));
  test("ends at 1.13", () => assert.ok(Math.abs(footageZoom(10, span) - 1.13) < 1e-9));
  test("stays at the ramp's end past the shot", () => assert.ok(Math.abs(footageZoom(12, span) - 1.13) < 1e-9));
});
