import { toast } from "sonner";

export type ShareTarget = { title?: string; text?: string; url: string };

/** Native share sheet first, then fallback to clipboard + toast. */
export async function share(target: ShareTarget) {
  try {
    if (typeof navigator !== "undefined" && "share" in navigator) {
      await (navigator as Navigator & { share: (d: ShareTarget) => Promise<void> }).share(target);
      return true;
    }
  } catch { /* user dismissed */ }
  try {
    await navigator.clipboard.writeText(target.url);
    toast.success("Link copied");
    return true;
  } catch {
    toast.error("Could not share");
    return false;
  }
}

export function whatsappShareUrl({ text, url }: ShareTarget) {
  const msg = `${text ? text + " " : ""}${url}`;
  return `https://wa.me/?text=${encodeURIComponent(msg)}`;
}

export function telegramShareUrl({ text, url }: ShareTarget) {
  return `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text ?? "")}`;
}

export function facebookShareUrl({ url }: ShareTarget) {
  return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
}

export function twitterShareUrl({ text, url }: ShareTarget) {
  return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text ?? "")}&url=${encodeURIComponent(url)}`;
}
