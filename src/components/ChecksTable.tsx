import { useMemo, useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Pencil, Trash2, Printer } from "lucide-react";
import { type Check, type CheckStatus } from "@/hooks/useChecks";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useChalikah } from "@/hooks/useChalikah";
import { useColumnLayout, type ColumnDef } from "@/hooks/useColumnLayout";
import { ColumnLayoutManager } from "@/components/ColumnLayoutManager";
import { DraggableTableHeader } from "@/components/DraggableTableHeader";
import { ColumnFilterBar } from "@/components/ColumnFilterBar";

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

const CHECK_COLUMNS: ColumnDef[] = [
  { key: "check_number", label: "Check #" },
  { key: "check_date", label: "Date" },
  { key: "payee", label: "Payee" },
  { key: "chalikah", label: "Chalikah" },
  { key: "amount", label: "Amount" },
  { key: "status", label: "Status" },
  { key: "given_to", label: "Given To" },
  { key: "memo", label: "Memo" },
  { key: "record_number", label: "Record #" },
  { key: "given_to_record", label: "Given To #", defaultVisible: false },
];

interface ChecksTableProps {
  checks: Check[];
  onEdit: (check: Check) => void;
  onDelete: (id: string) => void;
  onPrint: (check: Check) => void;
  onStatusChange: (check: Check, status: CheckStatus) => void;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onToggleAll: () => void;
}

function getCheckTextValue(check: Check, key: string, chalikahMap: Record<string, string>): string {
  switch (key) {
    case "check_number": return check.check_number || "";
    case "check_date": return check.check_date;
    case "payee": return check.payee;
    case "chalikah": return check.chalikah_id ? chalikahMap[check.chalikah_id] || "" : "";
    case "amount": return String(check.status === "Void" ? check.original_amount ?? 0 : check.amount);
    case "status": return check.status;
    case "given_to": return check.given_to_payee || "";
    case "memo": return check.memo || "";
    case "record_number": return check.payee_record_number || "";
    case "given_to_record": return check.given_to_record_number || "";
    default: return "";
  }
}

function getSortValue(check: Check, key: string, chalikahMap: Record<string, string>): string | number {
  switch (key) {
    case "check_number": return check.check_number || "";
    case "check_date": return check.check_date;
    case "payee": return check.payee.toLowerCase();
    case "chalikah": return (check.chalikah_id ? chalikahMap[check.chalikah_id] || "" : "").toLowerCase();
    case "amount": return check.status === "Void" ? 0 : check.amount;
    case "status": return check.status;
    case "given_to": return (check.given_to_payee || "").toLowerCase();
    case "memo": return (check.memo || "").toLowerCase();
    case "record_number": return check.payee_record_number || "";
    case "given_to_record": return check.given_to_record_number || "";
    default: return "";
  }
}

