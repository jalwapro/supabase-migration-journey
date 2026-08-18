import type { AppPageConfig } from "./schema";

export type EditorHistory = { past: AppPageConfig[]; present: AppPageConfig; future: AppPageConfig[] };

export function createEditorHistory(initial: AppPageConfig): EditorHistory { return { past: [], present: initial, future: [] }; }
export function pushEditorHistory(state: EditorHistory, next: AppPageConfig): EditorHistory { return { past: [...state.past.slice(-49), state.present], present: next, future: [] }; }
export function undoEditorHistory(state: EditorHistory): EditorHistory { const previous = state.past.at(-1); return previous ? { past: state.past.slice(0, -1), present: previous, future: [state.present, ...state.future].slice(0, 50) } : state; }
export function redoEditorHistory(state: EditorHistory): EditorHistory { const next = state.future[0]; return next ? { past: [...state.past, state.present].slice(-50), present: next, future: state.future.slice(1) } : state; }
