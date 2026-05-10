import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AuditLog {
  id: string;
  table_name: string;
  record_id: string | null;
  action: "insert" | "update" | "delete";
  changes: Record<string, any>;
  source: string | null;
  summary: string | null;
  created_at: string;
}

interface Filters {
  table?: string;
  action?: string;
  recordId?: string;
  search?: string;
  fromDate?: string;
  toDate?: string;
  limit?: number;
}

export function useAuditLogs(filters: Filters = {}) {
  return useQuery({
    queryKey: ["audit_logs", filters],
    queryFn: async () => {
      let q = supabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(filters.limit ?? 500);
      if (filters.table) q = q.eq("table_name", filters.table);
      if (filters.action) q = q.eq("action", filters.action);
      if (filters.recordId) q = q.eq("record_id", filters.recordId);
      if (filters.fromDate) q = q.gte("created_at", filters.fromDate);
      if (filters.toDate) q = q.lte("created_at", filters.toDate);
      if (filters.search) {
        q = q.or(
          `source.ilike.%${filters.search}%,summary.ilike.%${filters.search}%,record_id.ilike.%${filters.search}%`,
        );
      }
      const { data, error } = await q;
      if (error) throw error;
      return data as AuditLog[];
    },
  });
}

export function useRecordHistory(table: string, recordId: string | null | undefined) {
  return useQuery({
    queryKey: ["audit_logs", "record", table, recordId],
    enabled: !!recordId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("*")
        .eq("table_name", table)
        .eq("record_id", recordId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as AuditLog[];
    },
  });
}
