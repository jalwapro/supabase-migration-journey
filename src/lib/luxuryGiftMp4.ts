// Legacy shim. Luxury gift clips used to be served from /public/gifts/; every
// gift asset now lives on Cloudflare R2 and the DB stores the canonical URL,
// so this resolver is a pass-through kept for call-site compatibility.
export function resolveLuxuryGiftMp4Url(url: string | null | undefined) {
  return url ?? null;
}
