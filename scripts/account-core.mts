/**
 * Pure helpers for the account plumbing — no I/O, no env access.
 *
 * Exported so account-core.test.mts can unit-test the shipped code instead of a
 * re-implementation.
 */
import { ACCOUNT_IDS, accountById, isAccountId, type Account, type AccountId } from "../src/accounts.ts";
import { MOODS_BY_ACCOUNT } from "./music.mts";

export const MAX_SCRIPT_WORDS = 130;

/** Shorts stay ~45–55 s: reject long scripts before TTS spends quota. Cerpenek stories keep their own length. */
export const scriptWordProblem = (account: Account, lines: string[]): string | null => {
  if (account.id === "cerpenek") return null;
  const n = lines.join(" ").split(/\s+/).filter(Boolean).length;
  return n > MAX_SCRIPT_WORDS ? `naskah ${n} kata, maksimal ${MAX_SCRIPT_WORDS} — pendekkan sebelum TTS` : null;
};

export const MAX_LOOP_TAIL = 0.3;

/** config.json `tail` = seconds of picture after the last word; a long tail breaks the loop back to line 01. */
export const loopTailProblem = (account: Account, tail: unknown): string | null => {
  if (account.id === "cerpenek") return null;
  if (typeof tail !== "number" || !(tail >= 0)) return `config.json tail wajib angka ≥ 0 (maks ${MAX_LOOP_TAIL})`;
  return tail > MAX_LOOP_TAIL ? `config.json tail ${tail} dtk, maksimal ${MAX_LOOP_TAIL} — video harus langsung loop ke baris 01` : null;
};

/** The brand line a generated video source must contain, exactly. */
export const brandLine = (account: Account): string =>
  `brand: { prefix: ${JSON.stringify(account.brand.prefix)}, accent: ${JSON.stringify(account.brand.accent)} }`;

/**
 * Problems with the brand of a generated video source: the account's own literals must be
 * present, and no other account's brand may be there instead.
 */
export const brandProblems = (source: string, account: Account, all: readonly Account[]): string[] => {
  const problems: string[] = [];
  if (!source.includes(`prefix: ${JSON.stringify(account.brand.prefix)}`)) {
    problems.push(`brand prefix "${account.brand.prefix}" tidak ditemukan (harus: ${brandLine(account)})`);
  }
  if (!source.includes(`accent: ${JSON.stringify(account.brand.accent)}`)) {
    problems.push(`brand accent "${account.brand.accent}" tidak ditemukan (harus: ${brandLine(account)})`);
  }
  for (const other of all) {
    if (other.id === account.id) continue;
    if (source.includes(`prefix: ${JSON.stringify(other.brand.prefix)}`)) {
      problems.push(`brand milik akun lain (${other.id}) — akun ini harus pakai brand ${account.id}`);
    }
  }
  return problems;
};

/** Problems with the account a finished video declares vs the account the run is for. */
export const accountProblems = (publishJson: unknown, accountId: AccountId): string[] => {
  const problems: string[] = [];
  const value = (publishJson as { account?: unknown } | null)?.account;
  if (typeof value !== "string" || value.trim() === "") {
    problems.push(`publish.json: field "account" wajib diisi ("${accountId}")`);
    return problems;
  }
  if (value !== accountId) {
    problems.push(`publish.json: account video "${value}" != akun run "${accountId}"`);
  }
  return problems;
};

/** KEY=value lines for the CI resolve step (GITHUB_ENV format). */
export const envLines = (account: Account, catalogPath: string): string[] => {
  const prompt = [
    account.agent.prompt,
    `Channel: ${account.label}.`,
    `In src/videos/<slug>/index.ts write exactly: ${brandLine(account)}.`,
    `Published-video catalog for this channel: ${catalogPath} — read it before choosing a topic and do not repeat published titles.`,
    `YouTube categoryId: ${account.youtubeCategoryId}.`,
  ].join(" ");
  return [
    `ACCOUNT=${account.id}`,
    `ACCOUNT_LABEL=${account.label}`,
    `BRAND_LINE=${brandLine(account)}`,
    `YOUTUBE_CATEGORY_ID=${account.youtubeCategoryId}`,
    `AGENT_MODEL=${account.agent.model}`,
    `AGENT_FILES=${account.agent.files.join(" ")}`,
    `AGENT_PROMPT=${prompt}`,
    `CATALOG_PATH=${catalogPath}`,
  ];
};

/**
 * Resolve the account a script runs for: the --account flag wins over the ACCOUNT env value;
 * neither given means the default account. An explicitly empty or unknown value throws —
 * it must never silently become the default channel.
 */
export const resolveAccountArg = (flag: string | undefined, envValue: string | undefined): Account => {
  const raw = flag ?? envValue;
  if (raw !== undefined && !isAccountId(raw)) throw new Error(`Unknown account "${raw}". Valid accounts: ${ACCOUNT_IDS.join(", ")}`);
  return accountById(raw);
};

/** Why an account cannot be voiced yet (its voice is still a TODO_ placeholder), or null when it can. */
export const voiceProblem = (account: Account): string | null =>
  account.tts.voice.startsWith("TODO_") ? `suara akun ${account.id} belum dipilih (tts.voice di src/accounts.ts)` : null;

