import { useState, useMemo } from "react";
import { ArrowDown } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { type Check, CHECK_STATUSES } from "@/hooks/useChecks";
import { useChalikah } from "@/hooks/useChalikah";
import { usePayees } from "@/hooks/usePayees";
import { PayeeAutocomplete } from "@/components/PayeeAutocomplete";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Run promises in sequential batches to avoid rate limiting
async function batchedUpdates<T>(
  items: T[],
  fn: (item: T) => Promise<{ error: any }>,
  batchSize = 20
): Promise<{ errors: number; total: number }> {
  let errors = 0;
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const results = await Promise.all(batch.map(fn));
    errors += results.filter((r) => r.error).length;
  }
  return { errors, total: items.length };
}

interface FieldDef {
  key: string;
  label: string;
  type?: "number" | "date" | "boolean" | "chalikah" | "status";
}

const APPLY_ALL_FIELDS: FieldDef[] = [
  { key: "check_date", label: "Date", type: "date" },
  { key: "status", label: "Status", type: "status" },
  { key: "chalikah_id", label: "Chalikah", type: "chalikah" },
  { key: "memo", label: "Memo" },
  { key: "stub_memo", label: "Stub Memo" },
];

const GRID_FIELDS: FieldDef[] = [
  { key: "check_number", label: "Check #" },
  { key: "payee_record_number", label: "Record #" },
  { key: "payee", label: "Payee" },
  { key: "amount", label: "Amount", type: "number" },
  { key: "check_date", label: "Date", type: "date" },
  { key: "chalikah_id", label: "Chalikah", type: "chalikah" },
  { key: "status", label: "Status", type: "status" },
  { key: "memo", label: "Memo" },
  { key: "stub_memo", label: "Stub Memo" },
  { key: "given_to_record_number", label: "Given To #" },
  { key: "given_to_payee", label: "Given To" },
];

interface CheckBulkEditProps {
  checks: Check[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}

export function CheckBulkEdit({ checks, open, onOpenChange, onDone }: CheckBulkEditProps) {
  const [enabledFields, setEnabledFields] = useState<Set<string>>(new Set());
  const [values, setValues] = useState<Record<string, string>>({});
  const [boolValues, setBoolValues] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [gridRows, setGridRows] = useState<Record<string, any>[]>([]);
  const [gridInitialized, setGridInitialized] = useState(false);
  const { data: chalikahList = [] } = useChalikah();
  const { data: payees = [] } = usePayees();
  const qc = useQueryClient();

  const payeeByRecordId = useMemo(
    () => Object.fromEntries(payees.filter((p) => p.record_id).map((p) => [p.record_id!, p])),
    [payees]
  );

  const initGrid = () => {
    if (!gridInitialized || gridRows.length !== checks.length) {
      setGridRows(checks.map((c) => ({ ...c })));
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
      if (field?.type === "boolean") {
        updates[key] = boolValues[key] ?? false;
      } else if (field?.type === "chalikah" || field?.type === "status") {
        updates[key] = values[key] || null;
      } else if (field?.type === "number") {
        updates[key] = Number(values[key]) || 0;
      } else {
        updates[key] = values[key] || null;
      }
    });

    // Handle status=Void specially — each check needs its own original_amount
    if (enabledFields.has("status") && values["status"] === "Void") {
      setSaving(true);
      const { errors: voidErrors } = await batchedUpdates(checks, async (c) => {
        const perCheckUpdates = { ...updates };
        if (c.status !== "Void") {
          perCheckUpdates.original_amount = c.amount;
          perCheckUpdates.amount = 0;
        }
        return supabase.from("checks").update(perCheckUpdates).eq("id", c.id);
      });
      setSaving(false);
      if (voidErrors > 0) {
        toast.error(`${voidErrors} row(s) failed to update`);
      } else {
        toast.success(`Updated ${checks.length} check(s)`);
      }
      qc.invalidateQueries({ queryKey: ["checks"] });
      onDone();
      onOpenChange(false);
      return;
    }

    // Handle unvoiding
    if (enabledFields.has("status") && values["status"] !== "Void") {
      setSaving(true);
      const { errors: unvoidErrors } = await batchedUpdates(checks, async (c) => {
        const perCheckUpdates = { ...updates };
        if (c.status === "Void") {
          perCheckUpdates.amount = c.original_amount ?? 0;
          perCheckUpdates.original_amount = null;
        }
        return supabase.from("checks").update(perCheckUpdates).eq("id", c.id);
      });
      setSaving(false);
      if (unvoidErrors > 0) {
        toast.error(`${unvoidErrors} row(s) failed to update`);
      } else {
        toast.success(`Updated ${checks.length} check(s)`);
      }
      qc.invalidateQueries({ queryKey: ["checks"] });
      onDone();
      onOpenChange(false);
      return;
    }

    // Simple bulk update — use .in() with batched ID chunks
    setSaving(true);
    const ids = checks.map((c) => c.id);
    let bulkErrors = 0;
    for (let i = 0; i < ids.length; i += 50) {
      const batch = ids.slice(i, i + 50);
      const { error } = await supabase.from("checks").update(updates).in("id", batch);
      if (error) bulkErrors++;
    }
    setSaving(false);

    if (bulkErrors > 0) {
      toast.error(`Some rows failed to update`);
    } else {
      toast.success(`Updated ${checks.length} check(s)`);
    }
    qc.invalidateQueries({ queryKey: ["checks"] });
    onDone();
    onOpenChange(false);
  };

