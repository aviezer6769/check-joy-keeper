import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Save, Download, Trash2, FileText, Eye } from "lucide-react";
import { useChecks, type Check } from "@/hooks/useChecks";
import { useChalikah } from "@/hooks/useChalikah";
import { useAccounts } from "@/hooks/useAccounts";
import { usePayees } from "@/hooks/usePayees";
import { useSavedReports, useSaveReport, useDeleteReport, type SavedReport } from "@/hooks/useReports";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useColumnLayout, type ColumnDef } from "@/hooks/useColumnLayout";
import { ColumnLayoutManager } from "@/components/ColumnLayoutManager";
import * as XLSX from "xlsx";

const fmt = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" });

const STATIC_REPORT_COLS: ColumnDef[] = [
  { key: "record_id", label: "Record ID" },
  { key: "yiddish_name", label: "Yiddish Name" },
  { key: "payee_name", label: "Payee" },
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

  // Build payee lookup by record_id and payee_name
  const payeeLookup = useMemo(() => {
    const byRecord: Record<string, { record_id: string; yiddish: string }> = {};
    const byName: Record<string, { record_id: string; yiddish: string }> = {};
    payeesList.forEach((p) => {
      const yiddish = [p.title_1_yiddish, p.first_name_yiddish, p.middle_name_yiddish, p.last_name_yiddish, p.title_2_yiddish]
        .filter(Boolean)
        .join(" ");
      const entry = { record_id: p.record_id || "", yiddish };
      if (p.record_id) byRecord[p.record_id] = entry;
      byName[p.payee_name.toLowerCase()] = entry;
    });
    return { byRecord, byName };
  }, [payeesList]);

  const getPayeeInfo = (payeeName: string, recordNumber: string | null) => {
    if (recordNumber && payeeLookup.byRecord[recordNumber]) {
      return payeeLookup.byRecord[recordNumber];
    }
    return payeeLookup.byName[payeeName.toLowerCase()] || { record_id: "", yiddish: "" };
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
    const payeeMap: Record<string, { name: string; record_id: string; yiddish: string }> = {};
    const chalikahIds = new Set<string>();

    filteredChecks.forEach((c) => {
      const payee = c.payee || "(No Payee)";
      const chId = c.chalikah_id || "__none__";
      chalikahIds.add(chId);
      if (!map[payee]) {
        map[payee] = {};
        const info = getPayeeInfo(payee, c.payee_record_number);
        payeeMap[payee] = { name: payee, record_id: info.record_id, yiddish: info.yiddish };
      }
      map[payee][chId] = (map[payee][chId] || 0) + c.amount;
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
    const rows = (src.payeeRows as typeof payeeRows).map((pr) => {
      const row: Record<string, any> = {};
      colLayout.visibleColumns.forEach((col) => {
        if (col.key === "record_id") row["Record ID"] = pr.record_id;
        else if (col.key === "yiddish_name") row["Yiddish Name"] = pr.yiddish;
        else if (col.key === "payee_name") row["Payee"] = pr.name;
        else if (col.key === "total") row["Total"] = Object.values(src.matrix[pr.name] || {}).reduce((s: number, v: any) => s + Number(v), 0);
        else if (col.key.startsWith("ch_")) {
          const chId = col.key.slice(3);
          row[col.label] = src.matrix[pr.name]?.[chId] || 0;
        }
      });
      return row;
    });

    // Totals row
    const totalsRow: Record<string, any> = {};
    colLayout.visibleColumns.forEach((col) => {
      if (col.key === "payee_name") totalsRow["Payee"] = "TOTAL";
      else if (col.key === "record_id") totalsRow["Record ID"] = "";
      else if (col.key === "yiddish_name") totalsRow["Yiddish Name"] = "";
      else if (col.key === "total") totalsRow["Total"] = src.grandTotal || 0;
      else if (col.key.startsWith("ch_")) {
        const chId = col.key.slice(3);
        totalsRow[col.label] = (src.payeeRows as typeof payeeRows).reduce(
          (s: number, pr: any) => s + (src.matrix[pr.name]?.[chId] || 0), 0
        );
      }
    });
    rows.push(totalsRow);

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Report");
    XLSX.writeFile(wb, "report.xlsx");
  };

  const renderMatrix = (
    rows: typeof payeeRows,
    cols: typeof chalikahCols,
    matrixData: Record<string, Record<string, number>>,
    total: number,
    visibleCols?: ColumnDef[]
  ) => {
    const visCols = visibleCols || colLayout.visibleColumns;

    return (
      <div className="overflow-auto border rounded-lg">
        <Table>
          <TableHeader>
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
          </TableHeader>
          <TableBody>
            {rows.map((pr) => {
              const rowTotal = Object.values(matrixData[pr.name] || {}).reduce((s, v) => s + v, 0);
              return (
                <TableRow key={pr.name}>
                  {visCols.map((col) => {
                    if (col.key === "record_id")
                      return <TableCell key={col.key} className="sticky left-0 bg-background z-10">{pr.record_id || "—"}</TableCell>;
                    if (col.key === "yiddish_name")
                      return <TableCell key={col.key} className="bg-background" dir="rtl">{pr.yiddish || "—"}</TableCell>;
                    if (col.key === "payee_name")
                      return <TableCell key={col.key} className="bg-background font-medium">{pr.name}</TableCell>;
                    if (col.key === "total")
                      return <TableCell key={col.key} className="text-right font-bold tabular-nums">{fmt(rowTotal)}</TableCell>;
                    if (col.key.startsWith("ch_")) {
                      const chId = col.key.slice(3);
                      return (
                        <TableCell key={col.key} className="text-right tabular-nums">
                          {matrixData[pr.name]?.[chId] ? fmt(matrixData[pr.name][chId]) : "—"}
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
              {visCols.map((col) => {
                if (col.key === "record_id")
                  return <TableCell key={col.key} className="sticky left-0 bg-muted/50 z-10" />;
                if (col.key === "yiddish_name")
                  return <TableCell key={col.key} className="bg-muted/50" />;
                if (col.key === "payee_name")
                  return <TableCell key={col.key} className="bg-muted/50">TOTAL</TableCell>;
                if (col.key === "total")
                  return <TableCell key={col.key} className="text-right tabular-nums">{fmt(total)}</TableCell>;
                if (col.key.startsWith("ch_")) {
                  const chId = col.key.slice(3);
                  const colTotal = rows.reduce((s, pr) => s + (matrixData[pr.name]?.[chId] || 0), 0);
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
                  Export
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
          renderMatrix(payeeRows, chalikahCols, matrix, grandTotal)
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
              { key: "record_id", label: "Record ID" },
              { key: "yiddish_name", label: "Yiddish Name" },
              { key: "payee_name", label: "Payee" },
              ...(rd.chalikahCols || []).map((c: any) => ({ key: `ch_${c.id}`, label: c.name })),
              { key: "total", label: "Total" },
            ];
            return renderMatrix(
              rd.payeeRows || [],
              rd.chalikahCols || [],
              rd.matrix || {},
              rd.grandTotal || 0,
              savedCols
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Reports;
