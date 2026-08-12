import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { loadPublishedRoomLayout } from '@/lib/published-room-layout';
import type { LayoutJSON, RoomType } from '@/lib/room-layouts';

type Props = { roomType: RoomType; children: ReactNode; className?: string };

export function RoomLayoutRuntime({ roomType, children, className = '' }: Props) {
  const [layout, setLayout] = useState<LayoutJSON | null>(null);
  useEffect(() => {
    let active = true;
    const load = () => loadPublishedRoomLayout(roomType).then((value) => active && setLayout(value));
    load();
    const onPublished = () => load();
    window.addEventListener('jalwa:room-layout-published', onPublished);
    return () => { active = false; window.removeEventListener('jalwa:room-layout-published', onPublished); };
  }, [roomType]);

  const style = layout ? { '--room-layout-width': `${layout.canvas.width}px`, '--room-layout-height': `${layout.canvas.height}px` } as CSSProperties : undefined;

  return <div className={`relative min-h-full w-full ${className}`} style={style} data-room-layout={roomType} data-layout-loaded={Boolean(layout)}>
    {children}
    {layout && <div className="pointer-events-none absolute inset-0" aria-hidden="true">
      {layout.elements.filter((e) => e.visible !== false).map((element) => <div key={element.id} data-layout-element={element.id} className="absolute" style={{ left: `${element.x}px`, top: `${element.y}px`, width: `${element.width}px`, height: `${element.height}px`, zIndex: element.zIndex ?? 1 }} />)}
    </div>}
  </div>;
}
