import { createServerFn } from "@tanstack/react-start";

export const searchYouTube = createServerFn({ method: "GET" })
  .inputValidator((input: { q: string }) => {
    const q = String(input?.q ?? "").trim().slice(0, 100);
    if (!q) throw new Error("Empty query");
    return { q };
  })
  .handler(async ({ data }) => {
    const key = process.env.GOOGLE_API_KEY;
    if (!key) throw new Error("GOOGLE_API_KEY not configured");
    const url = new URL("https://www.googleapis.com/youtube/v3/search");
    url.searchParams.set("part", "snippet");
    url.searchParams.set("type", "video");
    url.searchParams.set("videoCategoryId", "10"); // Music
    url.searchParams.set("maxResults", "20");
    url.searchParams.set("q", data.q);
    url.searchParams.set("key", key);
    const res = await fetch(url.toString());
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`YouTube API ${res.status}: ${t.slice(0, 200)}`);
    }
    const json = (await res.json()) as {
      items?: Array<{
        id: { videoId: string };
        snippet: {
          title: string;
          channelTitle: string;
          thumbnails: { default?: { url: string }; medium?: { url: string } };
        };
      }>;
    };
    return (json.items ?? []).map((it) => ({
      id: it.id.videoId,
      title: it.snippet.title,
      artist: it.snippet.channelTitle,
      artwork:
        it.snippet.thumbnails.medium?.url ??
        it.snippet.thumbnails.default?.url ??
        "",
    }));
  });
