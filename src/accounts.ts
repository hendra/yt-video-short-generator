/**
 * Account config — the single source of truth for every channel this pipeline publishes to.
 *
 * One pipeline, many accounts: a CI run is scoped to exactly one account (see
 * `scripts/account-env.mts`), and `publish.json.account` decides which Buffer channel a
 * finished video goes to. Kali Aja's values are the ones the pipeline has always used. Voice and the
 * YouTube made-for-kids declaration are per account too.
 *
 * Kept free of node imports so it can be imported from scripts and from src alike.
 */

export type AccountId = "kali-aja" | "ai-labs" | "cerpenek" | "sastra-mesin" | "upwayyy";

export type Account = {
  id: AccountId;
  /** Channel name used in Slack reports. */
  label: string;
  /** Brand overlay shown on every frame (prefix + highlighted accent). */
  brand: { prefix: string; accent: string };
  /** Buffer org + channels (YouTube, TikTok, optional Instagram) inside it. */
  buffer: { orgId: string; youtubeChannelId: string; tiktokChannelId: string; instagramChannelId?: string };
  /** YouTube video category id. */
  youtubeCategoryId: string;
  /** YouTube "made for kids" declaration sent with every upload (true disables comments + notifications there). */
  madeForKids: boolean;
  /** Gemini TTS voice id + speaking style for this channel's voiceover. */
  tts: { voice: string; style: string };
  /** Instruction files the agent reads, plus the model it runs on. */
  agent: { model: string; prompt: string; files: string[] };
};

export const ACCOUNT_IDS: readonly AccountId[] = ["kali-aja", "ai-labs", "cerpenek", "sastra-mesin", "upwayyy"];

export const DEFAULT_ACCOUNT: AccountId = "kali-aja";

