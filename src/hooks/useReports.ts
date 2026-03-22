import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { data, error } = await supabase
        .from("saved_reports")
        .update({ name })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["saved_reports"] });
      toast.success("Report renamed");
    },
    onError: (e) => toast.error("Failed to rename: " + e.message),
  });
}

export function useDeleteReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("saved_reports").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["saved_reports"] });
      toast.success("Report deleted");
    },
    onError: (e) => toast.error("Failed to delete report: " + e.message),
  });
}
