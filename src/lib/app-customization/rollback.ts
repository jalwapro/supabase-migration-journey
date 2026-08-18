import { supabase } from "@/integrations/supabase/client";

export type PublishedVersion = {
  id: string;
  page_id: string;
  version_id: string;
  version: number;
  config: unknown;
  published_at: string;
  is_current: boolean;
};

/**
 * Returns published snapshots for one Studio page, newest first.
 * This intentionally reads snapshots, not drafts, so rollback can only
 * restore a configuration that was previously live.
 */
export async function listPublishedVersions(pageId: string) {
  const { data, error } = await supabase
    .from("app_customization_published")
    .select("id,page_id,version_id,version,config,published_at,is_current")
    .eq("page_id", pageId)
    .order("version", { ascending: false });

  if (error) throw error;
  return (data ?? []) as PublishedVersion[];
}

/**
 * Atomically switches the page's current published snapshot to an existing
 * published version. The database function enforces admin authorization and
 * performs the current-row switch in one transaction.
 */
export async function rollbackPublishedVersion(pageId: string, version: number) {
  const { data, error } = await supabase.rpc("rollback_app_customization_version", {
    p_page_id: pageId,
    p_version: version,
  });

  if (error) throw error;
  return data as PublishedVersion;
}
