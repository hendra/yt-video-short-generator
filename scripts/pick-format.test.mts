import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { ACCOUNT_IDS } from "../src/accounts.ts";
import { formatsFor, pickFormat } from "./pick-format.mts";

describe("per-account format pools", () => {
  test("every account has a non-empty, weighted, unique-id pool", () => {
    for (const id of ACCOUNT_IDS) {
      const pool = formatsFor(id);
      // upwayyy's pool is 6 story angles (one game yields several videos), the rest hold 7+.
      assert.ok(pool.length >= (id === "upwayyy" ? 6 : 7), `${id} pool too small: ${pool.length}`);
      assert.ok(pool.every((format) => format.weight > 0 && format.instruction.length > 20), `${id}: bad weight/instruction`);
      assert.equal(new Set(pool.map((f) => f.id)).size, pool.length, `${id}: duplicate ids`);
      assert.ok(pool.reduce((sum, f) => sum + f.weight, 0) > pool.length, `${id}: weights do not outweigh the count`);
    }
  });

  test("the Kali Aja pool is unchanged", () => {
    const ids = formatsFor("kali-aja").map((f) => f.id);
    assert.deepEqual(ids, [
      "expert-explainer",
      "numbered-listicle",
      "myth-buster",
      "mystery-story",
      "before-after",
      "how-to-tutorial",
      "storytime",
      "qa-rapid",
      "viewer-challenge",
      "problem-solution",
      "mini-documentary",
    ]);
  });

  test("the AI Labs pool avoids the forbidden 3-steps framework", () => {
    assert.equal(formatsFor("ai-labs").some((f) => f.id === "how-to-tutorial"), false);
    assert.ok(formatsFor("ai-labs").length >= 8);
  });
});

describe("Cerpenek pool", () => {
  test("is a story pool: no explainer or tutorial frameworks", () => {
    const ids = formatsFor("cerpenek").map((f) => f.id);
    assert.deepEqual(ids, ["dongeng-klasik", "asal-usul-tempat", "tokoh-sejarah", "tebak-dulu", "kenapa-begitu", "sahabat-hewan", "asal-usul-benda"]);
  });
});

describe("Upwayyy pool", () => {
  test("is a story pool of its own: lore angles, none shared with Kali Aja", () => {
    const ids = formatsFor("upwayyy").map((f) => f.id);
    assert.deepEqual(ids, ["lore-recap", "ending-explained", "villain-origin", "hidden-detail", "timeline", "character-story"]);
    const kali = new Set(formatsFor("kali-aja").map((f) => f.id));
    assert.ok(ids.every((id) => !kali.has(id)));
  });
  test("weights favour the lore recap and ending explainers", () =>
    assert.deepEqual(formatsFor("upwayyy").map((f) => f.weight), [3, 2, 2, 2, 1, 1]));
  test("every format carries the personal aside and the spoiler warning", () => {
    for (const f of formatsFor("upwayyy")) {
      assert.match(f.instruction, /aside/, f.id);
      assert.match(f.instruction, /spoiler/i, f.id);
    }
  });
});

describe("pickFormat", () => {
  test("roll boundaries select the first and last weighted bucket per account", () => {
    for (const id of ACCOUNT_IDS) {
      assert.equal(pickFormat(id, 0).id, formatsFor(id)[0].id);
      assert.equal(pickFormat(id, 0.999999).id, formatsFor(id)[formatsFor(id).length - 1].id);
    }
  });

  test("no account selected returns a Kali Aja format", () => {
    assert.equal(formatsFor("kali-aja").includes(pickFormat()), true);
  });

  test("roll outside [0,1) throws", () => {
    assert.throws(() => pickFormat("kali-aja", 1));
    assert.throws(() => pickFormat("kali-aja", Number.NaN));
  });
});

describe("Cerpenek weights follow the backlog mix", () => {
  const weight = (id: string) => formatsFor("cerpenek").find((f) => f.id === id)!.weight;
  test("historical figures (the largest backlog group) are the heaviest format", () => {
    for (const f of formatsFor("cerpenek")) assert.ok(weight("tokoh-sejarah") >= f.weight, `${f.id} outweighs tokoh-sejarah`);
  });
  test("the animal-helper format, which few stories fit, is the lightest", () => {
    for (const f of formatsFor("cerpenek")) assert.ok(weight("sahabat-hewan") <= f.weight, `${f.id} is lighter than sahabat-hewan`);
  });
});

describe("Sastra Mesin pool", () => {
  test("has its own formats, none shared with Kali Aja", () => {
    const ids = formatsFor("sastra-mesin").map((f) => f.id);
    assert.deepEqual(ids, ["bongkar-pasang", "satu-komponen", "ikuti-alirannya", "mitos-benda", "salah-pakai", "dulu-vs-sekarang", "kenapa-bunyi"]);
    const kali = new Set(formatsFor("kali-aja").map((f) => f.id));
    assert.ok(ids.every((id) => !kali.has(id)));
  });
  test("weights favour the take-apart and key-part formats", () =>
    assert.deepEqual(formatsFor("sastra-mesin").map((f) => f.weight), [3, 3, 2, 2, 1, 1, 1]));
  test("every format ends on a CTA", () => {
    for (const f of formatsFor("sastra-mesin")) assert.match(f.instruction, /CTA/, f.id);
  });
});

describe("Mandor Bangunan pool", () => {
  test("has 7 construction formats with loop endings and no CTA", () => {
    const pool = formatsFor("mandor-bangunan");
    assert.deepEqual(
      pool.map((f) => f.id),
      ["bedah-struktur", "cara-bangun", "mitos-konstruksi", "misteri-teknik", "sebelum-sesudah", "tantangan-lapangan", "duel-material"],
    );
    assert.deepEqual(
      pool.map((f) => f.weight),
      [3, 3, 2, 2, 2, 1, 1],
    );
    for (const f of pool) {
      assert.match(f.instruction, /loop/, f.id);
      assert.doesNotMatch(f.instruction, /\bCTA\b/, f.id);
    }
  });
});
