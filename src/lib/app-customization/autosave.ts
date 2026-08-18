export interface AutosaveController { schedule: (save: () => Promise<void> | void) => void; flush: () => Promise<void>; cancel: () => void; }
export function createAutosaveController(delayMs = 700): AutosaveController {
  let timer: ReturnType<typeof setTimeout> | null = null; let pending: Promise<void> = Promise.resolve(); let latest: (() => Promise<void> | void) | null = null;
  const schedule = (save: () => Promise<void> | void) => { latest = save; if (timer) clearTimeout(timer); timer = setTimeout(() => { timer = null; const fn = latest; latest = null; if (fn) pending = pending.then(() => Promise.resolve(fn())).catch(() => undefined); }, delayMs); };
  const flush = async () => { if (timer) { clearTimeout(timer); timer = null; } const fn = latest; latest = null; if (fn) pending = pending.then(() => Promise.resolve(fn())).catch(() => undefined); await pending; };
  const cancel = () => { if (timer) clearTimeout(timer); timer = null; latest = null; };
  return { schedule, flush, cancel };
}