  const updateGridCell = (idx: number, key: string, value: any) => {
    setGridRows((prev) =>
      prev.map((r, i) => {
        if (i !== idx) return r;
        const updated = { ...r, [key]: value };
        // Auto-fill payee info from record ID
        if (key === "payee_record_number") {
          const p = payeeByRecordId[value];
          if (p) {
            updated.payee = p.payee_name;
          }
        }
        // Auto-fill given-to payee from given-to record ID
        if (key === "given_to_record_number") {
          const p = payeeByRecordId[value];
          if (p) {
            updated.given_to_payee = p.payee_name;
          }
        }
        return updated;
      })
    );
  };

  const copyDownGrid = (key: string, fromRow = 0) => {
    setGridRows((prev) => {
      const sourceVal = prev[fromRow]?.[key];
      if (sourceVal === undefined || sourceVal === null || sourceVal === "") return prev;
      const isNumericFill = key === "check_number" && /^\d+$/.test(String(sourceVal));
      const startNum = isNumericFill ? parseInt(String(sourceVal), 10) : 0;
      return prev.map((r, i) => {
        if (i <= fromRow) return r;
        const newVal = isNumericFill ? String(startNum + (i - fromRow)) : sourceVal;
        return { ...r, [key]: newVal };
      });
    });
  };

  const handleGridSave = async () => {
    setSaving(true);
    const { errors: gridErrors } = await batchedUpdates(gridRows, async (row) => {
      const { id, created_at, updated_at, ...rest } = row;
      GRID_FIELDS.forEach((f) => {
        if (f.type === "number") {
          rest[f.key] = Number(rest[f.key]) || 0;
        } else if (f.type === "boolean") {
          rest[f.key] = !!rest[f.key];
        } else if (f.type === "chalikah") {
          rest[f.key] = rest[f.key] || null;
        } else {
          rest[f.key] = rest[f.key] || null;
        }
      });
      return supabase.from("checks").update(rest).eq("id", id);
    });
    setSaving(false);

    if (gridErrors > 0) {
      toast.error(`${gridErrors} row(s) failed to update`);
    } else {
      toast.success(`Updated ${gridRows.length} check(s)`);
      qc.invalidateQueries({ queryKey: ["checks"] });
      onDone();
      onOpenChange(false);
    }
  };

  const chalikahMap = Object.fromEntries(chalikahList.map((c) => [c.id, c.name]));

