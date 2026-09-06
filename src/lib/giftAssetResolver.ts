const normalize = (value: string) => value.toLowerCase().trim().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

// Canonical repo assets used by the gift migrations. Keep this small and
// deterministic; DB clip_path remains the first choice when available.
const aliases: Record<string, string[]> = {
  rose: ["rose-bloom.svg"],
  heart: ["heart-burst.svg"],
  fireworks: ["fireworks.svg"],
  confetti: ["fireworks.svg"],
  "coin-rain": ["coin-rain.svg"],
  diamond: ["diamond-sparkle.svg"],
  "sports-car": ["rocket-launch.svg"],
  "sports-car-plus": ["rocket-launch.svg"],
  crown: ["crown-shine.svg"],
  unicorn: ["galaxy-swirl.svg"],
  dragon: ["phoenix.svg"],
  castle: ["crown-shine.svg"],
  rocket: ["rocket-launch.svg"],
  galaxy: ["galaxy-swirl.svg"],
  phoenix: ["phoenix.svg"],
  "lucky-box": ["lucky-box.svg"],
  "mega-box": ["lucky-box.svg"],
  "diamond-box": ["diamond-sparkle.svg"],
  star: ["fireworks.svg"],
  trophy: ["crown-shine.svg"],
  kiss: ["heart-burst.svg"],
  "love-letter": ["heart-burst.svg"],
  "cupid-arrow": ["heart-burst.svg"],
  champagne: ["fireworks.svg"],
  yacht: ["rocket-launch.svg"],
};

const dirs = [
  "",
  "basic/",
  "starter25/",
  "luxury25/",
  "pack300/",
  "pack300/music/",
];

const extensions = ["svg", "png", "webp", "mp4", "webm"];

export function giftAssetCandidates(name: string | null | undefined): string[] {
  if (!name) return [];
  const key = normalize(name);
  const fileNames = new Set<string>();
  for (const file of aliases[key] ?? []) fileNames.add(file);
  fileNames.add(`${key}.svg`);
  for (const ext of extensions) fileNames.add(`${key}.${ext}`);
  const candidates: string[] = [];
  for (const dir of dirs) {
    for (const file of fileNames) candidates.push(`/animations/gifts/${dir}${file}`);
  }
  return [...new Set(candidates)];
}

export function giftAssetType(url: string): "video" | "image" {
  const clean = url.split("?")[0].split("#")[0].toLowerCase();
  return /\.(mp4|webm|mov)$/.test(clean) ? "video" : "image";
}
