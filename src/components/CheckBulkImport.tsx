import { useRef, useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, Plus, Trash2, FileUp, ArrowDown, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import * as XLSX from "xlsx";
import { type CheckInsert } from "@/hooks/useChecks";

const CHECK_COLUMN_KEYS = [
  "payee", "amount", "check_number", "check_date", "status", "memo", "stub_memo",
  "payee_record_number", "given_to_payee", "given_to_record_number", "run_no",
] as const;

type CheckColumnKey = typeof CHECK_COLUMN_KEYS[number];

const CHECK_COLUMN_LABELS: Record<CheckColumnKey, string> = {
  payee: "Payee",
  amount: "Amount",
  check_number: "Check #",
  check_date: "Date",
  status: "Status",
  memo: "Memo",
  stub_memo: "Stub Memo",
  payee_record_number: "Record #",
  given_to_payee: "Given To",
  given_to_record_number: "Given To Record #",
  run_no: "Run No.",
};

const CHECK_HEADER_ALIASES: Record<string, CheckColumnKey> = {
  payee: "payee", "payee name": "payee", payee_name: "payee",
  amount: "amount",
  "check #": "check_number", "check number": "check_number", check_number: "check_number", "check#": "check_number",
  checkno: "check_number", "checkno.": "check_number",
  date: "check_date", check_date: "check_date", "check date": "check_date", checkdate: "check_date",
  status: "status",
  memo: "memo", notes: "memo",
  "payee record #": "payee_record_number", payee_record_number: "payee_record_number",
  "record #": "payee_record_number", "record number": "payee_record_number",
  "record id": "payee_record_number", record_id: "payee_record_number", recordid: "payee_record_number",
  "given to": "given_to_payee", given_to_payee: "given_to_payee", "given to payee": "given_to_payee",
  "given to record #": "given_to_record_number", given_to_record_number: "given_to_record_number",
  "run no": "run_no", "run no.": "run_no", run_no: "run_no", runno: "run_no",
  checkrun: "run_no", "check run": "run_no", check_run: "run_no",
};

function matchCheckHeader(header: string): CheckColumnKey | undefined {
  const lower = header.trim().toLowerCase();
  if (CHECK_HEADER_ALIASES[lower]) return CHECK_HEADER_ALIASES[lower];
  for (const [key, label] of Object.entries(CHECK_COLUMN_LABELS)) {
    if (lower === label.toLowerCase()) return key as CheckColumnKey;
  }
  const normalized = lower.replace(/[^a-z0-9_]/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");
  return CHECK_COLUMN_KEYS.find(
    (k) => k === normalized || k.replace(/_/g, "") === normalized.replace(/_/g, "")
  );
}

const EMPTY_ROW = (): Record<string, string> =>
  Object.fromEntries(CHECK_COLUMN_KEYS.map((k) => [k, ""]));

function parseAmount(val: string): number {
  if (!val) return 0;
  return parseFloat(String(val).replace(/[$,]/g, "")) || 0;
}

function parseDate(val: string): string {
  if (!val) return new Date().toISOString().split("T")[0];
  const s = String(val).trim();
  // Already ISO format
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // Excel serial number (e.g. 45363)
  const num = Number(s);
  if (!isNaN(num) && num > 10000 && num < 100000) {
    // Excel epoch is Jan 0, 1900 (with the Lotus 1-2-3 leap year bug)
    const excelEpoch = new Date(1899, 11, 30);
    const date = new Date(excelEpoch.getTime() + num * 86400000);
    return date.toISOString().split("T")[0];
  }
  // M/D/YY or M/D/YYYY
  const parts = s.split("/");
  if (parts.length === 3) {
    let [m, d, y] = parts.map(Number);
    if (y < 100) y += 2000;
    return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }
  // Try native Date parse as fallback (handles "Mar 12, 2026" etc.)
  const parsed = new Date(s);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split("T")[0];
  }
  return new Date().toISOString().split("T")[0];
}

function parseCheckCSV(text: string): Record<string, string>[] {
  const lines = text.trim().split("\n").filter(Boolean);
  if (lines.length === 0) return [];

  const firstLine = lines[0];
  const delimiter = firstLine.includes("\t") ? "\t" : ",";
  const rawHeaders = firstLine.split(delimiter).map((h) => h.trim());

  const keyMap = new Map<number, CheckColumnKey>();
  rawHeaders.forEach((h, i) => {
    const match = matchCheckHeader(h);
    if (match && !Array.from(keyMap.values()).includes(match)) keyMap.set(i, match);
  });

  const hasHeaders = keyMap.size > 0;
  const dataLines = hasHeaders ? lines.slice(1) : lines;

  return dataLines.map((line) => {
    const values = line.split(delimiter).map((v) => v.trim());
    const row: Record<string, string> = {};
    if (hasHeaders) {
      keyMap.forEach((key, idx) => { row[key] = values[idx] || ""; });
    } else {
      CHECK_COLUMN_KEYS.forEach((key, idx) => { row[key] = values[idx] || ""; });
    }
    return row;
  });
}

async function lookupPayeesByRecordId(recordIds: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (recordIds.length === 0) return map;
  const unique = [...new Set(recordIds)];
  // Query in batches of 100
  for (let i = 0; i < unique.length; i += 100) {
    const batch = unique.slice(i, i + 100);
    const { data } = await supabase.from("payees").select("record_id, payee_name").in("record_id", batch);
    if (data) data.forEach((p) => { if (p.record_id) map.set(p.record_id, p.payee_name); });
  }
  return map;
}

function rowToCheck(row: Record<string, string>, accountId: string | null, payeeMap?: Map<string, string>): CheckInsert | null {
  let payee = (row.payee || "").trim();
  const recordId = (row.payee_record_number || "").trim();
  // If no payee but we have a record ID, look up the payee name
  if (!payee && recordId && payeeMap) {
    payee = payeeMap.get(recordId) || "";
  }
  if (!payee) return null;
  return {
    payee,
    amount: parseAmount(row.amount),
    check_number: row.check_number || null,
    check_date: parseDate(row.check_date),
    status: (["Open", "Printed", "Given", "Cleared", "Void"].includes(row.status) ? row.status : "Open") as any,
    memo: row.memo || null,
    stub_memo: row.stub_memo || null,
    payee_record_number: recordId || null,
    given_to_payee: row.given_to_payee || null,
    given_to_record_number: row.given_to_record_number || null,
    chalikah_id: null,
    run_no: row.run_no || null,
    account_id: accountId,
  };
}

interface CheckBulkImportProps {
  accountId: string | null;
  existingChecks?: { check_number: string | null }[];
}

export function CheckBulkImport({ accountId, existingChecks = [] }: CheckBulkImportProps) {
  const [open, setOpen] = useState(false);
  const [csvText, setCsvText] = useState("");
  const [rows, setRows] = useState<Record<string, string>[]>([EMPTY_ROW(), EMPTY_ROW(), EMPTY_ROW()]);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileRows, setFileRows] = useState<Record<string, string>[]>([]);
  const qc = useQueryClient();

  const nextCheckNumber = useMemo(() => {
    const nums = existingChecks
      .map((c) => parseInt(c.check_number || "", 10))
      .filter((n) => !isNaN(n));
    return nums.length > 0 ? Math.max(...nums) + 1 : 1;
  }, [existingChecks]);

  const importChecks = async (checks: CheckInsert[], onDone: () => void) => {
    if (checks.length === 0) {
      toast.error("No valid checks found");
      return;
    }
    setImporting(true);
    const { error } = await supabase.from("checks").insert(checks);
    setImporting(false);
    if (error) {
      toast.error("Import failed: " + error.message);
    } else {
      toast.success(`${checks.length} check(s) imported`);
      qc.invalidateQueries({ queryKey: ["checks"] });
      onDone();
      setOpen(false);
    }
  };

  const resolveAndImport = async (rawRows: Record<string, string>[], onDone: () => void) => {
    // Collect record IDs that need payee lookup
    const recordIds = rawRows
      .filter((r) => !r.payee?.trim() && r.payee_record_number?.trim())
      .map((r) => r.payee_record_number.trim());
    const payeeMap = await lookupPayeesByRecordId(recordIds);
    const checks = rawRows.map((r) => rowToCheck(r, accountId, payeeMap)).filter(Boolean) as CheckInsert[];
    importChecks(checks, onDone);
  };

  const handleCSVImport = () => {
    const parsed = parseCheckCSV(csvText);
    resolveAndImport(parsed, () => setCsvText(""));
  };

  const handleMultiRowSubmit = () => {
    resolveAndImport(rows, () => setRows([EMPTY_ROW(), EMPTY_ROW(), EMPTY_ROW()]));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array", cellDates: true });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonRows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: "", raw: false });

        const mapped = jsonRows.map((row) => {
          const result: Record<string, string> = {};
          Object.entries(row).forEach(([header, value]) => {
            const match = matchCheckHeader(header);
            if (match) result[match] = String(value);
          });
          return result;
        });

        setFileRows(mapped);
        toast.success(`Parsed ${mapped.length} row(s) from ${file.name}`);
      } catch {
        toast.error("Failed to parse file. Make sure it's a valid CSV or Excel file.");
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = "";
  };

  const handleFileImport = () => {
    resolveAndImport(fileRows, () => { setFileRows([]); setFileName(null); });
  };

  const updateRow = (idx: number, key: string, value: string) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, [key]: value } : r)));
  };
  const addRow = () => setRows((prev) => [...prev, EMPTY_ROW()]);
  const removeRow = (idx: number) => setRows((prev) => prev.filter((_, i) => i !== idx));

  const copyDown = (key: string, fromRow = 0) => {
    setRows((prev) => {
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

  const autoNumberChecks = () => {
    setRows((prev) => prev.map((r, i) => ({
      ...r,
      check_number: r.check_number || String(nextCheckNumber + i),
    })));
  };

  const addMultipleRows = (count: number) => {
    setRows((prev) => [...prev, ...Array.from({ length: count }, () => EMPTY_ROW())]);
  };

  const MULTI_ROW_KEYS: CheckColumnKey[] = ["payee_record_number", "payee", "amount", "check_number", "check_date", "run_no", "status", "memo"];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Upload className="h-4 w-4 mr-2" />
          Import
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Checks</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="file">
          <TabsList>
            <TabsTrigger value="file">Upload File</TabsTrigger>
            <TabsTrigger value="csv">Paste CSV</TabsTrigger>
            <TabsTrigger value="rows">Multi-Row Form</TabsTrigger>
          </TabsList>

          <TabsContent value="file" className="space-y-4 pt-2">
            <div className="flex flex-col items-center gap-4 py-6 border-2 border-dashed border-border rounded-lg">
              <FileUp className="h-10 w-10 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Upload a CSV or Excel (.xlsx, .xls) file</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                className="hidden"
                onChange={handleFileUpload}
              />
              <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                Choose File
              </Button>
              {fileName && (
                <p className="text-sm font-medium">{fileName} — {fileRows.length} row(s) parsed</p>
              )}
            </div>
            {fileRows.length > 0 && (
              <div className="overflow-x-auto max-h-48 rounded border border-border">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-muted/50">
                      {CHECK_COLUMN_KEYS.filter((k) => fileRows.some((r) => r[k])).map((k) => (
                        <th key={k} className="text-left px-2 py-1 font-semibold text-muted-foreground whitespace-nowrap">
                          {CHECK_COLUMN_LABELS[k]}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {fileRows.slice(0, 20).map((row, i) => (
                      <tr key={i} className="border-t border-border">
                        {CHECK_COLUMN_KEYS.filter((k) => fileRows.some((r) => r[k])).map((k) => (
                          <td key={k} className="px-2 py-1 whitespace-nowrap">{row[k] || ""}</td>
                        ))}
                      </tr>
                    ))}
                    {fileRows.length > 20 && (
                      <tr><td colSpan={99} className="px-2 py-1 text-muted-foreground">…and {fileRows.length - 20} more</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={handleFileImport} disabled={importing || fileRows.length === 0}>
                {importing ? "Importing..." : `Import ${fileRows.length} Check(s)`}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="csv" className="space-y-3 pt-2">
            <div>
              <Label className="text-xs text-muted-foreground">
                Paste tab-separated or comma-separated data. Headers: {CHECK_COLUMN_KEYS.join(", ")}
              </Label>
              <Textarea
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                placeholder={"payee\tamount\tcheck_number\tcheck_date\tstatus\tmemo\nJohn Doe\t100\t1001\t2025-01-15\tOpen\tDonation"}
                rows={10}
                className="font-mono text-xs mt-1"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={handleCSVImport} disabled={importing || !csvText.trim()}>
                {importing ? "Importing..." : "Import"}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="rows" className="space-y-3 pt-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Button size="sm" variant="outline" onClick={autoNumberChecks} title="Auto-fill check numbers starting from next available">
                Auto Check #s (from {nextCheckNumber})
              </Button>
              <span className="text-xs text-muted-foreground">Use header ↓ or row ↓ buttons to copy/fill down.</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr>
                    {MULTI_ROW_KEYS.map((k) => (
                      <th key={k} className="text-left px-1 py-1 font-semibold text-muted-foreground">
                        <div className="flex items-center gap-1">
                          {CHECK_COLUMN_LABELS[k]}
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-5 w-5 opacity-50 hover:opacity-100"
                            onClick={() => copyDown(k, 0)}
                            title={`${k === "check_number" ? "Fill" : "Copy"} ${CHECK_COLUMN_LABELS[k]} down from top row`}
                          >
                            <ArrowDown className="h-3 w-3" />
                          </Button>
                        </div>
                      </th>
                    ))}
                    <th className="w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, idx) => (
                    <tr key={idx}>
                       {MULTI_ROW_KEYS.map((k, colIdx) => (
                        <td key={k} className="px-1 py-0.5">
                          <div className="flex items-center gap-0.5">
                            <Input
                              className="h-8 text-xs flex-1"
                              value={row[k] || ""}
                              onChange={(e) => updateRow(idx, k, e.target.value)}
                              placeholder={CHECK_COLUMN_LABELS[k]}
                              type={k === "amount" ? "number" : k === "check_date" ? "date" : "text"}
                              data-row={idx}
                              data-col={colIdx}
                              onKeyDown={(e) => {
                                const totalCols = MULTI_ROW_KEYS.length;
                                const totalRows = rows.length;
                                let nextRow = idx;
                                let nextCol = colIdx;
                                if (e.key === "ArrowDown") { nextRow = Math.min(idx + 1, totalRows - 1); }
                                else if (e.key === "ArrowUp") { nextRow = Math.max(idx - 1, 0); }
                                else if (e.key === "ArrowRight" && (e.target as HTMLInputElement).selectionStart === (e.target as HTMLInputElement).value.length) {
                                  if (colIdx < totalCols - 1) nextCol = colIdx + 1;
                                  else if (idx < totalRows - 1) { nextRow = idx + 1; nextCol = 0; }
                                } else if (e.key === "ArrowLeft" && (e.target as HTMLInputElement).selectionStart === 0) {
                                  if (colIdx > 0) nextCol = colIdx - 1;
                                  else if (idx > 0) { nextRow = idx - 1; nextCol = totalCols - 1; }
                                } else if (e.key === "Tab" && !e.shiftKey) {
                                  if (colIdx < totalCols - 1) { nextCol = colIdx + 1; }
                                  else if (idx < totalRows - 1) { nextRow = idx + 1; nextCol = 0; }
                                  else return;
                                  e.preventDefault();
                                } else if (e.key === "Tab" && e.shiftKey) {
                                  if (colIdx > 0) { nextCol = colIdx - 1; }
                                  else if (idx > 0) { nextRow = idx - 1; nextCol = totalCols - 1; }
                                  else return;
                                  e.preventDefault();
                                } else if (e.key === "Enter") {
                                  nextRow = Math.min(idx + 1, totalRows - 1);
                                  e.preventDefault();
                                } else return;
                                if (nextRow !== idx || nextCol !== colIdx) {
                                  const next = document.querySelector<HTMLInputElement>(`input[data-row="${nextRow}"][data-col="${nextCol}"]`);
                                  next?.focus();
                                }
                              }}
                            />
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6 shrink-0 opacity-40 hover:opacity-100"
                              onClick={() => copyDown(k, idx)}
                              title={`${k === "check_number" ? "Fill" : "Copy"} ${CHECK_COLUMN_LABELS[k]} down from row ${idx + 1}`}
                            >
                              <ArrowDown className="h-3 w-3" />
                            </Button>
                          </div>
                        </td>
                      ))}
                      <td className="px-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => removeRow(idx)}
                          disabled={rows.length <= 1}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => addRow()}>
                <Plus className="h-3 w-3 mr-1" /> Add Row
              </Button>
              <Button size="sm" variant="outline" onClick={() => addMultipleRows(5)}>
                +5 Rows
              </Button>
              <Button size="sm" variant="outline" onClick={() => addMultipleRows(10)}>
                +10 Rows
              </Button>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={handleMultiRowSubmit} disabled={importing}>
                {importing ? "Adding..." : "Add Checks"}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
