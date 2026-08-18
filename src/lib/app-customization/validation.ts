import type { AppComponentNode, AppPageConfig } from "./schema";
import { validatePageConfig } from "./schema";

export interface ValidationIssue { severity: "warning" | "error"; code: string; message: string; componentId?: string; }

export function validateForPublish(config: AppPageConfig): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const result = validatePageConfig(config);
  result.errors.forEach(message => issues.push({ severity: "error", code: "SCHEMA_ERROR", message }));
  result.warnings.forEach(message => issues.push({ severity: "warning", code: "SCHEMA_WARNING", message }));

  const walk = (nodes: AppComponentNode[]) => nodes.forEach(node => {
    const style = node.style ?? {};
    if (typeof style.width === "number" && style.width > 10000) issues.push({ severity: "error", code: "WIDTH_OUT_OF_RANGE", message: `Width is too large for ${node.name ?? node.id}.`, componentId: node.id });
    if (typeof style.height === "number" && style.height > 10000) issues.push({ severity: "error", code: "HEIGHT_OUT_OF_RANGE", message: `Height is too large for ${node.name ?? node.id}.`, componentId: node.id });
    if (node.type === "button" && node.visible !== false && !node.props?.text && !node.props?.label && !node.binding) issues.push({ severity: "warning", code: "BUTTON_LABEL_MISSING", message: `Button ${node.name ?? node.id} has no configured label.`, componentId: node.id });
    if (node.children) walk(node.children);
  });
  walk(config.sections);
  return issues;
}

export function canPublish(config: AppPageConfig) { return !validateForPublish(config).some(issue => issue.severity === "error"); }
