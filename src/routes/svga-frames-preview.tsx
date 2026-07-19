import { createFileRoute } from '@tanstack/react-router';
import SvgaPlayer from '@/components/room/SvgaPlayer';

export const Route = createFileRoute('/svga-frames-preview')({
  component: Page,
  head: () => ({ meta: [{ title: 'SVGA Files — Preview' }] }),
});

// All 17 SVGA files from svga/SVGAPlayer-Android sample repo
const items = [
  { name: 'Castle',           url: '/__l5e/assets-v1/7616b3bf-5c0d-476c-8e13-f8e7031b11dd/Castle.svga',              type: 'Gift' },
  { name: 'Goddess',          url: '/__l5e/assets-v1/2bc7031c-a888-4a82-aa05-4dd56ccead26/Goddess.svga',             type: 'Gift' },
  { name: 'Merry Christmas',  url: '/__l5e/assets-v1/459d0120-e6b5-4938-86fa-0224662c5167/MerryChristmas.svga',      type: 'Gift' },
  { name: 'Rocket',           url: '/__l5e/assets-v1/e35c6a74-526a-48a4-848b-85348a612195/Rocket.svga',              type: 'Gift' },
  { name: 'Angel',            url: '/__l5e/assets-v1/5f55c51b-cd7d-4f00-a369-e24e4070964b/angel.svga',               type: 'Frame' },
  { name: 'Heartbeat',        url: '/__l5e/assets-v1/b47b4d2c-9016-4fb1-b03e-7b8eda0ade3c/heartbeat.svga',           type: 'Gift' },
  { name: 'Jojo Audio',       url: '/__l5e/assets-v1/d5a28fac-6bf2-4ecf-8fc5-eddcd2ed5d40/jojo_audio.svga',          type: 'Gift' },
  { name: 'Rose',             url: '/__l5e/assets-v1/11331805-3df3-4b6a-ae30-3c853495c0d3/rose.svga',                type: 'Gift' },
  { name: 'Rose 2.0',         url: '/__l5e/assets-v1/2438636f-4a8e-471c-9995-4cc8910c2b38/rose_2.0.0.svga',          type: 'Gift' },
  { name: 'Gradient Border',  url: '/__l5e/assets-v1/1611c987-f366-41dc-b390-87c737a6ab2f/gradientBorder.svga',      type: 'Frame' },
  { name: 'Alarm',            url: '/__l5e/assets-v1/35fe7eae-4cb4-4fb7-9f85-1cdac1b73335/alarm.svga',               type: 'Utility' },
  { name: 'Empty State',      url: '/__l5e/assets-v1/3ab8ef50-851b-4863-bfdd-9ba6d08110f0/EmptyState.svga',          type: 'Utility' },
  { name: 'Matte Bitmap',     url: '/__l5e/assets-v1/ef96fe71-5ee3-4641-95de-d6a2c717d23a/matteBitmap.svga',         type: 'Utility' },
  { name: 'Matte Bitmap 1.x', url: '/__l5e/assets-v1/d54468ee-2c79-4367-98b5-86053143bddf/matteBitmap_1.x.svga',     type: 'Utility' },
  { name: 'Matte Rect',       url: '/__l5e/assets-v1/1efc652c-fc42-4504-bd72-b959bef332e6/matteRect.svga',           type: 'Utility' },
  { name: 'MP3 Long',         url: '/__l5e/assets-v1/0b803367-2f74-4369-bd3f-a24920b76a0b/mp3_to_long.svga',         type: 'Utility' },
  { name: '750x80 Banner',    url: '/__l5e/assets-v1/8a8a355b-e64d-4a14-9d63-35fe39db19f7/750x80.svga',              type: 'Banner' },
];

function Page() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#1a0b2e] via-[#2d0b4d] to-black text-white p-4">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-2xl font-black text-center mb-2 bg-gradient-to-r from-yellow-300 via-pink-400 to-purple-400 bg-clip-text text-transparent">
          🎬 SVGA Preview — {items.length} Files
        </h1>
        <p className="text-center text-xs text-white/60 mb-6">
          svga/SVGAPlayer-Android sample repo. Jo pasand aayen batao, shop / DP frames me add kar dun.
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {items.map((f) => (
            <div key={f.url} className="rounded-2xl border border-white/10 bg-black/40 p-3 flex flex-col items-center">
              <div className="relative w-40 h-40 bg-gradient-to-br from-purple-900/40 to-black rounded-xl overflow-hidden flex items-center justify-center">
                <SvgaPlayer
                  src={f.url}
                  className="absolute inset-0"
                  style={{ width: '100%', height: '100%', pointerEvents: 'none' }}
                />
              </div>
              <div className="mt-2 text-sm font-bold text-center">{f.name}</div>
              <div className="text-[10px] uppercase tracking-widest text-yellow-300/80">{f.type}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