export function ChecksTable({ checks, onEdit, onDelete, onPrint, onStatusChange, selectedIds, onToggleSelect, onToggleAll }: ChecksTableProps) {
  const { data: chalikahList = [] } = useChalikah();
  const chalikahMap = Object.fromEntries(chalikahList.map((c) => [c.id, c.name]));
  const allSelected = checks.length > 0 && checks.every((c) => selectedIds.has(c.id));
  const [showFilters, setShowFilters] = useState(() => localStorage.getItem("checks-show-filters") === "true");
  const [filterColumn, setFilterColumn] = useState(CHECK_COLUMNS[0].key);
  const toggleFilters = () => {
    setShowFilters((prev) => {
      localStorage.setItem("checks-show-filters", String(!prev));
      return !prev;
    });
  };

  const colLayout = useColumnLayout("checks", CHECK_COLUMNS);

  // Apply column filters
  const filteredChecks = useMemo(() => {
    const activeFilters = Object.entries(colLayout.filters).filter(([, v]) => v.length > 0);
    if (activeFilters.length === 0) return checks;
    return checks.filter((check) =>
      activeFilters.every(([key, val]) => {
        const text = getCheckTextValue(check, key, chalikahMap);
        return text.toLowerCase().includes(val.toLowerCase());
      })
    );
  }, [checks, colLayout.filters, chalikahMap]);

  // Apply sort
  const sortedChecks = useMemo(() => {
    if (!colLayout.sort) return filteredChecks;
    const { key, dir } = colLayout.sort;
    return [...filteredChecks].sort((a, b) => {
      const va = getSortValue(a, key, chalikahMap);
      const vb = getSortValue(b, key, chalikahMap);
      if (va < vb) return dir === "asc" ? -1 : 1;
      if (va > vb) return dir === "asc" ? 1 : -1;
      return 0;
    });
  }, [filteredChecks, colLayout.sort, chalikahMap]);

  if (checks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <p className="text-lg font-medium">No checks found</p>
        <p className="text-sm">Add your first check to get started.</p>
      </div>
    );
  }

  const renderCell = (check: Check, key: string) => {
    switch (key) {
      case "check_number":
        return <span className="font-mono text-sm">{check.check_number || "—"}</span>;
      case "check_date":
        return <span className="text-sm">{formatDate(check.check_date)}</span>;
      case "payee":
        return <span className="font-medium">{check.payee}</span>;
      case "chalikah":
        return <span className="text-sm">{check.chalikah_id ? chalikahMap[check.chalikah_id] || "—" : "—"}</span>;
      case "amount":
        return (
          <span className="text-right font-mono font-medium block">
            {check.status === "Void" ? (
              <span className="line-through text-muted-foreground">
                {formatCurrency(check.original_amount ?? 0)}
              </span>
            ) : (
              formatCurrency(check.amount)
            )}
          </span>
        );
      case "status":
        return (
          <Select
            value={check.status}
            onValueChange={(v) => onStatusChange(check, v as CheckStatus)}
          >
            <SelectTrigger className="h-7 text-xs w-[100px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(["Open", "Printed", "Given", "Cleared", "Void"] as const).map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      case "given_to":
        return check.given_to_payee ? (
          <span className="text-primary font-medium text-sm">{check.given_to_payee}</span>
        ) : <span className="text-sm">—</span>;
      case "memo":
        return <span className="text-sm max-w-[200px] truncate block">{check.memo || "—"}</span>;
      case "record_number":
        return <span className="font-mono text-sm">{check.payee_record_number || "—"}</span>;
      case "given_to_record":
        return <span className="font-mono text-sm">{check.given_to_record_number || "—"}</span>;
      default:
        return "—";
    }
  };

  const hasActiveFilters = Object.values(colLayout.filters).some((v) => v.length > 0);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex-1">
          {showFilters && (
            <ColumnFilterBar
              columns={colLayout.visibleColumns}
              filters={colLayout.filters}
              onFilterChange={colLayout.setFilter}
              onClearFilters={colLayout.clearFilters}
              filterColumn={filterColumn}
              onFilterColumnChange={setFilterColumn}
            />
          )}
        </div>
        <div className="flex gap-2 shrink-0">
          <Button
            variant={showFilters ? "secondary" : "outline"}
            size="sm"
            onClick={toggleFilters}
            className={hasActiveFilters ? "border-primary text-primary" : ""}
          >
            Filter
            {hasActiveFilters && (
              <span className="ml-1 text-[10px] bg-primary text-primary-foreground rounded-full px-1.5">
                {Object.values(colLayout.filters).filter((v) => v.length > 0).length}
              </span>
            )}
          </Button>
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
      <div className="overflow-x-auto rounded-lg border border-border">
        <Table>
          <TableHeader>
            <DraggableTableHeader
              columns={colLayout.visibleColumns}
              widths={colLayout.widths}
              sort={colLayout.sort}
              onToggleSort={colLayout.toggleSort}
              onReorder={colLayout.reorderColumn}
              columnClassName={(key) => key === "amount" ? "text-right" : ""}
              prefix={
                <TableHead className="w-10 px-2">
                  <Checkbox checked={allSelected} onCheckedChange={onToggleAll} />
                </TableHead>
              }
              suffix={
                <TableHead className="font-semibold text-right">Actions</TableHead>
              }
            />
          </TableHeader>
          <TableBody>
            {sortedChecks.map((check, i) => (
              <TableRow
                key={check.id}
                className={`animate-fade-in ${check.status === "Void" ? "opacity-60" : ""}`}
                style={{ animationDelay: `${i * 30}ms` }}
              >
                <TableCell className="px-2" onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={selectedIds.has(check.id)}
                    onCheckedChange={() => onToggleSelect(check.id)}
                  />
                </TableCell>
                {colLayout.visibleColumns.map((col) => {
                  const w = colLayout.widths[col.key];
                  return (
                    <TableCell
                      key={col.key}
                      style={w ? { width: w, minWidth: w, maxWidth: w, overflow: "hidden" } : undefined}
                    >
                      {renderCell(check, col.key)}
                    </TableCell>
                  );
                })}
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" onClick={() => onPrint(check)} title="Print">
                      <Printer className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => onEdit(check)} title="Edit">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => onDelete(check.id)} title="Delete" className="text-destructive hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export { CHECK_COLUMNS };
export { useColumnLayout };
