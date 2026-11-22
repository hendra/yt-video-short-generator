/** Pure report-text builder for report.mts (exported for unit tests). */
import { ACCOUNTS, isAccountId } from "../src/accounts.ts";

export const formatLinksCsv = (links?: { youtube?: string | null; tiktok?: string | null; instagram?: string | null }): string =>
  [links?.youtube, links?.tiktok, links?.instagram].filter((v): v is string => Boolean(v)).join(",");

type Platform = "youtube" | "tiktok" | "instagram";
const PLATFORM_LINES: [Platform, string, string][] = [["youtube", "▶️", "YouTube"], ["tiktok", "🎵", "TikTok"], ["instagram", "📸", "Instagram"]];
/** "now" → "sekarang"; ISO → "HH:MM WIB" (UTC+7). */
const wibTime = (v: string): string => (v === "now" ? "sekarang" : `${new Date(Date.parse(v) + 7 * 3_600_000).toISOString().slice(11, 16)} WIB`);

export type ReportOptions = {
  slug: string; links?: string; step?: string; error?: string; account?: string;
  /** Per-platform air time from publish-result.json: ISO UTC or "now"; absent platform = not posted. */
  schedule?: Partial<Record<Platform, string>>;
  linkMap?: Partial<Record<Platform, string | null>>;
};

export const buildReportText = (opts: ReportOptions): string => {
  const { slug, links = "", step = "", error = "", account, schedule, linkMap = {} } = opts;
  const known = account !== undefined && isAccountId(account) ? account : undefined;
  const label = known ? ACCOUNTS[known].label : "video-short CI";
  if (error) {
    const suffix = known ? ` — ${label}` : "";
    return `:x: *[video-short CI]* run gagal di *${step || "unknown step"}* untuk \`${slug}\`${suffix}\nError: ${error.slice(0, 300)}`;
  }
  if (schedule && Object.values(schedule).some(Boolean)) {
    const lines = PLATFORM_LINES.filter(([p]) => schedule[p])
      .map(([p, icon, name]) => `${icon} ${name} ${wibTime(schedule[p]!)}${linkMap[p] ? ` — ${linkMap[p]}` : ""}`);
    return `:calendar: *[${label}] Video dijadwalkan*\n${lines.join("\n")}\nProject: \`${slug}\` — diproduksi oleh pipeline video-short (GitHub-hosted).`;
  }
  if (links) {
    const mappedLines = PLATFORM_LINES.filter(([p]) => Boolean(linkMap[p])).map(([p, icon]) => `${icon} ${linkMap[p]}`);
    if (mappedLines.length > 0) {
      const first = linkMap.youtube ?? linkMap.tiktok ?? linkMap.instagram ?? "";
      return `:rocket: *[${label}] Video baru live*\n*Judul:* lihat di ${first}\n${mappedLines.join("\n")}\nProject: \`${slug}\` — diproduksi oleh pipeline video-short (GitHub-hosted).`;
    }
    const [yt, tt, ig] = links.split(",");
    const igLine = ig ? `\n📸 ${ig}` : "";
    return `:rocket: *[${label}] Video baru live*\n*Judul:* lihat di ${yt ?? ""}\n▶️ ${yt ?? "?"}\n🎵 ${tt ?? "?"}${igLine}\nProject: \`${slug}\` — diproduksi oleh pipeline video-short (GitHub-hosted).`;
  }
  return `:information_source: *[${label}]* \`${slug}\` — report (tidak ada links/error diberikan)`;
};
