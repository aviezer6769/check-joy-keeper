import { useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAddPayee, type PayeeInsert } from "@/hooks/usePayees";
import { Upload, Plus, Trash2, FileUp } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import * as XLSX from "xlsx";

const COLUMN_KEYS: (keyof PayeeInsert)[] = [
  "payee_name", "record_id", "sort_order", "urgent_level",
  "title_1_yiddish", "first_name_yiddish", "middle_name_yiddish", "last_name_yiddish", "title_2_yiddish",
  "title", "title_to_use", "first_name", "middle_name", "last_name",
  "street_no", "street_name", "apt", "city", "state", "zip",
];

const COLUMN_LABELS: Record<string, string> = {
  payee_name: "Payee Name", record_id: "Record ID", sort_order: "Sort Order", urgent_level: "Urgent Level",
  title_1_yiddish: "טיטל 1", first_name_yiddish: "ערשטע נאמען", middle_name_yiddish: "מיטעלסטע",
  last_name_yiddish: "לעצטע", title_2_yiddish: "טיטל 2",
  title: "Title", title_to_use: "TitleToUse", first_name: "First Name", middle_name: "Middle Name",
  last_name: "Last Name", street_no: "St #", street_name: "Street", apt: "Apt",
  city: "City", state: "State", zip: "Zip",
};

const EMPTY_ROW = (): Record<string, string> =>
  Object.fromEntries(COLUMN_KEYS.map((k) => [k, ""]));

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.trim().split("\n").filter(Boolean);
  if (lines.length === 0) return [];

  const firstLine = lines[0];
  const delimiter = firstLine.includes("\t") ? "\t" : ",";
  const headerRow = firstLine.split(delimiter).map((h) => h.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_"));

  // Try to map headers to column keys
  const keyMap = new Map<number, keyof PayeeInsert>();
  headerRow.forEach((h, i) => {
    const match = COLUMN_KEYS.find(
      (k) => k === h || k.replace(/_/g, "") === h.replace(/_/g, "") || COLUMN_LABELS[k]?.toLowerCase().replace(/[^a-z0-9]/g, "") === h.replace(/[^a-z0-9]/g, "")
    );
    if (match) keyMap.set(i, match);
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
    // Ensure payee_name exists
    if (!row.payee_name && row.first_name && row.last_name) {
      row.payee_name = `${row.first_name} ${row.last_name}`.trim();
    }
    return row;
  });
}

function rowToPayee(row: Record<string, string>): PayeeInsert | null {
  const name = (row.payee_name || "").trim();
  if (!name) return null;
  return {
    payee_name: name,
    record_id: row.record_id || null,
    sort_order: Number(row.sort_order) || 0,
    urgent_level: Number(row.urgent_level) || 0,
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

  const importPayees = async (payees: PayeeInsert[], onDone: () => void) => {
    if (payees.length === 0) {
      toast.error("No valid payees found");
      return;
    }
    setImporting(true);
    const { error } = await supabase.from("payees").insert(payees);
    setImporting(false);
    if (error) {
      toast.error("Import failed: " + error.message);
    } else {
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
        const mapped = jsonRows.map((row) => {
          const mapped: Record<string, string> = {};
          Object.entries(row).forEach(([header, value]) => {
            const normalized = header.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_");
            const match = COLUMN_KEYS.find(
              (k) =>
                k === normalized ||
                k.replace(/_/g, "") === normalized.replace(/_/g, "") ||
                COLUMN_LABELS[k]?.toLowerCase().replace(/[^a-z0-9]/g, "") === normalized.replace(/[^a-z0-9]/g, "")
            );
            if (match) mapped[match] = String(value);
          });
          if (!mapped.payee_name && mapped.first_name && mapped.last_name) {
            mapped.payee_name = `${mapped.first_name} ${mapped.last_name}`.trim();
          }
          return mapped;
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
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, [key]: value } : r)));
  };

  const addRow = () => setRows((prev) => [...prev, EMPTY_ROW()]);
  const removeRow = (idx: number) => setRows((prev) => prev.filter((_, i) => i !== idx));

  const MULTI_ROW_KEYS: (keyof PayeeInsert)[] = [
    "payee_name", "record_id", "first_name", "last_name", "city", "state", "zip",
  ];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Upload className="h-4 w-4 mr-1" /> Import
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
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
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr>
                    {MULTI_ROW_KEYS.map((k) => (
                      <th key={k} className="text-left px-1 py-1 font-semibold text-muted-foreground">
                        {COLUMN_LABELS[k]}
                      </th>
                    ))}
                    <th className="w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, idx) => (
                    <tr key={idx}>
                      {MULTI_ROW_KEYS.map((k) => (
                        <td key={k} className="px-1 py-0.5">
                          <Input
                            className="h-8 text-xs"
                            value={row[k] || ""}
                            onChange={(e) => updateRow(idx, k, e.target.value)}
                            placeholder={COLUMN_LABELS[k]}
                          />
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
