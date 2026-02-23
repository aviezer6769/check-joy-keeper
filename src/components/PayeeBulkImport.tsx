import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAddPayee, type PayeeInsert } from "@/hooks/usePayees";
import { Upload, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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
  const qc = useQueryClient();

  const handleCSVImport = async () => {
    const parsed = parseCSV(csvText);
    const payees = parsed.map(rowToPayee).filter(Boolean) as PayeeInsert[];
    if (payees.length === 0) {
      toast.error("No valid payees found in pasted data");
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
      setCsvText("");
      setOpen(false);
    }
  };

  const handleMultiRowSubmit = async () => {
    const payees = rows.map(rowToPayee).filter(Boolean) as PayeeInsert[];
    if (payees.length === 0) {
      toast.error("Please fill in at least one payee name");
      return;
    }
    setImporting(true);
    const { error } = await supabase.from("payees").insert(payees);
    setImporting(false);
    if (error) {
      toast.error("Import failed: " + error.message);
    } else {
      toast.success(`${payees.length} payee(s) added`);
      qc.invalidateQueries({ queryKey: ["payees"] });
      setRows([EMPTY_ROW(), EMPTY_ROW(), EMPTY_ROW()]);
      setOpen(false);
    }
  };

  const updateRow = (idx: number, key: string, value: string) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, [key]: value } : r)));
  };

  const addRow = () => setRows((prev) => [...prev, EMPTY_ROW()]);
  const removeRow = (idx: number) => setRows((prev) => prev.filter((_, i) => i !== idx));

  // Show a subset of columns in multi-row for usability
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
        <Tabs defaultValue="csv">
          <TabsList>
            <TabsTrigger value="csv">Paste CSV / Excel</TabsTrigger>
            <TabsTrigger value="rows">Multi-Row Form</TabsTrigger>
          </TabsList>

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
