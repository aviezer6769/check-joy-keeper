import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Settings2, ArrowUp, ArrowDown, RotateCcw } from "lucide-react";
import { type ColumnDef } from "@/hooks/useColumnLayout";

interface ColumnLayoutManagerProps {
  visibleColumns: ColumnDef[];
  hiddenColumns: ColumnDef[];
  allColumns: ColumnDef[];
  onToggle: (key: string) => void;
  onMove: (key: string, dir: "up" | "down") => void;
  onReset: () => void;
}

export function ColumnLayoutManager({
  visibleColumns,
  hiddenColumns,
  allColumns,
  onToggle,
  onMove,
  onReset,
}: ColumnLayoutManagerProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings2 className="h-4 w-4 mr-1" /> Columns
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 max-h-[70vh] overflow-y-auto p-0" align="end">
        <div className="p-3 border-b border-border flex items-center justify-between">
          <span className="text-sm font-semibold">Columns</span>
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onReset}>
            <RotateCcw className="h-3 w-3 mr-1" /> Reset
          </Button>
        </div>

        {/* Visible columns — ordered */}
        <div className="p-2 space-y-0.5">
          <p className="text-xs text-muted-foreground font-medium px-1 mb-1">Visible (drag order)</p>
          {visibleColumns.map((col, idx) => (
            <div
              key={col.key}
              className="flex items-center gap-1 rounded px-1 py-0.5 hover:bg-accent"
            >
              <Checkbox
                checked
                onCheckedChange={() => onToggle(col.key)}
                className="shrink-0"
              />
              <span className="text-xs flex-1 truncate">{col.label}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 shrink-0"
                disabled={idx === 0}
                onClick={() => onMove(col.key, "up")}
              >
                <ArrowUp className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 shrink-0"
                disabled={idx === visibleColumns.length - 1}
                onClick={() => onMove(col.key, "down")}
              >
                <ArrowDown className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>

        {/* Hidden columns */}
        {hiddenColumns.length > 0 && (
          <div className="p-2 border-t border-border space-y-0.5">
            <p className="text-xs text-muted-foreground font-medium px-1 mb-1">Hidden</p>
            {hiddenColumns.map((col) => (
              <div
                key={col.key}
                className="flex items-center gap-1 rounded px-1 py-0.5 hover:bg-accent"
              >
                <Checkbox
                  checked={false}
                  onCheckedChange={() => onToggle(col.key)}
                  className="shrink-0"
                />
                <span className="text-xs flex-1 truncate text-muted-foreground">{col.label}</span>
              </div>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
