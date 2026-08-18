export type StudioVersionStatus = "draft" | "published" | "archived";
export interface StudioVersion<T = unknown> { id: string; projectId: string; version: number; status: StudioVersionStatus; snapshot: T; createdAt: string; createdBy?: string; summary?: string; }

export function nextVersionNumber(versions: StudioVersion[]): number { return versions.reduce((max, item) => Math.max(max, item.version), 0) + 1; }
export function createSnapshot<T>(projectId: string, snapshot: T, versions: StudioVersion[], createdBy?: string, summary?: string): StudioVersion<T> { return { id: crypto.randomUUID(), projectId, version: nextVersionNumber(versions), status: "draft", snapshot: structuredClone(snapshot), createdAt: new Date().toISOString(), createdBy, summary }; }
export function markPublished<T>(version: StudioVersion<T>): StudioVersion<T> { return { ...version, status: "published" }; }
export function archivePublished<T>(versions: StudioVersion<T>[], exceptId: string) { return versions.map(item => item.id === exceptId ? item : item.status === "published" ? { ...item, status: "archived" as const } : item); }
export function latestPublished<T>(versions: StudioVersion<T>[]) { return [...versions].filter(item => item.status === "published").sort((a,b) => b.version-a.version)[0] ?? null; }
export function rollbackTo<T>(versions: StudioVersion<T>[], version: number) { return [...versions].find(item => item.version === version) ?? null; }
