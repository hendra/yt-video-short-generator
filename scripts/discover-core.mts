/**
 * Which new folder under src/videos is this run's video.
 * The registry is the source of truth (a video exists only if it is registered), so a folder the
 * agent abandoned after switching topic is ignored instead of failing the whole run as "ambiguous".
 */
export type SlugPick = { slug: string; ignored: readonly string[] } | { error: string };

export const pickSlug = (newFolders: readonly string[], registered: readonly string[]): SlugPick => {
  const ignored = newFolders.filter((f) => !registered.includes(f));
  const known = newFolders.filter((f) => registered.includes(f));
  if (known.length === 0)
    return { error: `agent produced no registered new video folder${ignored.length ? ` (new but unregistered: ${ignored.join(", ")})` : ""}` };
  if (known.length > 1) return { error: `ambiguous slug (multiple registered new folders): ${known.join(", ")}` };
  const slug = known[0];
  if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) return { error: `slug fails charset check: ${slug}` };
  return { slug, ignored };
};
