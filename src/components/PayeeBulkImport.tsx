import { useRef, useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePayees, type PayeeInsert } from "@/hooks/usePayees";
import { Upload, Plus, Trash2, FileUp, ArrowDown } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import * as XLSX from "xlsx";
import { buildPayeeName, formatPhone } from "@/lib/payee-utils";
import { FieldSuggestInput } from "@/components/FieldSuggestInput";


const COLUMN_KEYS: (keyof PayeeInsert)[] = [
  "payee_name", "record_id", "sort_order", "urgent_level",
  "title_1_yiddish", "first_name_yiddish", "middle_name_yiddish", "last_name_yiddish", "title_2_yiddish",
  "title", "title_to_use", "first_name", "middle_name", "last_name",
  "street_no", "street_name", "apt", "city", "state", "zip", "phone", "memo",
];

const COLUMN_LABELS: Record<string, string> = {
  payee_name: "Payee Name", record_id: "Record ID", sort_order: "Sort Order", urgent_level: "Urgent Level",
  title_1_yiddish: "טיטל 1", first_name_yiddish: "ערשטע נאמען", middle_name_yiddish: "מיטעלסטע",
  last_name_yiddish: "לעצטע", title_2_yiddish: "טיטל 2",
  title: "Title", title_to_use: "TitleToUse", first_name: "First Name", middle_name: "Middle Name",
  last_name: "Last Name", street_no: "St #", street_name: "Street", apt: "Apt",
  city: "City", state: "State", zip: "Zip", phone: "Phone", memo: "Memo",
};

const RTL_KEYS = new Set([
  "title_1_yiddish", "first_name_yiddish", "middle_name_yiddish", "last_name_yiddish", "title_2_yiddish",
]);


// Additional alternate header names (case-insensitive) that map to column keys
const HEADER_ALIASES: Record<string, keyof PayeeInsert> = {
  "payeename": "payee_name", "payee name": "payee_name", "payee_name": "payee_name",
  "recordid": "record_id", "record id": "record_id", "record_id": "record_id",
  "sortorder": "sort_order", "sort order": "sort_order", "sort_order": "sort_order",
  "urgentlevel": "urgent_level", "urgent level": "urgent_level", "urgent_level": "urgent_level",
  "טיטל 1": "title_1_yiddish", "title_1_yiddish": "title_1_yiddish",
  "ערשטע נאמען": "first_name_yiddish", "first_name_yiddish": "first_name_yiddish",
  "מיטעלסטע": "middle_name_yiddish", "middle_name_yiddish": "middle_name_yiddish",
  "לעצטע": "last_name_yiddish", "last_name_yiddish": "last_name_yiddish",
  "טיטל 2": "title_2_yiddish", "title_2_yiddish": "title_2_yiddish",
  "title": "title", "titletouse": "title_to_use", "titleto use": "title_to_use", "title_to_use": "title_to_use",
  "firstname": "first_name", "first name": "first_name", "first_name": "first_name",
  "middlename": "middle_name", "middle name": "middle_name", "middle_name": "middle_name",
  "lastname": "last_name", "last name": "last_name", "last_name": "last_name",
  "streetno": "street_no", "street no": "street_no", "street_no": "street_no", "st #": "street_no",
  "streetname": "street_name", "street name": "street_name", "street_name": "street_name", "street": "street_name",
  "apt": "apt",
  "city": "city",
  "state": "state",
  "zip": "zip",
  "phone": "phone", "phone number": "phone", "phone_number": "phone", "tel": "phone",
  "memo": "memo", "note": "memo", "notes": "memo",

};

