import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";
import { ROOT } from "./lib.mts";

const briefPath = path.join(ROOT, "ops", "accounts", "ai-labs.md");
const topicsPath = path.join(ROOT, "ops", "topics", "ai-labs.md");

const ENTRY = /^- ([a-z0-9-]+): (.+) — (https:\/\/\S+) \((Claude|ChatGPT|Gemini|OpenCode)\)$/;
/** An entry line starts with a slug; the file may also contain prose lines. */
const ENTRY_LINE = /^- [a-z0-9-]+: /;

const entryLines = (text: string): string[] => text.split(/\r?\n/).filter((l) => ENTRY_LINE.test(l));

describe("AI Labs brief", () => {
  test("exists", () => assert.ok(fs.existsSync(briefPath), `missing ${briefPath}`));

  test("has every required section", () => {
    const text = fs.readFileSync(briefPath, "utf8");
    for (const heading of [
      "## Brand",
      "## Format",
      "## Topik",
      "## Naskah",
      "## Visual: Motion Graphics",
      "## publish.json",
      "## Batas klaim",
      "## Refill backlog",
    ]) {
      assert.ok(text.includes(heading), `brief missing section ${heading}`);
    }
  });

  test("states the exact brand line and motion/prompt rules", () => {
    const text = fs.readFileSync(briefPath, "utf8");
    assert.ok(text.includes('brand: { prefix: "AI ", accent: "Labs" }'), "brief must carry the literal brand line");
    assert.ok(text.includes('mode: "motion"'), 'brief must document mode: "motion"');
    assert.ok(text.includes("captions: false"), "brief must require captions: false");
    assert.ok(text.includes("1480"), "brief must document expanded y = 1480 stage bottom");
    assert.ok(text.includes("Prompt siap copy:"), 'brief must document "Prompt siap copy:" rule');
  });
});

describe("AI Labs topic backlog", () => {
  test("exists", () => assert.ok(fs.existsSync(topicsPath), `missing ${topicsPath}`));

  test("has at least 40 entries", () => {
    const entries = entryLines(fs.readFileSync(topicsPath, "utf8"));
    assert.ok(entries.length >= 40, `backlog has ${entries.length} entries, need >= 40`);
  });

  test("every entry has a slug, a title, an https source url and a tool", () => {
    for (const line of entryLines(fs.readFileSync(topicsPath, "utf8"))) {
      assert.ok(ENTRY.test(line), `malformed entry: ${line}`);
    }
  });

  test("every dash line is a valid entry — nothing is silently skipped", () => {
    const lines = fs.readFileSync(topicsPath, "utf8").split(/\r?\n/);
    const bad = lines.filter((l) => l.startsWith("- ") && !ENTRY.test(l));
    assert.deepEqual(bad, [], `malformed dash lines: ${bad.join(" | ")}`);
  });

  test("slugs are unique", () => {
    const slugs = entryLines(fs.readFileSync(topicsPath, "utf8")).map((l) => l.slice(2).split(":")[0].trim());
    assert.equal(new Set(slugs).size, slugs.length, "duplicate slugs in backlog");
  });
});

// ---------- Cerpenek
const cerpenekBrief = path.join(ROOT, "ops", "accounts", "cerpenek.md");
const cerpenekTopics = path.join(ROOT, "ops", "topics", "cerpenek.md");
/** `- <slug>: <judul> — <https source> (<daerah>)` */
const CERPENEK_ENTRY = /^- [a-z0-9]+(?:-[a-z0-9]+)*: .+ — https:\/\/\S+ \([^()]+\)$/;

