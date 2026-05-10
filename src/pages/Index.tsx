import { useState, useRef, useMemo, useCallback } from "react";
import { useReactToPrint } from "react-to-print";
import { usePayees } from "@/hooks/usePayees";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Plus, Search, Users, Pencil, Trash2, List, Download, BarChart3, FileText, Printer, History } from "lucide-react";
import { Link } from "react-router-dom";
import { useChecks, useAddCheck, useUpdateCheck, useDeleteCheck, type Check, type CheckInsert, type CheckStatus } from "@/hooks/useChecks";
import { useAccounts } from "@/hooks/useAccounts";
import { useAuditSource } from "@/hooks/useAuditSource";
import { CheckForm } from "@/components/CheckForm";
import { ChecksTable, CHECK_COLUMNS } from "@/components/ChecksTable";
import { CheckPrintView } from "@/components/CheckPrintView";
import { StatsCards } from "@/components/StatsCards";
import { AccountManager } from "@/components/AccountManager";

import { CheckBulkEdit } from "@/components/CheckBulkEdit";
import { CheckBulkImport } from "@/components/CheckBulkImport";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import * as XLSX from "xlsx";
import { useChalikah } from "@/hooks/useChalikah";
import { useColumnLayout } from "@/hooks/useColumnLayout";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const Index = () => {
  useAuditSource("Checks page");
  const { data: accounts = [] } = useAccounts();
  const [activeAccountId, setActiveAccountId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingCheck, setEditingCheck] = useState<Check | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [printChecks, setPrintChecks] = useState<Check[]>([]);
  const [printWithSignature, setPrintWithSignature] = useState(true);
  const [printDialogOpen, setPrintDialogOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);
  const [displayedChecks, setDisplayedChecks] = useState<Check[]>([]);
  const { data: payees = [] } = usePayees();
  const handleFilteredChecksChange = useCallback((filtered: Check[]) => {
    setDisplayedChecks(filtered);
  }, []);

  // Use first account as default once loaded
  const selectedAccountId = activeAccountId || accounts[0]?.id || null;

  const { data: checks = [], isLoading } = useChecks(search, selectedAccountId);
  const { data: chalikahList = [] } = useChalikah();
  const addCheck = useAddCheck();
  const updateCheck = useUpdateCheck();
  const deleteCheck = useDeleteCheck();

  const chalikahMap = Object.fromEntries(chalikahList.map((c) => [c.id, c.name]));
  const checkColLayout = useColumnLayout("checks", CHECK_COLUMNS);

  const getCheckExportValue = (c: Check, key: string): any => {
    switch (key) {
      case "check_number": return c.check_number || "";
      case "check_date": return c.check_date;
      case "payee": return c.payee;
      case "chalikah": return c.chalikah_id ? chalikahMap[c.chalikah_id] || "" : "";
      case "amount": return c.status === "Void" ? 0 : c.amount;
      case "status": return c.status;
      case "given_to": return c.given_to_payee || "";
      case "memo": return c.memo || "";
      case "record_number": return c.payee_record_number || "";
      case "given_to_record": return c.given_to_record_number || "";
      case "run_no": return c.run_no || "";
      default: return "";
    }
  };

  const handleExportChecks = () => {
    const cols = checkColLayout.visibleColumns;
    const rows = checks.map((c) => {
      const row: Record<string, any> = {};
      cols.forEach((col) => { row[col.label] = getCheckExportValue(c, col.key); });
      return row;
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Checks");
    XLSX.writeFile(wb, "checks.xlsx");
  };

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Check-${printChecks.length === 1 ? printChecks[0]?.check_number || "print" : "bulk-print"}`,
  });

  const handleSubmit = (data: CheckInsert) => {
    if (editingCheck) {
      updateCheck.mutate({ id: editingCheck.id, ...data }, {
        onSuccess: () => { setFormOpen(false); setEditingCheck(null); },
      });
    } else {
      addCheck.mutate({ ...data, account_id: selectedAccountId }, {
        onSuccess: () => setFormOpen(false),
      });
    }
  };

  const handleEdit = (check: Check) => {
    setEditingCheck(check);
    setFormOpen(true);
  };

  const handlePrintCheck = (check: Check) => {
    setPrintChecks([check]);
    setPrintDialogOpen(true);
  };

  const handleBulkPrint = () => {
    const sorted = [...selectedChecks].sort((a, b) => {
      const numA = parseInt(a.check_number || "0", 10);
      const numB = parseInt(b.check_number || "0", 10);
      return numA - numB;
    });
    setPrintChecks(sorted);
    setPrintDialogOpen(true);
  };

  const handlePrintBlank = (data: { payee: string; check_number: string; check_date: string; payee_record_number: string }) => {
    // Save the check to the database first
    const checkInsert: CheckInsert = {
      payee: data.payee || "Blank",
      amount: 0,
      check_date: data.check_date,
      check_number: data.check_number || null,
      status: "Printed",
      memo: null,
      stub_memo: null,
      account_id: selectedAccountId || null,
      chalikah_id: null,
      payee_record_number: data.payee_record_number || null,
      given_to_payee: null,
      given_to_record_number: null,
      run_no: null,
    };
    addCheck.mutate(checkInsert, {
      onSuccess: (savedData) => {
        const savedCheck = savedData as unknown as Check;
        setFormOpen(false);
        setPrintChecks([savedCheck]);
        setPrintDialogOpen(true);
      },
    });
  };

  const confirmPrint = () => {
    setPrintDialogOpen(false);
    setTimeout(() => {
      document.fonts.ready.then(() => handlePrint());
    }, 100);
  };

  const handleStatusChange = (check: Check, newStatus: CheckStatus) => {
    const updates: Partial<Check> & { id: string } = { id: check.id, status: newStatus };
    if (newStatus === "Void" && check.status !== "Void") {
      updates.original_amount = check.amount;
      updates.amount = 0;
    } else if (newStatus !== "Void" && check.status === "Void") {
      updates.amount = check.original_amount ?? 0;
      updates.original_amount = null;
    }
    updateCheck.mutate(updates);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    const target = displayedChecks.length > 0 ? displayedChecks : checks;
    if (target.length > 0 && target.every((c) => selectedIds.has(c.id))) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(target.map((c) => c.id)));
    }
  };

  const handleBulkDelete = async () => {
    if (!confirm(`Delete ${selectedIds.size} check(s)? This cannot be undone.`)) return;
    const ids = Array.from(selectedIds);
    for (const id of ids) {
      deleteCheck.mutate(id);
    }
    setSelectedIds(new Set());
  };

  const selectedChecks = checks.filter((c) => selectedIds.has(c.id));
  const selectedAccount = accounts.find((a) => a.id === selectedAccountId) || null;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card no-print">
        <div className="container py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Check Tracker</h1>
              <p className="text-sm text-muted-foreground mt-1">Manage and print charity checks</p>
            </div>
            <div className="flex gap-2">
              <Link to="/payees">
                <Button variant="outline">
                  <Users className="h-4 w-4 mr-2" />
                  Payees
                </Button>
              </Link>
              <Link to="/chalikah">
                <Button variant="outline">
                  <List className="h-4 w-4 mr-2" />
                  Chalikah
                </Button>
              </Link>
              <Link to="/dashboard">
                <Button variant="outline">
                  <BarChart3 className="h-4 w-4 mr-2" />
                  Dashboard
                </Button>
              </Link>
              <Link to="/reports">
                <Button variant="outline">
                  <FileText className="h-4 w-4 mr-2" />
                  Reports
                </Button>
              </Link>
              <Link to="/audit">
                <Button variant="outline">
                  <History className="h-4 w-4 mr-2" />
                  Audit Log
                </Button>
              </Link>
              <Button variant="outline" onClick={handleExportChecks}>
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
              <CheckBulkImport accountId={selectedAccountId} existingChecks={checks} />
              <Button onClick={() => { setEditingCheck(null); setFormOpen(true); }}>
                <Plus className="h-4 w-4 mr-2" />
                New Check
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container py-6 space-y-6 no-print">
        {/* Account tabs */}
        {accounts.length > 0 && (
          <div className="flex items-center gap-3">
            <Tabs value={selectedAccountId || ""} onValueChange={setActiveAccountId}>
              <TabsList>
                {accounts.map((a) => (
                  <TabsTrigger key={a.id} value={a.id}>
                    {a.account_name}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            <AccountManager />
          </div>
        )}

        {/* Stats */}
        <StatsCards checks={displayedChecks} />

        {/* Search + bulk actions */}
        <div className="flex items-center gap-3">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search checks..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          {selectedIds.size > 0 && (
            <div className="flex gap-2">
              <Button size="sm" variant="destructive" onClick={handleBulkDelete}>
                <Trash2 className="h-4 w-4 mr-1" /> Delete {selectedIds.size}
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setBulkEditOpen(true)}>
                <Pencil className="h-4 w-4 mr-1" /> Edit {selectedIds.size}
              </Button>
              <Button size="sm" variant="outline" onClick={handleBulkPrint}>
                <Printer className="h-4 w-4 mr-1" /> Print {selectedIds.size}
              </Button>
            </div>
          )}
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">Loading...</div>
        ) : (
          <ChecksTable
            checks={checks}
            onEdit={handleEdit}
            onDelete={(id) => setDeleteId(id)}
            onPrint={handlePrintCheck}
            onStatusChange={handleStatusChange}
            selectedIds={selectedIds}
            onToggleSelect={toggleSelect}
            onToggleAll={toggleAll}
            onFilteredChecksChange={handleFilteredChecksChange}
          />
        )}
      </main>

      {/* Form dialog */}
      <CheckForm
        open={formOpen}
        onOpenChange={(open) => { setFormOpen(open); if (!open) setEditingCheck(null); }}
        onSubmit={handleSubmit}
        onPrintBlank={handlePrintBlank}
        initialData={editingCheck}
        isPending={addCheck.isPending || updateCheck.isPending}
        existingChecks={checks}
        key={editingCheck?.id ?? `new-${checks.length}`}
      />

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this check?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { if (deleteId) deleteCheck.mutate(deleteId); setDeleteId(null); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Print options dialog */}
      <AlertDialog open={printDialogOpen} onOpenChange={setPrintDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Print {printChecks.length} Check{printChecks.length !== 1 ? "s" : ""}</AlertDialogTitle>
            <AlertDialogDescription>Choose print options before proceeding.</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex items-center justify-between py-3">
            <Label htmlFor="print-signature" className="text-sm">Include Signature</Label>
            <Switch
              id="print-signature"
              checked={printWithSignature}
              onCheckedChange={setPrintWithSignature}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmPrint}>
              <Printer className="h-4 w-4 mr-2" />
              Print
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>


      {/* Hidden print view */}
      <div className="hidden">
        <div ref={printRef}>
          {printChecks.map((c, i) => {
            const normalizedPayeeName = (c.payee || "").trim().toLowerCase();
            const normalizedRecord = (c.payee_record_number || "").trim().toLowerCase();
            const matchedPayee =
              (normalizedRecord
                ? payees.find((p) => (p.record_id || "").trim().toLowerCase() === normalizedRecord)
                : null) ||
              payees.find((p) => (p.payee_name || "").trim().toLowerCase() === normalizedPayeeName) ||
              null;

            return (
              <div key={c.id} style={i > 0 ? { pageBreakBefore: "always" } : undefined}>
                <CheckPrintView check={c} account={selectedAccount} payee={matchedPayee} showSignature={printWithSignature} />
              </div>
            );
          })}
        </div>
      </div>

      <CheckBulkEdit
        checks={selectedChecks}
        open={bulkEditOpen}
        onOpenChange={setBulkEditOpen}
        onDone={() => setSelectedIds(new Set())}
      />
    </div>
  );
};

export default Index;
