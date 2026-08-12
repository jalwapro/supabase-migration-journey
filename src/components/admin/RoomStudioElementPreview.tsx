import type { LayoutElement, RoomType } from '@/lib/room-layouts';

export function RoomStudioElementPreview({ element, roomType, interactive = false }: { element: LayoutElement; roomType: RoomType; interactive?: boolean }) {
  const common = 'w-full h-full overflow-hidden';
  switch (element.type) {
    case 'room-header':
      return <div className={`${common} flex items-center justify-between px-3 bg-black/35 backdrop-blur border-b border-white/10`}><div className="flex items-center gap-2"><div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-400 to-pink-500"/><div><div className="text-white text-xs font-semibold">Live Room</div><div className="text-white/40 text-[9px]">12.4K online</div></div></div><div className="flex gap-1"><span className="px-2 py-1 rounded-full bg-white/10 text-white/70 text-[9px]">Follow</span><span className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-white">•••</span></div></div>;
    case 'room-announcement':
    case 'room-title':
      return <div className={`${common} flex items-center px-3 bg-white/5`}><span className="text-[10px] text-white/70">🔥 Welcome to the room • Enjoy the live session</span></div>;
    case 'host-avatar':
      return <div className={`${common} flex flex-col items-center justify-center`}><div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-400 to-pink-500 ring-2 ring-white/20"/><span className="text-white text-[10px] mt-1">Host</span></div>;
    case 'seat':
      return <div className={`${common} rounded-xl bg-white/[0.06] border border-white/10 flex flex-col items-center justify-center relative`}><span className="absolute top-1 left-1 text-[8px] text-white/35">Seat {String(element.data?.seatNumber ?? '').padStart(2, '0')}</span><div className="w-11 h-11 rounded-full bg-gradient-to-br from-slate-400 to-slate-700 ring-2 ring-white/10"/><span className="text-[9px] text-white/60 mt-1">Available</span><span className="text-[8px] text-white/30">🎙</span></div>;
    case 'seat-avatar':
      return <div className={`${common} flex items-center justify-center`}><div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-400 to-blue-600"/></div>;
    case 'seat-lock':
      return <div className={`${common} flex items-center justify-center text-white/70`}>🔒</div>;
    case 'mic-icon':
      return <div className={`${common} flex items-center justify-center text-white`}>🎙</div>;
    case 'chat-panel':
      return <div className={`${common} rounded-xl bg-black/35 backdrop-blur border border-white/10 p-2`}><div className="text-white/50 text-[8px] mb-1">Live chat</div><div className="space-y-1"><div className="text-[8px] text-white/75"><b className="text-pink-300">Ahsan</b> Welcome everyone 👋</div><div className="text-[8px] text-white/65"><b className="text-cyan-300">Sara</b> Nice room!</div><div className="text-[8px] text-white/60"><b className="text-purple-300">Ali</b> ❤️❤️❤️</div></div></div>;
    case 'chat-message':
      return <div className={`${common} flex items-center px-2 text-[9px] text-white/70`}>Ahsan: Welcome 👋</div>;
    case 'gift-button':
    case 'send-gift-button':
      return <div className={`${common} rounded-full bg-gradient-to-r from-pink-500 to-purple-600 flex items-center justify-center text-white font-semibold text-[10px]`}>🎁 Gift</div>;
    case 'gift-panel':
      return <div className={`${common} rounded-xl bg-black/40 border border-white/10 p-2 flex gap-1 items-end justify-center`}><span>🌹</span><span>💎</span><span>🚀</span><span>👑</span></div>;
    case 'coin-balance':
      return <div className={`${common} flex items-center justify-center rounded-full bg-black/30 text-yellow-300 text-[9px]`}>🪙 12,450</div>;
    case 'follow-button':
      return <div className={`${common} rounded-full bg-white/10 flex items-center justify-center text-white text-[9px]`}>+ Follow</div>;
    case 'share-button':
      return <div className={`${common} flex items-center justify-center text-white text-sm`}>↗</div>;
    case 'more-button':
      return <div className={`${common} flex items-center justify-center text-white text-sm`}>•••</div>;
    case 'settings-button':
      return <div className={`${common} flex items-center justify-center text-white text-sm`}>⚙</div>;
    case 'bottom-toolbar':
      return <div className={`${common} flex items-center justify-around bg-black/45 border-t border-white/10`}><span>🎙</span><span>🎮</span><span>🎁</span><span>✨</span><span>⚙</span></div>;
    case 'beauty-filter-button': return <div className={`${common} flex items-center justify-center text-white text-sm`}>✨</div>;
    case 'game-button': return <div className={`${common} flex items-center justify-center text-white text-sm`}>🎮</div>;
    case 'pk-button': return <div className={`${common} rounded-full bg-red-500/80 flex items-center justify-center text-white text-[9px] font-bold`}>PK</div>;
    case 'video-participant':
    case 'video-frame':
      return <div className={`${common} relative rounded-xl bg-gradient-to-br from-slate-700 via-slate-900 to-black border border-white/10`}><div className="absolute inset-0 flex items-center justify-center"><div className="w-16 h-16 rounded-full bg-gradient-to-br from-orange-300 to-red-600"/></div><div className="absolute left-2 bottom-2 text-[9px] text-white">User {element.id.split('-').pop()}</div><span className="absolute right-2 bottom-2 text-[9px]">🎙</span></div>;
    case 'pk-player':
      return <div className={`${common} relative rounded-xl bg-gradient-to-br from-purple-700/40 to-pink-600/20 border border-white/10`}><div className="absolute inset-0 flex items-center justify-center"><div className="w-14 h-14 rounded-full bg-gradient-to-br from-purple-300 to-fuchsia-600"/></div><div className="absolute left-2 bottom-2 text-[9px] text-white">Player</div></div>;
    case 'pk-vs-logo': return <div className={`${common} flex items-center justify-center text-white font-black italic text-lg`}>VS</div>;
    case 'pk-score-bar': return <div className={`${common} rounded-full bg-white/10 overflow-hidden`}><div className="h-full w-2/3 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full"/></div>;
    case 'pk-progress-bar': return <div className={`${common} rounded-full bg-white/10 overflow-hidden`}><div className="h-full w-1/2 bg-gradient-to-r from-cyan-400 to-purple-500 rounded-full"/></div>;
    case 'pk-timer': return <div className={`${common} flex items-center justify-center rounded-full bg-black/50 border border-white/10 text-white font-bold text-xs">02:34</div>;
    case 'pk-gift-score': return <div className={`${common} flex items-center justify-center text-yellow-300 text-[9px]">🎁 8,240</div>;
    case 'pk-coin-score': return <div className={`${common} flex items-center justify-center text-yellow-300 text-[9px]">🪙 24,500</div>;
    case 'pk-battle-status': return <div className={`${common} flex items-center justify-center rounded-full bg-red-500/20 text-red-300 text-[9px]">BATTLE LIVE</div>;
    case 'pk-winner-area': return <div className={`${common} flex items-center justify-center text-yellow-300 text-xs font-bold`}>🏆 WINNER</div>;
    case 'custom-text':
      return <div className={`${common} flex items-center px-2`} style={{ color: element.style?.color || '#fff', fontSize: element.style?.fontSize || 14, fontWeight: element.style?.fontWeight || '400', textAlign: element.style?.textAlign || 'left' }}>{String(element.data?.text ?? 'Your text')}</div>;
    case 'custom-image':
      return element.data?.src ? <img src={String(element.data.src)} alt="Custom" className="w-full h-full object-cover" /> : <div className={`${common} flex items-center justify-center bg-white/5 text-white/40 text-[9px]`}>🖼 Custom Image</div>;
    case 'badge': return <div className={`${common} rounded-full bg-purple-500/80 flex items-center justify-center text-white text-[9px]`}>NEW</div>;
    case 'divider': return <div className="w-full h-px bg-white/20" />;
    case 'overlay': return <div className="w-full h-full bg-black/30" />;
    case 'gradient': return <div className="w-full h-full bg-gradient-to-br from-purple-500/30 to-pink-500/30" />;
    case 'decorative-element': return <div className={`${common} flex items-center justify-center text-2xl`}>✦</div>;
    case 'frame': return <div className="w-full h-full border-2 border-purple-400/60 rounded-xl" />;
    case 'gif-animation': return <div className={`${common} flex items-center justify-center text-2xl`}>✨</div>;
    case 'room-id': return <div className={`${common} flex items-center justify-center text-white/50 text-[8px]`}>ID: 123456</div>;
    case 'host-name': return <div className={`${common} flex items-center text-white text-[10px]`}>Host</div>;
    case 'user-name': return <div className={`${common} flex items-center text-white text-[9px]`}>Username</div>;
    case 'user-level': return <div className={`${common} flex items-center justify-center text-yellow-300 text-[8px]`}>Lv. 28</div>;
    case 'online-indicator': return <div className={`${common} flex items-center justify-center`}><span className="w-2 h-2 rounded-full bg-green-400"/></div>;
    default: return <div className={`${common} flex items-center justify-center text-white/50 text-[9px]`}>{element.type}</div>;
  }
}
