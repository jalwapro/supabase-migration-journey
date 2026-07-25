#!/usr/bin/env node
// Generate 300 transparent animated SVG gifts + SQL seed migration.
// 20 categories x 15 gifts each. All SVGs have transparent bg + CSS animation.
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const OUT_DIR = "public/animations/gifts/pack300";
const SQL_PATH = "db/migrations/0171_gifts_pack_300.sql";

// palette generator
const palettes = [
  ["#FF3D7F", "#FF9EC6", "#FFF"],
  ["#7C3AED", "#C4B5FD", "#FFF"],
  ["#F59E0B", "#FCD34D", "#FFF"],
  ["#10B981", "#6EE7B7", "#FFF"],
  ["#EF4444", "#FCA5A5", "#FFF"],
  ["#3B82F6", "#93C5FD", "#FFF"],
  ["#EC4899", "#F9A8D4", "#FFF"],
  ["#8B5CF6", "#DDD6FE", "#FFF"],
  ["#F97316", "#FDBA74", "#FFF"],
  ["#14B8A6", "#5EEAD4", "#FFF"],
  ["#E11D48", "#FDA4AF", "#FFF"],
  ["#0EA5E9", "#7DD3FC", "#FFF"],
  ["#D946EF", "#F0ABFC", "#FFF"],
  ["#84CC16", "#BEF264", "#FFF"],
  ["#FACC15", "#FDE68A", "#FFF"],
];

// category → array of 15 { name, glyph, shape } items
// glyph = emoji-ish accent used in center; shape = builder key
const CATS = {
  popular:  ["Star","Nova","Sparkle","Twinkle","Comet","Aurora","Beam","Flash","Halo","Prism","Glow","Meteor","Glitter","Ray","Shine"].map(n=>({n,g:"⭐"})),
  love:     ["Heart","Cupid","Rose","Kiss","Amour","Passion","Devotion","Blush","Cherish","Adore","Sweetheart","Beloved","Romance","Valentine","Forever"].map(n=>({n,g:"❤"})),
  luxury:   ["Diamond","GoldBar","Ruby","Sapphire","Emerald","Platinum","Pearl","Topaz","Onyx","Jade","Opal","Amber","Coral","Ivory","Bling"].map(n=>({n,g:"💎"})),
  premium:  ["Trophy","Medal","Crown","Scepter","Chalice","Laurel","Ribbon","Badge","Star","Insignia","Emblem","Award","Honor","Grand","Elite"].map(n=>({n,g:"🏆"})),
  mythic:   ["Dragon","Phoenix","Griffin","Hydra","Chimera","Kraken","Basilisk","Wyvern","Cerberus","Pegasus","Sphinx","Titan","Serpent","Fenrir","Leviathan"].map(n=>({n,g:"🐉"})),
  classic:  ["Candy","Cupcake","Lollipop","Toffee","Bonbon","Marshmallow","Nougat","Praline","Truffle","Fudge","Caramel","Sherbet","Gelato","Sundae","Eclair"].map(n=>({n,g:"🍬"})),
  cute:     ["Teddy","Bunny","Kitten","Puppy","Panda","Duckling","Chick","Piglet","Fawn","Cub","Otter","Hedgehog","Squirrel","Koala","Fox"].map(n=>({n,g:"🧸"})),
  nature:   ["Leaf","Flower","Tree","Bloom","Sprout","Petal","Fern","Vine","Blossom","Meadow","Forest","Sunflower","Lotus","Tulip","Cherry"].map(n=>({n,g:"🌿"})),
  fire:     ["Flame","Ember","Blaze","Inferno","Torch","Bonfire","Spark","Wildfire","Ignite","Combust","Furnace","Pyre","Cinder","Volcano","Meteor"].map(n=>({n,g:"🔥"})),
  ice:      ["Snowflake","Frost","Glacier","Icicle","Crystal","Blizzard","Chill","Arctic","Winter","Polar","Frozen","Diamond","Aurora","Iceberg","Sleet"].map(n=>({n,g:"❄"})),
  cosmic:   ["Galaxy","Planet","Star","Comet","Nebula","Supernova","Orbit","Cosmos","Universe","Astro","Meteor","Solar","Lunar","Void","Quasar"].map(n=>({n,g:"🌌"})),
  royal:    ["Crown","Throne","Scepter","Chalice","Robe","Orb","Diadem","Tiara","Signet","Regalia","Coronet","Palace","Kingdom","Majesty","Sovereign"].map(n=>({n,g:"👑"})),
  party:    ["Balloon","Confetti","Popper","Streamer","Firework","Cake","Cheers","Dance","Disco","Sparkler","Ribbon","Champagne","Toast","Bash","Festival"].map(n=>({n,g:"🎉"})),
  food:     ["Cake","Donut","Pizza","Burger","Cookie","Pretzel","Sushi","Taco","Pancake","Waffle","Muffin","Croissant","Bagel","Bento","Ramen"].map(n=>({n,g:"🍰"})),
  animals:  ["Lion","Tiger","Eagle","Wolf","Bear","Deer","Owl","Fox","Falcon","Panther","Cobra","Shark","Dolphin","Rhino","Elephant"].map(n=>({n,g:"🦁"})),
  magic:    ["Wand","Spell","Potion","Rune","Crystal","Orb","Amulet","Charm","Enchant","Mystic","Arcane","Sorcery","Hex","Talisman","Grimoire"].map(n=>({n,g:"🪄"})),
  music:    ["Note","Melody","Harmony","Rhythm","Chord","Beat","Tune","Anthem","Symphony","Ballad","Serenade","Groove","Concerto","Sonata","Lyric"].map(n=>({n,g:"🎵"})),
  sports:   ["Trophy","Ball","Medal","Whistle","Racket","Boxing","Goal","Champion","Victory","Sprint","Marathon","Podium","Torch","Ring","Bat"].map(n=>({n,g:"🏆"})),
  vehicles: ["Rocket","Car","Jet","Yacht","Bike","Chopper","Ferrari","Lambo","Tesla","Cruiser","Speeder","Racer","Drone","Skyliner","Hovercar"].map(n=>({n,g:"🚀"})),
  fantasy:  ["Unicorn","Castle","Fairy","Elf","Wizard","Mermaid","Griffin","Dragon","Knight","Genie","Nymph","Pixie","Sprite","Oracle","Titan"].map(n=>({n,g:"🦄"})),
};

