import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useUpdatePayee, type Payee } from "@/hooks/usePayees";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface FieldDef {
  key: keyof Omit<Payee, "id" | "created_at" | "updated_at">;
  label: string;
  dir?: "rtl";
  type?: "number";
}

const FIELDS: FieldDef[] = [
  { key: "sort_order", label: "Sort Order", type: "number" },
  { key: "urgent_level", label: "Urgent Level", type: "number" },
  { key: "title", label: "Title" },
  { key: "title_to_use", label: "TitleToUse" },
  { key: "city", label: "City" },
  { key: "state", label: "State" },
  { key: "zip", label: "Zip" },
];

interface PayeeBulkEditProps {
  payees: Payee[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}

export function PayeeBulkEdit({ payees, open, onOpenChange, onDone }: PayeeBulkEditProps) {
  const [enabledFields, setEnabledFields] = useState<Set<string>>(new Set());
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const qc = useQueryClient();

  const toggleField = (key: string) => {
    setEnabledFields((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (enabledFields.size === 0) {
      toast.error("Select at least one field to update");
      return;
    }

    const updates: Record<string, any> = {};
    enabledFields.forEach((key) => {
      const field = FIELDS.find((f) => f.key === key);
      const val = values[key] || "";
      updates[key] = field?.type === "number" ? Number(val) || 0 : val || null;
    });

    setSaving(true);
    const ids = payees.map((p) => p.id);
    const { error } = await supabase.from("payees").update(updates).in("id", ids);
    setSaving(false);

    if (error) {
      toast.error("Bulk update failed: " + error.message);
    } else {
      toast.success(`Updated ${payees.length} payee(s)`);
      qc.invalidateQueries({ queryKey: ["payees"] });
      onDone();
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Bulk Edit {payees.length} Payee(s)</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Check the fields you want to update. The new value will be applied to all selected payees.
        </p>
        <form onSubmit={handleSubmit} className="space-y-3 pt-2">
          {FIELDS.map((f) => (
            <div key={f.key} className="flex items-center gap-3">
              <Checkbox
                checked={enabledFields.has(f.key)}
                onCheckedChange={() => toggleField(f.key)}
                id={`bulk-${f.key}`}
              />
              <Label htmlFor={`bulk-${f.key}`} className="text-sm w-24 shrink-0" dir={f.dir}>
                {f.label}
              </Label>
              <Input
                dir={f.dir}
                type={f.type === "number" ? "number" : "text"}
                value={values[f.key] ?? ""}
                onChange={(e) => setValues((prev) => ({ ...prev, [f.key]: e.target.value }))}
                placeholder={f.label}
                disabled={!enabledFields.has(f.key)}
                className="h-8 text-sm"
              />
            </div>
          ))}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || enabledFields.size === 0}>
              {saving ? "Updating..." : "Update All"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
