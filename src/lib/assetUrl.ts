const PROJECT_ASSET_ORIGIN = "https://project--269a4b2a-bb70-44e1-bd04-6acc825e6f84.lovable.app";

export function resolveAssetUrl(url?: string | null) {
  if (!url) return url;
  if (url.startsWith("/__l5e/assets-v1/")) return `${PROJECT_ASSET_ORIGIN}${url}`;
  return url;
}