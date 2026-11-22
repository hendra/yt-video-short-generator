export type RecentPost = {
  id?: string;
  platform?: string;
  date?: string;
  createdAt?: string;
  title?: string | null;
  text: string;
  link?: string | null;
  source?: string;
};
export type CandidatePost = {
  title: string;
  tiktokTitle: string;
  description: string;
  tiktokCaption: string;
  instagramCaption?: string;
};
export type DuplicateMatch = {
  post: RecentPost;
  field: keyof CandidatePost;
  containment: number;
  jaccard: number;
};

const STOP = new Set([
  "yang","dan","dari","untuk","dengan","itu","ini","di","ke","nya","ada","akan","jadi","atau","pada","dalam","karena","seperti","serta","saat","anda","kita","kami","kamu","dia","mereka","harus","bisa","lebih","adalah","kok","kenapa","mengapa","cara","apa","agar","juga",
  "the","and","with","for","from","this","that","into","your","you","are","was","were","has","have","how","why","what",
  "shorts","youtube","tiktok","komentar","tulis","tanya","mau","bongkar","lagi","sumber","animasi","ilustrasi","suara","google","ai","studio","kali","aja","tau","labs",
  // Cerpenek boilerplate: genre words that every story title or description carries.
  "cerpenek","nenek","sastra","mesin","cucuku","legenda","cerita","rakyat","kisah","dongeng","sejarah","asal","usul",
]);

export const significantTokens = (input: string): Set<string> => {
  const clean = input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[@#][\w.-]+/g, " ")
    .replace(/mau dibongkar apa lagi\??\s*tulis di komentar\.?/g, " ")
    .replace(/[^a-z0-9]+/g, " ");
  return new Set(clean.split(/\s+/).filter((token) => (token.length >= 3 || /\d/.test(token)) && !STOP.has(token)));
};

export const similarity = (a: Set<string>, b: Set<string>) => {
  if (a.size === 0 || b.size === 0) return { jaccard: 0, containment: 0 };
  let intersection = 0;
  for (const token of a) if (b.has(token)) intersection += 1;
  return { jaccard: intersection / (a.size + b.size - intersection), containment: intersection / Math.min(a.size, b.size) };
};

const MATCH_CONTAINMENT = 0.55;
const MATCH_JACCARD = 0.42;

export const findDuplicate = (candidate: CandidatePost, recent: RecentPost[]): DuplicateMatch | null => {
  for (const post of recent) {
    const hay = significantTokens(`${post.title ?? ""}\n${post.text}`);
    if (hay.size === 0) continue;
    for (const field of ["title", "tiktokTitle", "description", "tiktokCaption", "instagramCaption"] as const) {
      const text = candidate[field];
      if (typeof text !== "string" || !text.trim()) continue;
      const needle = significantTokens(text);
      const { jaccard, containment } = similarity(needle, hay);
      if (needle.size >= 4 && (containment >= MATCH_CONTAINMENT || jaccard >= MATCH_JACCARD)) {
        return { post, field, containment, jaccard };
      }
    }
  }
  return null;
};
