import { useState, useCallback, useRef, useMemo } from "react";
import { TableHead, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { ArrowUpDown, ArrowUp, ArrowDown, ListFilter } from "lucide-react";
import { type ColumnDef, type SortState } from "@/hooks/useColumnLayout";
import { cn } from "@/lib/utils";
import React from "react";

const MAX_DROPDOWN_OPTIONS = 50;

function FilterCell({ col, w, value, options, onChange }: {
  col: ColumnDef;
  w: number | undefined;
  value: string;
  options?: string[];
  onChange: (val: string) => void;
}) {
  const hasOptions = options && options.length > 0 && options.length <= MAX_DROPDOWN_OPTIONS;

  return (
    <TableHead
      key={`filter-${col.key}`}
      className="py-1 px-1"
      style={w ? { width: w, minWidth: w, maxWidth: w } : undefined}
    >
      <div className="flex items-center gap-0.5">
        <Input
          placeholder="Search..."
          value={value === "__blank__" ? "" : value}
          onChange={(e) => onChange(e.target.value)}
          disabled={value === "__blank__"}
          className="h-6 text-xs border-muted bg-background flex-1"
        />
        <Button
          variant="ghost"
          size="icon"
          className={cn("h-6 w-6 shrink-0 text-[9px] font-medium", value === "__blank__" && "text-primary bg-primary/10")}
          title="Filter blank values"
          onClick={() => onChange(value === "__blank__" ? "" : "__blank__")}
        >
          ∅
        </Button>
        {hasOptions && (
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className={cn("h-6 w-6 shrink-0", value && value !== "__blank__" && "text-primary")}>
                <ListFilter className="h-3 w-3" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-48 p-1 max-h-60 overflow-y-auto" align="start">
              <button
                className={cn("w-full text-left text-xs px-2 py-1 rounded hover:bg-muted", !value && "font-semibold text-primary")}
                onClick={() => onChange("")}
              >
                All
              </button>
              <button
                className={cn("w-full text-left text-xs px-2 py-1 rounded hover:bg-muted italic text-muted-foreground", value === "__blank__" && "font-semibold text-primary")}
                onClick={() => onChange("__blank__")}
              >
                (blank)
              </button>
              {options.map((opt) => (
                <button
                  key={opt}
                  className={cn("w-full text-left text-xs px-2 py-1 rounded hover:bg-muted truncate", value === opt && "font-semibold text-primary")}
                  onClick={() => onChange(opt)}
                >
                  {opt || "(empty)"}
                </button>
              ))}
            </PopoverContent>
          </Popover>
        )}
      </div>
    </TableHead>
  );
}

interface DraggableTableHeaderProps {
  columns: ColumnDef[];
  widths: Record<string, number>;
  sort: SortState | null;
  onToggleSort: (key: string) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
  onSetWidth?: (key: string, width: number) => void;
  columnClassName?: (key: string) => string;
  isRtl?: (key: string) => boolean;
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
  filters?: Record<string, string>;
  onFilterChange?: (key: string, value: string) => void;
  showFilters?: boolean;
  filterOptions?: Record<string, string[]>;
}

export function DraggableTableHeader({
  columns,
  widths,
  sort,
  onToggleSort,
  onReorder,
  onSetWidth,
  columnClassName,
  isRtl,
  prefix,
  suffix,
  filters,
  onFilterChange,
  showFilters,
  filterOptions,
}: DraggableTableHeaderProps) {
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  const [resizingCol, setResizingCol] = useState<string | null>(null);
  const resizeRef = useRef<{ startX: number; startW: number; key: string } | null>(null);

  // --- Column drag-to-reorder ---
  const handleDragStart = useCallback((e: React.DragEvent, idx: number) => {
    if (resizingCol) { e.preventDefault(); return; }
    setDragIdx(idx);
    e.dataTransfer.effectAllowed = "move";
    const el = e.currentTarget as HTMLElement;
    e.dataTransfer.setDragImage(el, 20, 20);
  }, [resizingCol]);

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

  // --- Column resize ---
  const handleResizeStart = useCallback(
    (e: React.MouseEvent, colKey: string, currentWidth: number) => {
      e.preventDefault();
      e.stopPropagation();
      const startX = e.clientX;
      const startW = currentWidth || 120;
      resizeRef.current = { startX, startW, key: colKey };
      setResizingCol(colKey);

      const onMouseMove = (ev: MouseEvent) => {
        if (!resizeRef.current) return;
        const diff = ev.clientX - resizeRef.current.startX;
        const newW = Math.max(40, Math.min(600, resizeRef.current.startW + diff));
        onSetWidth?.(resizeRef.current.key, newW);
      };

      const onMouseUp = () => {
        resizeRef.current = null;
        setResizingCol(null);
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    },
    [onSetWidth]
  );

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
              draggable={!resizingCol}
              onDragStart={(e) => handleDragStart(e, idx)}
              onDragOver={(e) => handleDragOver(e, idx)}
              onDrop={(e) => handleDrop(e, idx)}
              onDragEnd={handleDragEnd}
              dir={rtl ? "rtl" : undefined}
              className={cn(
                "font-semibold select-none transition-all relative group",
                !resizingCol && "cursor-grab active:cursor-grabbing",
                isDragging && "opacity-40",
                isOver && "border-l-2 border-primary",
                extraCls
              )}
              style={w ? { width: w, minWidth: w, maxWidth: w } : undefined}
            >
              <div
                className="inline-flex items-center cursor-pointer hover:text-foreground pr-2"
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
              {/* Resize handle */}
              {onSetWidth && (
                <div
                  className={cn(
                    "absolute top-0 right-0 w-1.5 h-full cursor-col-resize z-10",
                    "hover:bg-primary/40 active:bg-primary/60",
                    "opacity-0 group-hover:opacity-100 transition-opacity",
                    resizingCol === col.key && "opacity-100 bg-primary/60"
                  )}
                  onMouseDown={(e) => handleResizeStart(e, col.key, w || (e.currentTarget.parentElement?.offsetWidth ?? 120))}
                  onDoubleClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    // Find the table and measure max content width for this column
                    const th = e.currentTarget.closest("th");
                    const table = th?.closest("table");
                    if (!table || !th) return;
                    const headerRow = th.closest("tr");
                    if (!headerRow) return;
                    const headers = Array.from(headerRow.querySelectorAll("th"));
                    const colIndex = headers.indexOf(th);
                    if (colIndex < 0) return;
                    const rows = table.querySelectorAll("tbody tr");
                    let maxW = th.scrollWidth;
                    rows.forEach((row) => {
                      const cells = row.querySelectorAll("td");
                      if (cells[colIndex]) {
                        maxW = Math.max(maxW, cells[colIndex].scrollWidth + 16);
                      }
                    });
                    onSetWidth?.(col.key, Math.max(40, Math.min(600, maxW)));
                  }}
                />
              )}
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
          {columns.map((col) => (
            <FilterCell
              key={`filter-${col.key}`}
              col={col}
              w={widths[col.key]}
              value={filters[col.key] || ""}
              options={filterOptions?.[col.key]}
              onChange={(val) => onFilterChange(col.key, val)}
            />
          ))}
          {suffix && <TableHead className="py-1 px-2" />}
        </TableRow>
      )}
    </>
  );
}
