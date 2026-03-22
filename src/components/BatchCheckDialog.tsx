import { useState, useMemo } from "react";
import { ArrowDown } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useChalikah } from "@/hooks/useChalikah";
import { useAccounts } from "@/hooks/useAccounts";
import { useChecks, type CheckInsert } from "@/hooks/useChecks";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { type Payee } from "@/hooks/usePayees";

interface BatchCheckDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payees: Payee[];
  onDone: () => void;
}

interface GridRow {
  payee_name: string;
  record_id: string;
  amount: string;
  check_date: string;
  memo: string;
  stub_memo: string;
  run_no: string;
}

const GRID_COLS: { key: keyof GridRow; label: string; type?: string; readOnly?: boolean }[] = [
  { key: "record_id", label: "Record #", readOnly: true },
  { key: "payee_name", label: "Payee", readOnly: true },
  { key: "amount", label: "Amount", type: "number" },
  { key: "check_date", label: "Date", type: "date" },
  { key: "memo", label: "Memo" },
  { key: "stub_memo", label: "Stub Memo" },
  { key: "run_no", label: "Run No." },
];

export function BatchCheckDialog({ open, onOpenChange, payees, onDone }: BatchCheckDialogProps) {
  const { data: chalikahList = [] } = useChalikah();
  const { data: accounts = [] } = useAccounts();
  const [accountId, setAccountId] = useState<string>("");
  const { data: existingChecks = [] } = useChecks(undefined, accountId || undefined);
  const qc = useQueryClient();

  // Shared settings
  const [amount, setAmount] = useState("");
  const [maxPerCheck, setMaxPerCheck] = useState("");
  const [checkDate, setCheckDate] = useState(new Date().toISOString().split("T")[0]);
  const [chalikahId, setChalikahId] = useState<string>("__none__");
  const [runNo, setRunNo] = useState("");
  const [memo, setMemo] = useState("");
  const [stubMemo, setStubMemo] = useState("");
  const [autoCheckNumbers, setAutoCheckNumbers] = useState(true);
  const [manualStartNumber, setManualStartNumber] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Grid mode
  const [gridRows, setGridRows] = useState<GridRow[]>([]);
  const [gridInitialized, setGridInitialized] = useState(false);

  const nextCheckNumber = useMemo(() => {
    const nums = existingChecks
      .map((c) => parseInt(c.check_number || "", 10))
      .filter((n) => !isNaN(n));
    return nums.length > 0 ? Math.max(...nums) + 1 : 1;
  }, [existingChecks]);

  const effectiveAccountId = accountId || accounts[0]?.id || "";

  const splitAmount = (total: number, max: number): number[] => {
    if (!max || max <= 0 || max >= total) return [total];
    const parts: number[] = [];
    let remaining = total;
    while (remaining > 0) {
      const chunk = Math.min(remaining, max);
      parts.push(parseFloat(chunk.toFixed(2)));
      remaining = parseFloat((remaining - chunk).toFixed(2));
    }
    return parts;
  };

  const totalChecksPreview = useMemo(() => {
    const amt = parseFloat(amount);
    const max = parseFloat(maxPerCheck);
    if (!amt || amt <= 0) return payees.length;
    const parts = splitAmount(amt, max);
    return payees.length * parts.length;
  }, [amount, maxPerCheck, payees.length]);

  // Initialize grid from payees
  const initGrid = () => {
    if (gridInitialized) return;
    setGridRows(
      payees.map((p) => ({
        payee_name: p.payee_name,
        record_id: p.record_id || "",
        amount: amount || "",
        check_date: checkDate,
        memo: "",
        stub_memo: "",
        run_no: runNo || "",
      }))
    );
    setGridInitialized(true);
  };

  const updateGridCell = (idx: number, key: keyof GridRow, value: string) => {
    setGridRows((prev) => prev.map((r, i) => (i === idx ? { ...r, [key]: value } : r)));
  };

  const copyDownGrid = (key: keyof GridRow, fromRow = 0) => {
    setGridRows((prev) => {
      const sourceVal = prev[fromRow]?.[key];
      if (sourceVal === undefined || sourceVal === null || sourceVal === "") return prev;
      return prev.map((r, i) => (i > fromRow ? { ...r, [key]: sourceVal } : r));
    });
  };

  // Uniform mode submit
  const handleSubmit = async () => {
    if (!effectiveAccountId) {
      toast.error("Please select an account");
      return;
    }
    if (!amount || parseFloat(amount) <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    setSubmitting(true);
    const totalAmount = parseFloat(amount);
    const max = parseFloat(maxPerCheck);
    const amountParts = splitAmount(totalAmount, max);
    const startNum = manualStartNumber ? parseInt(manualStartNumber, 10) : nextCheckNumber;

    let checkIndex = 0;
    const checks: CheckInsert[] = [];

    for (const p of payees) {
      for (const partAmount of amountParts) {
        checks.push({
          payee: p.payee_name,
          amount: partAmount,
          check_number: autoCheckNumbers ? String(startNum + checkIndex) : null,
          check_date: checkDate,
          chalikah_id: chalikahId === "__none__" ? null : chalikahId,
          status: "Open" as const,
           memo: null,
          stub_memo: null,
          payee_record_number: p.record_id || null,
          given_to_payee: null,
          given_to_record_number: null,
          run_no: runNo || null,
          account_id: effectiveAccountId,
        });
        checkIndex++;
      }
    }

    const { error } = await supabase.from("checks").insert(checks);
    setSubmitting(false);

    if (error) {
      toast.error("Failed to create checks: " + error.message);
    } else {
      toast.success(`Created ${checks.length} check(s)`);
      qc.invalidateQueries({ queryKey: ["checks"] });
      onOpenChange(false);
      onDone();
    }
  };

  // Grid mode submit
  const handleGridSubmit = async () => {
    if (!effectiveAccountId) {
      toast.error("Please select an account");
      return;
    }

    const validRows = gridRows.filter((r) => r.payee_name && parseFloat(r.amount) > 0);
    if (validRows.length === 0) {
      toast.error("No valid rows (need payee and amount > 0)");
      return;
    }

    setSubmitting(true);
    const max = parseFloat(maxPerCheck);
    const startNum = manualStartNumber ? parseInt(manualStartNumber, 10) : nextCheckNumber;

    let checkIndex = 0;
    const checks: CheckInsert[] = [];

    for (const row of validRows) {
      const rowAmount = parseFloat(row.amount);
      const amountParts = splitAmount(rowAmount, max);
      for (const partAmount of amountParts) {
        checks.push({
          payee: row.payee_name,
          amount: partAmount,
          check_number: autoCheckNumbers ? String(startNum + checkIndex) : null,
          check_date: row.check_date || checkDate,
          chalikah_id: chalikahId === "__none__" ? null : chalikahId,
          status: "Open" as const,
          memo: row.memo || null,
          stub_memo: row.stub_memo || null,
          payee_record_number: row.record_id || null,
          given_to_payee: null,
          given_to_record_number: null,
          run_no: row.run_no || null,
          account_id: effectiveAccountId,
        });
        checkIndex++;
      }
    }

    const { error } = await supabase.from("checks").insert(checks);
    setSubmitting(false);

    if (error) {
      toast.error("Failed to create checks: " + error.message);
    } else {
      toast.success(`Created ${checks.length} check(s)`);
      qc.invalidateQueries({ queryKey: ["checks"] });
      onOpenChange(false);
      onDone();
    }
  };

  const gridValidCount = gridRows.filter((r) => r.payee_name && parseFloat(r.amount) > 0).length;

  // Shared settings (account, chalikah, auto check #, max per check)
  const sharedSettings = (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <Label>Account</Label>
        <Select value={effectiveAccountId} onValueChange={setAccountId}>
          <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
          <SelectContent>
            {accounts.map((a) => (
              <SelectItem key={a.id} value={a.id}>{a.account_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Chalikah</Label>
        <Select value={chalikahId} onValueChange={setChalikahId}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">None</SelectItem>
            {chalikahList.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Max Per Check</Label>
        <Input type="number" value={maxPerCheck} onChange={(e) => setMaxPerCheck(e.target.value)} placeholder="No limit" />
      </div>
      <div className="flex flex-col gap-2">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={autoCheckNumbers} onChange={(e) => setAutoCheckNumbers(e.target.checked)} className="rounded" />
          Auto Check #
        </label>
        {autoCheckNumbers && (
          <Input
            type="number"
            value={manualStartNumber}
            onChange={(e) => setManualStartNumber(e.target.value)}
            placeholder={`Auto: ${nextCheckNumber}`}
            className="h-8 text-xs"
          />
        )}
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) setGridInitialized(false); onOpenChange(v); }}>
      <DialogContent className="max-w-[90vw] max-h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>Create Checks for {payees.length} Payee{payees.length !== 1 ? "s" : ""}</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="uniform" onValueChange={(v) => v === "grid" && initGrid()} className="flex flex-col min-h-0 flex-1">
          <TabsList>
            <TabsTrigger value="uniform">Same for All</TabsTrigger>
            <TabsTrigger value="grid">Per-Payee Grid</TabsTrigger>
          </TabsList>

          {/* Uniform tab */}
          <TabsContent value="uniform" className="space-y-4 pt-2 overflow-y-auto">
            <div className="text-sm text-muted-foreground max-h-32 overflow-y-auto border border-border rounded p-2">
              {payees.map((p) => (
                <div key={p.id} className="flex justify-between text-xs py-0.5">
                  <span>{p.payee_name}</span>
                  <span className="text-muted-foreground font-mono">{p.record_id || "—"}</span>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Account</Label>
                <Select value={effectiveAccountId} onValueChange={setAccountId}>
                  <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                  <SelectContent>
                    {accounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>{a.account_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Amount</Label>
                <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
              </div>
              <div>
                <Label>Max Per Check</Label>
                <Input type="number" value={maxPerCheck} onChange={(e) => setMaxPerCheck(e.target.value)} placeholder="No limit" />
              </div>
              <div>
                <Label>Date</Label>
                <Input type="date" value={checkDate} onChange={(e) => setCheckDate(e.target.value)} />
              </div>
              <div>
                <Label>Chalikah</Label>
                <Select value={chalikahId} onValueChange={setChalikahId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    {chalikahList.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Run No.</Label>
                <Input value={runNo} onChange={(e) => setRunNo(e.target.value)} placeholder="Optional" />
              </div>
              <div>
                <Label>Memo</Label>
                <Input value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="Optional" />
              </div>
              <div>
                <Label>Stub Memo</Label>
                <Input value={stubMemo} onChange={(e) => setStubMemo(e.target.value)} placeholder="Optional" />
              </div>
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={autoCheckNumbers} onChange={(e) => setAutoCheckNumbers(e.target.checked)} className="rounded" />
                  Auto Check #
                </label>
                {autoCheckNumbers && (
                  <Input
                    type="number"
                    value={manualStartNumber}
                    onChange={(e) => setManualStartNumber(e.target.value)}
                    placeholder={`Auto: ${nextCheckNumber}`}
                    className="h-8 text-xs"
                  />
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button onClick={handleSubmit} disabled={submitting}>
                {submitting ? "Creating..." : `Create ${totalChecksPreview} Check(s)`}
              </Button>
            </div>
          </TabsContent>

          {/* Per-payee grid tab */}
          <TabsContent value="grid" className="pt-2 flex flex-col min-h-0 flex-1" style={{ display: "flex" }}>
            <div className="shrink-0 space-y-3 mb-3">
              {sharedSettings}
            </div>

            <p className="text-xs text-muted-foreground mb-2 shrink-0">
              Customize amount, date, memo, run no. per payee. Use ↓ buttons to copy/fill down.
            </p>

            <div className="rounded border border-border flex-1 min-h-0 overflow-auto" style={{ scrollbarGutter: "stable" }}>
              <table className="w-full text-xs min-w-max">
                <thead className="sticky top-0 z-10 bg-muted">
                  <tr>
                    <th className="text-left px-2 py-1.5 font-semibold text-muted-foreground whitespace-nowrap">#</th>
                    {GRID_COLS.map((col) => (
                      <th key={col.key} className="text-left px-1 py-1.5 font-semibold text-muted-foreground whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          {col.label}
                          {!col.readOnly && (
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="h-5 w-5 opacity-50 hover:opacity-100"
                              onClick={() => copyDownGrid(col.key, 0)}
                              title={`Copy ${col.label} down from top row`}
                            >
                              <ArrowDown className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {gridRows.map((row, idx) => (
                    <tr key={idx} className="border-t border-border">
                      <td className="px-2 py-0.5 text-muted-foreground">{idx + 1}</td>
                      {GRID_COLS.map((col, colIdx) => (
                        <td key={col.key} className="px-0.5 py-0.5">
                          {col.readOnly ? (
                            <span className="text-xs px-1.5 py-1 inline-block truncate max-w-[160px]">{row[col.key]}</span>
                          ) : (
                            <div className="flex items-center gap-0.5">
                              <Input
                                type={col.type || "text"}
                                value={row[col.key]}
                                onChange={(e) => updateGridCell(idx, col.key, e.target.value)}
                                className="h-7 text-xs min-w-[80px] px-1.5 flex-1"
                                placeholder={col.label}
                                data-bgrid-row={idx}
                                data-bgrid-col={colIdx}
                                onKeyDown={(e) => {
                                  const editableCols = GRID_COLS.filter((c) => !c.readOnly);
                                  const editableIdx = editableCols.findIndex((c) => c.key === col.key);
                                  const totalEditCols = editableCols.length;
                                  const totalRows = gridRows.length;
                                  let nextRow = idx;
                                  let nextEditCol = editableIdx;
                                  const el = e.target as HTMLInputElement;

                                  if (e.key === "ArrowDown") { nextRow = Math.min(idx + 1, totalRows - 1); }
                                  else if (e.key === "ArrowUp") { nextRow = Math.max(idx - 1, 0); }
                                  else if (e.key === "Tab" && !e.shiftKey) {
                                    if (editableIdx < totalEditCols - 1) nextEditCol = editableIdx + 1;
                                    else if (idx < totalRows - 1) { nextRow = idx + 1; nextEditCol = 0; }
                                    else return;
                                    e.preventDefault();
                                  } else if (e.key === "Tab" && e.shiftKey) {
                                    if (editableIdx > 0) nextEditCol = editableIdx - 1;
                                    else if (idx > 0) { nextRow = idx - 1; nextEditCol = totalEditCols - 1; }
                                    else return;
                                    e.preventDefault();
                                  } else if (e.key === "Enter") {
                                    nextRow = Math.min(idx + 1, totalRows - 1);
                                    e.preventDefault();
                                  } else return;

                                  if (nextRow !== idx || nextEditCol !== editableIdx) {
                                    const nextColKey = editableCols[nextEditCol].key;
                                    const nextColIdx = GRID_COLS.findIndex((c) => c.key === nextColKey);
                                    const next = document.querySelector<HTMLInputElement>(
                                      `input[data-bgrid-row="${nextRow}"][data-bgrid-col="${nextColIdx}"]`
                                    );
                                    next?.focus();
                                  }
                                }}
                              />
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6 shrink-0 opacity-40 hover:opacity-100"
                                onClick={() => copyDownGrid(col.key, idx)}
                                title={`Copy ${col.label} down from row ${idx + 1}`}
                              >
                                <ArrowDown className="h-3 w-3" />
                              </Button>
                            </div>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end gap-2 pt-3 shrink-0">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button onClick={handleGridSubmit} disabled={submitting || gridValidCount === 0}>
                {submitting ? "Creating..." : `Create ${gridValidCount} Check(s)`}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