const CAT_ORDER = Object.keys(CATS);

function esc(s){ return s.replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }

// SVG builder — one animated composition. 200x200 viewBox, transparent.
// Uses rotating aura + pulsing core + orbiting particles + centered glyph.
function buildSvg({ name, glyph, palette, seed }){
  const [c1, c2, c3] = palette;
  const parts = 8 + (seed % 5); // 8..12 orbiting particles
  const rotDur = (6 + (seed % 6)).toFixed(1); // 6..11s
  const pulseDur = (1.6 + ((seed*0.13) % 1.4)).toFixed(2);
  const particles = Array.from({length: parts}, (_, i) => {
    const angle = (360/parts) * i;
    const r = 78;
    const x = 100 + r * Math.cos(angle * Math.PI/180);
    const y = 100 + r * Math.sin(angle * Math.PI/180);
    const rad = 4 + ((seed + i) % 4);
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${rad}" fill="${c2}" opacity="0.85"><animate attributeName="opacity" values="0.3;1;0.3" dur="${pulseDur}s" begin="${(i*0.12).toFixed(2)}s" repeatCount="indefinite"/></circle>`;
  }).join("");

  const rays = Array.from({length: 12}, (_, i) => {
    const a = (360/12)*i;
    return `<rect x="99" y="10" width="2" height="30" fill="${c3}" opacity="0.35" transform="rotate(${a} 100 100)"/>`;
  }).join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200" style="background:transparent">
  <defs>
    <radialGradient id="g${seed}" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="${c3}" stop-opacity="0.95"/>
      <stop offset="55%" stop-color="${c1}" stop-opacity="0.85"/>
      <stop offset="100%" stop-color="${c1}" stop-opacity="0"/>
    </radialGradient>
    <filter id="glow${seed}" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="3" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>

  <!-- outer rotating rays -->
  <g filter="url(#glow${seed})">
    <g>
      ${rays}
      <animateTransform attributeName="transform" type="rotate" from="0 100 100" to="360 100 100" dur="${rotDur}s" repeatCount="indefinite"/>
    </g>
  </g>

  <!-- pulsing aura -->
  <circle cx="100" cy="100" r="70" fill="url(#g${seed})">
    <animate attributeName="r" values="60;74;60" dur="${pulseDur}s" repeatCount="indefinite"/>
    <animate attributeName="opacity" values="0.6;1;0.6" dur="${pulseDur}s" repeatCount="indefinite"/>
  </circle>

  <!-- orbiting particles -->
  <g>
    ${particles}
    <animateTransform attributeName="transform" type="rotate" from="0 100 100" to="-360 100 100" dur="${(parseFloat(rotDur)+2).toFixed(1)}s" repeatCount="indefinite"/>
  </g>

  <!-- core glyph -->
  <g>
    <circle cx="100" cy="100" r="34" fill="${c1}" opacity="0.9"/>
    <text x="100" y="118" text-anchor="middle" font-size="42" font-family="Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif">${glyph}</text>
    <animateTransform attributeName="transform" type="scale" values="1;1.08;1" dur="${pulseDur}s" additive="sum" repeatCount="indefinite"/>
  </g>

  <title>${esc(name)}</title>
</svg>
`;
}

function slug(s){ return s.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,""); }

const rows = [];
let seed = 0;
for (let ci = 0; ci < CAT_ORDER.length; ci++){
  const cat = CAT_ORDER[ci];
  const dir = join(OUT_DIR, cat);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const items = CATS[cat];
  for (let i = 0; i < items.length; i++){
    seed++;
    const { n, g } = items[i];
    const palette = palettes[seed % palettes.length];
    const displayName = `Jalwa ${n}`;
    const fileName = `${slug(n)}.svg`;
    const filePath = join(dir, fileName);
    const clipPath = `/animations/gifts/pack300/${cat}/${fileName}`;
    writeFileSync(filePath, buildSvg({ name: displayName, glyph: g, palette, seed }));
    // price curve per category slot (1..15): 5, 10, 20, ..., up to ~50000
    const tier = i + 1; // 1..15
    const catMul = 1 + ci * 0.15; // slight bump per category index
    const price = Math.max(1, Math.round(5 * Math.pow(1.65, tier - 1) * catMul));
    const diamonds = Math.max(1, Math.floor(price/2));
    const sortOrder = ci * 100 + tier;
    rows.push({ name: displayName, emoji: g, price, diamonds, category: cat, sortOrder, clipPath });
  }
}

// Build safe upsert SQL
const values = rows.map(r =>
  `('${r.name.replace(/'/g,"''")}','${r.emoji}','${r.emoji}',${r.price},${r.price},${r.diamonds},'${r.category}','pop',${r.sortOrder},'${r.clipPath}','svg',true,true)`
).join(",\n  ");

