import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";
import { ROOT } from "./lib.mts";
import { ACCOUNT_IDS, ACCOUNTS, DEFAULT_ACCOUNT, accountById, isAccountId, isConfigured, missingConfigFields } from "../src/accounts.ts";

const isPlaceholder = (v: string) => v.startsWith("TODO_");

describe("account registry", () => {
  test("holds exactly the five known accounts and defaults to Kali Aja", () => {
    assert.deepEqual([...ACCOUNT_IDS], ["kali-aja", "ai-labs", "cerpenek", "sastra-mesin", "upwayyy"]);
    assert.equal(DEFAULT_ACCOUNT, "kali-aja");
  });

  test("Kali Aja keeps its current identity", () => {
    const k = ACCOUNTS["kali-aja"];
    assert.equal(k.label, "Kali Aja Tau");
    assert.deepEqual(k.brand, { prefix: "Kali Aja ", accent: "Tau" });
    assert.equal(k.youtubeCategoryId, "27");
    assert.equal(k.buffer.orgId, "6aed53e7ec5c7c6d73f3e437");
    assert.equal(k.buffer.youtubeChannelId, "6aedb753e29c69a171803f6e");
    assert.equal(k.buffer.tiktokChannelId, "6aedb7fee29c69a171804662");
    assert.equal(k.buffer.instagramChannelId, "6aed5544e29c69a1717ba62e");
    assert.equal(k.agent.model, "opencode/deepseek-v4.1-flash-free");
    assert.ok(k.agent.files.includes("AGENTS.md"));
    assert.ok(k.agent.files.includes("docs/AUTOPILOT.md"));
    assert.ok(k.agent.files.includes("ops/ci-prompt.md"));
  });

  test("existing accounts keep the locked male voice", () => {
    for (const id of ["kali-aja", "ai-labs"] as const) {
      assert.deepEqual(ACCOUNTS[id].tts, { voice: "id-id-podcaster-1", style: "natural, warm, conversational" });
    }
  });

  test("AI Labs has its own identity", () => {
    const a = ACCOUNTS["ai-labs"];
    assert.equal(a.label, "AI Labs");
    assert.deepEqual(a.brand, { prefix: "AI ", accent: "Labs" });
    assert.equal(a.youtubeCategoryId, "28");
    assert.equal(a.buffer.instagramChannelId, "6af92062ece6dfde5fcba082");
    assert.deepEqual(a.agent.files, ["AGENTS.md", "ops/ci-prompt.md", "ops/accounts/ai-labs.md", "ops/topics/ai-labs.md"]);
  });

  test("Cerpenek has its own identity", () => {
    const a = ACCOUNTS.cerpenek;
    assert.equal(a.label, "Cerpenek");
    assert.deepEqual(a.brand, { prefix: "Cerpe", accent: "nek" });
    assert.equal(a.youtubeCategoryId, "27");
    assert.equal(a.madeForKids, true);
    assert.deepEqual(a.agent.files, ["AGENTS.md", "ops/ci-prompt.md", "ops/accounts/cerpenek.md", "ops/topics/cerpenek.md"]);
  });

  test("Cerpenek is fully configured with its own Buffer org and channels", () => {
    const a = ACCOUNTS.cerpenek;
    assert.deepEqual(a.buffer, { orgId: "6af9a85ef0ed12641d69eab4", youtubeChannelId: "6af9a8caece6dfde5fd19e00", tiktokChannelId: "6af9a8e0ece6dfde5fd19e93" });
    assert.deepEqual(missingConfigFields(a), []);
    const others = [ACCOUNTS["kali-aja"], ACCOUNTS["ai-labs"]].flatMap((o) => Object.values(o.buffer));
    for (const id of Object.values(a.buffer)) assert.equal(others.includes(id), false, `buffer id ${id} belongs to another account`);
  });

  test("Cerpenek speaks with the young storyteller voice", () => {
    assert.deepEqual(ACCOUNTS.cerpenek.tts, {
      voice: "id-id-storyteller-1",
      style: "hangat, ceria, bersemangat; intonasi naik-turun seperti bercerita",
    });
  });

  test("Sastra Mesin is fully configured with its own Buffer org and channels", () => {
    const s = ACCOUNTS["sastra-mesin"];
    assert.equal(s.label, "Sastra Mesin");
    assert.deepEqual(s.brand, { prefix: "Sastra ", accent: "Mesin" });
    assert.equal(s.youtubeCategoryId, "27");
    assert.equal(s.madeForKids, false);
    assert.equal(s.tts.voice, "id-id-tutor-1");
    assert.deepEqual(s.agent.files, ["AGENTS.md", "ops/ci-prompt.md", "ops/accounts/sastra-mesin.md", "ops/topics/sastra-mesin.md"]);
    assert.match(s.agent.prompt, /override ops\/ci-prompt\.md/);
    assert.match(s.agent.prompt, /docs\/AUTOPILOT\.md does NOT apply/);
    assert.deepEqual(s.buffer, {
      orgId: "6afdf08dd10011a8be72ed75",
      youtubeChannelId: "6afdf52fece6dfde5f101631",
      tiktokChannelId: "6afdf54bece6dfde5f101af0",
      instagramChannelId: "6afe07c2ece6dfde5f116be8",
    });
    assert.equal(isConfigured(s), true);
    assert.deepEqual(missingConfigFields(s), []);
    const others = [ACCOUNTS["kali-aja"], ACCOUNTS["ai-labs"], ACCOUNTS.cerpenek].flatMap((o) => Object.values(o.buffer));
    for (const id of Object.values(s.buffer)) assert.equal(others.includes(id), false, `buffer id ${id} belongs to another account`);
  });

  test("Upwayyy is fully configured with its own Buffer org and channels", () => {
    const u = ACCOUNTS.upwayyy;
    assert.equal(u.label, "Upwayyy");
    assert.deepEqual(u.brand, { prefix: "Up", accent: "wayyy" });
    assert.equal(u.youtubeCategoryId, "20");
    assert.equal(u.madeForKids, false);
    assert.equal(u.tts.voice, "id-id-podcaster-1");
    assert.equal(u.agent.model, "opencode/deepseek-v4.1-flash-free");
    assert.deepEqual(u.agent.files, ["AGENTS.md", "ops/ci-prompt.md", "ops/accounts/upwayyy.md", "ops/topics/upwayyy.md"]);
    assert.deepEqual(u.buffer, {
      orgId: "6b0133b51b0e893dcb2b070c",
      youtubeChannelId: "6b0133e2ece6dfde5f3ffc2f",
      tiktokChannelId: "6b0176e5ece6dfde5f42e897",
    });
    assert.equal(isConfigured(u), true);
    assert.deepEqual(missingConfigFields(u), []);
    const others = [ACCOUNTS["kali-aja"], ACCOUNTS["ai-labs"], ACCOUNTS.cerpenek, ACCOUNTS["sastra-mesin"]].flatMap((o) =>
      Object.values(o.buffer),
    );
    for (const id of Object.values(u.buffer)) assert.equal(others.includes(id), false, `buffer id ${id} belongs to another account`);
  });

  test("a placeholder instagramChannelId counts as unconfigured", () => {
    const a = { ...ACCOUNTS["sastra-mesin"], buffer: { ...ACCOUNTS["sastra-mesin"].buffer, instagramChannelId: "TODO_IG" } };
    assert.deepEqual(missingConfigFields(a), ["buffer.instagramChannelId"]);
    assert.equal(isConfigured(a), false);
  });

  test("a placeholder voice counts as unconfigured and is named", () => {
    const a = { ...ACCOUNTS["kali-aja"], tts: { voice: "TODO_VOICE", style: "x" } };
    assert.deepEqual(missingConfigFields(a), ["tts.voice"]);
    assert.equal(isConfigured(a), false);
  });

  test("voice chosen but buffer ids missing is still unconfigured", () => {
    const a = { ...ACCOUNTS["kali-aja"], buffer: { orgId: "TODO_A", youtubeChannelId: "TODO_B", tiktokChannelId: "TODO_C" } };
    assert.deepEqual(missingConfigFields(a), ["buffer.orgId", "buffer.youtubeChannelId", "buffer.tiktokChannelId"]);
    assert.equal(isConfigured(a), false);
  });

  test("each account's buffer ids are either all real or all placeholder", () => {
    for (const id of ACCOUNT_IDS) {
      const a = ACCOUNTS[id];
      const ids = [a.buffer.orgId, a.buffer.youtubeChannelId, a.buffer.tiktokChannelId, a.buffer.instagramChannelId].filter(
        (v): v is string => typeof v === "string",
      );
      const placeholders = ids.filter(isPlaceholder);
      const real = ids.filter((v) => !isPlaceholder(v));
      assert.ok(placeholders.length === 0 || real.length === 0, `account ${id} mixes placeholder and real buffer ids`);
      if (real.length > 0) {
        for (const v of real) assert.match(v, /^[0-9a-f]{24}$/, `account ${id} has a malformed buffer id`);
      }
    }
  });

  test("every agent instruction file exists on disk", () => {
    for (const id of ACCOUNT_IDS) {
      for (const file of ACCOUNTS[id].agent.files) {
        assert.ok(fs.existsSync(path.join(ROOT, file)), `account ${id} references missing file ${file}`);
      }
    }
  });

  test("isAccountId only accepts known ids", () => {
    assert.equal(isAccountId("ai-labs"), true);
    assert.equal(isAccountId("bogus"), false);
    assert.equal(isAccountId(undefined), false);
  });

  test("accountById rejects unknown ids and falls back to the default", () => {
    assert.throws(() => accountById("bogus"), (e: Error) => e.message.includes("bogus") && e.message.includes("ai-labs"));
    assert.equal(accountById(undefined).id, DEFAULT_ACCOUNT);
    assert.equal(accountById("ai-labs").id, "ai-labs");
  });

  test("missingConfigFields names the unconfigured buffer ids", () => {
    const placeholder = {
      ...ACCOUNTS["ai-labs"],
      buffer: { orgId: "TODO_ORG", youtubeChannelId: "TODO_YT", tiktokChannelId: "TODO_TT" },
    };
    assert.deepEqual(missingConfigFields(placeholder), ["buffer.orgId", "buffer.youtubeChannelId", "buffer.tiktokChannelId"]);
    assert.equal(isConfigured(placeholder), false);
    assert.deepEqual(missingConfigFields(ACCOUNTS["kali-aja"]), []);
    assert.equal(isConfigured(ACCOUNTS["kali-aja"]), true);
  });
});
