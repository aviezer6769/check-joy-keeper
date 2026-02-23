import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { type Payee } from "@/hooks/usePayees";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface FieldDef {
  key: keyof Omit<Payee, "id" | "created_at" | "updated_at">;
  label: string;
  dir?: "rtl";
  type?: "number";
}

const APPLY_ALL_FIELDS: FieldDef[] = [
  { key: "sort_order", label: "Sort Order", type: "number" },
  { key: "urgent_level", label: "Urgent Level", type: "number" },
  { key: "title", label: "Title" },
  { key: "title_to_use", label: "TitleToUse" },
  { key: "city", label: "City" },
  { key: "state", label: "State" },
  { key: "zip", label: "Zip" },
];

const GRID_FIELDS: FieldDef[] = [
  { key: "payee_name", label: "Payee Name" },
  { key: "record_id", label: "Record ID" },
  { key: "sort_order", label: "Sort", type: "number" },
  { key: "urgent_level", label: "Urgent", type: "number" },
  { key: "title_1_yiddish", label: "טיטל 1", dir: "rtl" },
  { key: "first_name_yiddish", label: "ערשטע נאמען", dir: "rtl" },
  { key: "middle_name_yiddish", label: "מיטעלסטע", dir: "rtl" },
  { key: "last_name_yiddish", label: "לעצטע", dir: "rtl" },
  { key: "title_2_yiddish", label: "טיטל 2", dir: "rtl" },
  { key: "first_name", label: "First Name" },
  { key: "last_name", label: "Last Name" },
  { key: "title", label: "Title" },
  { key: "title_to_use", label: "TitleToUse" },
  { key: "street_no", label: "St #" },
  { key: "street_name", label: "Street" },
  { key: "apt", label: "Apt" },
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
  const [gridRows, setGridRows] = useState<Record<string, any>[]>([]);
  const [gridInitialized, setGridInitialized] = useState(false);
  const qc = useQueryClient();

  // Initialize grid rows when switching to grid tab
  const initGrid = () => {
    if (!gridInitialized || gridRows.length !== payees.length) {
      setGridRows(payees.map((p) => ({ ...p })));
      setGridInitialized(true);
    }
  };

  const toggleField = (key: string) => {
    setEnabledFields((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleApplyAll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (enabledFields.size === 0) {
      toast.error("Select at least one field to update");
      return;
    }

    const updates: Record<string, any> = {};
    enabledFields.forEach((key) => {
      const field = APPLY_ALL_FIELDS.find((f) => f.key === key);
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

  const updateGridCell = (idx: number, key: string, value: string) => {
    setGridRows((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, [key]: value } : r))
    );
  };

  const handleGridSave = async () => {
    setSaving(true);
    // Build individual updates for changed rows
    const promises = gridRows.map((row) => {
      const { id, created_at, updated_at, ...rest } = row;
      // Convert number fields
      GRID_FIELDS.forEach((f) => {
        if (f.type === "number") {
          rest[f.key] = Number(rest[f.key]) || 0;
        } else {
          rest[f.key] = rest[f.key] || null;
        }
      });
      return supabase.from("payees").update(rest).eq("id", id);
    });

    const results = await Promise.all(promises);
    setSaving(false);

    const errors = results.filter((r) => r.error);
    if (errors.length > 0) {
      toast.error(`${errors.length} row(s) failed to update`);
    } else {
      toast.success(`Updated ${gridRows.length} payee(s)`);
      qc.invalidateQueries({ queryKey: ["payees"] });
      onDone();
      onOpenChange(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) setGridInitialized(false);
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-[95vw] max-h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>Bulk Edit {payees.length} Payee(s)</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="apply-all" onValueChange={(v) => v === "grid" && initGrid()} className="flex flex-col min-h-0 flex-1">
          <TabsList>
            <TabsTrigger value="apply-all">Apply to All</TabsTrigger>
            <TabsTrigger value="grid">Edit Grid</TabsTrigger>
          </TabsList>

          <TabsContent value="apply-all" className="pt-2 overflow-y-auto">
            <p className="text-sm text-muted-foreground mb-3">
              Check the fields you want to update. The new value will be applied to all selected payees.
            </p>
            <form onSubmit={handleApplyAll} className="space-y-3">
              {APPLY_ALL_FIELDS.map((f) => (
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
          </TabsContent>

          <TabsContent value="grid" className="pt-2 flex flex-col min-h-0 flex-1" style={{ display: "flex" }}>
            <p className="text-sm text-muted-foreground mb-3 shrink-0">
              Edit each payee individually in the grid below.
            </p>
            <div className="rounded border border-border overflow-auto flex-1 min-h-0">
              <table className="w-full text-xs">
                <thead className="sticky top-0 z-10 bg-muted">
                  <tr>
                    <th className="text-left px-2 py-1.5 font-semibold text-muted-foreground whitespace-nowrap">#</th>
                    {GRID_FIELDS.map((f) => (
                      <th
                        key={f.key}
                        className="text-left px-1 py-1.5 font-semibold text-muted-foreground whitespace-nowrap"
                        dir={f.dir}
                      >
                        {f.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {gridRows.map((row, idx) => (
                    <tr key={row.id} className="border-t border-border">
                      <td className="px-2 py-0.5 text-muted-foreground">{idx + 1}</td>
                      {GRID_FIELDS.map((f) => (
                        <td key={f.key} className="px-0.5 py-0.5">
                          <Input
                            dir={f.dir}
                            type={f.type === "number" ? "number" : "text"}
                            value={
                              f.type === "number"
                                ? (row[f.key] as number) ?? 0
                                : (row[f.key] as string) ?? ""
                            }
                            onChange={(e) => updateGridCell(idx, f.key, e.target.value)}
                            className="h-7 text-xs min-w-[80px] px-1.5"
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end gap-2 pt-3 shrink-0">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleGridSave} disabled={saving}>
                {saving ? "Saving..." : `Save ${gridRows.length} Payee(s)`}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
