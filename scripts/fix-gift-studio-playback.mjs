import fs from "node:fs";
import path from "node:path";

const file = path.resolve("src/components/room/GiftAnimationPlayer.tsx");
let source = fs.readFileSync(file, "utf8");

const replacements = [
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

for (const [from, to] of replacements) {
  if (!source.includes(from)) {
    throw new Error(`Gift Studio playback patch target not found: ${from.slice(0, 100)}`);
  }
  source = source.replace(from, to);
}

fs.writeFileSync(file, source);
console.log("Gift Studio playback patch applied.");
