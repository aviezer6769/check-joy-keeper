import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface Check {
  id: string;
  payee: string;
  amount: number;
  check_number: string | null;
  check_date: string;
  charity: string | null;
  check_given: boolean;
  memo: string | null;
  payee_record_number: string | null;
  created_at: string;
  updated_at: string;
}

export type CheckInsert = Omit<Check, "id" | "created_at" | "updated_at">;

export function useChecks(search?: string) {
  return useQuery({
    queryKey: ["checks", search],
    queryFn: async () => {
      let query = supabase
        .from("checks")
        .select("*")
        .order("check_date", { ascending: false });

      if (search) {
        query = query.or(
          `payee.ilike.%${search}%,check_number.ilike.%${search}%,memo.ilike.%${search}%,charity.ilike.%${search}%`
        );
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Check[];
    },
  });
}

export function useAddCheck() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (check: CheckInsert) => {
      const { data, error } = await supabase.from("checks").insert(check).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["checks"] });
      toast.success("Check added successfully");
    },
    onError: (e) => toast.error("Failed to add check: " + e.message),
  });
}

export function useUpdateCheck() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...check }: Partial<Check> & { id: string }) => {
      const { data, error } = await supabase.from("checks").update(check).eq("id", id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["checks"] });
      toast.success("Check updated");
    },
    onError: (e) => toast.error("Failed to update: " + e.message),
  });
}

export function useDeleteCheck() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("checks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["checks"] });
      toast.success("Check deleted");
    },
    onError: (e) => toast.error("Failed to delete: " + e.message),
  });
}