describe("Cerpenek brief", () => {
  test("exists", () => assert.ok(fs.existsSync(cerpenekBrief), `missing ${cerpenekBrief}`));

  test("has every required section", () => {
    const text = fs.readFileSync(cerpenekBrief, "utf8");
    for (const heading of ["## Brand", "## Format", "## Topik", "## Naskah", "## Scene 3D", "## Batas isi", "## publish.json"]) {
      assert.ok(text.includes(heading), `brief missing section ${heading}`);
    }
  });

  test("states the exact brand line and account id", () => {
    const text = fs.readFileSync(cerpenekBrief, "utf8");
    assert.ok(text.includes('brand: { prefix: "Cerpe", accent: "nek" },'), "brief must carry the literal brand line");
    assert.ok(text.includes('"account": "cerpenek"'), "brief must carry the account id");
  });

  test("forbids callouts and names the diorama prefabs", () => {
    const text = fs.readFileSync(cerpenekBrief, "utf8");
    for (const name of ["kit.figure(", "kit.island(", "kit.palm(", "kit.boat(", "kit.mountain(", "kit.hut(", "kit.animal(", "kit.bird(", "kit.swimmer("]) {
      assert.ok(text.includes(name), `brief must show ${name}`);
    }
    assert.match(text, /tanpa `callouts`/i);
  });
});

describe("Cerpenek topic entry format", () => {
  test("accepts a well-formed entry", () =>
    assert.ok(CERPENEK_ENTRY.test("- malin-kundang: Malin Kundang, anak yang lupa pada ibunya — https://example.go.id/malin (Sumatra Barat)")));
  test("rejects http sources, a missing daerah, and uppercase slugs", () => {
    assert.equal(CERPENEK_ENTRY.test("- malin-kundang: Malin Kundang — http://example.go.id/malin (Sumatra Barat)"), false);
    assert.equal(CERPENEK_ENTRY.test("- malin-kundang: Malin Kundang — https://example.go.id/malin"), false);
    assert.equal(CERPENEK_ENTRY.test("- Malin-Kundang: Malin Kundang — https://example.go.id/malin (Sumatra Barat)"), false);
  });
});

describe("Cerpenek topic backlog", () => {
  test("exists", () => assert.ok(fs.existsSync(cerpenekTopics), `missing ${cerpenekTopics}`));

  test("every dash line is a valid entry — nothing is silently skipped", () => {
    const lines = fs.readFileSync(cerpenekTopics, "utf8").split(/\r?\n/);
    const bad = lines.filter((l) => l.startsWith("- ") && !CERPENEK_ENTRY.test(l));
    assert.deepEqual(bad, [], `malformed dash lines: ${bad.join(" | ")}`);
  });

  test("has at least 180 entries (about a month at six videos a day) with unique slugs", () => {
    const slugs = fs.readFileSync(cerpenekTopics, "utf8").split(/\r?\n/).filter((l) => CERPENEK_ENTRY.test(l)).map((l) => l.slice(2).split(":")[0]);
    assert.ok(slugs.length >= 180, `backlog has ${slugs.length} entries, need >= 180`);
    assert.equal(new Set(slugs).size, slugs.length, "duplicate slugs in backlog");
  });

  test("covers at least 20 distinct daerah", () => {
    const daerah = fs.readFileSync(cerpenekTopics, "utf8").split(/\r?\n/).filter((l) => CERPENEK_ENTRY.test(l)).map((l) => l.slice(l.lastIndexOf("(") + 1, -1));
    assert.ok(new Set(daerah).size >= 20, `only ${new Set(daerah).size} daerah`);
  });

  test("no source is used twice", () => {
    const urls = fs.readFileSync(cerpenekTopics, "utf8").split(/\r?\n/).filter((l) => CERPENEK_ENTRY.test(l)).map((l) => l.match(/https:\/\/\S+/)![0]);
    assert.equal(new Set(urls).size, urls.length, "duplicate source urls in backlog");
  });

  test("stories whose core is an adult, violent, sectarian or health theme stay out", () => {
    const slugs = fs.readFileSync(cerpenekTopics, "utf8").split(/\r?\n/).filter((l) => CERPENEK_ENTRY.test(l)).map((l) => l.slice(2).split(":")[0]);
    const excluded = ["sangkuriang", "jaka-tarub", "rara-jonggrang", "rara-mendut", "nyi-roro-kidul", "nenek-pakande", "sureq-galigo", "asal-usul-danau-maninjau", "kisah-manik-angker", "putri-hijau", "angling-dharma", "tabuik", "pasola", "karapan-sapi", "jamu"];
    assert.deepEqual(slugs.filter((s) => excluded.includes(s)), []);
  });
});

