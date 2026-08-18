export const EDITOR_SHORTCUTS = {
  undo: "Ctrl+Z",
  redo: "Ctrl+Shift+Z",
  copy: "Ctrl+C",
  paste: "Ctrl+V",
  duplicate: "Ctrl+D",
  save: "Ctrl+S",
  group: "Ctrl+G",
  ungroup: "Ctrl+Shift+G",
  delete: "Delete",
} as const;

export function isTypingTarget(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  if (!el) return false;
  return el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable;
}

export function matchesShortcut(event: KeyboardEvent, shortcut: keyof typeof EDITOR_SHORTCUTS) {
  if (isTypingTarget(event.target)) return false;
  const key = event.key.toLowerCase();
  switch (shortcut) {
    case "undo": return event.ctrlKey && !event.shiftKey && key === "z";
    case "redo": return event.ctrlKey && event.shiftKey && key === "z";
    case "copy": return event.ctrlKey && key === "c";
    case "paste": return event.ctrlKey && key === "v";
    case "duplicate": return event.ctrlKey && key === "d";
    case "save": return event.ctrlKey && key === "s";
    case "group": return event.ctrlKey && !event.shiftKey && key === "g";
    case "ungroup": return event.ctrlKey && event.shiftKey && key === "g";
    case "delete": return key === "delete" || key === "backspace";
  }
}