const sql = `-- 0171 Jalwa Gift Pack 300 — 20 categories x 15 animated transparent SVGs.
-- Safe upsert: preserves existing gift_sends FK history, no deletes.
BEGIN;

WITH data(name, emoji, icon, price, price_coins, diamonds_value, category, animation, sort_order, clip_path, clip_type, is_active, active) AS (
  VALUES
  ${values}
),
upd AS (
  UPDATE public.gifts g
     SET emoji = d.emoji, icon = d.icon, price = d.price, price_coins = d.price_coins,
         diamonds_value = d.diamonds_value, category = d.category, animation = d.animation,
         sort_order = d.sort_order, clip_path = d.clip_path, clip_type = d.clip_type,
         is_active = true, active = true, image_url = NULL
    FROM data d
   WHERE g.name = d.name
  RETURNING g.name
)
INSERT INTO public.gifts
  (name, emoji, icon, price, price_coins, diamonds_value, category, animation, sort_order, clip_path, clip_type, is_active, active)
SELECT d.name, d.emoji, d.icon, d.price, d.price_coins, d.diamonds_value, d.category, d.animation,
       d.sort_order, d.clip_path, d.clip_type, d.is_active, d.active
  FROM data d
 WHERE d.name NOT IN (SELECT name FROM upd);

COMMIT;

SELECT category, count(*) FROM public.gifts WHERE clip_path LIKE '/animations/gifts/pack300/%' GROUP BY category ORDER BY category;
`;

writeFileSync(SQL_PATH, sql);
console.log(`Wrote ${rows.length} SVGs across ${CAT_ORDER.length} categories.`);
console.log(`Wrote migration: ${SQL_PATH}`);
