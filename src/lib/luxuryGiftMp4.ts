const OPTIMIZED_LUXURY_MP4_BY_FILENAME: Record<string, string> = {
  "jalwa-diamond-watch.mp4": "/__l5e/assets-v1/ee493084-4975-4f3f-bd93-39a0da81f461/jalwa-diamond-watch.webm",
  "jalwa-luxury-perfume.mp4": "/__l5e/assets-v1/80007651-cbe2-4237-a72b-6dfaa8848498/jalwa-luxury-perfume.webm",
  "jalwa-gold-bar.mp4": "/__l5e/assets-v1/96088036-0dae-48d5-8422-5d4d5e3db143/jalwa-gold-bar.webm",
  "jalwa-diamond-necklace.mp4": "/__l5e/assets-v1/4baac0a9-66d0-4ea5-aed7-7e3be4c7b266/jalwa-diamond-necklace.webm",
  "jalwa-premium-handbag.mp4": "/__l5e/assets-v1/af21bf90-6f17-4352-8066-01529748aa6d/jalwa-premium-handbag.webm",
  "jalwa-royal-crown.mp4": "/__l5e/assets-v1/77b89bb0-a2e6-49ea-a76c-328154a4b873/jalwa-royal-crown.webm",
  "jalwa-luxury-sports-car.mp4": "/__l5e/assets-v1/48daaaf9-4c50-42e2-9d70-2255c46d5f45/jalwa-luxury-sports-car.webm",
  "jalwa-lamborghini.mp4": "/__l5e/assets-v1/294ee128-e456-4d35-a194-1594c4880b0b/jalwa-lamborghini.webm",
  "jalwa-ferrari.mp4": "/__l5e/assets-v1/cc30a46d-9373-46a7-a797-13e4755f889c/jalwa-ferrari.webm",
  "jalwa-rolls-royce-phantom.mp4": "/__l5e/assets-v1/fcc2fc00-65ca-4333-bfd7-a052183b2b27/jalwa-rolls-royce-phantom.webm",
  "jalwa-private-helicopter.mp4": "/__l5e/assets-v1/f6009fbf-9bb5-4229-8a67-68fdb78fbe3b/jalwa-private-helicopter.webm",
  "jalwa-private-jet.mp4": "/__l5e/assets-v1/ab1f9bdc-1784-41fd-893e-9fed4ed98421/jalwa-private-jet.webm",
  "jalwa-super-yacht.mp4": "/__l5e/assets-v1/6e244d12-9190-400c-94c6-01dd28837a5b/jalwa-super-yacht.webm",
  "jalwa-luxury-villa.mp4": "/__l5e/assets-v1/50d1af9e-bea6-4b83-a74d-0a3d7716d939/jalwa-luxury-villa.webm",
  "jalwa-diamond-safe.mp4": "/__l5e/assets-v1/26e48a3c-fae2-44c6-a13f-ff0a795b5c33/jalwa-diamond-safe.webm",
  "jalwa-treasure-chest.mp4": "/__l5e/assets-v1/5943a210-3c29-453e-95e4-24e941ad3662/jalwa-treasure-chest.webm",
  "jalwa-golden-peacock.mp4": "/__l5e/assets-v1/39ebfe06-abf5-4e6c-adb5-052e0674c4a7/jalwa-golden-peacock.webm",
  "jalwa-white-stallion.mp4": "/__l5e/assets-v1/ea947d1c-4160-4608-a5ea-8aceb034762c/jalwa-white-stallion.webm",
  "jalwa-crystal-piano.mp4": "/__l5e/assets-v1/8bdbb399-6d1a-4a1e-990f-782ff25abd5a/jalwa-crystal-piano.webm",
  "jalwa-royal-ballroom.mp4": "/__l5e/assets-v1/afccd8e9-57be-47a5-b296-6fad693faa90/jalwa-royal-ballroom.webm",
  "jalwa-diamond-fountain.mp4": "/__l5e/assets-v1/e327cd1a-ce32-414f-a3f1-39de688d7cc4/jalwa-diamond-fountain.webm",
  "jalwa-golden-palace.mp4": "/__l5e/assets-v1/5b737a13-bac7-4e75-b3a8-14ce0c6a6104/jalwa-golden-palace.webm",
  "jalwa-floating-luxury-island.mp4": "/__l5e/assets-v1/184cfa56-c736-4b97-84ca-f10ee872cd54/jalwa-floating-luxury-island.webm",
  "jalwa-millionaire-mansion.mp4": "/__l5e/assets-v1/d991cbed-61b7-42ad-81ad-66caa2a90d47/jalwa-millionaire-mansion.webm",
  "jalwa-billionaire-empire.mp4": "/__l5e/assets-v1/d693bff8-3ff1-4675-b6c4-c67aa6df4d17/jalwa-billionaire-empire.webm",
};

export function resolveLuxuryGiftMp4Url(url: string | null | undefined) {
  if (!url) return null;
  const cleanUrl = url.split("?")[0]?.split("#")[0] ?? url;
  const filename = cleanUrl.split("/").pop();
  return filename ? OPTIMIZED_LUXURY_MP4_BY_FILENAME[filename] ?? url : url;
}