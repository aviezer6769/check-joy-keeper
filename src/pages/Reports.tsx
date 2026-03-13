import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Save, Download, Trash2, FileText, Eye } from "lucide-react";
import { useChecks, type Check } from "@/hooks/useChecks";
import { useChalikah } from "@/hooks/useChalikah";
import { useAccounts } from "@/hooks/useAccounts";
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
import * as XLSX from "xlsx";

const fmt = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" });

const Reports = () => {
  const { data: allChecks = [], isLoading: checksLoading } = useChecks(undefined, undefined);
  const { data: chalikahList = [] } = useChalikah();
  const { data: accounts = [] } = useAccounts();
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
  const { matrix, payees, chalikahCols, grandTotal } = useMemo(() => {
    const map: Record<string, Record<string, number>> = {};
    const payeeSet = new Set<string>();
    const chalikahIds = new Set<string>();

    filteredChecks.forEach((c) => {
      const payee = c.payee || "(No Payee)";
      const chId = c.chalikah_id || "__none__";
      payeeSet.add(payee);
      chalikahIds.add(chId);
      if (!map[payee]) map[payee] = {};
      map[payee][chId] = (map[payee][chId] || 0) + c.amount;
    });

    const chalikahMap = Object.fromEntries(chalikahList.map((c) => [c.id, c.name]));
    const cols = Array.from(chalikahIds).map((id) => ({
      id,
      name: id === "__none__" ? "(No Chalikah)" : chalikahMap[id] || id,
    }));
    cols.sort((a, b) => a.name.localeCompare(b.name));

    const payeeArr = Array.from(payeeSet).sort((a, b) => a.localeCompare(b));
    let gt = 0;
    filteredChecks.forEach((c) => (gt += c.amount));

    return { matrix: map, payees: payeeArr, chalikahCols: cols, grandTotal: gt };
  }, [filteredChecks, chalikahList]);

  const getPayeeTotal = (payee: string) =>
    Object.values(matrix[payee] || {}).reduce((s, v) => s + v, 0);

  const getColTotal = (colId: string) =>
    payees.reduce((s, p) => s + (matrix[p]?.[colId] || 0), 0);

  const currentFilters = { accountFilter, statusFilter, dateFrom, dateTo };

  const buildReportData = () => ({
    payees,
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

  const handleExport = (data?: SavedReport["report_data"]) => {
    const src = data || buildReportData();
    const p = (src as any).payees as string[];
    const cols = (src as any).chalikahCols as { id: string; name: string }[];
    const m = (src as any).matrix as Record<string, Record<string, number>>;

    const rows = p.map((payee) => {
      const row: Record<string, any> = { Payee: payee };
      cols.forEach((col) => {
        row[col.name] = m[payee]?.[col.id] || 0;
      });
      row["Total"] = Object.values(m[payee] || {}).reduce((s, v) => s + v, 0);
      return row;
    });

    // Add totals row
    const totalsRow: Record<string, any> = { Payee: "TOTAL" };
    cols.forEach((col) => {
      totalsRow[col.name] = p.reduce((s, payee) => s + (m[payee]?.[col.id] || 0), 0);
    });
    totalsRow["Total"] = (src as any).grandTotal || 0;
    rows.push(totalsRow);

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Report");
    XLSX.writeFile(wb, "report.xlsx");
  };

  const loadSavedReport = (report: SavedReport) => {
    setViewingReport(report);
  };

  const renderMatrix = (
    payeeList: string[],
    cols: { id: string; name: string }[],
    matrixData: Record<string, Record<string, number>>,
    total: number
  ) => (
    <div className="overflow-auto border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="sticky left-0 bg-muted z-10 min-w-[200px]">Payee</TableHead>
            {cols.map((col) => (
              <TableHead key={col.id} className="text-right min-w-[120px]">
                {col.name}
              </TableHead>
            ))}
            <TableHead className="text-right font-bold min-w-[120px]">Total</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {payeeList.map((payee) => {
            const rowTotal = Object.values(matrixData[payee] || {}).reduce(
              (s, v) => s + v,
              0
            );
            return (
              <TableRow key={payee}>
                <TableCell className="sticky left-0 bg-background z-10 font-medium">
                  {payee}
                </TableCell>
                {cols.map((col) => (
                  <TableCell key={col.id} className="text-right tabular-nums">
                    {matrixData[payee]?.[col.id]
                      ? fmt(matrixData[payee][col.id])
                      : "—"}
                  </TableCell>
                ))}
                <TableCell className="text-right font-bold tabular-nums">
                  {fmt(rowTotal)}
                </TableCell>
              </TableRow>
            );
          })}
          {/* Totals row */}
          <TableRow className="bg-muted/50 font-bold">
            <TableCell className="sticky left-0 bg-muted/50 z-10">TOTAL</TableCell>
            {cols.map((col) => {
              const colTotal = payeeList.reduce(
                (s, p) => s + (matrixData[p]?.[col.id] || 0),
                0
              );
              return (
                <TableCell key={col.id} className="text-right tabular-nums">
                  {fmt(colTotal)}
                </TableCell>
              );
            })}
            <TableCell className="text-right tabular-nums">{fmt(total)}</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Reports</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Payee totals by Chalikah
              </p>
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
                      <SelectItem key={a.id} value={a.id}>
                        {a.account_name}
                      </SelectItem>
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
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-[160px]"
                />
              </div>
              <div className="space-y-1">
                <Label>To</Label>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-[160px]"
                />
              </div>
              <div className="flex gap-2 ml-auto">
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
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            Loading...
          </div>
        ) : payees.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            No checks match the current filters.
          </div>
        ) : (
          renderMatrix(payees, chalikahCols, matrix, grandTotal)
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
                  <div
                    key={r.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="font-medium">{r.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(r.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => loadSavedReport(r)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          handleExport(r.report_data as any)
                        }
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => deleteReport.mutate(r.id)}
                      >
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
            <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!reportName.trim() || saveReport.isPending}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View saved report dialog */}
      <Dialog open={!!viewingReport} onOpenChange={() => setViewingReport(null)}>
        <DialogContent className="max-w-[90vw] max-h-[85vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>{viewingReport?.name}</DialogTitle>
          </DialogHeader>
          {viewingReport &&
            renderMatrix(
              (viewingReport.report_data as any).payees || [],
              (viewingReport.report_data as any).chalikahCols || [],
              (viewingReport.report_data as any).matrix || {},
              (viewingReport.report_data as any).grandTotal || 0
            )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Reports;
