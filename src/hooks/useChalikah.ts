import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface Chalikah {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export function useChalikah() {
  return useQuery({
    queryKey: ["chalikah"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chalikah")
        .select("*")
        .order("name");
      if (error) throw error;
      return data as Chalikah[];
    },
  });
}

export function useAddChalikah() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => {
      const { data, error } = await supabase.from("chalikah").insert({ name }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["chalikah"] });
      toast.success("Chalikah added");
    },
    onError: (e) => toast.error("Failed to add: " + e.message),
  });
}

export function useUpdateChalikah() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { data, error } = await supabase.from("chalikah").update({ name }).eq("id", id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["chalikah"] });
      toast.success("Chalikah updated");
    },
    onError: (e) => toast.error("Failed to update: " + e.message),
  });
}

export function useDeleteChalikah() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("chalikah").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["chalikah"] });
      toast.success("Chalikah deleted");
    },
    onError: (e) => toast.error("Failed to delete: " + e.message),
  });
}