/** Problems with instagramCaption in publish.json for accounts that publish to Instagram Reels. */
export const instagramCaptionProblems = (publishJson: { instagramCaption?: unknown } | null, account: Account): string[] => {
  if (!account.buffer.instagramChannelId) return [];
  const problems: string[] = [];
  const ig = publishJson?.instagramCaption;
  if (typeof ig !== "string" || ig.trim() === "") {
    problems.push('publish.json: field "instagramCaption" wajib diisi untuk akun dengan Instagram');
    return problems;
  }
  if (ig.length > 2200) {
    problems.push(`publish.json: instagramCaption ${ig.length} karakter, maksimal 2200`);
  }
  if (/(?:^|[^\w])#(?:shorts|short|fyp)(?![\w-])/i.test(ig)) {
    problems.push("publish.json: instagramCaption dilarang memakai #shorts, #short, atau #fyp");
  }
  return problems;
};

/** Rules specific to ai-labs videos: motion graphics only, captions disabled, no world.ts, and PromptCard needs the prompt in the description. */
export const aiLabsVideoProblems = (opts: {
  indexSource: string;
  shotsSource: string | null;
  hasWorldFile: boolean;
  publishJson: { description?: unknown; instagramCaption?: unknown } | null;
}): string[] => {
  const problems: string[] = [];
  const indexCode = opts.indexSource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  if (!/mode\s*:\s*["']motion["']/.test(indexCode)) {
    problems.push('ai-labs wajib pakai mode: "motion" di index.ts');
  }
  if (!/(?:^|[{,\n])\s*captions\s*:\s*false\b/.test(indexCode)) {
    problems.push("ai-labs wajib pakai captions: false di index.ts");
  }
  if (opts.hasWorldFile) {
    problems.push('ai-labs wajib pakai motion graphics (mode: "motion"), bukan world.ts 3D');
  }
  if (opts.shotsSource && /<PromptCard\b/.test(opts.shotsSource)) {
    const desc = opts.publishJson?.description;
    if (typeof desc !== "string" || !/Prompt siap copy:/i.test(desc)) {
      problems.push('shots pakai PromptCard — publish.json description wajib berisi "Prompt siap copy:"');
    }
    const ig = opts.publishJson?.instagramCaption;
    if (typeof ig === "string" && !/Prompt siap copy:/i.test(ig)) {
      problems.push('shots pakai PromptCard — publish.json instagramCaption wajib berisi "Prompt siap copy:"');
    }
  }
  return problems;
};

/** Rules specific to sastra-mesin videos: 3D cutaway (world.ts, not motion) with the "blueprint" overlay theme. */
export const sastraMesinVideoProblems = (opts: { indexSource: string; hasWorldFile: boolean }): string[] => {
  const problems: string[] = [];
  const indexCode = opts.indexSource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  if (!/theme\s*:\s*["']blueprint["']/.test(indexCode)) {
    problems.push('sastra-mesin wajib pakai theme: "blueprint" di index.ts');
  }
  if (/mode\s*:\s*["']motion["']/.test(indexCode) || !opts.hasWorldFile) {
    problems.push('sastra-mesin wajib 3D (world.ts), bukan mode: "motion"');
  }
  return problems;
};

/** Rules specific to upwayyy videos: Steam trailer footage only — footage mode, no world.ts, every shot's clip exists and is used once, credit line in the description. */
export const upwayyyVideoProblems = (opts: {
  indexSource: string;
  hasWorldFile: boolean;
  clipPaths: string[];
  clipExists: (p: string) => boolean;
  publishJson: { description?: unknown } | null;
}): string[] => {
  const problems: string[] = [];
  const indexCode = opts.indexSource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  if (!/mode\s*:\s*["']footage["']/.test(indexCode) || opts.hasWorldFile) {
    problems.push('upwayyy wajib mode: "footage" (trailer Steam), bukan world.ts 3D');
  }
  const seen = new Set<string>();
  for (const clip of opts.clipPaths) {
    if (seen.has(clip)) problems.push(`klip ${clip} dipakai dua kali — satu klip per shot`);
    seen.add(clip);
    if (!opts.clipExists(clip)) problems.push(`klip ${clip} tidak ada di public/`);
  }
  const desc = opts.publishJson?.description;
  if (typeof desc !== "string" || !/Cuplikan:\s*trailer resmi/i.test(desc) || !/Suara:\s*AI/i.test(desc)) {
    problems.push('publish.json description wajib berisi "Cuplikan: trailer resmi <Game> (Steam). Suara: AI (Google AI Studio)."');
  }
  return problems;
};

/** Rules for config.json.music per account: must pick one of that channel's moods. */
export const accountMusicProblems = (configJson: { music?: unknown } | null, accountId: AccountId): string[] => {
  if (!configJson) return ['config.json wajib ada dan berisi field "music"'];
  const validMoods = MOODS_BY_ACCOUNT[accountId];
  const mood = configJson.music;
  if (typeof mood !== "string" || !validMoods.includes(mood)) {
    return [`config.json: field "music" wajib salah satu dari: ${validMoods.join(", ")}`];
  }
  return [];
};

/** Rules specific to cerpenek videos: config.json must pick one of the 5 mood tracks. */
export const cerpenekMusicProblems = (configJson: { music?: unknown } | null): string[] =>
  accountMusicProblems(configJson, "cerpenek");
