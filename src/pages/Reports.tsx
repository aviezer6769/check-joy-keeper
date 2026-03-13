import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Save, Download, Trash2, FileText, Eye, Filter } from "lucide-react";
import { useChecks, type Check } from "@/hooks/useChecks";
import { useChalikah } from "@/hooks/useChalikah";
import { useAccounts } from "@/hooks/useAccounts";
import { usePayees } from "@/hooks/usePayees";
import { useSavedReports, useSaveReport, useDeleteReport, type SavedReport } from "@/hooks/useReports";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useColumnLayout, type ColumnDef, type FilterMode } from "@/hooks/useColumnLayout";
import { ColumnLayoutManager } from "@/components/ColumnLayoutManager";
import { DraggableTableHeader } from "@/components/DraggableTableHeader";
import * as XLSX from "xlsx";

const fmt = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" });

const STATIC_REPORT_COLS: ColumnDef[] = [
  { key: "sort_order", label: "Sort" },
  { key: "record_id", label: "Record ID" },
  { key: "urgent_level", label: "Urgent" },
  { key: "is_active", label: "Active" },
  { key: "yiddish_name", label: "Yiddish Name" },
  { key: "payee_name", label: "Payee" },
  { key: "address", label: "Address" },
  { key: "memo", label: "Memo", defaultVisible: false },
];

