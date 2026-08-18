import type { AppPageConfig } from "./schema";
import { canPublish, validateForPublish, type ValidationIssue } from "./validation";
import { createSnapshot, markPublished, archivePublished, type StudioVersion } from "./version-manager";

export interface PublishResult { ok: boolean; issues: ValidationIssue[]; version?: StudioVersion<AppPageConfig>; versions: StudioVersion<AppPageConfig>[]; }

export function publishConfig(projectId: string, config: AppPageConfig, versions: StudioVersion<AppPageConfig>[], createdBy?: string, summary = "Published App Studio design"): PublishResult {
  const issues = validateForPublish(config);
  if (!canPublish(config)) return { ok: false, issues, versions };
  const draft = createSnapshot(projectId, config, versions, createdBy, summary);
  const published = markPublished(draft);
  return { ok: true, issues, version: published, versions: [...archivePublished(versions, published.id), published] };
}
