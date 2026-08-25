import fs from "node:fs";
import path from "node:path";

const playerFile = path.resolve("src/components/room/GiftAnimationPlayer.tsx");
let player = fs.readFileSync(playerFile, "utf8");

const playerReplacements = [
  [
    'if (isRoyalRoseGift(p.giftName) || p.giftClipUrl?.includes("royal-rose")) {',
    'if (!p.giftClipUrl && isRoyalRoseGift(p.giftName)) {',
  ],
  [
    '  const autoBlackBg = isBlackBgGift(current?.giftName) || hasVideo || hasSvga;',
    '  const autoBlackBg = isBlackBgGift(current?.giftName);',
  ],
  [
    '  const isSpaceship = isJalwaSpaceshipGift(current?.giftName);',
    '  const isSpaceship = !hasAdvCfg && isJalwaSpaceshipGift(current?.giftName);',
  ],
  [
    '    !!current &&\n    !isSpaceship &&\n    !isRoyalRose &&\n    !isRoyalCrownGift(current.giftName) &&\n    (current.coins ?? 0) <= 300;',
    '    !!current &&\n    !hasAdvCfg &&\n    !isSpaceship &&\n    !isRoyalRose &&\n    !isRoyalCrownGift(current.giftName) &&\n    (current.coins ?? 0) <= 300;',
  ],
];

for (const [from, to] of playerReplacements) {
  if (!player.includes(from)) {
    throw new Error(`Gift Studio playback patch target not found: ${from.slice(0, 100)}`);
  }
  player = player.replace(from, to);
}
fs.writeFileSync(playerFile, player);

const giftSheetFile = path.resolve("src/components/GiftSheet.tsx");
let giftSheet = fs.readFileSync(giftSheetFile, "utf8");

const giftSheetReplacements = [
  [
    '  const performSend = () => {\n    if (!selectedGift || send.isPending) return;',
    '  const performSend = () => {\n    if (!selectedGift || send.isPending) return;\n    // Only the supported gift quantities may reach the integer RPC.\n    // This also protects against stale/client-side values such as "f".\n    const safeQty = qty === 1 || qty === 10 || qty === 99 ? qty : 1;',
  ],
  [
    '          coins: price(selectedGift) * qty,',
    '          coins: price(selectedGift) * safeQty,',
  ],
  [
    '          diamonds: selectedGift.diamonds_value * qty,',
    '          diamonds: selectedGift.diamonds_value * safeQty,',
  ],
  [
    '          quantity: qty,',
    '          quantity: safeQty,',
  ],
  [
    '    send.mutate({ gift: selectedGift, targets, quantity: qty });',
    '    send.mutate({ gift: selectedGift, targets, quantity: safeQty });',
  ],
  [
    '    mutationFn: async ({ gift, targets, quantity }: { gift: Gift; targets: string[]; quantity: number }) => {\n      if (targets.length === 0) throw new Error("Pick a receiver");',
    '    mutationFn: async ({ gift, targets, quantity }: { gift: Gift; targets: string[]; quantity: number }) => {\n      if (targets.length === 0) throw new Error("Pick a receiver");\n      const safeQuantity = quantity === 1 || quantity === 10 || quantity === 99 ? quantity : 1;',
  ],
  [
    '          _quantity: quantity,',
    '          _quantity: safeQuantity,',
  ],
  [
    '        quantity,\n        coins: price(gift) * quantity,',
    '        quantity: safeQuantity,\n        coins: price(gift) * safeQuantity,',
  ],
];

for (const [from, to] of giftSheetReplacements) {
  if (!giftSheet.includes(from)) {
    throw new Error(`Gift quantity patch target not found: ${from.slice(0, 100)}`);
  }
  giftSheet = giftSheet.replace(from, to);
}
fs.writeFileSync(giftSheetFile, giftSheet);

console.log("Gift Studio playback + gift quantity safety patches applied.");