export const ACCOUNTS: Record<AccountId, Account> = {
  "kali-aja": {
    id: "kali-aja",
    label: "Kali Aja Tau",
    brand: { prefix: "Kali Aja ", accent: "Tau" },
    buffer: {
      orgId: "6aed53e7ec5c7c6d73f3e437",
      youtubeChannelId: "6aedb753e29c69a171803f6e",
      tiktokChannelId: "6aedb7fee29c69a171804662",
      instagramChannelId: "6aed5544e29c69a1717ba62e",
    },
    youtubeCategoryId: "27",
    madeForKids: false,
    tts: { voice: "id-id-podcaster-1", style: "natural, warm, conversational" },
    agent: {
      model: "opencode/deepseek-v4.1-flash-free",
      prompt:
        "You are in CI. Follow AGENTS.md and docs/AUTOPILOT.md. Follow ops/ci-prompt.md exactly. Stop before any publish/upload/render step.",
      files: ["AGENTS.md", "docs/AUTOPILOT.md", "ops/ci-prompt.md"],
    },
  },
  "ai-labs": {
    id: "ai-labs",
    label: "AI Labs",
    brand: { prefix: "AI ", accent: "Labs" },
    buffer: {
      orgId: "67654dffc44cce0b50102d9e",
      youtubeChannelId: "6af91d59ece6dfde5fcb8689",
      tiktokChannelId: "6af91d8bece6dfde5fcb87ac",
      instagramChannelId: "6af92062ece6dfde5fcba082",
    },
    youtubeCategoryId: "28",
    madeForKids: false,
    tts: { voice: "id-id-podcaster-1", style: "natural, warm, conversational" },
    agent: {
      model: "opencode/deepseek-v4.1-flash-free",
      prompt:
        "You are in CI. Follow AGENTS.md and ops/ci-prompt.md exactly. Follow ops/accounts/ai-labs.md (channel brief) and ops/topics/ai-labs.md (topic backlog) — they are part of your instructions, and docs/AUTOPILOT.md does NOT apply to this channel. Stop before any publish/upload/render step.",
      files: ["AGENTS.md", "ops/ci-prompt.md", "ops/accounts/ai-labs.md", "ops/topics/ai-labs.md"],
    },
  },
  // Cerpenek (Cerita Pendek Nenek): dongeng anak 5–10 tahun. Own Buffer organization + channels;
  // credentials come from the GitHub Environment `cerpenek`.
  cerpenek: {
    id: "cerpenek",
    label: "Cerpenek",
    brand: { prefix: "Cerpe", accent: "nek" },
    buffer: {
      orgId: "6af9a85ef0ed12641d69eab4",
      youtubeChannelId: "6af9a8caece6dfde5fd19e00",
      tiktokChannelId: "6af9a8e0ece6dfde5fd19e93",
    },
    youtubeCategoryId: "27",
    madeForKids: true,
    tts: { voice: "id-id-storyteller-1", style: "hangat, ceria, bersemangat; intonasi naik-turun seperti bercerita" },
    agent: {
      model: "opencode/deepseek-v4.1-flash-free",
      prompt:
        "You are in CI. Follow AGENTS.md and ops/ci-prompt.md exactly. Follow ops/accounts/cerpenek.md (channel brief) and ops/topics/cerpenek.md (topic backlog) — they are part of your instructions, they override ops/ci-prompt.md where they differ, and docs/AUTOPILOT.md does NOT apply to this channel. Stop before any publish/upload/render step.",
      files: ["AGENTS.md", "ops/ci-prompt.md", "ops/accounts/cerpenek.md", "ops/topics/cerpenek.md"],
    },
  },
  // Sastra Mesin: how everyday objects work, 3D cutaways in the "blueprint" overlay theme. Own Buffer org + channels.
  "sastra-mesin": {
    id: "sastra-mesin",
    label: "Sastra Mesin",
    brand: { prefix: "Sastra ", accent: "Mesin" },
    buffer: {
      orgId: "6afdf08dd10011a8be72ed75",
      youtubeChannelId: "6afdf52fece6dfde5f101631",
      tiktokChannelId: "6afdf54bece6dfde5f101af0",
      instagramChannelId: "6afe07c2ece6dfde5f116be8",
    },
    youtubeCategoryId: "27",
    madeForKids: false,
    tts: { voice: "id-id-tutor-1", style: "ramah, jelas, penasaran; seperti teman pintar yang menjelaskan sesuatu yang seru; tempo sedang" },
    agent: {
      model: "opencode/deepseek-v4.1-flash-free",
      prompt:
        "You are in CI. Follow AGENTS.md and ops/ci-prompt.md exactly. Follow ops/accounts/sastra-mesin.md (channel brief) and ops/topics/sastra-mesin.md (topic backlog) — they are part of your instructions, they override ops/ci-prompt.md where they differ, and docs/AUTOPILOT.md does NOT apply to this channel. Stop before any publish/upload/render step.",
      files: ["AGENTS.md", "ops/ci-prompt.md", "ops/accounts/sastra-mesin.md", "ops/topics/sastra-mesin.md"],
    },
  },
  // Upwayyy: horror-game lore Shorts over official Steam trailer footage. Buffer ids are placeholders
  // until the user connects the channels; the `--require-configured` guard keeps publishing blocked.
  upwayyy: {
    id: "upwayyy",
    label: "Upwayyy",
    brand: { prefix: "Up", accent: "wayyy" },
    buffer: {
      orgId: "6b0133b51b0e893dcb2b070c",
      youtubeChannelId: "6b0133e2ece6dfde5f3ffc2f",
      tiktokChannelId: "6b0176e5ece6dfde5f42e897",
    },
    youtubeCategoryId: "20",
    madeForKids: false,
    tts: { voice: "id-id-podcaster-1", style: "santai, akrab, seperti teman gamer bercerita; serius saat cerita seram" },
    agent: {
      model: "opencode/deepseek-v4.1-flash-free",
      prompt:
        "You are in CI. Follow AGENTS.md and ops/ci-prompt.md exactly. Follow ops/accounts/upwayyy.md (channel brief) and ops/topics/upwayyy.md (topic backlog) — they are part of your instructions, they override ops/ci-prompt.md where they differ, and docs/AUTOPILOT.md does NOT apply to this channel. Stop before any publish/upload/render step.",
      files: ["AGENTS.md", "ops/ci-prompt.md", "ops/accounts/upwayyy.md", "ops/topics/upwayyy.md"],
    },
  },
};

export const isAccountId = (v: unknown): v is AccountId => typeof v === "string" && (ACCOUNT_IDS as readonly string[]).includes(v);

/** Look up an account; unknown ids throw instead of silently falling back to a live channel. */
export const accountById = (id?: string | null): Account => {
  if (id === undefined || id === null || id === "") return ACCOUNTS[DEFAULT_ACCOUNT];
  if (!isAccountId(id)) throw new Error(`Unknown account "${id}". Valid accounts: ${ACCOUNT_IDS.join(", ")}`);
  return ACCOUNTS[id];
};

/** Config fields that still hold a TODO_ placeholder, e.g. ["buffer.orgId", "tts.voice"]. */
export const missingConfigFields = (account: Account): string[] => [
  ...(["orgId", "youtubeChannelId", "tiktokChannelId", "instagramChannelId"] as const)
    .filter((field) => {
      const val = account.buffer[field];
      return typeof val === "string" && val.startsWith("TODO_");
    })
    .map((field) => `buffer.${field}`),
  ...(account.tts.voice.startsWith("TODO_") ? ["tts.voice"] : []),
];

/** True when the account is safe to publish to (no placeholder left). */
export const isConfigured = (account: Account): boolean => missingConfigFields(account).length === 0;
