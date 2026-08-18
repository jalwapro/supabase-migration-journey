import type { ComponentPropertyConfig, CSSLength } from "./property-schema";

const lengthPattern = /^-?\d+(\.\d+)?(px|%|vw|vh|rem|em)$/;

function validLength(value: CSSLength | undefined): boolean {
  return value === undefined || value === "auto" || typeof value === "number" || lengthPattern.test(value);
}

export interface PropertyValidation { critical: string[]; warnings: string[]; safe: ComponentPropertyConfig; }

export function validateComponentProperties(input: ComponentPropertyConfig): PropertyValidation {
  const critical: string[] = [];
  const warnings: string[] = [];
  const safe = structuredClone(input);

  if (!input.id || !input.type) critical.push("Component identity is missing.");
  if (!validLength(input.style.size.width)) { warnings.push("Invalid width; using auto."); safe.style.size.width = "auto"; }
  if (!validLength(input.style.size.height)) { warnings.push("Invalid height; using auto."); safe.style.size.height = "auto"; }
  if (safe.style.opacity < 0 || safe.style.opacity > 1 || Number.isNaN(safe.style.opacity)) { warnings.push("Invalid opacity; using 1."); safe.style.opacity = 1; }
  if (safe.style.rotation < -360 || safe.style.rotation > 360 || Number.isNaN(safe.style.rotation)) { warnings.push("Invalid rotation; using 0."); safe.style.rotation = 0; }
  if (safe.style.position.zIndex !== undefined && !Number.isFinite(safe.style.position.zIndex)) { warnings.push("Invalid z-index; using 0."); safe.style.position.zIndex = 0; }
  if (safe.interaction.actionType === "existing") safe.interaction.preserveExisting = true;
  if (safe.visibility === false && safe.interaction.actionType === "existing") warnings.push("An existing-action component is hidden; verify the flow before publishing.");

  return { critical, warnings, safe };
}