  const renderApplyField = (f: FieldDef) => {
    const enabled = enabledFields.has(f.key);
    if (f.type === "boolean") {
      return (
        <Checkbox
          checked={boolValues[f.key] ?? false}
          onCheckedChange={(v) => setBoolValues((prev) => ({ ...prev, [f.key]: v === true }))}
          disabled={!enabled}
        />
      );
    }
    if (f.type === "chalikah") {
      return (
        <Select
          value={values[f.key] ?? ""}
          onValueChange={(v) => setValues((prev) => ({ ...prev, [f.key]: v }))}
          disabled={!enabled}
        >
          <SelectTrigger className="h-8 text-sm">
            <SelectValue placeholder="Select..." />
          </SelectTrigger>
          <SelectContent>
            {chalikahList.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }
    if (f.type === "status") {
      return (
        <Select
          value={values[f.key] ?? ""}
          onValueChange={(v) => setValues((prev) => ({ ...prev, [f.key]: v }))}
          disabled={!enabled}
        >
          <SelectTrigger className="h-8 text-sm">
            <SelectValue placeholder="Select..." />
          </SelectTrigger>
          <SelectContent>
            {CHECK_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }
    return (
      <Input
        type={f.type === "date" ? "date" : f.type === "number" ? "number" : "text"}
        value={values[f.key] ?? ""}
        onChange={(e) => setValues((prev) => ({ ...prev, [f.key]: e.target.value }))}
        placeholder={f.label}
        disabled={!enabled}
        className="h-8 text-sm"
      />
    );
  };

  const renderGridCell = (row: Record<string, any>, idx: number, f: FieldDef) => {
    if (f.type === "boolean") {
      return (
        <Checkbox
          checked={!!row[f.key]}
          onCheckedChange={(v) => updateGridCell(idx, f.key, v === true)}
        />
      );
    }
    if (f.type === "chalikah") {
      return (
        <Select
          value={row[f.key] ?? ""}
          onValueChange={(v) => updateGridCell(idx, f.key, v)}
        >
          <SelectTrigger className="h-7 text-xs min-w-[100px]">
            <SelectValue placeholder="—" />
          </SelectTrigger>
          <SelectContent>
            {chalikahList.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }
    if (f.type === "status") {
      return (
        <Select
          value={row[f.key] ?? "Open"}
          onValueChange={(v) => updateGridCell(idx, f.key, v)}
        >
          <SelectTrigger className="h-7 text-xs min-w-[90px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CHECK_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }
    // Payee-related fields with autocomplete
    const PAYEE_FIELDS: Record<string, "payee_name" | "record_id"> = {
      payee: "payee_name",
      payee_record_number: "record_id",
      given_to_payee: "payee_name",
      given_to_record_number: "record_id",
    };
    if (f.key in PAYEE_FIELDS) {
      return (
        <PayeeAutocomplete
          value={(row[f.key] as string) ?? ""}
          onChange={(v) => updateGridCell(idx, f.key, v)}
          onSelectPayee={(p) => {
            if (f.key === "payee_record_number" || f.key === "payee") {
              updateGridCell(idx, "payee_record_number", p.record_id || "");
              updateGridCell(idx, "payee", p.payee_name);
            } else {
              updateGridCell(idx, "given_to_record_number", p.record_id || "");
              updateGridCell(idx, "given_to_payee", p.payee_name);
            }
          }}
          onContextMenu={(e) => {
            e.preventDefault();
            copyDownGrid(f.key, idx);
          }}
          title={`Right-click to ${f.key === "check_number" ? "fill" : "copy"} ${f.label} down from this row`}
          payees={payees}
          searchField={PAYEE_FIELDS[f.key]}
          placeholder={f.label}
        />
      );
    }
    const colIdx = GRID_FIELDS.indexOf(f);
    return (
      <Input
        type={f.type === "date" ? "date" : f.type === "number" ? "number" : "text"}
        value={f.type === "number" ? (row[f.key] as number) ?? 0 : (row[f.key] as string) ?? ""}
        onChange={(e) => updateGridCell(idx, f.key, e.target.value)}
        className="h-7 text-xs min-w-[80px] px-1.5"
        data-grid-row={idx}
        data-grid-col={colIdx}
        onContextMenu={(e) => {
          e.preventDefault();
          copyDownGrid(f.key, idx);
        }}
        title={`Right-click to ${f.key === "check_number" ? "fill" : "copy"} ${f.label} down from this row`}
        onKeyDown={(e) => {
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
            const next = document.querySelector<HTMLInputElement>(`input[data-grid-row="${nextRow}"][data-grid-col="${nextCol}"]`);
            next?.focus();
          }
        }}
      />
    );
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
          <DialogTitle>Bulk Edit {checks.length} Check(s)</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="apply-all" onValueChange={(v) => v === "grid" && initGrid()} className="flex flex-col min-h-0 flex-1">
          <TabsList>
            <TabsTrigger value="apply-all">Apply to All</TabsTrigger>
            <TabsTrigger value="grid">Edit Grid</TabsTrigger>
          </TabsList>

          <TabsContent value="apply-all" className="pt-2 overflow-y-auto">
            <p className="text-sm text-muted-foreground mb-3">
              Check the fields you want to update. The new value will be applied to all selected checks.
            </p>
            <form onSubmit={handleApplyAll} className="space-y-3">
              {APPLY_ALL_FIELDS.map((f) => (
                <div key={f.key} className="flex items-center gap-3">
                  <Checkbox
                    checked={enabledFields.has(f.key)}
                    onCheckedChange={() => toggleField(f.key)}
                    id={`bulk-check-${f.key}`}
                  />
                  <Label htmlFor={`bulk-check-${f.key}`} className="text-sm w-24 shrink-0">
                    {f.label}
                  </Label>
                  {renderApplyField(f)}
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
              Edit each check individually. Use the header arrow to fill/copy from top, or the small arrow in any row to continue from that row.
            </p>
            <div className="rounded border border-border flex-1 min-h-0 overflow-auto" style={{ scrollbarGutter: "stable" }}>
              <table className="w-full text-xs min-w-max">
                <thead className="sticky top-0 z-10 bg-muted">
                  <tr>
                    <th className="text-left px-2 py-1.5 font-semibold text-muted-foreground whitespace-nowrap">#</th>
                    {GRID_FIELDS.map((f) => (
                      <th key={f.key} className="text-left px-1 py-1.5 font-semibold text-muted-foreground whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          {f.label}
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-5 w-5 opacity-50 hover:opacity-100"
                            onClick={() => copyDownGrid(f.key, 0)}
                            title={`${f.key === "check_number" ? "Fill" : "Copy"} ${f.label} down from top row`}
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
                      {GRID_FIELDS.map((f) => (
                        <td key={f.key} className="px-0.5 py-0.5">
                          <div className="flex items-center gap-0.5">
                            <div className="min-w-[80px] flex-1">{renderGridCell(row, idx, f)}</div>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6 opacity-40 hover:opacity-100"
                              onClick={() => copyDownGrid(f.key, idx)}
                              title={`${f.key === "check_number" ? "Fill" : "Copy"} ${f.label} down from row ${idx + 1}`}
                            >
                              <ArrowDown className="h-3 w-3" />
                            </Button>
                          </div>
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
                {saving ? "Saving..." : `Save ${gridRows.length} Check(s)`}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
