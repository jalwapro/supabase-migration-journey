import type { AppComponentNode, AppPageConfig } from "./schema";
import { validatePageConfig } from "./schema";

export interface ValidationIssue { severity: "warning" | "error"; code: string; message: string; componentId?: string; }

export function validateForPublish(config: AppPageConfig): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const result = validatePageConfig(config);
  result.errors.forEach(message => issues.push({ severity: "error", code: "SCHEMA_ERROR", message }));
  result.warnings.forEach(message => issues.push({ severity: "warning", code: "SCHEMA_WARNING", message }));

  const ids = new Set<string>();
  const walk = (nodes: AppComponentNode[]) => nodes.forEach(node => {
    if (ids.has(node.id)) issues.push({ severity: "error", code: "DUPLICATE_COMPONENT_ID", message: `Duplicate component id: ${node.id}.`, componentId: node.id });
    ids.add(node.id);
    const style = node.style ?? {};
    if (typeof style.width === "number" && (style.width < 0 || style.width > 10000)) issues.push({ severity: "error", code: "WIDTH_OUT_OF_RANGE", message: `Width is invalid for ${node.name ?? node.id}.`, componentId: node.id });
    if (typeof style.height === "number" && (style.height < 0 || style.height > 10000)) issues.push({ severity: "error", code: "HEIGHT_OUT_OF_RANGE", message: `Height is invalid for ${node.name ?? node.id}.`, componentId: node.id });
    if (node.type === "button" && node.visible !== false && !node.props?.text && !node.props?.label && !node.binding) issues.push({ severity: "warning", code: "BUTTON_LABEL_MISSING", message: `Button ${node.name ?? node.id} has no configured label.`, componentId: node.id });
    if (node.children) walk(node.children);
  });
  walk(config.sections);
  return issues;
}

export function canPublish(config: AppPageConfig) { return !validateForPublish(config).some(issue => issue.severity === "error"); }
export function summarizeValidation(config: AppPageConfig) {
  const issues = validateForPublish(config);
  return { errors: issues.filter(i => i.severity === "error").length, warnings: issues.filter(i => i.severity === "warning").length, canPublish: !issues.some(i => i.severity === "error") };
}
