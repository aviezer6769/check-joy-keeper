import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUpdatePayee, useDeletePayee, usePayees, type Payee } from "@/hooks/usePayees";
import { Trash2 } from "lucide-react";
import { buildPayeeName } from "@/lib/payee-utils";
import { FieldSuggestInput } from "@/components/FieldSuggestInput";

interface FieldDef {
  key: keyof Omit<Payee, "id" | "created_at" | "updated_at">;
  label: string;
  dir?: "rtl";
  type?: "number";
}

const FIELDS: FieldDef[] = [
  { key: "record_id", label: "Record ID" },
  { key: "sort_order", label: "Sort Order", type: "number" },
  { key: "urgent_level", label: "Urgent Level", type: "number" },
  { key: "title_1_yiddish", label: "טיטל 1", dir: "rtl" },
  { key: "first_name_yiddish", label: "ערשטע נאמען", dir: "rtl" },
  { key: "middle_name_yiddish", label: "מיטעלסטע", dir: "rtl" },
  { key: "last_name_yiddish", label: "לעצטע", dir: "rtl" },
  { key: "title_2_yiddish", label: "טיטל 2", dir: "rtl" },
  { key: "title", label: "Title" },
  { key: "title_to_use", label: "TitleToUse" },
  { key: "first_name", label: "First Name" },
  { key: "middle_name", label: "Middle Name" },
  { key: "last_name", label: "Last Name" },
  { key: "street_no", label: "Street #" },
  { key: "street_name", label: "Street Name" },
  { key: "apt", label: "Apt" },
  { key: "city", label: "City" },
  { key: "state", label: "State" },
  { key: "zip", label: "Zip" },
];

interface PayeeEditFormProps {
  payee: Payee;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PayeeEditForm({ payee, open, onOpenChange }: PayeeEditFormProps) {
  const [form, setForm] = useState<Record<string, any>>({ ...payee });
  const updatePayee = useUpdatePayee();
  const deletePayee = useDeletePayee();
  const { data: allPayees = [] } = usePayees();

  const suggestionsByField = useMemo(() => {
    const map: Record<string, string[]> = {};
    FIELDS.forEach((f) => {
      if (f.type !== "number") {
        map[f.key] = allPayees.map((p) => (p as any)[f.key]).filter(Boolean) as string[];
      }
    });
    return map;
  }, [allPayees]);

  const handleChange = (key: string, value: string) => {
    setForm((prev) => ({
      ...prev,
      [key]: key === "sort_order" || key === "urgent_level" ? Number(value) || 0 : value || null,
    }));
  };

  const computedName = buildPayeeName(form);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!computedName) return;
    const { id, created_at, updated_at, ...rest } = form;
    updatePayee.mutate(
      { id: payee.id, ...rest, payee_name: computedName },
      { onSuccess: () => onOpenChange(false) }
    );
  };

  const handleDelete = () => {
    if (!confirm("Delete this payee?")) return;
    deletePayee.mutate(payee.id, { onSuccess: () => onOpenChange(false) });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Payee</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-3 pt-2">
          <div className="col-span-2">
            <Label className="text-xs mb-1 block">Payee Name (auto-generated)</Label>
            <Input value={computedName} readOnly disabled className="bg-muted" />
          </div>
          {FIELDS.map((f) => (
            <div key={f.key}>
              <Label className="text-xs mb-1 block" dir={f.dir}>
                {f.label}
              </Label>
              {f.type === "number" ? (
                <Input
                  type="number"
                  value={(form[f.key] as number) ?? 0}
                  onChange={(e) => handleChange(f.key, e.target.value)}
                  placeholder={f.label}
                />
              ) : (
                <FieldSuggestInput
                  dir={f.dir}
                  value={(form[f.key] as string) ?? ""}
                  onChange={(v) => handleChange(f.key, v)}
                  suggestions={suggestionsByField[f.key] || []}
                  placeholder={f.label}
                />
              )}
            </div>
          ))}
          <div className="col-span-2 flex items-center gap-3 pt-1">
            <Switch
              checked={form.is_active ?? true}
              onCheckedChange={(v) => setForm((prev) => ({ ...prev, is_active: v }))}
              id="is-active"
            />
            <Label htmlFor="is-active" className="text-sm">Active</Label>
          </div>
          <div className="col-span-2 flex justify-between pt-2">
            <Button type="button" variant="destructive" size="sm" onClick={handleDelete} disabled={deletePayee.isPending}>
              <Trash2 className="h-4 w-4 mr-1" /> Delete
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={updatePayee.isPending}>
                {updatePayee.isPending ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
