import { useMemo } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Pencil, Trash2, Printer } from "lucide-react";
import { type Check, type CheckStatus } from "@/hooks/useChecks";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useChalikah } from "@/hooks/useChalikah";
import { useColumnLayout, type ColumnDef } from "@/hooks/useColumnLayout";
import { ColumnLayoutManager } from "@/components/ColumnLayoutManager";

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

export function ChecksTable({ checks, onEdit, onDelete, onPrint, onStatusChange, selectedIds, onToggleSelect, onToggleAll }: ChecksTableProps) {
  const { data: chalikahList = [] } = useChalikah();
  const chalikahMap = Object.fromEntries(chalikahList.map((c) => [c.id, c.name]));
  const allSelected = checks.length > 0 && checks.every((c) => selectedIds.has(c.id));

  const colLayout = useColumnLayout("checks", CHECK_COLUMNS);

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

  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <ColumnLayoutManager
          visibleColumns={colLayout.visibleColumns}
          hiddenColumns={colLayout.hiddenColumns}
          allColumns={colLayout.allColumns}
          onToggle={colLayout.toggleColumn}
          onMove={colLayout.moveColumn}
          onReset={colLayout.resetLayout}
        />
      </div>
      <div className="overflow-x-auto rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-10 px-2">
                <Checkbox checked={allSelected} onCheckedChange={onToggleAll} />
              </TableHead>
              {colLayout.visibleColumns.map((col) => (
                <TableHead key={col.key} className={`font-semibold ${col.key === "amount" ? "text-right" : ""}`}>
                  {col.label}
                </TableHead>
              ))}
              <TableHead className="font-semibold text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {checks.map((check, i) => (
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
                {colLayout.visibleColumns.map((col) => (
                  <TableCell key={col.key}>{renderCell(check, col.key)}</TableCell>
                ))}
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

// Export column layout for use in export function
export { CHECK_COLUMNS };
export { useColumnLayout };
