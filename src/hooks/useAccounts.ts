import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface Account {
  id: string;
  account_name: string;
  bank_name: string | null;
  account_number: string | null;
  routing_number: string | null;
  payer_name: string | null;
  payer_address: string | null;
  payer_city: string | null;
  payer_state: string | null;
  payer_zip: string | null;
  payer_phone: string | null;
  payer_name_yiddish: string | null;
  check_payer_name: string | null;
  stub_payer_name: string | null;
  created_at: string;
  updated_at: string;
}

export function useAccounts() {
  return useQuery({
    queryKey: ["accounts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("accounts")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as Account[];
    },
  });
}

export function useUpdateAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Account> & { id: string }) => {
      const { data, error } = await supabase.from("accounts").update(updates).eq("id", id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["accounts"] });
      toast.success("Account updated");
    },
    onError: (e: Error) => toast.error("Failed to update account: " + e.message),
  });
}
