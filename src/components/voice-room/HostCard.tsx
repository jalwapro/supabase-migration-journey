import React, { useMemo } from "react";
import { RoomParticipant } from "@/types/room";
import { NeonBorder } from "@/components/room-shared/PremiumStyles";
import { motion } from "framer-motion";

export const HostCard = ({ host }: { host: RoomParticipant }) => {
  const bars = useMemo(() => Array.from({ length: 24 }).map((_, i) => i), []);

  return (
    <div className="flex flex-col items-center py-6">
      <div className="relative">
        {/* Crown */}
        <div className="absolute -top-10 left-1/2 z-10 -translate-x-1/2">
          <motion.div
            animate={{ y: [0, -5, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            className="text-4xl drop-shadow-[0_0_10px_rgba(251,191,36,0.6)]"
          >
            👑
          </motion.div>
        </div>

        {/* Avatar with Neon Ring */}
        <div className="relative">
          <NeonBorder color="primary" className="p-1">
            <div className="h-40 w-40 overflow-hidden rounded-full border-4 border-black/40 bg-zinc-900 shadow-2xl">
              {host.avatar ? (
                <img src={host.avatar} alt={host.username} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-5xl font-black text-white/20">
                  {host.username[0]}
                </div>
              )}
            </div>
          </NeonBorder>

          {/* Audio Visualizer Waveform */}
          <div className="absolute -bottom-4 left-1/2 flex -translate-x-1/2 items-end gap-[2px]">
            {bars.map((i) => (
              <motion.div
                key={i}
                className="w-[3px] rounded-full bg-gradient-to-t from-fuchsia-500 to-purple-400"
                animate={{
                  height: [8, Math.random() * 30 + 10, 8],
                }}
                transition={{
                  duration: 0.5 + Math.random() * 0.5,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="mt-8 flex flex-col items-center gap-1 text-center">
        <h2 className="text-xl font-black tracking-tight text-white drop-shadow-md">
          {host.username}
        </h2>
        <div className="flex items-center gap-2">
          <div className="rounded-full bg-gradient-to-r from-amber-400 to-yellow-600 px-3 py-0.5 text-[10px] font-black uppercase text-black ring-1 ring-white/20">
            Lv.{host.level}
          </div>
          <div className="rounded-full bg-black/40 px-3 py-0.5 text-[10px] font-bold text-white/60 backdrop-blur-md">
            ID: {host.id.slice(0, 8)}
          </div>
        </div>
      </div>
    </div>
  );
};
