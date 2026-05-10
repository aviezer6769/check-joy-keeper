import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { logAudit } from "@/lib/audit";

export interface Payee {
  id: string;
  record_id: string | null;
  sort_order: number;
  urgent_level: number;
  title_1_yiddish: string | null;
  first_name_yiddish: string | null;
  middle_name_yiddish: string | null;
  last_name_yiddish: string | null;
  title_2_yiddish: string | null;
  title: string | null;
  title_to_use: string | null;
  first_name: string | null;
  middle_name: string | null;
  last_name: string | null;
  street_no: string | null;
  street_name: string | null;
  apt: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  payee_name: string;
  is_active: boolean;
  memo: string | null;
  phone: string | null;
  created_at: string;
  updated_at: string;
}

export type PayeeInsert = Omit<Payee, "id" | "created_at" | "updated_at">;

export function usePayees(search?: string) {
  return useQuery({
    queryKey: ["payees", search],
    queryFn: async () => {
      let query = supabase
        .from("payees")
        .select("*")
        .order("sort_order", { ascending: true })
        .order("payee_name", { ascending: true });

      if (search) {
        query = query.or(
          `payee_name.ilike.%${search}%,record_id.ilike.%${search}%,first_name.ilike.%${search}%,last_name.ilike.%${search}%,first_name_yiddish.ilike.%${search}%,last_name_yiddish.ilike.%${search}%`
        );
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Payee[];
    },
  });
}

export function useAddPayee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payee: PayeeInsert) => {
      const { data, error } = await supabase.from("payees").insert(payee).select().single();
      if (error) throw error;
      await logAudit({ table: "payees", action: "insert", recordId: data.id, after: data });
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payees"] });
      toast.success("Payee added successfully");
    },
    onError: (e: Error) => toast.error("Failed to add payee: " + e.message),
  });
}

export function useUpdatePayee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payee }: Partial<Payee> & { id: string }) => {
      const { data: before } = await supabase.from("payees").select("*").eq("id", id).single();
      const { data, error } = await supabase.from("payees").update(payee).eq("id", id).select().single();
      if (error) throw error;
      await logAudit({ table: "payees", action: "update", recordId: id, before, after: data });
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payees"] });
      toast.success("Payee updated");
    },
    onError: (e: Error) => toast.error("Failed to update payee: " + e.message),
  });
}

export function useDeletePayee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data: before } = await supabase.from("payees").select("*").eq("id", id).single();
      const { error } = await supabase.from("payees").delete().eq("id", id);
      if (error) throw error;
      await logAudit({ table: "payees", action: "delete", recordId: id, before });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payees"] });
      toast.success("Payee deleted");
    },
    onError: (e: Error) => toast.error("Failed to delete payee: " + e.message),
  });
}