function matchHeader(header: string): keyof PayeeInsert | undefined {
  const trimmed = header.trim();
  // 1. Exact match against aliases (preserving Unicode)
  const lower = trimmed.toLowerCase();
  if (HEADER_ALIASES[lower]) return HEADER_ALIASES[lower];
  // 2. Exact match against column labels
  for (const [key, label] of Object.entries(COLUMN_LABELS)) {
    if (trimmed === label || lower === label.toLowerCase()) return key as keyof PayeeInsert;
  }
  // 3. Normalized Latin-only fallback (only if result is non-empty)
  const normalized = lower.replace(/[^a-z0-9_]/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");
  if (normalized) {
    const match = COLUMN_KEYS.find(
      (k) => k === normalized || k.replace(/_/g, "") === normalized.replace(/_/g, "")
    );
    if (match) return match;
  }
  return undefined;
}

const EMPTY_ROW = (): Record<string, string> =>
  Object.fromEntries(COLUMN_KEYS.map((k) => [k, ""]));

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.trim().split("\n").filter(Boolean);
  if (lines.length === 0) return [];

  const firstLine = lines[0];
  const delimiter = firstLine.includes("\t") ? "\t" : ",";
  const rawHeaders = firstLine.split(delimiter).map((h) => h.trim());

  // Try to map headers to column keys
  const keyMap = new Map<number, keyof PayeeInsert>();
  rawHeaders.forEach((h, i) => {
    const match = matchHeader(h);
    if (match && !Array.from(keyMap.values()).includes(match)) keyMap.set(i, match);
  });

  // If no headers matched, assume column order matches COLUMN_KEYS
  const hasHeaders = keyMap.size > 0;
  const dataLines = hasHeaders ? lines.slice(1) : lines;

  return dataLines.map((line) => {
    const values = line.split(delimiter).map((v) => v.trim());
    const row: Record<string, string> = {};
    if (hasHeaders) {
      keyMap.forEach((key, idx) => {
        row[key] = values[idx] || "";
      });
    } else {
      COLUMN_KEYS.forEach((key, idx) => {
        row[key] = values[idx] || "";
      });
    }
    // Auto-generate payee_name from components
    row.payee_name = buildPayeeName(row) || row.payee_name || "";
    return row;
  });
}

function rowToPayee(row: Record<string, string>): PayeeInsert | null {
  const name = (row.payee_name || "").trim() || buildPayeeName(row).trim();
  if (!name) return null;
  const urgentRaw = (row.urgent_level ?? "").toString().trim();
  return {
    payee_name: name,
    record_id: row.record_id || null,
    sort_order: Number(row.sort_order) || 0,
    urgent_level: (urgentRaw === "?" ? null : Number(urgentRaw) || 0) as any,

    title_1_yiddish: row.title_1_yiddish || null,
    first_name_yiddish: row.first_name_yiddish || null,
    middle_name_yiddish: row.middle_name_yiddish || null,
    last_name_yiddish: row.last_name_yiddish || null,
    title_2_yiddish: row.title_2_yiddish || null,
    title: row.title || null,
    title_to_use: row.title_to_use || null,
    first_name: row.first_name || null,
    middle_name: row.middle_name || null,
    last_name: row.last_name || null,
    street_no: row.street_no || null,
    street_name: row.street_name || null,
    apt: row.apt || null,
    city: row.city || null,
    state: row.state || null,
    zip: row.zip || null,
    is_active: row.is_active === "false" ? false : true,
    memo: row.memo || null,
    phone: row.phone || null,
  };
}

