import { useState } from "react";
import { Link } from "react-router-dom";
import { usePayees, type Payee } from "@/hooks/usePayees";
import { useChecks, type Check } from "@/hooks/useChecks";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Search, ChevronDown, ChevronRight, Pencil, Trash2, Download } from "lucide-react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { PayeeForm } from "@/components/PayeeForm";
import { PayeeBulkImport } from "@/components/PayeeBulkImport";
import { PayeeEditForm } from "@/components/PayeeEditForm";
import { PayeeBulkEdit } from "@/components/PayeeBulkEdit";
import { useDeletePayee } from "@/hooks/usePayees";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
}

function formatDate(date: string) {
  return new Date(date + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const Payees = () => {
  const { data: payees = [], isLoading } = usePayees();
  const { data: checks = [] } = useChecks();
  const [search, setSearch] = useState("");
  const [expandedPayee, setExpandedPayee] = useState<string | null>(null);
  const [editingPayee, setEditingPayee] = useState<Payee | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const deletePayee = useDeletePayee();
  const qc = useQueryClient();
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const checksByPayee = checks.reduce<Record<string, Check[]>>((acc, c) => {
    (acc[c.payee] ??= []).push(c);
    return acc;
  }, {});

  const filtered = search
    ? payees.filter((p) => {
        const q = search.toLowerCase();
        return (
          p.payee_name.toLowerCase().includes(q) ||
          p.record_id?.toLowerCase().includes(q) ||
          p.first_name?.toLowerCase().includes(q) ||
          p.last_name?.toLowerCase().includes(q) ||
          p.first_name_yiddish?.toLowerCase().includes(q) ||
          p.last_name_yiddish?.toLowerCase().includes(q)
        );
      })
    : payees;

  const allSelected = filtered.length > 0 && filtered.every((p) => selectedIds.has(p.id));

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((p) => p.id)));
    }
  };

  const toggleOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectedPayees = payees.filter((p) => selectedIds.has(p.id));

  const handleBulkDelete = async () => {
    if (!confirm(`Delete ${selectedIds.size} payee(s)? This cannot be undone.`)) return;
    setBulkDeleting(true);
    const ids = Array.from(selectedIds);
    const { error } = await supabase.from("payees").delete().in("id", ids);
    setBulkDeleting(false);
    if (error) {
      toast.error("Bulk delete failed: " + error.message);
    } else {
      toast.success(`Deleted ${ids.length} payee(s)`);
      setSelectedIds(new Set());
      qc.invalidateQueries({ queryKey: ["payees"] });
    }
  };

  const handleExport = () => {
    const rows = filtered.map((p) => ({
      "Record ID": p.record_id || "",
      "Sort": p.sort_order,
      "Urgent": p.urgent_level,
      "טיטל 1": p.title_1_yiddish || "",
      "ערשטע נאמען": p.first_name_yiddish || "",
      "מיטעלסטע": p.middle_name_yiddish || "",
      "לעצטע": p.last_name_yiddish || "",
      "טיטל 2": p.title_2_yiddish || "",
      "Title": p.title || "",
      "TitleToUse": p.title_to_use || "",
      "First Name": p.first_name || "",
      "Middle": p.middle_name || "",
      "Last Name": p.last_name || "",
      "St #": p.street_no || "",
      "Street": p.street_name || "",
      "Apt": p.apt || "",
      "City": p.city || "",
      "State": p.state || "",
      "Zip": p.zip || "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Payees");
    XLSX.writeFile(wb, "payees.xlsx");
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link to="/">
                <Button variant="ghost" size="icon">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Payees</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  {filtered.length} payee{filtered.length !== 1 ? "s" : ""}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              {selectedIds.size > 0 && (
                <>
                  <Button size="sm" variant="destructive" onClick={handleBulkDelete} disabled={bulkDeleting}>
                    <Trash2 className="h-4 w-4 mr-1" /> Delete {selectedIds.size}
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => setBulkEditOpen(true)}>
                    <Pencil className="h-4 w-4 mr-1" /> Edit {selectedIds.size}
                  </Button>
                </>
              )}
              <Button size="sm" variant="outline" onClick={handleExport}>
                <Download className="h-4 w-4 mr-1" /> Export
              </Button>
              <PayeeForm />
              <PayeeBulkImport />
            </div>
          </div>
        </div>
      </header>

      <main className="container py-6 space-y-6">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search payees..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <p className="text-lg font-medium">No payees found</p>
            <p className="text-sm">Add payees to see them here.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-10 px-2">
                    <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
                  </TableHead>
                  <TableHead className="font-semibold w-8"></TableHead>
                  <TableHead className="font-semibold w-10"></TableHead>
                  <TableHead className="font-semibold">Record ID</TableHead>
                  <TableHead className="font-semibold">Sort</TableHead>
                  <TableHead className="font-semibold">Urgent</TableHead>
                  <TableHead className="font-semibold" dir="rtl">Yiddish Name</TableHead>
                  <TableHead className="font-semibold">Payee</TableHead>
                  <TableHead className="font-semibold">Address</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((p) => {
                  const payeeChecks = checksByPayee[p.payee_name] || [];
                  return (
                    <>
                      <TableRow
                        key={p.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => setExpandedPayee(expandedPayee === p.id ? null : p.id)}
                      >
                        <TableCell className="px-2" onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedIds.has(p.id)}
                            onCheckedChange={() => toggleOne(p.id)}
                          />
                        </TableCell>
                        <TableCell className="px-2">
                          {expandedPayee === p.id ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )}
                        </TableCell>
                        <TableCell className="px-2" onClick={(e) => e.stopPropagation()}>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={() => setEditingPayee(p)}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                        </TableCell>
                        <TableCell className="font-mono text-sm">{p.record_id || "—"}</TableCell>
                        <TableCell className="text-center">{p.sort_order}</TableCell>
                        <TableCell className="text-center">
                          {p.urgent_level > 0 ? (
                            <Badge variant="destructive">{p.urgent_level}</Badge>
                          ) : (
                            <span className="text-muted-foreground">0</span>
                          )}
                        </TableCell>
                        <TableCell dir="rtl">
                          {[p.title_1_yiddish, p.first_name_yiddish, p.middle_name_yiddish, p.last_name_yiddish, p.title_2_yiddish].filter(Boolean).join(" ") || "—"}
                        </TableCell>
                        <TableCell>
                          {[p.title_to_use, p.first_name, p.middle_name, p.last_name].filter(Boolean).join(" ") || "—"}
                        </TableCell>
                        <TableCell>
                          {[
                            [p.street_no, p.street_name].filter(Boolean).join(" "),
                            p.apt ? `#${p.apt}` : "",
                            [p.city, p.state].filter(Boolean).join(", "),
                            p.zip,
                          ].filter(Boolean).join(", ") || "—"}
                        </TableCell>
                      </TableRow>
                      {expandedPayee === p.id && (
                        <TableRow key={`${p.id}-details`}>
                          <TableCell colSpan={9} className="bg-muted/30 p-0">
                            <div className="px-8 py-3">
                              <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
                                Check History for {p.payee_name}
                              </p>
                              {payeeChecks.length === 0 ? (
                                <p className="text-sm text-muted-foreground py-2">No checks found for this payee.</p>
                              ) : (
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead className="text-xs">Check #</TableHead>
                                      <TableHead className="text-xs">Date</TableHead>
                                      <TableHead className="text-xs">Charity</TableHead>
                                      <TableHead className="text-xs text-right">Amount</TableHead>
                                      <TableHead className="text-xs">Status</TableHead>
                                      <TableHead className="text-xs">Memo</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {payeeChecks
                                      .sort((a, b) => b.check_date.localeCompare(a.check_date))
                                      .map((c) => (
                                        <TableRow key={c.id}>
                                          <TableCell className="font-mono text-xs">{c.check_number || "—"}</TableCell>
                                          <TableCell className="text-xs">{formatDate(c.check_date)}</TableCell>
                                          <TableCell className="text-xs">{c.charity || "—"}</TableCell>
                                          <TableCell className="text-right font-mono text-xs">
                                            {c.voided ? (
                                              <span className="line-through text-muted-foreground">{formatCurrency(c.original_amount ?? 0)}</span>
                                            ) : (
                                              formatCurrency(c.amount)
                                            )}
                                          </TableCell>
                                          <TableCell>
                                            {c.voided ? (
                                              <Badge variant="destructive" className="text-xs">Voided</Badge>
                                            ) : (
                                              <Badge
                                                variant={c.check_given ? "default" : "secondary"}
                                                className={c.check_given ? "bg-success text-success-foreground text-xs" : "text-xs"}
                                              >
                                                {c.check_given ? "Given" : "Pending"}
                                              </Badge>
                                            )}
                                          </TableCell>
                                          <TableCell className="text-xs max-w-[200px] truncate">{c.memo || "—"}</TableCell>
                                        </TableRow>
                                      ))}
                                  </TableBody>
                                </Table>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </main>

      {editingPayee && (
        <PayeeEditForm
          payee={editingPayee}
          open={!!editingPayee}
          onOpenChange={(open) => !open && setEditingPayee(null)}
        />
      )}

      <PayeeBulkEdit
        payees={selectedPayees}
        open={bulkEditOpen}
        onOpenChange={setBulkEditOpen}
        onDone={() => setSelectedIds(new Set())}
      />
    </div>
  );
};

export default Payees;
