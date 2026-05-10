import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { logAudit } from "@/lib/audit";

export interface SavedReport {
  id: string;
  name: string;
  report_type: string;
  filters: Record<string, any>;
  report_data: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export function useSavedReports() {
  return useQuery({
    queryKey: ["saved_reports"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("saved_reports")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as SavedReport[];
    },
  });
}

export function useSaveReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (report: {
      name: string;
      report_type: string;
      filters: Record<string, any>;
      report_data: Record<string, any>;
    }) => {
      const { data, error } = await supabase
        .from("saved_reports")
        .insert(report)
        .select()
        .single();
      if (error) throw error;
      await logAudit({ table: "saved_reports", action: "insert", recordId: data.id, after: data, summary: data.name });
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["saved_reports"] });
      toast.success("Report saved");
    },
    onError: (e) => toast.error("Failed to save report: " + e.message),
  });
}

export function useUpdateReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, name, filters, report_data, report_type }: { id: string; name?: string; filters?: Record<string, any>; report_data?: Record<string, any>; report_type?: string }) => {
      const { data: before } = await supabase.from("saved_reports").select("*").eq("id", id).single();
      const patch: Record<string, any> = {};
      if (name !== undefined) patch.name = name;
      if (filters !== undefined) patch.filters = filters;
      if (report_data !== undefined) patch.report_data = report_data;
      if (report_type !== undefined) patch.report_type = report_type;
      const { data, error } = await supabase
        .from("saved_reports")
        .update(patch)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      await logAudit({ table: "saved_reports", action: "update", recordId: id, before, after: data });
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["saved_reports"] });
      toast.success("Report updated");
    },
    onError: (e) => toast.error("Failed to update: " + e.message),
  });
}

export function useDeleteReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data: before } = await supabase.from("saved_reports").select("*").eq("id", id).single();
      const { error } = await supabase.from("saved_reports").delete().eq("id", id);
      if (error) throw error;
      await logAudit({ table: "saved_reports", action: "delete", recordId: id, before });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["saved_reports"] });
      toast.success("Report deleted");
    },
    onError: (e) => toast.error("Failed to delete report: " + e.message),
  });
}
