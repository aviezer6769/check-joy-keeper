import { useState, useCallback } from "react";
import { TableHead, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { type ColumnDef, type SortState } from "@/hooks/useColumnLayout";
import { cn } from "@/lib/utils";
import React from "react";

interface DraggableTableHeaderProps {
  columns: ColumnDef[];
  widths: Record<string, number>;
  sort: SortState | null;
  onToggleSort: (key: string) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
  columnClassName?: (key: string) => string;
  isRtl?: (key: string) => boolean;
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
  /** Per-column filter support */
  filters?: Record<string, string>;
  onFilterChange?: (key: string, value: string) => void;
  showFilters?: boolean;
}

export function DraggableTableHeader({
  columns,
  widths,
  sort,
  onToggleSort,
  onReorder,
  columnClassName,
  isRtl,
  prefix,
  suffix,
  filters,
  onFilterChange,
  showFilters,
}: DraggableTableHeaderProps) {
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);

  const handleDragStart = useCallback((e: React.DragEvent, idx: number) => {
    setDragIdx(idx);
    e.dataTransfer.effectAllowed = "move";
    const el = e.currentTarget as HTMLElement;
    e.dataTransfer.setDragImage(el, 20, 20);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, idx: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setOverIdx(idx);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, toIdx: number) => {
      e.preventDefault();
      if (dragIdx !== null && dragIdx !== toIdx) {
        onReorder(dragIdx, toIdx);
      }
      setDragIdx(null);
      setOverIdx(null);
    },
    [dragIdx, onReorder]
  );

  const handleDragEnd = useCallback(() => {
    setDragIdx(null);
    setOverIdx(null);
  }, []);

  // Count prefix children for empty filter cells
  const prefixCount = prefix
    ? React.Children.count(
        React.isValidElement(prefix) && prefix.type === React.Fragment
          ? (prefix.props as { children?: React.ReactNode }).children
          : prefix
      )
    : 0;

  return (
    <>
      <TableRow className="bg-muted/50">
        {prefix}
        {columns.map((col, idx) => {
          const w = widths[col.key];
          const rtl = isRtl?.(col.key);
          const extraCls = columnClassName?.(col.key) || "";
          const isDragging = dragIdx === idx;
          const isOver = overIdx === idx && dragIdx !== idx;

          return (
            <TableHead
              key={col.key}
              draggable
              onDragStart={(e) => handleDragStart(e, idx)}
              onDragOver={(e) => handleDragOver(e, idx)}
              onDrop={(e) => handleDrop(e, idx)}
              onDragEnd={handleDragEnd}
              dir={rtl ? "rtl" : undefined}
              className={cn(
                "font-semibold select-none transition-all",
                "cursor-grab active:cursor-grabbing",
                isDragging && "opacity-40",
                isOver && "border-l-2 border-primary",
                extraCls
              )}
              style={w ? { width: w, minWidth: w, maxWidth: w } : undefined}
            >
              <div
                className="inline-flex items-center cursor-pointer hover:text-foreground"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleSort(col.key);
                }}
              >
                {col.label}
                {sort?.key === col.key ? (
                  sort.dir === "asc" ? (
                    <ArrowUp className="h-3 w-3 ml-1" />
                  ) : (
                    <ArrowDown className="h-3 w-3 ml-1" />
                  )
                ) : (
                  <ArrowUpDown className="h-3 w-3 ml-1 opacity-30" />
                )}
              </div>
            </TableHead>
          );
        })}
        {suffix}
      </TableRow>

      {/* Per-column filter row */}
      {showFilters && filters && onFilterChange && (
        <TableRow className="bg-muted/20">
          {Array.from({ length: prefixCount }, (_, i) => (
            <TableHead key={`pf-${i}`} className="py-1 px-2" />
          ))}
          {columns.map((col) => {
            const w = widths[col.key];
            return (
              <TableHead
                key={`filter-${col.key}`}
                className="py-1 px-1"
                style={w ? { width: w, minWidth: w, maxWidth: w } : undefined}
              >
                <Input
                  placeholder="Filter..."
                  value={filters[col.key] || ""}
                  onChange={(e) => onFilterChange(col.key, e.target.value)}
                  className="h-6 text-xs border-muted bg-background"
                />
              </TableHead>
            );
          })}
          {suffix && <TableHead className="py-1 px-2" />}
        </TableRow>
      )}
    </>
  );
}
