import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { X, Filter } from "lucide-react";
import { type ColumnDef } from "@/hooks/useColumnLayout";

interface ColumnFilterBarProps {
  columns: ColumnDef[];
  filters: Record<string, string>;
  onFilterChange: (key: string, value: string) => void;
  onClearFilters: () => void;
  filterColumn: string;
  onFilterColumnChange: (key: string) => void;
}

export function ColumnFilterBar({
  columns,
  filters,
  onFilterChange,
  onClearFilters,
  filterColumn,
  onFilterColumnChange,
}: ColumnFilterBarProps) {
  const activeCount = Object.values(filters).filter((v) => v.length > 0).length;
  const currentValue = filters[filterColumn] || "";

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
      <Select value={filterColumn} onValueChange={onFilterColumnChange}>
        <SelectTrigger className="h-8 w-[160px] text-xs">
          <SelectValue placeholder="Select column" />
        </SelectTrigger>
        <SelectContent>
          {columns.map((col) => (
            <SelectItem key={col.key} value={col.key}>
              {col.label}
              {filters[col.key] ? " ✓" : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        placeholder={`Type to filter...`}
        value={currentValue}
        onChange={(e) => onFilterChange(filterColumn, e.target.value)}
        className="h-8 w-[200px] text-xs"
      />
      {activeCount > 0 && (
        <>
          <span className="text-xs text-muted-foreground">
            {activeCount} filter{activeCount > 1 ? "s" : ""} active
          </span>
          <Button variant="ghost" size="sm" className="h-7 text-xs px-2" onClick={onClearFilters}>
            <X className="h-3 w-3 mr-1" /> Clear all
          </Button>
        </>
      )}
    </div>
  );
}
