import { useState, useRef } from "react";
import { useReactToPrint } from "react-to-print";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Users, Pencil, Trash2, List } from "lucide-react";
import { Link } from "react-router-dom";
import { useChecks, useAddCheck, useUpdateCheck, useDeleteCheck, type Check, type CheckInsert } from "@/hooks/useChecks";
import { useAccounts } from "@/hooks/useAccounts";
import { CheckForm } from "@/components/CheckForm";
import { ChecksTable } from "@/components/ChecksTable";
import { CheckPrintView } from "@/components/CheckPrintView";
import { StatsCards } from "@/components/StatsCards";
import { AccountManager } from "@/components/AccountManager";
import { CheckBulkEdit } from "@/components/CheckBulkEdit";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  const { data: accounts = [] } = useAccounts();
  const [activeAccountId, setActiveAccountId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingCheck, setEditingCheck] = useState<Check | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [printCheck, setPrintCheck] = useState<Check | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  // Use first account as default once loaded
  const selectedAccountId = activeAccountId || accounts[0]?.id || null;

  const { data: checks = [], isLoading } = useChecks(search, selectedAccountId);
  const addCheck = useAddCheck();
  const updateCheck = useUpdateCheck();
  const deleteCheck = useDeleteCheck();

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Check-${printCheck?.check_number || "print"}`,
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
    setPrintCheck(check);
    setTimeout(() => handlePrint(), 100);
  };

  const handleVoid = (check: Check) => {
    if (!confirm(`Void check #${check.check_number || "—"} for ${check.payee}? This will set the amount to $0.`)) return;
    updateCheck.mutate({
      id: check.id,
      voided: true,
      original_amount: check.amount,
      amount: 0,
    });
  };

  const handleUnvoid = (check: Check) => {
    if (!confirm(`Unvoid check #${check.check_number || "—"} for ${check.payee}? This will restore the original amount.`)) return;
    updateCheck.mutate({
      id: check.id,
      voided: false,
      amount: check.original_amount ?? 0,
      original_amount: null,
    });
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
    if (checks.length > 0 && checks.every((c) => selectedIds.has(c.id))) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(checks.map((c) => c.id)));
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
        <StatsCards checks={checks} />

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
            onVoid={handleVoid}
            onUnvoid={handleUnvoid}
            selectedIds={selectedIds}
            onToggleSelect={toggleSelect}
            onToggleAll={toggleAll}
          />
        )}
      </main>

      {/* Form dialog */}
      <CheckForm
        open={formOpen}
        onOpenChange={(open) => { setFormOpen(open); if (!open) setEditingCheck(null); }}
        onSubmit={handleSubmit}
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

      {/* Hidden print view */}
      <div className="hidden">
        <div ref={printRef}>
          {printCheck && <CheckPrintView check={printCheck} />}
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
