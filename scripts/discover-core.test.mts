import assert from "node:assert/strict";
import { test } from "node:test";
import { pickSlug } from "./discover-core.mts";

test("ignores an abandoned unregistered folder and picks the registered one", () => {
  assert.deepEqual(pickSlug(["dementium-ward-ending", "hotd2-remake-ending"], ["hotd2-remake-ending", "sample-karakter"]), {
    slug: "hotd2-remake-ending",
    ignored: ["dementium-ward-ending"],
  });
});

test("fails when the only new folder was never registered", () => {
  const pick = pickSlug(["dementium-ward-ending"], ["sample-karakter"]);
  assert.ok("error" in pick && pick.error.includes("unregistered: dementium-ward-ending"));
});

test("fails when two new folders are both registered", () => {
  assert.ok("error" in pickSlug(["satu-video", "dua-video"], ["satu-video", "dua-video"]));
});

test("fails when nothing new was created", () => {
  assert.ok("error" in pickSlug([], ["sample-karakter"]));
});

test("rejects a registered slug outside the charset", () => {
  assert.ok("error" in pickSlug(["Bad_Slug"], ["Bad_Slug"]));
});
