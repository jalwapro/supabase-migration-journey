const OPTIMIZED_LUXURY_MP4_BY_FILENAME: Record<string, string> = {
  "jalwa-diamond-watch.mp4": "/__l5e/assets-v1/62040291-d45a-4613-a35c-dae609e792b3/jalwa-diamond-watch.mp4",
  "jalwa-luxury-perfume.mp4": "/__l5e/assets-v1/8e96b1b5-4085-49b0-99a2-7d223e3315e7/jalwa-luxury-perfume.mp4",
  "jalwa-gold-bar.mp4": "/__l5e/assets-v1/1cd62061-c6f7-4351-be41-3bd67cf6e6b1/jalwa-gold-bar.mp4",
  "jalwa-diamond-necklace.mp4": "/__l5e/assets-v1/0421c4d3-efa2-444b-961f-709f9f6ba57a/jalwa-diamond-necklace.mp4",
  "jalwa-premium-handbag.mp4": "/__l5e/assets-v1/e07b0a32-4218-4767-a432-83c3ec68e358/jalwa-premium-handbag.mp4",
  "jalwa-royal-crown.mp4": "/__l5e/assets-v1/f60e5232-5305-42f9-9912-e80c480c952d/jalwa-royal-crown.mp4",
  "jalwa-luxury-sports-car.mp4": "/__l5e/assets-v1/be5314ea-6a40-44a5-b7f2-7e85c2d4e77f/jalwa-luxury-sports-car.mp4",
  "jalwa-lamborghini.mp4": "/__l5e/assets-v1/eec0f3d1-483f-40a1-9aa9-49cd869325e8/jalwa-lamborghini.mp4",
  "jalwa-ferrari.mp4": "/__l5e/assets-v1/744b62fc-7414-41bc-9d3e-cd7dc17f29ad/jalwa-ferrari.mp4",
  "jalwa-rolls-royce-phantom.mp4": "/__l5e/assets-v1/5172de60-da41-4b85-93ae-837b5b50d95b/jalwa-rolls-royce-phantom.mp4",
  "jalwa-private-helicopter.mp4": "/__l5e/assets-v1/c4240032-1400-4d2a-80dd-12c66d364d45/jalwa-private-helicopter.mp4",
  "jalwa-private-jet.mp4": "/__l5e/assets-v1/85f25efa-6481-4f5d-b6fb-f137deb2e9e4/jalwa-private-jet.mp4",
  "jalwa-super-yacht.mp4": "/__l5e/assets-v1/21067e19-963b-4513-9709-9191c303639a/jalwa-super-yacht.mp4",
  "jalwa-luxury-villa.mp4": "/__l5e/assets-v1/5b7e89ee-ac2e-41fd-83d4-928c6a1b06d9/jalwa-luxury-villa.mp4",
  "jalwa-diamond-safe.mp4": "/__l5e/assets-v1/625e34d0-4b24-4f08-9d82-c02916c9a383/jalwa-diamond-safe.mp4",
  "jalwa-treasure-chest.mp4": "/__l5e/assets-v1/be501561-8b34-4c32-988e-5a95576f106c/jalwa-treasure-chest.mp4",
  "jalwa-golden-peacock.mp4": "/__l5e/assets-v1/d2bb2c9b-4d7e-419c-a068-b4af721f56d5/jalwa-golden-peacock.mp4",
  "jalwa-white-stallion.mp4": "/__l5e/assets-v1/db0d036b-6f75-4712-93bd-2ea1272d5ccb/jalwa-white-stallion.mp4",
  "jalwa-crystal-piano.mp4": "/__l5e/assets-v1/6694bb66-c1c7-4eb9-ade4-39b7281d60bd/jalwa-crystal-piano.mp4",
  "jalwa-royal-ballroom.mp4": "/__l5e/assets-v1/d0aa1e77-d687-4f91-a86b-51b862f5d5bd/jalwa-royal-ballroom.mp4",
  "jalwa-diamond-fountain.mp4": "/__l5e/assets-v1/a790c8b2-5ecb-48b3-9519-0363b3b270d1/jalwa-diamond-fountain.mp4",
  "jalwa-golden-palace.mp4": "/__l5e/assets-v1/4a10dbfb-97f9-4599-8bb1-9f8df3329f41/jalwa-golden-palace.mp4",
  "jalwa-floating-luxury-island.mp4": "/__l5e/assets-v1/69717823-1537-407b-b715-84680a210794/jalwa-floating-luxury-island.mp4",
  "jalwa-millionaire-mansion.mp4": "/__l5e/assets-v1/1a5b43e6-488a-427b-b2ae-4138322a525c/jalwa-millionaire-mansion.mp4",
  "jalwa-billionaire-empire.mp4": "/__l5e/assets-v1/4145c25d-0ad9-4376-bbf6-2ca8d33a8977/jalwa-billionaire-empire.mp4",
};

export function resolveLuxuryGiftMp4Url(url: string | null | undefined) {
  if (!url) return null;
  const cleanUrl = url.split("?")[0]?.split("#")[0] ?? url;
  const filename = cleanUrl.split("/").pop();
  return filename ? OPTIMIZED_LUXURY_MP4_BY_FILENAME[filename] ?? url : url;
}