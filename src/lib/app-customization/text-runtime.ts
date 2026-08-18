import { applyTextOverrides, createTextOverrideMap, type TextOverride } from "./text-overrides";

let observer: MutationObserver | undefined;
let activeMap = new Map<string, string>();

export function installTextOverrideRuntime(
  overrides: TextOverride[],
  root: ParentNode = document.body,
) {
  activeMap = createTextOverrideMap(overrides);
  applyTextOverrides(root, activeMap);

  observer?.disconnect();
  observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of Array.from(mutation.addedNodes)) {
        if (node.nodeType !== Node.ELEMENT_NODE && node.nodeType !== Node.TEXT_NODE) continue;
        applyTextOverrides(node as ParentNode, activeMap);
      }
    }
  });
  observer.observe(root, { childList: true, subtree: true });

  return () => {
    observer?.disconnect();
    observer = undefined;
    activeMap = new Map();
  };
}

export function refreshTextOverrides(overrides: TextOverride[], root: ParentNode = document.body) {
  activeMap = createTextOverrideMap(overrides);
  return applyTextOverrides(root, activeMap);
}