export function PayeeBulkImport() {
  const [open, setOpen] = useState(false);
  const [csvText, setCsvText] = useState("");
  const [rows, setRows] = useState<Record<string, string>[]>([EMPTY_ROW(), EMPTY_ROW(), EMPTY_ROW()]);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileRows, setFileRows] = useState<Record<string, string>[]>([]);
  const qc = useQueryClient();
  const { data: allPayees = [] } = usePayees();

  const nextRecordId = useMemo(() => {
    const nums = allPayees.map((p) => parseInt(p.record_id || "", 10)).filter((n) => !isNaN(n));
    return nums.length > 0 ? String(Math.max(...nums) + 1) : "1";
  }, [allPayees]);

  const suggestionsByField = useMemo(() => {
    const map: Record<string, string[]> = {};
    COLUMN_KEYS.forEach((k) => {
      if (k === "sort_order" || k === "urgent_level") return;
      map[k] = allPayees.map((p) => (p as any)[k]).filter(Boolean) as string[];
    });
    return map;
  }, [allPayees]);


  const importPayees = async (payees: PayeeInsert[], onDone: () => void) => {
    if (payees.length === 0) {
      toast.error("No valid payees found");
      return;
    }
    setImporting(true);
    const { data: inserted, error } = await supabase.from("payees").insert(payees).select();
    setImporting(false);
    if (error) {
      toast.error("Import failed: " + error.message);
    } else {
      const { logAuditBatch } = await import("@/lib/audit");
      await logAuditBatch(
        (inserted || []).map((row: any) => ({
          table: "payees" as const,
          action: "insert" as const,
          recordId: row.id,
          after: row,
        })),
        "Payees bulk import",
      );
      toast.success(`${payees.length} payee(s) imported`);
      qc.invalidateQueries({ queryKey: ["payees"] });
      onDone();
      setOpen(false);
    }
  };

  const handleCSVImport = () => {
    const parsed = parseCSV(csvText);
    const payees = parsed.map(rowToPayee).filter(Boolean) as PayeeInsert[];
    importPayees(payees, () => setCsvText(""));
  };

  const handleMultiRowSubmit = () => {
    const payees = rows.map(rowToPayee).filter(Boolean) as PayeeInsert[];
    importPayees(payees, () => setRows([EMPTY_ROW(), EMPTY_ROW(), EMPTY_ROW()]));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonRows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: "" });

        // Map spreadsheet headers to our column keys
        const usedKeys = new Set<string>();
        const mapped = jsonRows.map((row) => {
          const result: Record<string, string> = {};
          Object.entries(row).forEach(([header, value]) => {
            const match = matchHeader(header);
            if (match) result[match] = String(value);
          });
          result.payee_name = buildPayeeName(result) || result.payee_name || "";
          return result;
        });

        setFileRows(mapped);
        toast.success(`Parsed ${mapped.length} row(s) from ${file.name}`);
      } catch {
        toast.error("Failed to parse file. Make sure it's a valid CSV or Excel file.");
      }
    };
    reader.readAsArrayBuffer(file);
    // Reset input so the same file can be re-selected
    e.target.value = "";
  };

  const handleFileImport = () => {
    const payees = fileRows.map(rowToPayee).filter(Boolean) as PayeeInsert[];
    importPayees(payees, () => {
      setFileRows([]);
      setFileName(null);
    });
  };

  const updateRow = (idx: number, key: string, value: string) => {
    setRows((prev) =>
      prev.map((r, i) => {
        if (i !== idx) return r;
        const next = { ...r, [key]: key === "phone" ? formatPhone(value) : value };
        // Auto-fill city/state/zip from an existing payee with the same street
        if (key === "street_name" && value) {
          const match = allPayees.find(
            (p) => p.street_name?.toLowerCase() === value.toLowerCase()
          );
          if (match) {
            if (!next.city) next.city = match.city || "";
            if (!next.state) next.state = match.state || "";
            if (!next.zip) next.zip = match.zip || "";
          }
        }
        next.payee_name = buildPayeeName(next);
        return next;
      })
    );
  };

  const toggleUnknownUrgent = (idx: number) => {
    setRows((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, urgent_level: r.urgent_level === "?" ? "" : "?" } : r))
    );
  };

  // Copy a value from a row down to all rows below it
  const copyDown = (idx: number, key: string) => {
    setRows((prev) => {
      const value = prev[idx][key] || "";
      return prev.map((r, i) => {
        if (i <= idx) return r;
        const next = { ...r, [key]: value };
        next.payee_name = buildPayeeName(next);
        return next;
      });
    });
  };

  const addRow = () =>
    setRows((prev) => {
      const row = EMPTY_ROW();
      const used = prev.map((r) => parseInt(r.record_id || "", 10)).filter((n) => !isNaN(n));
      const base = used.length > 0 ? Math.max(...used) : parseInt(nextRecordId, 10) - 1;
      row.record_id = String((isNaN(base) ? 0 : base) + 1);
      return [...prev, row];
    });
  const removeRow = (idx: number) => setRows((prev) => prev.filter((_, i) => i !== idx));

  const fillRecordIds = () =>
    setRows((prev) => {
      let n = parseInt(nextRecordId, 10) || 1;
      return prev.map((r) => (r.record_id ? r : { ...r, record_id: String(n++) }));
    });

  const MULTI_ROW_KEYS: (keyof PayeeInsert)[] = COLUMN_KEYS.filter((k) => k !== "payee_name");


  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Upload className="h-4 w-4 mr-1" /> Import
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-[95vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Payees</DialogTitle>
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
                      {COLUMN_KEYS.filter((k) => fileRows.some((r) => r[k])).map((k) => (
                        <th key={k} className="text-left px-2 py-1 font-semibold text-muted-foreground whitespace-nowrap">
                          {COLUMN_LABELS[k]}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {fileRows.slice(0, 20).map((row, i) => (
                      <tr key={i} className="border-t border-border">
                        {COLUMN_KEYS.filter((k) => fileRows.some((r) => r[k])).map((k) => (
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
                {importing ? "Importing..." : `Import ${fileRows.length} Payee(s)`}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="csv" className="space-y-3 pt-2">
            <div>
              <Label className="text-xs text-muted-foreground">
                Paste tab-separated or comma-separated data. First row can be headers matching:
                {" "}{COLUMN_KEYS.join(", ")}
              </Label>
              <Textarea
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                placeholder={"payee_name\trecord_id\tfirst_name\tlast_name\tcity\tstate\tzip\nJohn Doe\t001\tJohn\tDoe\tNew York\tNY\t10001"}
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
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">
                All payee fields are available. Payee Name is auto-generated from TitleToUse + names.
                Use the ↓ button in a header to copy a value down to the rows below.
              </p>
              <Button size="sm" variant="outline" onClick={fillRecordIds} className="shrink-0">
                Auto Record IDs
              </Button>
            </div>
            <div className="overflow-x-auto max-h-[45vh] rounded border border-border">
              <table className="text-xs">
                <thead className="sticky top-0 bg-muted/80 backdrop-blur z-10">
                  <tr>
                    <th className="text-left px-1 py-1 font-semibold text-muted-foreground whitespace-nowrap">
                      Payee Name
                    </th>
                    {MULTI_ROW_KEYS.map((k) => (
                      <th
                        key={k}
                        dir={RTL_KEYS.has(k) ? "rtl" : undefined}
                        className="text-left px-1 py-1 font-semibold text-muted-foreground whitespace-nowrap"
                      >
                        {COLUMN_LABELS[k]}
                      </th>
                    ))}
                    <th className="w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, idx) => (
                    <tr key={idx}>
                      <td className="px-1 py-0.5">
                        <Input
                          className="h-8 text-xs bg-muted min-w-[160px]"
                          value={row.payee_name || ""}
                          readOnly
                          disabled
                        />
                      </td>
                      {MULTI_ROW_KEYS.map((k) => (
                        <td key={k} className="px-1 py-0.5">
                          <div className="flex items-center gap-0.5">
                            {k === "urgent_level" ? (
                              <>
                                <Input
                                  type="number"
                                  className="h-8 text-xs w-16"
                                  value={row[k] === "?" ? "" : row[k] || ""}
                                  onChange={(e) => updateRow(idx, k, e.target.value)}
                                  placeholder={row[k] === "?" ? "?" : "0"}
                                  disabled={row[k] === "?"}
                                />
                                <Button
                                  type="button"
                                  size="sm"
                                  variant={row[k] === "?" ? "default" : "outline"}
                                  className="h-8 px-2 text-xs shrink-0"
                                  onClick={() => toggleUnknownUrgent(idx)}
                                >
                                  ?
                                </Button>
                              </>
                            ) : k === "sort_order" ? (
                              <Input
                                type="number"
                                className="h-8 text-xs w-16"
                                value={row[k] || ""}
                                onChange={(e) => updateRow(idx, k, e.target.value)}
                                placeholder="0"
                              />
                            ) : (
                              <FieldSuggestInput
                                dir={RTL_KEYS.has(k) ? "rtl" : undefined}
                                className="h-8 text-xs min-w-[110px]"
                                value={row[k] || ""}
                                onChange={(v) => updateRow(idx, k, v)}
                                suggestions={suggestionsByField[k] || []}
                                placeholder={COLUMN_LABELS[k]}
                              />
                            )}
                            {idx < rows.length - 1 && (
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                className="h-8 w-6 shrink-0"
                                title="Copy down"
                                onClick={() => copyDown(idx, k)}
                              >
                                <ArrowDown className="h-3 w-3" />
                              </Button>
                            )}
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

            <Button size="sm" variant="outline" onClick={addRow}>
              <Plus className="h-3 w-3 mr-1" /> Add Row
            </Button>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={handleMultiRowSubmit} disabled={importing}>
                {importing ? "Adding..." : "Add Payees"}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
