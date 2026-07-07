// Permissive types for external Supabase. Regenerate with supabase CLI when access token is available.
export type Json = string | number | boolean | null | { [k: string]: Json } | Json[];
type Row = Record<string, any>;
type AnyTable = { Row: Row; Insert: Row; Update: Row; Relationships: [] };
export interface Database {
  public: {
    Tables: Record<string, AnyTable>;
    Views: Record<string, { Row: Row }>;
    Functions: Record<string, { Args: Record<string, any>; Returns: any }>;
    Enums: Record<string, string>;
    CompositeTypes: Record<string, Record<string, any>>;
  };
}
