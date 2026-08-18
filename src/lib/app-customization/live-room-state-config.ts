import type { AppComponentNode, AppPageConfig } from "./schema";

export type LiveRoomStateConfig = {
  roomType: string;
  state: string;
  sections: AppComponentNode[];
  updatedAt: string;
};

const PREFIX = "live-room-state:";
const key = (roomType: string, state: string) => `${PREFIX}${roomType}:${state}`;

type ConfigWithState = AppPageConfig & { runtimeOverrides?: AppPageConfig["runtimeOverrides"] };

export function getLiveRoomStateConfig(config: AppPageConfig, roomType: string, state: string): LiveRoomStateConfig | null {
  const override = (config as ConfigWithState).runtimeOverrides?.find(x => x.selector === key(roomType, state));
  const content = override?.content as Partial<LiveRoomStateConfig> | undefined;
  return Array.isArray(content?.sections)
    ? { roomType, state, sections: structuredClone(content.sections), updatedAt: String(content.updatedAt ?? "") }
    : null;
}

export function saveLiveRoomStateConfig(config: AppPageConfig, roomType: string, state: string, sections: AppComponentNode[]): AppPageConfig {
  const next = structuredClone(config);
  const overrides = [...(next.runtimeOverrides ?? [])];
  const selector = key(roomType, state);
  const value = { roomType, state, sections: structuredClone(sections), updatedAt: new Date().toISOString() } satisfies LiveRoomStateConfig;
  const existing = overrides.findIndex(x => x.selector === selector);
  const item = { id: existing >= 0 ? overrides[existing].id : crypto.randomUUID(), selector, style: {}, visible: true, content: value };
  if (existing >= 0) overrides[existing] = item; else overrides.push(item);
  next.runtimeOverrides = overrides;
  return next;
}

export function removeLiveRoomStateConfig(config: AppPageConfig, roomType: string, state: string): AppPageConfig {
  const next = structuredClone(config);
  next.runtimeOverrides = (next.runtimeOverrides ?? []).filter(x => x.selector !== key(roomType, state));
  return next;
}