const Reports = () => {
  const { data: allChecks = [], isLoading: checksLoading } = useChecks(undefined, undefined);
  const { data: chalikahList = [] } = useChalikah();
  const { data: accounts = [] } = useAccounts();
  const { data: payeesList = [] } = usePayees();
  const { data: savedReports = [], isLoading: reportsLoading } = useSavedReports();
  const saveReport = useSaveReport();
  const deleteReport = useDeleteReport();

  const [accountFilter, setAccountFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("issued");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [reportName, setReportName] = useState("");
  const [viewingReport, setViewingReport] = useState<SavedReport | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedNames, setSelectedNames] = useState<Set<string>>(new Set());
  // Build payee lookup by record_id and payee_name
  const payeeLookup = useMemo(() => {
    const byRecord: Record<string, { record_id: string; yiddish: string; memo: string; address: string; is_active: boolean; urgent_level: number | null; last_name_yiddish: string; first_name_yiddish: string; middle_name_yiddish: string }> = {};
    const byName: Record<string, typeof byRecord[string]> = {};
    payeesList.forEach((p) => {
      const yiddish = [p.title_1_yiddish, p.first_name_yiddish, p.middle_name_yiddish, p.last_name_yiddish, p.title_2_yiddish]
        .filter(Boolean)
        .join(" ");
      const address = [p.street_no, p.street_name, p.apt ? `#${p.apt}` : ""].filter(Boolean).join(" ");
      const entry = {
        record_id: p.record_id || "", yiddish, memo: p.memo || "", address,
        is_active: p.is_active, urgent_level: p.urgent_level,
        last_name_yiddish: p.last_name_yiddish || "",
        first_name_yiddish: p.first_name_yiddish || "",
        middle_name_yiddish: p.middle_name_yiddish || "",
      };
      if (p.record_id) byRecord[p.record_id] = entry;
      byName[p.payee_name.toLowerCase()] = entry;
    });
    return { byRecord, byName };
  }, [payeesList]);

  const getPayeeInfo = (payeeName: string, recordNumber: string | null) => {
    if (recordNumber && payeeLookup.byRecord[recordNumber]) {
      return payeeLookup.byRecord[recordNumber];
    }
    return payeeLookup.byName[payeeName.toLowerCase()] || { record_id: "", yiddish: "", memo: "", address: "", is_active: true, urgent_level: null, last_name_yiddish: "", first_name_yiddish: "", middle_name_yiddish: "" };
  };

  // Filter checks
  const filteredChecks = useMemo(() => {
    let result = allChecks;
    if (accountFilter !== "all") {
      result = result.filter((c) => c.account_id === accountFilter);
    }
    if (statusFilter === "issued") {
      result = result.filter((c) => c.status === "Given" || c.status === "Cleared");
    } else if (statusFilter === "pending") {
      result = result.filter((c) => c.status === "Open" || c.status === "Printed");
    } else if (statusFilter !== "all") {
      result = result.filter((c) => c.status === statusFilter);
    }
    if (dateFrom) {
      result = result.filter((c) => c.check_date >= dateFrom);
    }
    if (dateTo) {
      result = result.filter((c) => c.check_date <= dateTo);
    }
    return result;
  }, [allChecks, accountFilter, statusFilter, dateFrom, dateTo]);

  // Build payee × chalikah matrix
  const { matrix, payeeRows, chalikahCols, grandTotal } = useMemo(() => {
    const map: Record<string, Record<string, number>> = {};
    const payeeMap: Record<string, { key: string; name: string; record_id: string; yiddish: string; memo: string; address: string; is_active: boolean; urgent_level: number | null; last_name_yiddish: string; first_name_yiddish: string; middle_name_yiddish: string }> = {};
    const chalikahIds = new Set<string>();

    // Attribute check to given_to if different from check payee, same as payee list
    filteredChecks.forEach((c) => {
      // Use given_to_record_number first (the actual recipient), fall back to payee_record_number
      const effectiveRecordNumber = c.given_to_record_number || c.payee_record_number;
      const effectivePayee = c.given_to_payee || c.payee || "(No Payee)";
      const info = getPayeeInfo(effectivePayee, effectiveRecordNumber);
      // Deduplicate by record_id when available, otherwise by payee name
      const dedupeKey = (effectiveRecordNumber && info.record_id)
        ? `__rid__${info.record_id}`
        : effectivePayee;
      const chId = c.chalikah_id || "__none__";
      chalikahIds.add(chId);
      if (!map[dedupeKey]) {
        map[dedupeKey] = {};
        payeeMap[dedupeKey] = { key: dedupeKey, name: effectivePayee, ...info };
      }
      map[dedupeKey][chId] = (map[dedupeKey][chId] || 0) + c.amount;
    });

    const chalikahNameMap = Object.fromEntries(chalikahList.map((c) => [c.id, c.name]));
    const cols = Array.from(chalikahIds).map((id) => ({
      id,
      name: id === "__none__" ? "(No Chalikah)" : chalikahNameMap[id] || id,
    }));
    cols.sort((a, b) => a.name.localeCompare(b.name));

    const rows = Object.values(payeeMap).sort((a, b) => a.name.localeCompare(b.name));
    let gt = 0;
    filteredChecks.forEach((c) => (gt += c.amount));

    return { matrix: map, payeeRows: rows, chalikahCols: cols, grandTotal: gt };
  }, [filteredChecks, chalikahList, payeeLookup]);

  // Dynamic columns = static cols + chalikah cols + total
  const allReportColumns: ColumnDef[] = useMemo(() => [
    ...STATIC_REPORT_COLS,
    ...chalikahCols.map((col) => ({ key: `ch_${col.id}`, label: col.name })),
    { key: "total", label: "Total" },
  ], [chalikahCols]);

  const colLayout = useColumnLayout("reports", allReportColumns);

  const currentFilters = { accountFilter, statusFilter, dateFrom, dateTo };

  const buildReportData = () => ({
    payeeRows,
    chalikahCols,
    matrix,
    grandTotal,
    generatedAt: new Date().toISOString(),
  });

  const handleSave = () => {
    if (!reportName.trim()) return;
    saveReport.mutate(
      {
        name: reportName.trim(),
        report_type: "payee_chalikah",
        filters: currentFilters,
        report_data: buildReportData(),
      },
      { onSuccess: () => { setSaveDialogOpen(false); setReportName(""); } }
    );
  };

  const handleExport = (data?: any) => {
    const src = data || buildReportData();
    // Use displayedRows (sorted/filtered) for live view, or saved data's payeeRows
    const baseRows = data ? (src.payeeRows as typeof payeeRows) : displayedRows;
    // If there's a selection, export only selected; otherwise export all displayed
    const exportPayees = selectedNames.size > 0
      ? baseRows.filter((pr) => selectedNames.has(pr.key))
      : baseRows;
    const rows = exportPayees.map((pr) => {
      const row: Record<string, any> = {};
      colLayout.visibleColumns.forEach((col) => {
        if (col.key === "record_id") row["Record ID"] = pr.record_id;
        else if (col.key === "urgent_level") row["Urgent"] = pr.urgent_level == null ? "?" : pr.urgent_level;
        else if (col.key === "is_active") row["Active"] = pr.is_active ? "Active" : "Inactive";
        else if (col.key === "yiddish_name") row["Yiddish Name"] = pr.yiddish;
        else if (col.key === "payee_name") row["Payee"] = pr.name;
        else if (col.key === "address") row["Address"] = pr.address || "";
        else if (col.key === "memo") row["Memo"] = pr.memo || "";
        else if (col.key === "total") row["Total"] = Object.values(src.matrix[pr.key] || {}).reduce((s: number, v: any) => s + Number(v), 0);
        else if (col.key.startsWith("ch_")) {
          const chId = col.key.slice(3);
          row[col.label] = src.matrix[pr.key]?.[chId] || 0;
        }
      });
      return row;
    });

    // Totals row
    const totalsRow: Record<string, any> = {};
    colLayout.visibleColumns.forEach((col) => {
      if (col.key === "payee_name") totalsRow["Payee"] = "TOTAL";
      else if (col.key === "record_id") totalsRow["Record ID"] = "";
      else if (col.key === "urgent_level") totalsRow["Urgent"] = "";
      else if (col.key === "is_active") totalsRow["Active"] = "";
      else if (col.key === "yiddish_name") totalsRow["Yiddish Name"] = "";
      else if (col.key === "address") totalsRow["Address"] = "";
      else if (col.key === "total") {
        totalsRow["Total"] = exportPayees.reduce((s: number, pr: any) =>
          s + (Object.values(src.matrix[pr.key] || {}) as number[]).reduce((ss, v) => ss + Number(v), 0), 0);
      } else if (col.key.startsWith("ch_")) {
        const chId = col.key.slice(3);
        totalsRow[col.label] = exportPayees.reduce(
          (s: number, pr: any) => s + (src.matrix[pr.key]?.[chId] || 0), 0
        );
      }
    });
    rows.push(totalsRow);

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Report");
    XLSX.writeFile(wb, "report.xlsx");
  };

  // Helper to get cell text value for filtering/sorting
  const getRowTextValue = (
    pr: typeof payeeRows[number],
    colKey: string,
    matrixData: Record<string, Record<string, number>>
  ): string => {
    if (colKey === "sort_order") return "";
    if (colKey === "record_id") return pr.record_id || "";
    if (colKey === "urgent_level") return pr.urgent_level == null ? "?" : String(pr.urgent_level);
    if (colKey === "is_active") return pr.is_active ? "Active" : "Inactive";
    if (colKey === "yiddish_name") return pr.yiddish || "";
    if (colKey === "payee_name") return pr.name;
    if (colKey === "address") return pr.address || "";
    if (colKey === "memo") return pr.memo || "";
    if (colKey === "total") {
      return String(Object.values(matrixData[pr.key] || {}).reduce((s, v) => s + v, 0));
    }
    if (colKey.startsWith("ch_")) {
      const chId = colKey.slice(3);
      return String(matrixData[pr.key]?.[chId] || 0);
    }
    return "";
  };

  const getRowSortValue = (
    pr: typeof payeeRows[number],
    colKey: string,
    matrixData: Record<string, Record<string, number>>
  ): string | number => {
    if (colKey === "record_id") {
      const n = parseFloat(pr.record_id || "");
      return isNaN(n) ? (pr.record_id || "").toLowerCase() : n;
    }
    if (colKey === "urgent_level") return pr.urgent_level ?? -1;
    if (colKey === "is_active") return pr.is_active ? 1 : 0;
    if (colKey === "yiddish_name") return (pr.yiddish || "").toLowerCase();
    if (colKey === "payee_name") return pr.name.toLowerCase();
    if (colKey === "address") return (pr.address || "").toLowerCase();
    if (colKey === "memo") return (pr.memo || "").toLowerCase();
    if (colKey === "total") return Object.values(matrixData[pr.key] || {}).reduce((s, v) => s + v, 0);
    if (colKey.startsWith("ch_")) {
      const chId = colKey.slice(3);
      return matrixData[pr.key]?.[chId] || 0;
    }
    return "";
  };

  // Apply column filters + sorting to payeeRows
  const displayedRows = useMemo(() => {
    const activeFilters = Object.entries(colLayout.filters).filter(([, v]) => v.length > 0);
    let result = [...payeeRows];

    if (activeFilters.length > 0) {
      result = result.filter((pr) =>
        activeFilters.every(([key, val]) => {
          const text = getRowTextValue(pr, key, matrix);
          if (val === "__blank__") return !text || text.trim() === "" || text === "0";
          const mode = colLayout.filterModes[key] || "contains";
          const tl = text.toLowerCase();
          const vl = val.toLowerCase();
          const numT = parseFloat(text);
          const numV = parseFloat(val);
          switch (mode) {
            case "equals": return tl === vl;
            case "not": return tl !== vl;
            case "gt": return !isNaN(numT) && !isNaN(numV) && numT > numV;
            case "lt": return !isNaN(numT) && !isNaN(numV) && numT < numV;
            case "gte": return !isNaN(numT) && !isNaN(numV) && numT >= numV;
            case "lte": return !isNaN(numT) && !isNaN(numV) && numT <= numV;
            case "contains":
            default: return tl.includes(vl);
          }
        })
      );
    }

    if (colLayout.sort) {
      const { key, dir } = colLayout.sort;
      if (key === "sort_order") {
        // Composite sort: active first, urgent priority 1 > 2 > 3 > 0 > ?, then Hebrew name
        result.sort((a, b) => {
          const mul = dir === "asc" ? 1 : -1;
          const activeA = a.is_active ? 0 : 1;
          const activeB = b.is_active ? 0 : 1;
          if (activeA !== activeB) return (activeA - activeB) * mul;
          const getUrgencyPriority = (value: number | null | undefined) =>
            value === 1 ? 0 : value === 2 ? 1 : value === 3 ? 2 : value === 0 ? 3 : 4;
          const urgA = getUrgencyPriority(a.urgent_level);
          const urgB = getUrgencyPriority(b.urgent_level);
          if (urgA !== urgB) return (urgA - urgB) * mul;
          const lastCmp = a.last_name_yiddish.localeCompare(b.last_name_yiddish, "he");
          if (lastCmp !== 0) return lastCmp * mul;
          const firstCmp = a.first_name_yiddish.localeCompare(b.first_name_yiddish, "he");
          if (firstCmp !== 0) return firstCmp * mul;
          return a.middle_name_yiddish.localeCompare(b.middle_name_yiddish, "he") * mul;
        });
      } else {
        result.sort((a, b) => {
          const va = getRowSortValue(a, key, matrix);
          const vb = getRowSortValue(b, key, matrix);
          if (va < vb) return dir === "asc" ? -1 : 1;
          if (va > vb) return dir === "asc" ? 1 : -1;
          return 0;
        });
      }
    }

    return result;
  }, [payeeRows, matrix, colLayout.filters, colLayout.filterModes, colLayout.sort]);

  // Filter options for dropdown
  const reportFilterOptions = useMemo(() => {
    const opts: Record<string, Set<string>> = {};
    for (const col of colLayout.visibleColumns) opts[col.key] = new Set();
    for (const pr of payeeRows) {
      for (const col of colLayout.visibleColumns) {
        const val = getRowTextValue(pr, col.key, matrix);
        if (val && val !== "0") opts[col.key]?.add(val);
      }
    }
    const result: Record<string, string[]> = {};
    for (const [key, set] of Object.entries(opts)) {
      result[key] = Array.from(set).sort();
    }
    return result;
  }, [payeeRows, matrix, colLayout.visibleColumns]);

  // Compute filtered grand total
  const filteredGrandTotal = useMemo(() =>
    displayedRows.reduce((s, pr) =>
      s + Object.values(matrix[pr.key] || {}).reduce((ss, v) => ss + v, 0), 0
    ), [displayedRows, matrix]);

  const renderMatrix = (
    rows: typeof payeeRows,
    cols: typeof chalikahCols,
    matrixData: Record<string, Record<string, number>>,
    total: number,
    visibleCols?: ColumnDef[],
    isStatic?: boolean
  ) => {
    const visCols = visibleCols || colLayout.visibleColumns;

    return (
      <div className="overflow-auto border rounded-lg">
        {!isStatic && selectedNames.size > 0 && (
          <div className="px-4 py-2 bg-muted/50 border-b text-sm text-muted-foreground flex items-center gap-2">
            {selectedNames.size} selected
            <Button variant="ghost" size="sm" onClick={() => setSelectedNames(new Set())}>
              Clear
            </Button>
          </div>
        )}
        <Table>
          <TableHeader>
            {isStatic ? (
              <TableRow>
                {visCols.map((col) => (
                  <TableHead
                    key={col.key}
                    className={
                      col.key === "record_id" || col.key === "yiddish_name" || col.key === "payee_name"
                        ? "sticky left-0 bg-muted z-10 min-w-[120px]"
                        : "text-right min-w-[120px]"
                    }
                    style={col.key === "yiddish_name" ? { direction: "rtl" } : undefined}
                  >
                    {col.label}
                  </TableHead>
                ))}
              </TableRow>
            ) : (
              <DraggableTableHeader
                columns={visCols}
                widths={colLayout.widths}
                sort={colLayout.sort}
                onToggleSort={colLayout.toggleSort}
                onReorder={colLayout.reorderColumn}
                onSetWidth={colLayout.setColumnWidth}
                columnClassName={(key) =>
                  key === "record_id" || key === "yiddish_name" || key === "payee_name" || key === "memo" || key === "address"
                    ? "min-w-[120px]"
                    : "text-right min-w-[120px]"
                }
                isRtl={(key) => key === "yiddish_name"}
                showFilters={showFilters}
                filters={colLayout.filters}
                filterModes={colLayout.filterModes}
                onFilterChange={colLayout.setFilter}
                onFilterModeChange={colLayout.setFilterMode}
                filterOptions={reportFilterOptions}
                prefix={
                  <TableHead className="w-10">
                    <Checkbox
                      checked={rows.length > 0 && rows.every((pr) => selectedNames.has(pr.key))}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedNames(new Set(rows.map((pr) => pr.key)));
                        } else {
                          setSelectedNames(new Set());
                        }
                      }}
                    />
                  </TableHead>
                }
              />
            )}
          </TableHeader>
          <TableBody>
            {rows.map((pr) => {
              const rowTotal = Object.values(matrixData[pr.key] || {}).reduce((s, v) => s + v, 0);
              return (
                <TableRow key={pr.key} className={!isStatic && selectedNames.has(pr.key) ? "bg-muted/30" : undefined}>
                  {!isStatic && (
                    <TableCell className="w-10">
                      <Checkbox
                        checked={selectedNames.has(pr.key)}
                        onCheckedChange={(checked) => {
                          setSelectedNames((prev) => {
                            const next = new Set(prev);
                            if (checked) next.add(pr.key);
                            else next.delete(pr.key);
                            return next;
                          });
                        }}
                      />
                    </TableCell>
                  )}
                  {visCols.map((col) => {
                    if (col.key === "sort_order") {
                      const parts = [pr.is_active ? "✓" : "✗", pr.urgent_level === null || pr.urgent_level === undefined ? "?" : String(pr.urgent_level)].join("/");
                      return <TableCell key={col.key} className="bg-background"><span className="text-muted-foreground text-xs">{parts}</span></TableCell>;
                    }
                    if (col.key === "record_id")
                      return <TableCell key={col.key} className="sticky left-0 bg-background z-10">{pr.record_id || "—"}</TableCell>;
                    if (col.key === "urgent_level") {
                      if (pr.urgent_level == null) return <TableCell key={col.key} className="bg-background"><Badge variant="outline">?</Badge></TableCell>;
                      return <TableCell key={col.key} className="bg-background">{pr.urgent_level > 0 ? <Badge variant="destructive">{pr.urgent_level}</Badge> : <span className="text-muted-foreground">0</span>}</TableCell>;
                    }
                    if (col.key === "is_active")
                      return <TableCell key={col.key} className="bg-background">{pr.is_active ? <Badge variant="default" className="bg-success text-success-foreground">Active</Badge> : <Badge variant="secondary">Inactive</Badge>}</TableCell>;
                    if (col.key === "yiddish_name")
                      return <TableCell key={col.key} className="bg-background" dir="rtl">{pr.yiddish || "—"}</TableCell>;
                    if (col.key === "payee_name")
                      return <TableCell key={col.key} className="bg-background font-medium">{pr.name}</TableCell>;
                    if (col.key === "address")
                      return <TableCell key={col.key} className="bg-background">{pr.address || "—"}</TableCell>;
                    if (col.key === "memo")
                      return <TableCell key={col.key} className="bg-background text-sm max-w-[300px] whitespace-pre-line">{pr.memo || "—"}</TableCell>;
                    if (col.key === "total")
                      return <TableCell key={col.key} className="text-right font-bold tabular-nums">{fmt(rowTotal)}</TableCell>;
                    if (col.key.startsWith("ch_")) {
                      const chId = col.key.slice(3);
                      return (
                        <TableCell key={col.key} className="text-right tabular-nums">
                          {matrixData[pr.key]?.[chId] ? fmt(matrixData[pr.key][chId]) : "—"}
                        </TableCell>
                      );
                    }
                    return <TableCell key={col.key}>—</TableCell>;
                  })}
                </TableRow>
              );
            })}
            {/* Totals row */}
            <TableRow className="bg-muted/50 font-bold">
              {!isStatic && <TableCell className="bg-muted/50" />}
              {visCols.map((col) => {
                if (col.key === "sort_order")
                  return <TableCell key={col.key} className="bg-muted/50" />;
                if (col.key === "record_id")
                  return <TableCell key={col.key} className="sticky left-0 bg-muted/50 z-10" />;
                if (col.key === "yiddish_name")
                  return <TableCell key={col.key} className="bg-muted/50" />;
                if (col.key === "payee_name")
                  return <TableCell key={col.key} className="bg-muted/50">TOTAL</TableCell>;
                if (col.key === "address" || col.key === "memo" || col.key === "is_active")
                  return <TableCell key={col.key} className="bg-muted/50" />;
                if (col.key === "total")
                  return <TableCell key={col.key} className="text-right tabular-nums">{fmt(total)}</TableCell>;
                if (col.key.startsWith("ch_")) {
                  const chId = col.key.slice(3);
                  const colTotal = rows.reduce((s, pr) => s + (matrixData[pr.key]?.[chId] || 0), 0);
                  return <TableCell key={col.key} className="text-right tabular-nums">{fmt(colTotal)}</TableCell>;
                }
                return <TableCell key={col.key} />;
              })}
            </TableRow>
          </TableBody>
        </Table>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Reports</h1>
              <p className="text-sm text-muted-foreground mt-1">Payee totals by Chalikah</p>
            </div>
            <Link to="/">
              <Button variant="outline">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Checks
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="container py-6 space-y-6">
        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4 items-end">
              <div className="space-y-1">
                <Label>Account</Label>
                <Select value={accountFilter} onValueChange={setAccountFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Accounts</SelectItem>
                    {accounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>{a.account_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Status</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="issued">Issued (Given+Cleared)</SelectItem>
                    <SelectItem value="pending">Pending (Open+Printed)</SelectItem>
                    <SelectItem value="Void">Void</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>From</Label>
                <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-[160px]" />
              </div>
              <div className="space-y-1">
                <Label>To</Label>
                <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-[160px]" />
              </div>
              <div className="flex gap-2 ml-auto">
                <Button
                  variant={showFilters ? "default" : "outline"}
                  size="sm"
                  onClick={() => setShowFilters(!showFilters)}
                >
                  <Filter className="h-4 w-4 mr-2" />
                  Column Filters
                </Button>
                <ColumnLayoutManager
                  visibleColumns={colLayout.visibleColumns}
                  hiddenColumns={colLayout.hiddenColumns}
                  allColumns={allReportColumns}
                  widths={colLayout.widths}
                  onToggle={colLayout.toggleColumn}
                  onReorder={colLayout.reorderColumn}
                  onReset={colLayout.resetLayout}
                  onSetWidth={colLayout.setColumnWidth}
                />
                <Button variant="outline" onClick={() => handleExport()}>
                  <Download className="h-4 w-4 mr-2" />
                  {selectedNames.size > 0 ? `Export ${selectedNames.size} Selected` : "Export"}
                </Button>
                <Button onClick={() => setSaveDialogOpen(true)}>
                  <Save className="h-4 w-4 mr-2" />
                  Save Report
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Live matrix */}
        {checksLoading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">Loading...</div>
        ) : payeeRows.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">No checks match the current filters.</div>
        ) : (
          renderMatrix(displayedRows, chalikahCols, matrix, filteredGrandTotal)
        )}

        {/* Saved reports */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Saved Reports</CardTitle>
          </CardHeader>
          <CardContent>
            {reportsLoading ? (
              <p className="text-muted-foreground">Loading...</p>
            ) : savedReports.length === 0 ? (
              <p className="text-muted-foreground">No saved reports yet.</p>
            ) : (
              <div className="space-y-2">
                {savedReports.map((r) => (
                  <div key={r.id} className="flex items-center justify-between rounded-lg border p-3">
                    <div className="flex items-center gap-3">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="font-medium">{r.name}</p>
                        <p className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="ghost" onClick={() => setViewingReport(r)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleExport(r.report_data as any)}>
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => deleteReport.mutate(r.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Save dialog */}
      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Report</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Label>Report Name</Label>
            <Input
              value={reportName}
              onChange={(e) => setReportName(e.target.value)}
              placeholder="e.g. Q1 2026 Summary"
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={!reportName.trim() || saveReport.isPending}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View saved report dialog */}
      <Dialog open={!!viewingReport} onOpenChange={() => setViewingReport(null)}>
        <DialogContent className="max-w-[90vw] max-h-[85vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>{viewingReport?.name}</DialogTitle>
          </DialogHeader>
          {viewingReport && (() => {
            const rd = viewingReport.report_data as any;
            // Saved reports show all columns from stored data
            const savedCols: ColumnDef[] = [
              { key: "sort_order", label: "Sort" },
              { key: "record_id", label: "Record ID" },
              { key: "yiddish_name", label: "Yiddish Name" },
              { key: "payee_name", label: "Payee" },
              { key: "memo", label: "Memo" },
              ...(rd.chalikahCols || []).map((c: any) => ({ key: `ch_${c.id}`, label: c.name })),
              { key: "total", label: "Total" },
            ];
            return renderMatrix(
              rd.payeeRows || [],
              rd.chalikahCols || [],
              rd.matrix || {},
              rd.grandTotal || 0,
              savedCols,
              true
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Reports;
