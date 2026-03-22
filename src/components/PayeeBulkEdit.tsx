import { useState, useMemo } from "react";
import { ArrowDown } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { type Payee, usePayees } from "@/hooks/usePayees";
import { buildPayeeName } from "@/lib/payee-utils";
import { FieldSuggestInput } from "@/components/FieldSuggestInput";

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
  { key: "street_no", label: "St #" },
  { key: "street_name", label: "Street" },
  { key: "apt", label: "Apt" },
  { key: "city", label: "City" },
  { key: "state", label: "State" },
  { key: "zip", label: "Zip" },
  { key: "memo", label: "Memo" },
  { key: "is_active", label: "Active Status" },
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
  { key: "memo", label: "Memo" },
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
  const { data: allPayees = [] } = usePayees();
  const qc = useQueryClient();

  const suggestionsByField = useMemo(() => {
    const map: Record<string, string[]> = {};
    [...APPLY_ALL_FIELDS, ...GRID_FIELDS].forEach((f) => {
      if (f.type !== "number" && !map[f.key]) {
        map[f.key] = allPayees.map((p) => (p as any)[f.key]).filter(Boolean) as string[];
      }
    });
    return map;
  }, [allPayees]);

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
      if (key === "is_active") {
        updates[key] = values[key] === "true";
      } else {
        updates[key] = field?.type === "number" ? (val === "?" ? null : Number(val) || 0) : val || null;
      }
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

  const copyDownGrid = (key: string, fromRow = 0) => {
    setGridRows((prev) => {
      const sourceVal = prev[fromRow]?.[key];
      if (sourceVal === undefined || sourceVal === null || sourceVal === "") return prev;
      return prev.map((r, i) => (i > fromRow ? { ...r, [key]: sourceVal } : r));
    });
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
      // Auto-generate payee_name
      rest.payee_name = buildPayeeName(rest) || rest.payee_name;
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
                  {f.key === "is_active" ? (
                    <Switch
                      checked={values[f.key] === "true"}
                      onCheckedChange={(checked) => setValues((prev) => ({ ...prev, [f.key]: String(checked) }))}
                      disabled={!enabledFields.has(f.key)}
                    />
                  ) : f.type === "number" ? (
                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        value={values[f.key] === "?" ? "" : (values[f.key] ?? "")}
                        onChange={(e) => setValues((prev) => ({ ...prev, [f.key]: e.target.value }))}
                        placeholder={values[f.key] === "?" ? "?" : f.label}
                        disabled={!enabledFields.has(f.key) || values[f.key] === "?"}
                        className="h-8 text-sm"
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant={values[f.key] === "?" ? "default" : "outline"}
                        className="h-8 px-2 text-xs shrink-0"
                        disabled={!enabledFields.has(f.key)}
                        onClick={() => setValues((prev) => ({ ...prev, [f.key]: prev[f.key] === "?" ? "" : "?" }))}
                      >
                        ?
                      </Button>
                    </div>
                  ) : (
                    <FieldSuggestInput
                      dir={f.dir}
                      value={values[f.key] ?? ""}
                      onChange={(v) => setValues((prev) => ({ ...prev, [f.key]: v }))}
                      suggestions={enabledFields.has(f.key) ? (suggestionsByField[f.key] || []) : []}
                      placeholder={f.label}
                      className={`h-8 text-sm ${!enabledFields.has(f.key) ? "opacity-50 pointer-events-none" : ""}`}
                    />
                  )}
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
              Edit each payee individually. Use the header arrow to copy from top, or the small arrow in any row to continue from that row.
            </p>
            <div className="rounded border border-border flex-1 min-h-0 overflow-auto" style={{ scrollbarGutter: 'stable' }}>
              <table className="w-full text-xs min-w-max">
                <thead className="sticky top-0 z-10 bg-muted">
                  <tr>
                    <th className="text-left px-2 py-1.5 font-semibold text-muted-foreground whitespace-nowrap">#</th>
                    {GRID_FIELDS.map((f) => (
                      <th
                        key={f.key}
                        className="text-left px-1 py-1.5 font-semibold text-muted-foreground whitespace-nowrap"
                        dir={f.dir}
                      >
                        <div className="flex items-center gap-1">
                          {f.label}
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-5 w-5 opacity-50 hover:opacity-100"
                            onClick={() => copyDownGrid(f.key, 0)}
                            title={`Copy ${f.label} down from top row`}
                          >
                            <ArrowDown className="h-3 w-3" />
                          </Button>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {gridRows.map((row, idx) => (
                    <tr key={row.id} className="border-t border-border">
                      <td className="px-2 py-0.5 text-muted-foreground">{idx + 1}</td>
                      {GRID_FIELDS.map((f, colIdx) => {
                        const mkKeyHandler = (e: React.KeyboardEvent<HTMLInputElement>) => {
                          if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                            e.preventDefault();
                            copyDownGrid(f.key, idx);
                            return;
                          }
                          const totalCols = GRID_FIELDS.length;
                          const totalRows = gridRows.length;
                          let nextRow = idx;
                          let nextCol = colIdx;
                          const el = e.target as HTMLInputElement;
                          if (e.key === "ArrowDown") { nextRow = Math.min(idx + 1, totalRows - 1); }
                          else if (e.key === "ArrowUp") { nextRow = Math.max(idx - 1, 0); }
                          else if (e.key === "ArrowRight" && el.selectionStart === el.value.length) {
                            if (colIdx < totalCols - 1) nextCol = colIdx + 1;
                            else if (idx < totalRows - 1) { nextRow = idx + 1; nextCol = 0; }
                          } else if (e.key === "ArrowLeft" && el.selectionStart === 0) {
                            if (colIdx > 0) nextCol = colIdx - 1;
                            else if (idx > 0) { nextRow = idx - 1; nextCol = totalCols - 1; }
                          } else if (e.key === "Tab" && !e.shiftKey) {
                            if (colIdx < totalCols - 1) nextCol = colIdx + 1;
                            else if (idx < totalRows - 1) { nextRow = idx + 1; nextCol = 0; }
                            else return;
                            e.preventDefault();
                          } else if (e.key === "Tab" && e.shiftKey) {
                            if (colIdx > 0) nextCol = colIdx - 1;
                            else if (idx > 0) { nextRow = idx - 1; nextCol = totalCols - 1; }
                            else return;
                            e.preventDefault();
                          } else if (e.key === "Enter") {
                            nextRow = Math.min(idx + 1, totalRows - 1);
                            e.preventDefault();
                          } else return;
                          if (nextRow !== idx || nextCol !== colIdx) {
                            const next = document.querySelector<HTMLInputElement>(`input[data-pgrid-row="${nextRow}"][data-pgrid-col="${nextCol}"]`);
                            next?.focus();
                          }
                        };
                        return (
                          <td key={f.key} className="px-0.5 py-0.5">
                            <div className="flex items-center gap-0.5">
                              <div className="min-w-[80px] flex-1">
                                {f.type === "number" ? (
                                  <Input
                                    type="number"
                                    value={(row[f.key] as number) ?? 0}
                                    onChange={(e) => updateGridCell(idx, f.key, e.target.value)}
                                    className="h-7 text-xs min-w-[80px] px-1.5"
                                    data-pgrid-row={idx}
                                    data-pgrid-col={colIdx}
                                    onContextMenu={(e) => {
                                      e.preventDefault();
                                      copyDownGrid(f.key, idx);
                                    }}
                                    title={`Right-click to copy ${f.label} down from this row`}
                                    onKeyDown={mkKeyHandler}
                                  />
                                ) : (
                                  <FieldSuggestInput
                                    dir={f.dir}
                                    value={(row[f.key] as string) ?? ""}
                                    onChange={(v) => updateGridCell(idx, f.key, v)}
                                    suggestions={suggestionsByField[f.key] || []}
                                    placeholder={f.label}
                                    className="h-7 text-xs min-w-[80px] px-1.5"
                                    data-pgrid-row={idx}
                                    data-pgrid-col={colIdx}
                                    onContextMenu={(e: React.MouseEvent<HTMLInputElement>) => {
                                      e.preventDefault();
                                      copyDownGrid(f.key, idx);
                                    }}
                                    title={`Right-click to copy ${f.label} down from this row`}
                                    onKeyDown={mkKeyHandler}
                                  />
                                )}
                              </div>
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6 opacity-40 hover:opacity-100"
                                onClick={() => copyDownGrid(f.key, idx)}
                                title={`Copy ${f.label} down from row ${idx + 1}`}
                              >
                                <ArrowDown className="h-3 w-3" />
                              </Button>
                            </div>
                          </td>
                        );
                      })}
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
