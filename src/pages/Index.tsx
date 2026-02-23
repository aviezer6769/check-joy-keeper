import { useState, useRef } from "react";
import { useReactToPrint } from "react-to-print";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { useChecks, useAddCheck, useUpdateCheck, useDeleteCheck, type Check, type CheckInsert } from "@/hooks/useChecks";
import { CheckForm } from "@/components/CheckForm";
import { ChecksTable } from "@/components/ChecksTable";
import { CheckPrintView } from "@/components/CheckPrintView";
import { StatsCards } from "@/components/StatsCards";
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
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingCheck, setEditingCheck] = useState<Check | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [printCheck, setPrintCheck] = useState<Check | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  const { data: checks = [], isLoading } = useChecks(search);
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
      addCheck.mutate(data, {
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
              <Button onClick={() => { setEditingCheck(null); setFormOpen(true); }}>
                <Plus className="h-4 w-4 mr-2" />
                New Check
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container py-6 space-y-6 no-print">
        {/* Stats */}
        <StatsCards checks={checks} />

        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search checks..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">Loading...</div>
        ) : (
          <ChecksTable checks={checks} onEdit={handleEdit} onDelete={(id) => setDeleteId(id)} onPrint={handlePrintCheck} />
        )}
      </main>

      {/* Form dialog */}
      <CheckForm
        open={formOpen}
        onOpenChange={(open) => { setFormOpen(open); if (!open) setEditingCheck(null); }}
        onSubmit={handleSubmit}
        initialData={editingCheck}
        isPending={addCheck.isPending || updateCheck.isPending}
        key={editingCheck?.id ?? "new"}
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
    </div>
  );
};

export default Index;