describe("Cerpenek brief — review fixes", () => {
  const text = () => fs.readFileSync(cerpenekBrief, "utf8");
  test("tells the agent to voice with the account flag, not ambient env", () => assert.ok(text().includes("npm run tts -- <slug> --account cerpenek")));
  test("keeps the region out of the title template", () => assert.equal(/title.*Legenda dari Sumatra Barat/.test(text()), false));
  test("says how to stage object and building topics", () => assert.match(text(), /## Cerita tentang benda dan bangunan/));
  test("says what to do when no unused story fits the picked format", () => assert.match(text(), /jalankan `pick-format` sekali lagi/));
  test("quotes a tempo range that keeps 1000 chars under 90 s", () => assert.match(text(), /11–13 karakter per detik/));
  test("keeps the hook on line one even when the picked format opens on scenery", () => assert.match(text(), /[Kk]erangka mulai dari \*{0,2}baris kedua/));
  test("tells the agent to pose figures and fill the empty backdrop", () => {
    assert.match(text(), /Beri tokoh pose/);
    assert.match(text(), /Latar belakang harus terisi/);
    assert.match(text(), /anak\.legL\.rotation\.x/);
  });
  test("documents the articulated figure parts the brief animates", () => assert.match(text(), /`armR`, `legL`/));
});

// ---------- Sastra Mesin
const smBrief = path.join(ROOT, "ops", "accounts", "sastra-mesin.md");
const smTopics = path.join(ROOT, "ops", "topics", "sastra-mesin.md");
const SM_CATEGORIES = ["Rumah Tangga", "Dapur", "Pribadi", "Elektronik", "Utilitas", "Transportasi"] as const;
const SM_ENTRY = /^- [a-z0-9]+(?:-[a-z0-9]+)*: .+ — https:\/\/\S+ \((Rumah Tangga|Dapur|Pribadi|Elektronik|Utilitas|Transportasi)\)$/;

describe("Sastra Mesin brief", () => {
  test("exists", () => assert.ok(fs.existsSync(smBrief), `missing ${smBrief}`));

  test("has every required section", () => {
    const text = fs.readFileSync(smBrief, "utf8");
    for (const heading of ["## Brand", "## Suara", "## Format", "## Topik", "## Riset", "## Naskah", "## Scene 3D", "## Batas isi", "## Musik latar", "## publish.json", "## Refill backlog"]) {
      assert.ok(text.includes(heading), `brief missing section ${heading}`);
    }
  });

  test("pins brand, theme, account id, tts command, format command and music moods", () => {
    const text = fs.readFileSync(smBrief, "utf8");
    assert.ok(text.includes('brand: { prefix: "Sastra ", accent: "Mesin" },'));
    assert.ok(text.includes('theme: "blueprint"'));
    assert.ok(text.includes('"account": "sastra-mesin"'));
    assert.ok(text.includes("npm run tts -- <slug> --account sastra-mesin"));
    assert.ok(text.includes("pick-format.mts --account sastra-mesin"));
    for (const mood of ["rakit", "aliran", "rahasia"]) assert.ok(text.includes(`"${mood}"`), `missing mood ${mood}`);
  });
});

describe("Sastra Mesin topic backlog", () => {
  test("exists", () => assert.ok(fs.existsSync(smTopics), `missing ${smTopics}`));

  test("has at least 30 well-formed entries covering all six categories, with unique slugs", () => {
    const text = fs.readFileSync(smTopics, "utf8");
    const lines = text.split(/\r?\n/);
    const entries = lines.filter((l) => l.startsWith("- "));
    assert.ok(entries.length >= 30, `backlog has ${entries.length} entries, need >= 30`);
    const bad = entries.filter((l) => !SM_ENTRY.test(l));
    assert.deepEqual(bad, [], `malformed entries: ${bad.join(" | ")}`);
    const slugs = entries.map((l) => l.slice(2).split(":")[0]);
    assert.equal(new Set(slugs).size, slugs.length, "duplicate slugs");
    for (const cat of SM_CATEGORIES) {
      assert.ok(entries.some((l) => l.endsWith(`(${cat})`)), `missing category ${cat}`);
    }
  });
});

// ---------- line-beat choreography requirements
describe("briefs teach line-beat choreography", () => {
  test("every 3D brief documents beat()/pulse() and the new kit parts", () => {
    for (const p of ["docs/AUTOPILOT.md", "ops/accounts/sastra-mesin.md", "ops/accounts/cerpenek.md", "ops/accounts/mandor-bangunan.md"]) {
      const text = fs.readFileSync(path.join(ROOT, p), "utf8");
      assert.match(text, /beat\(t, L\(/, `${p} must show beat(t, L(n))`);
      assert.match(text, /pulse\(t, L\(/, `${p} must show pulse(t, L(n))`);
    }
    const sm = fs.readFileSync(path.join(ROOT, "ops/accounts/sastra-mesin.md"), "utf8");
    for (const name of ["kit.tube(", "kit.gear(", "kit.flowDots(", "kit.cutaway(", "kit.glowMat("]) {
      assert.ok(sm.includes(name), `sastra-mesin must show ${name}`);
    }
    const mb = fs.readFileSync(path.join(ROOT, "ops/accounts/mandor-bangunan.md"), "utf8");
    for (const name of ["kit.tube(", "kit.gear(", "kit.flowDots(", "kit.cutaway(", "kit.glowMat("]) {
      assert.ok(mb.includes(name), `mandor-bangunan must show ${name}`);
    }
    const cp = fs.readFileSync(path.join(ROOT, "ops/accounts/cerpenek.md"), "utf8");
    for (const name of ["poseFigure(", "kit.cloud(", "kit.prop(", "kit.ripple("]) {
      assert.ok(cp.includes(name), `cerpenek must show ${name}`);
    }
  });

  test("ai-labs brief documents the new motion beats", () => {
    const text = fs.readFileSync(path.join(ROOT, "ops/accounts/ai-labs.md"), "utf8");
    for (const s of ["BeatCallout", "agent-loop", "context-window", "code-diff", "activeAt"]) {
      assert.ok(text.includes(s), `ai-labs must document ${s}`);
    }
  });

  test("CI runs the motion gate before rendering", () => {
    const wf = fs.readFileSync(path.join(ROOT, ".github/workflows/video.yml"), "utf8");
    assert.ok(wf.includes("check-motion"), "workflow must run check-motion");
    const prompt = fs.readFileSync(path.join(ROOT, "ops/ci-prompt.md"), "utf8");
    assert.ok(prompt.includes("check-motion"), "ci-prompt must list check-motion");
  });
});

// The brief snippets are copy-paste targets: an agent that pastes one into src/videos/<slug>/ must not hit a
// tsc error, because the Gates step runs `npm run lint` (noUnusedLocals: true) right after.
const snippetBlocks = (text: string): string[] =>
  [...text.matchAll(/```ts\n([\s\S]*?)```/g)].map((m) => m[1]);

describe("brief TypeScript snippets are copy-paste safe", () => {
  test("no choreography snippet declares an unused local (root tsconfig sets noUnusedLocals)", () => {
    const NEW_HELPERS = /\b(beat|pulse|between|stepIndex|flowPhase|focusOffset|poseFigure)\b/;
    for (const p of ["docs/AUTOPILOT.md", "ops/accounts/sastra-mesin.md", "ops/accounts/cerpenek.md", "ops/accounts/ai-labs.md", "ops/accounts/upwayyy.md", "ops/accounts/mandor-bangunan.md"]) {
      const text = fs.readFileSync(path.join(ROOT, p), "utf8");
      for (const block of snippetBlocks(text).filter((b) => NEW_HELPERS.test(b))) {
        const declared = [...block.matchAll(/^\s*const (\w+)\s*=/gm)].map((m) => m[1]);
        for (const name of declared) {
          const uses = (block.match(new RegExp(`\\b${name}\\b`, "g")) ?? []).length;
          assert.ok(uses > 1, `${p}: snippet declares \`${name}\` and never uses it — tsc TS6133 under noUnusedLocals`);
        }
      }
    }
  });

  test("every snippet only names identifiers it defines or the real engine exports", () => {
    const engineExports = new Set<string>();
    for (const f of ["src/engine/math.ts", "src/engine/kit.ts", "src/engine/motion/blocks.tsx", "src/engine/types.ts"]) {
      const src = fs.readFileSync(path.join(ROOT, f), "utf8");
      for (const m of src.matchAll(/export (?:const|function|type|class) (\w+)/g)) engineExports.add(m[1]);
    }
    const ALLOWED = new Set(["t", "ctx", "L", "Kit", "kit", "poseFigure", "beat", "pulse", "between", "stepIndex", "flowPhase", "focusOffset", "keyframes", "Vec3", "CamPose", "BentoItem", "BeatCallout", "BentoGrid", "TerminalCard", "MetricPanel", "NodeFlow", "PromptCard", "ComparisonSplit", "IllustrationStage", "anak", "cards", "base", "pose", "mode", "on", "hi", "openU", "step", "box", "mat", "root", "shot", "import", "from"]);
    for (const p of ["docs/AUTOPILOT.md", "ops/accounts/sastra-mesin.md", "ops/accounts/cerpenek.md", "ops/accounts/ai-labs.md", "ops/accounts/upwayyy.md", "ops/accounts/mandor-bangunan.md"]) {
      const text = fs.readFileSync(path.join(ROOT, p), "utf8");
      for (const block of snippetBlocks(text)) {
        for (const m of block.matchAll(/\b(base|shot)\(/g)) {
          assert.ok(engineExports.has(m[1]) || ALLOWED.has(m[1]) || block.includes(`const ${m[1]} `), `${p}: snippet calls ${m[1]}() but never defines it`);
        }
      }
    }
  });
});

// ---------- Upwayyy
const uwBrief = path.join(ROOT, "ops", "accounts", "upwayyy.md");
const uwTopics = path.join(ROOT, "ops", "topics", "upwayyy.md");
/** `- <slug>: <judul> — appid <steamAppId> — rilis <YYYY-MM> — <sumber https> [<sumber https>]` */
const UW_ENTRY = /^- ([a-z0-9-]+): (.+) — appid (\d+) — rilis (\d{4}-\d{2}) — (https:\/\/\S+)( https:\/\/\S+)*$/;

describe("Upwayyy brief", () => {
  test("exists", () => assert.ok(fs.existsSync(uwBrief), `missing ${uwBrief}`));

  test("has every required section", () => {
    const text = fs.readFileSync(uwBrief, "utf8");
    for (const heading of ["## Brand", "## Suara dan nada", "## Format", "## Topik", "## Footage", "## Batas isi", "## Naskah", "## publish.json"]) {
      assert.ok(text.includes(heading), `brief missing section ${heading}`);
    }
  });

  test("pins the brand, footage mode, footage fetch, voice flag and credit line", () => {
    const text = fs.readFileSync(uwBrief, "utf8");
    assert.ok(text.includes('brand: { prefix: "Up", accent: "wayyy" }'), "brief must carry the literal brand line");
    assert.ok(text.includes('mode: "footage"'), 'brief must document mode: "footage"');
    assert.ok(text.includes("npm run footage"), "brief must require npm run footage");
    assert.ok(text.includes("--account upwayyy"), "brief must carry the account flag");
    assert.ok(text.includes("Cuplikan: trailer resmi"), "brief must carry the credit line");
  });

  test("tells the agent to fetch footage before writing the script, with the swap/stop rule", () => {
    const text = fs.readFileSync(uwBrief, "utf8");
    assert.match(text, /sebelum menulis naskah/i);
    assert.match(text, /maksimal 3/i);
  });
});

describe("Upwayyy topic backlog", () => {
  test("exists", () => assert.ok(fs.existsSync(uwTopics), `missing ${uwTopics}`));

  test("has at least 10 well-formed entries", () => {
    const entries = fs.readFileSync(uwTopics, "utf8").split(/\r?\n/).filter((l) => l.startsWith("- "));
    assert.ok(entries.length >= 10, `backlog has ${entries.length} entries, need >= 10`);
    const bad = entries.filter((l) => !UW_ENTRY.test(l));
    assert.deepEqual(bad, [], `malformed entries: ${bad.join(" | ")}`);
  });

  test("every entry is a 2025-05-or-later release with an app id and a source", () => {
    for (const line of fs.readFileSync(uwTopics, "utf8").split(/\r?\n/).filter((l) => l.startsWith("- "))) {
      const m = line.match(UW_ENTRY);
      assert.ok(m, `malformed entry: ${line}`);
      assert.ok(m[4] >= "2025-05", `${line} is older than 2025-05`);
      assert.ok(Number(m[3]) > 0, `${line} has no app id`);
    }
  });

  test("slugs are unique", () => {
    const slugs = fs.readFileSync(uwTopics, "utf8").split(/\r?\n/).filter((l) => UW_ENTRY.test(l)).map((l) => l.slice(2).split(":")[0]);
    assert.equal(new Set(slugs).size, slugs.length, "duplicate slugs in backlog");
  });
});

// ---------- Mandor Bangunan
const mbBrief = path.join(ROOT, "ops", "accounts", "mandor-bangunan.md");
const mbTopics = path.join(ROOT, "ops", "topics", "mandor-bangunan.md");
const MB_CATEGORIES = ["Gedung", "Jembatan", "Infrastruktur", "Pondasi", "Terowongan & Bendungan"] as const;
const MB_ENTRY = /^- [a-z0-9]+(?:-[a-z0-9]+)*: .+ — https:\/\/\S+ \((Gedung|Jembatan|Infrastruktur|Pondasi|Terowongan & Bendungan)\)$/;

describe("Mandor Bangunan brief", () => {
  test("exists", () => assert.ok(fs.existsSync(mbBrief), `missing ${mbBrief}`));

  test("has every required section", () => {
    const text = fs.readFileSync(mbBrief, "utf8");
    for (const heading of ["## Brand", "## Suara", "## Format", "## Topik", "## Riset", "## Naskah", "## Scene 3D", "## Batas isi", "## Musik latar", "## publish.json", "## Refill backlog"]) {
      assert.ok(text.includes(heading), `brief missing section ${heading}`);
    }
  });

  test("pins brand, account id, tts command, format command, loop rule, and music moods", () => {
    const text = fs.readFileSync(mbBrief, "utf8");
    assert.ok(text.includes('brand: { prefix: "Mandor ", accent: "Bangunan" },'));
    assert.ok(text.includes('"account": "mandor-bangunan"'));
    assert.ok(text.includes("npm run tts -- <slug> --account mandor-bangunan"));
    assert.ok(text.includes("pick-format.mts --account mandor-bangunan"));
    assert.match(text, /ending loop/i);
    assert.match(text, /tail.*0,3/i);
    for (const mood of ["teknik", "misteri", "fenomena"]) assert.ok(text.includes(`"${mood}"`), `missing mood ${mood}`);
  });
});

describe("Mandor Bangunan topic backlog", () => {
  test("exists", () => assert.ok(fs.existsSync(mbTopics), `missing ${mbTopics}`));

  test("has at least 30 well-formed entries covering all five categories, with unique slugs and unique URLs", () => {
    const text = fs.readFileSync(mbTopics, "utf8");
    const lines = text.split(/\r?\n/);
    const entries = lines.filter((l) => l.startsWith("- "));
    assert.ok(entries.length >= 30, `backlog has ${entries.length} entries, need >= 30`);
    const bad = entries.filter((l) => !MB_ENTRY.test(l));
    assert.deepEqual(bad, [], `malformed entries: ${bad.join(" | ")}`);
    const slugs = entries.map((l) => l.slice(2).split(":")[0]);
    assert.equal(new Set(slugs).size, slugs.length, "duplicate slugs");
    const urls = entries.map((l) => l.match(/https:\/\/\S+/)![0]);
    assert.equal(new Set(urls).size, urls.length, "duplicate source urls in backlog");
    for (const cat of MB_CATEGORIES) {
      assert.ok(entries.some((l) => l.endsWith(`(${cat})`)), `missing category ${cat}`);
    }
  });
});
