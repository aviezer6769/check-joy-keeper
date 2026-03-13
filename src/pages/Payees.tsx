import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { usePayees, type Payee } from "@/hooks/usePayees";
import { useChecks, type Check } from "@/hooks/useChecks";
import { useChalikah } from "@/hooks/useChalikah";
import { useAccounts } from "@/hooks/useAccounts";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Search, ChevronDown, ChevronRight, Pencil, Trash2, Download, Layers, X, FileCheck } from "lucide-react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { PayeeForm } from "@/components/PayeeForm";
import { PayeeBulkImport } from "@/components/PayeeBulkImport";
import { PayeeEditForm } from "@/components/PayeeEditForm";
import { PayeeBulkEdit } from "@/components/PayeeBulkEdit";
import { BatchCheckDialog } from "@/components/BatchCheckDialog";
import { useDeletePayee } from "@/hooks/usePayees";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useColumnLayout, type ColumnDef } from "@/hooks/useColumnLayout";
import { ColumnLayoutManager } from "@/components/ColumnLayoutManager";
import { DraggableTableHeader } from "@/components/DraggableTableHeader";

const PAYEE_COLUMNS: ColumnDef[] = [
  { key: "record_id", label: "Record ID" },
  { key: "sort_order", label: "Sort" },
  { key: "urgent_level", label: "Urgent" },
  { key: "yiddish_name", label: "Yiddish Name" },
  { key: "payee_name", label: "Payee" },
  { key: "address", label: "Address" },
  { key: "title_1_yiddish", label: "טיטל 1", defaultVisible: false },
  { key: "first_name_yiddish", label: "ערשטע נאמען", defaultVisible: false },
  { key: "middle_name_yiddish", label: "מיטעלסטע", defaultVisible: false },
  { key: "last_name_yiddish", label: "לעצטע", defaultVisible: false },
  { key: "title_2_yiddish", label: "טיטל 2", defaultVisible: false },
  { key: "title", label: "Title", defaultVisible: false },
  { key: "title_to_use", label: "TitleToUse", defaultVisible: false },
  { key: "first_name", label: "First Name", defaultVisible: false },
  { key: "middle_name", label: "Middle", defaultVisible: false },
  { key: "last_name", label: "Last Name", defaultVisible: false },
  { key: "street_no", label: "St #", defaultVisible: false },
  { key: "street_name", label: "Street", defaultVisible: false },
  { key: "apt", label: "Apt", defaultVisible: false },
  { key: "city", label: "City", defaultVisible: false },
  { key: "state", label: "State", defaultVisible: false },
  { key: "zip", label: "Zip", defaultVisible: false },
  { key: "memo", label: "Memo", defaultVisible: false },
  { key: "is_active", label: "Active" },
];

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
  const { data: chalikahList = [] } = useChalikah();
  const [search, setSearch] = useState("");
  const [expandedPayee, setExpandedPayee] = useState<string | null>(null);
  const [editingPayee, setEditingPayee] = useState<Payee | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [batchCheckOpen, setBatchCheckOpen] = useState(false);
  const [groupByChalikah, setGroupByChalikah] = useState(false);
  const [showFilters, setShowFilters] = useState(() => localStorage.getItem("payees-show-filters") === "true");
  const toggleFilters = () => {
    setShowFilters((prev) => {
      localStorage.setItem("payees-show-filters", String(!prev));
      return !prev;
    });
  };
  const [checksCollapsed, setChecksCollapsed] = useState<Set<string>>(new Set());
  const [collapsedChalikahs, setCollapsedChalikahs] = useState<Set<string>>(new Set());
  const deletePayee = useDeletePayee();
  const qc = useQueryClient();
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const colLayout = useColumnLayout("payees", PAYEE_COLUMNS);
  const chalikahMap = useMemo(() => Object.fromEntries(chalikahList.map((c) => [c.id, c.name])), [chalikahList]);

  // Match checks to payee by record number (given_to_record_number first, then payee_record_number)
  const checksByRecordId = useMemo(() => {
    return checks.reduce<Record<string, Check[]>>((acc, c) => {
      const key = c.given_to_record_number || c.payee_record_number;
      if (key) (acc[key] ??= []).push(c);
      return acc;
    }, {});
  }, [checks]);

  const filteredBase = search
    ? payees.filter((p) => {
        const q = search.toLowerCase();
        const fields = [
          p.payee_name, p.record_id,
          p.title_1_yiddish, p.first_name_yiddish, p.middle_name_yiddish, p.last_name_yiddish, p.title_2_yiddish,
          p.title, p.title_to_use, p.first_name, p.middle_name, p.last_name,
          p.street_no, p.street_name, p.apt, p.city, p.state, p.zip, p.memo,
        ];
        return fields.some((f) => f?.toLowerCase().includes(q));
      })
    : payees;

  const getPayeeTextValue = (p: Payee, key: string): string => {
    switch (key) {
      case "record_id": return p.record_id || "";
      case "sort_order": return String(p.sort_order ?? 0);
      case "urgent_level": return String(p.urgent_level ?? 0);
      case "yiddish_name": return [p.title_1_yiddish, p.first_name_yiddish, p.middle_name_yiddish, p.last_name_yiddish, p.title_2_yiddish].filter(Boolean).join(" ");
      case "payee_name": return [p.title_to_use, p.first_name, p.middle_name, p.last_name].filter(Boolean).join(" ") || p.payee_name;
      case "address": return [p.street_no, p.street_name, p.apt, p.city, p.state, p.zip].filter(Boolean).join(" ");
      case "is_active": return p.is_active ? "Active" : "Inactive";
      default: return ((p as any)[key] || "").toString();
    }
  };

  const getPayeeSortValue = (p: Payee, key: string): string | number => {
    switch (key) {
      case "record_id": {
        const n = parseFloat(p.record_id || "");
        return isNaN(n) ? (p.record_id || "").toLowerCase() : n;
      }
      case "sort_order": return p.sort_order ?? 0;
      case "urgent_level": return p.urgent_level ?? 0;
      case "yiddish_name": return [p.title_1_yiddish, p.first_name_yiddish, p.middle_name_yiddish, p.last_name_yiddish, p.title_2_yiddish].filter(Boolean).join(" ").toLowerCase();
      case "payee_name": return [p.title_to_use, p.first_name, p.middle_name, p.last_name].filter(Boolean).join(" ").toLowerCase() || p.payee_name.toLowerCase();
      case "address": return [p.city, p.state].filter(Boolean).join(", ").toLowerCase();
      case "is_active": return p.is_active ? 1 : 0;
      default: {
        const raw = ((p as any)[key] || "").toString();
        const n = parseFloat(raw);
        return isNaN(n) ? raw.toLowerCase() : n;
      }
    }
  };

  // Apply column filters then sort
  const filtered = useMemo(() => {
    const activeFilters = Object.entries(colLayout.filters).filter(([, v]) => v.length > 0);
    let result = filteredBase;
    if (activeFilters.length > 0) {
      result = result.filter((p) =>
        activeFilters.every(([key, val]) => {
          const text = getPayeeTextValue(p, key);
          if (val === "__blank__") return !text || text.trim() === "";
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
    if (!colLayout.sort) return result;
    const { key, dir } = colLayout.sort;
    return [...result].sort((a, b) => {
      const va = getPayeeSortValue(a, key);
      const vb = getPayeeSortValue(b, key);
      if (va < vb) return dir === "asc" ? -1 : 1;
      if (va > vb) return dir === "asc" ? 1 : -1;
      return 0;
    });
  }, [filteredBase, colLayout.sort, colLayout.filters, colLayout.filterModes]);

  // Compute unique values per column for dropdown filters
  const filterOptions = useMemo(() => {
    const opts: Record<string, Set<string>> = {};
    for (const col of PAYEE_COLUMNS) opts[col.key] = new Set();
    for (const p of payees) {
      for (const col of PAYEE_COLUMNS) {
        const val = getPayeeTextValue(p, col.key);
        if (val) opts[col.key].add(val);
      }
    }
    const result: Record<string, string[]> = {};
    for (const [key, set] of Object.entries(opts)) {
      result[key] = Array.from(set).sort();
    }
    return result;
  }, [payees]);

  const renderPayeeCell = (p: Payee, key: string) => {
    switch (key) {
      case "record_id": return p.record_id || "—";
      case "sort_order": return p.sort_order;
      case "urgent_level":
        return p.urgent_level > 0 ? <Badge variant="destructive">{p.urgent_level}</Badge> : <span className="text-muted-foreground">0</span>;
      case "yiddish_name":
        return [p.title_1_yiddish, p.first_name_yiddish, p.middle_name_yiddish, p.last_name_yiddish, p.title_2_yiddish].filter(Boolean).join(" ") || "—";
      case "payee_name":
        return [p.title_to_use, p.first_name, p.middle_name, p.last_name].filter(Boolean).join(" ") || "—";
      case "address":
        return [[p.street_no, p.street_name].filter(Boolean).join(" "), p.apt ? `#${p.apt}` : "", [p.city, p.state].filter(Boolean).join(", "), p.zip].filter(Boolean).join(", ") || "—";
      case "title_1_yiddish": return p.title_1_yiddish || "—";
      case "first_name_yiddish": return p.first_name_yiddish || "—";
      case "middle_name_yiddish": return p.middle_name_yiddish || "—";
      case "last_name_yiddish": return p.last_name_yiddish || "—";
      case "title_2_yiddish": return p.title_2_yiddish || "—";
      case "title": return p.title || "—";
      case "title_to_use": return p.title_to_use || "—";
      case "first_name": return p.first_name || "—";
      case "middle_name": return p.middle_name || "—";
      case "last_name": return p.last_name || "—";
      case "street_no": return p.street_no || "—";
      case "street_name": return p.street_name || "—";
      case "apt": return p.apt || "—";
      case "city": return p.city || "—";
      case "state": return p.state || "—";
      case "zip": return p.zip || "—";
      case "memo": return <span className="text-sm max-w-[300px] whitespace-pre-line block">{p.memo || "—"}</span>;
      case "is_active": return p.is_active ? <Badge variant="default" className="bg-success text-success-foreground">Active</Badge> : <Badge variant="secondary">Inactive</Badge>;
      default: return "—";
    }
  };

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

  const getPayeeExportValue = (p: Payee, key: string): any => {
    switch (key) {
      case "record_id": return p.record_id || "";
      case "sort_order": return p.sort_order;
      case "urgent_level": return p.urgent_level;
      case "yiddish_name": return [p.title_1_yiddish, p.first_name_yiddish, p.middle_name_yiddish, p.last_name_yiddish, p.title_2_yiddish].filter(Boolean).join(" ");
      case "payee_name": return [p.title_to_use, p.first_name, p.middle_name, p.last_name].filter(Boolean).join(" ") || p.payee_name;
      case "address": return [[p.street_no, p.street_name].filter(Boolean).join(" "), p.apt ? `#${p.apt}` : "", [p.city, p.state].filter(Boolean).join(", "), p.zip].filter(Boolean).join(", ");
      case "title_1_yiddish": return p.title_1_yiddish || "";
      case "first_name_yiddish": return p.first_name_yiddish || "";
      case "middle_name_yiddish": return p.middle_name_yiddish || "";
      case "last_name_yiddish": return p.last_name_yiddish || "";
      case "title_2_yiddish": return p.title_2_yiddish || "";
      case "title": return p.title || "";
      case "title_to_use": return p.title_to_use || "";
      case "first_name": return p.first_name || "";
      case "middle_name": return p.middle_name || "";
      case "last_name": return p.last_name || "";
      case "street_no": return p.street_no || "";
      case "street_name": return p.street_name || "";
      case "apt": return p.apt || "";
      case "city": return p.city || "";
      case "state": return p.state || "";
      case "zip": return p.zip || "";
      case "is_active": return p.is_active ? "Active" : "Inactive";
      case "memo": return p.memo || "";
      default: return "";
    }
  };

  const handleExport = () => {
    const cols = colLayout.visibleColumns;
    const rows = filtered.map((p) => {
      const row: Record<string, any> = {};
      cols.forEach((col) => { row[col.label] = getPayeeExportValue(p, col.key); });
      return row;
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    // Enable text wrapping for cells with line breaks (e.g. memo)
    const range = XLSX.utils.decode_range(ws["!ref"] || "A1");
    for (let R = range.s.r; R <= range.e.r; R++) {
      for (let C = range.s.c; C <= range.e.c; C++) {
        const addr = XLSX.utils.encode_cell({ r: R, c: C });
        const cell = ws[addr];
        if (cell && typeof cell.v === "string" && cell.v.includes("\n")) {
          if (!cell.s) cell.s = {};
          (cell.s as any).alignment = { wrapText: true };
        }
      }
    }
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
                  <Button size="sm" variant="default" onClick={() => setBatchCheckOpen(true)}>
                    <FileCheck className="h-4 w-4 mr-1" /> Create Checks ({selectedIds.size})
                  </Button>
                </>
              )}
              <Button size="sm" variant={groupByChalikah ? "default" : "outline"} onClick={() => setGroupByChalikah(!groupByChalikah)}>
                <Layers className="h-4 w-4 mr-1" /> Group by Chalikah
              </Button>
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
        <div className="flex items-center gap-3">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search payees..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="ml-auto flex gap-2">
            <Button
              variant={showFilters ? "secondary" : "outline"}
              size="sm"
              onClick={toggleFilters}
              className={Object.values(colLayout.filters).some((v) => v.length > 0) ? "border-primary text-primary" : ""}
            >
              Filter
              {Object.values(colLayout.filters).some((v) => v.length > 0) && (
                <span className="ml-1 text-[10px] bg-primary text-primary-foreground rounded-full px-1.5">
                  {Object.values(colLayout.filters).filter((v) => v.length > 0).length}
                </span>
              )}
            </Button>
            {Object.values(colLayout.filters).some((v) => v.length > 0) && (
              <Button variant="ghost" size="sm" className="h-8 text-xs px-2" onClick={colLayout.clearFilters}>
                <X className="h-3 w-3 mr-1" /> Clear
              </Button>
            )}
            <ColumnLayoutManager
              visibleColumns={colLayout.visibleColumns}
              hiddenColumns={colLayout.hiddenColumns}
              allColumns={colLayout.allColumns}
              widths={colLayout.widths}
              onToggle={colLayout.toggleColumn}
              onReorder={colLayout.reorderColumn}
              onReset={colLayout.resetLayout}
              onSetWidth={colLayout.setColumnWidth}
            />
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">Loading...</div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <Table>
              <TableHeader>
                <DraggableTableHeader
                  columns={colLayout.visibleColumns}
                  widths={colLayout.widths}
                  sort={colLayout.sort}
                  onToggleSort={colLayout.toggleSort}
                  onReorder={colLayout.reorderColumn}
                  onSetWidth={colLayout.setColumnWidth}
                  isRtl={(key) => key === "yiddish_name" || key.endsWith("_yiddish")}
                  filters={colLayout.filters}
                  filterModes={colLayout.filterModes}
                  onFilterChange={colLayout.setFilter}
                  onFilterModeChange={colLayout.setFilterMode}
                  showFilters={showFilters}
                  filterOptions={filterOptions}
                  prefix={
                    <>
                      <TableHead className="w-10 px-2">
                        <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
                      </TableHead>
                      <TableHead className="font-semibold w-8"></TableHead>
                      <TableHead className="font-semibold w-10"></TableHead>
                    </>
                  }
                />
              </TableHeader>
              <TableBody>
                {filtered.map((p) => {
                  const payeeChecks = (p.record_id ? checksByRecordId[p.record_id] : []) || [];
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
                        {colLayout.visibleColumns.map((col) => {
                          const w = colLayout.widths[col.key];
                          return (
                            <TableCell
                              key={col.key}
                              dir={col.key === "yiddish_name" || col.key.endsWith("_yiddish") ? "rtl" : undefined}
                              className={col.key === "sort_order" || col.key === "urgent_level" ? "text-center" : col.key === "record_id" ? "font-mono text-sm" : ""}
                              style={w ? { width: w, minWidth: w, maxWidth: w, overflow: "hidden" } : undefined}
                            >
                              {renderPayeeCell(p, col.key)}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                      {expandedPayee === p.id && (
                        <TableRow key={`${p.id}-details`}>
                          <TableCell colSpan={colLayout.visibleColumns.length + 3} className="bg-muted/30 p-0">
                            <div className="px-8 py-3">
                              <div
                                className="flex items-center gap-2 cursor-pointer mb-2"
                                onClick={() => {
                                  setChecksCollapsed((prev) => {
                                    const next = new Set(prev);
                                    next.has(p.id) ? next.delete(p.id) : next.add(p.id);
                                    return next;
                                  });
                                }}
                              >
                                {checksCollapsed.has(p.id) ? (
                                  <ChevronRight className="h-3 w-3 text-muted-foreground" />
                                ) : (
                                  <ChevronDown className="h-3 w-3 text-muted-foreground" />
                                )}
                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                  Check History for {p.payee_name} (Given)
                                </p>
                              </div>
                              {checksCollapsed.has(p.id) ? null : payeeChecks.length === 0 ? (
                                <p className="text-sm text-muted-foreground py-2">No checks found for this payee.</p>
                              ) : (
                                (() => {
                                  const sorted = [...payeeChecks].sort((a, b) => b.check_date.localeCompare(a.check_date));
                                  const total = sorted.reduce((sum, c) => sum + (c.status === "Void" ? 0 : c.amount), 0);

                                  const renderCheckRows = (items: Check[]) =>
                                    items.map((c) => (
                                      <TableRow key={c.id}>
                                        <TableCell className="font-mono text-xs">{c.check_number || "—"}</TableCell>
                                        <TableCell className="text-xs">{formatDate(c.check_date)}</TableCell>
                                        <TableCell className="text-xs">{c.chalikah_id ? chalikahMap[c.chalikah_id] || "—" : "—"}</TableCell>
                                        <TableCell className="text-right font-mono text-xs">
                                          {c.status === "Void" ? (
                                            <span className="line-through text-muted-foreground">{formatCurrency(c.original_amount ?? 0)}</span>
                                          ) : (
                                            formatCurrency(c.amount)
                                          )}
                                        </TableCell>
                                        <TableCell>
                                          <Badge
                                            variant={c.status === "Void" ? "destructive" : c.status === "Given" || c.status === "Cleared" ? "default" : "secondary"}
                                            className={c.status === "Given" || c.status === "Cleared" ? "bg-success text-success-foreground text-xs" : "text-xs"}
                                          >
                                            {c.status}
                                          </Badge>
                                        </TableCell>
                                        <TableCell className="text-xs max-w-[200px] truncate">{c.memo || "—"}</TableCell>
                                      </TableRow>
                                    ));

                                  if (groupByChalikah) {
                                    const groups: Record<string, Check[]> = {};
                                    sorted.forEach((c) => {
                                      const key = c.chalikah_id ? chalikahMap[c.chalikah_id] || "Unknown" : "No Chalikah";
                                      (groups[key] ??= []).push(c);
                                    });

                                    return (
                                      <div className="space-y-3">
                                        {Object.entries(groups).reverse().map(([name, items]) => {
                                          const groupTotal = items.reduce((s, c) => s + (c.status === "Void" ? 0 : c.amount), 0);
                                          const chalikahKey = `${p.id}::${name}`;
                                          const isCollapsed = collapsedChalikahs.has(chalikahKey);
                                          return (
                                            <div key={name}>
                                              <div
                                                className="flex items-center gap-2 cursor-pointer mb-1"
                                                onClick={() => {
                                                  setCollapsedChalikahs((prev) => {
                                                    const next = new Set(prev);
                                                    next.has(chalikahKey) ? next.delete(chalikahKey) : next.add(chalikahKey);
                                                    return next;
                                                  });
                                                }}
                                              >
                                                {isCollapsed ? (
                                                  <ChevronRight className="h-3 w-3 text-primary" />
                                                ) : (
                                                  <ChevronDown className="h-3 w-3 text-primary" />
                                                )}
                                                <span className="text-xs font-semibold text-primary">{name}</span>
                                                <span className="text-xs text-muted-foreground">({items.length} checks · {formatCurrency(groupTotal)})</span>
                                              </div>
                                              {!isCollapsed && (
                                                <Table>
                                                  <TableHeader>
                                                    <TableRow>
                                                      <TableHead className="text-xs">Check #</TableHead>
                                                      <TableHead className="text-xs">Date</TableHead>
                                                      <TableHead className="text-xs">Chalikah</TableHead>
                                                      <TableHead className="text-xs text-right">Amount</TableHead>
                                                      <TableHead className="text-xs">Status</TableHead>
                                                      <TableHead className="text-xs">Memo</TableHead>
                                                    </TableRow>
                                                  </TableHeader>
                                                  <TableBody>
                                                    {renderCheckRows(items)}
                                                    <TableRow className="bg-muted/50 font-semibold">
                                                      <TableCell colSpan={3} className="text-xs">Subtotal ({items.length} checks)</TableCell>
                                                      <TableCell className="text-right font-mono text-xs">{formatCurrency(groupTotal)}</TableCell>
                                                      <TableCell colSpan={2} />
                                                    </TableRow>
                                                  </TableBody>
                                                </Table>
                                              )}
                                            </div>
                                          );
                                        })}
                                        <div className="border-t border-border pt-2">
                                          <p className="text-sm font-semibold text-right">
                                            Grand Total: <span className="font-mono">{formatCurrency(total)}</span> ({sorted.length} checks)
                                          </p>
                                        </div>
                                      </div>
                                    );
                                  }

                                  return (
                                    <Table>
                                      <TableHeader>
                                        <TableRow>
                                          <TableHead className="text-xs">Check #</TableHead>
                                          <TableHead className="text-xs">Date</TableHead>
                                          <TableHead className="text-xs">Chalikah</TableHead>
                                          <TableHead className="text-xs text-right">Amount</TableHead>
                                          <TableHead className="text-xs">Status</TableHead>
                                          <TableHead className="text-xs">Memo</TableHead>
                                        </TableRow>
                                      </TableHeader>
                                      <TableBody>
                                        {renderCheckRows(sorted)}
                                        <TableRow className="bg-muted/50 font-semibold">
                                          <TableCell colSpan={3} className="text-xs">Total ({sorted.length} checks)</TableCell>
                                          <TableCell className="text-right font-mono text-xs">{formatCurrency(total)}</TableCell>
                                          <TableCell colSpan={2} />
                                        </TableRow>
                                      </TableBody>
                                    </Table>
                                  );
                                })()
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  );
                })}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={colLayout.visibleColumns.length + 3} className="text-center py-12 text-muted-foreground">
                      <p className="text-lg font-medium">No payees found</p>
                      <p className="text-sm">Try adjusting your filters.</p>
                    </TableCell>
                  </TableRow>
                )}
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
      <BatchCheckDialog
        open={batchCheckOpen}
        onOpenChange={setBatchCheckOpen}
        payees={selectedPayees}
        onDone={() => setSelectedIds(new Set())}
      />
    </div>
  );
};

export default Payees;
