import { useState, useCallback, useMemo } from "react";

export interface ColumnDef {
  key: string;
  label: string;
  defaultVisible?: boolean; // defaults to true
  defaultWidth?: number; // px, optional
}

export type SortDir = "asc" | "desc";

export interface SortState {
  key: string;
  dir: SortDir;
}

export type FilterMode = "contains" | "equals" | "gt" | "lt" | "gte" | "lte" | "not";

export interface ColumnLayout {
  visibleKeys: string[];
  widths?: Record<string, number>;
  sort?: SortState | null;
}

// ... keep existing code (STORAGE_PREFIX, loadLayout, saveLayout)

const STORAGE_PREFIX = "col-layout-";

function loadLayout(storageKey: string): ColumnLayout | null {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + storageKey);
    if (raw) return JSON.parse(raw) as ColumnLayout;
  } catch {}
  return null;
}

function saveLayout(storageKey: string, layout: ColumnLayout) {
  localStorage.setItem(STORAGE_PREFIX + storageKey, JSON.stringify(layout));
}

export function useColumnLayout(storageKey: string, allColumns: ColumnDef[]) {
  const defaultLayout = useMemo<ColumnLayout>(() => {
    return {
      visibleKeys: allColumns
        .filter((c) => c.defaultVisible !== false)
        .map((c) => c.key),
      widths: {},
      sort: null,
    };
  }, [allColumns]);

  const [layout, setLayoutState] = useState<ColumnLayout>(() => {
    const saved = loadLayout(storageKey);
    if (saved) {
      const validKeys = new Set(allColumns.map((c) => c.key));
      const filtered = saved.visibleKeys.filter((k) => validKeys.has(k));
      return {
        visibleKeys: filtered.length > 0 ? filtered : defaultLayout.visibleKeys,
        widths: saved.widths || {},
        sort: saved.sort || null,
      };
    }
    return defaultLayout;
  });

  // Column filters (not persisted — session only)
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [filterModes, setFilterModes] = useState<Record<string, FilterMode>>({});

  const setLayout = useCallback(
    (next: ColumnLayout) => {
      setLayoutState(next);
      saveLayout(storageKey, next);
    },
    [storageKey]
  );

  const visibleColumns = useMemo(() => {
    const map = new Map(allColumns.map((c) => [c.key, c]));
    return layout.visibleKeys.map((k) => map.get(k)!).filter(Boolean);
  }, [layout.visibleKeys, allColumns]);

  const hiddenColumns = useMemo(() => {
    const visible = new Set(layout.visibleKeys);
    return allColumns.filter((c) => !visible.has(c.key));
  }, [layout.visibleKeys, allColumns]);

  // ... keep existing code (toggleColumn, moveColumn, reorderColumn, setColumnWidth, toggleSort)

  const toggleColumn = useCallback(
    (key: string) => {
      setLayout({
        ...layout,
        visibleKeys: layout.visibleKeys.includes(key)
          ? layout.visibleKeys.filter((k) => k !== key)
          : [...layout.visibleKeys, key],
      });
    },
    [layout, setLayout]
  );

  const moveColumn = useCallback(
    (key: string, direction: "up" | "down") => {
      const idx = layout.visibleKeys.indexOf(key);
      if (idx < 0) return;
      const newIdx = direction === "up" ? idx - 1 : idx + 1;
      if (newIdx < 0 || newIdx >= layout.visibleKeys.length) return;
      const next = [...layout.visibleKeys];
      [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
      setLayout({ ...layout, visibleKeys: next });
    },
    [layout, setLayout]
  );

  const reorderColumn = useCallback(
    (fromIndex: number, toIndex: number) => {
      const next = [...layout.visibleKeys];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      setLayout({ ...layout, visibleKeys: next });
    },
    [layout, setLayout]
  );

  const setColumnWidth = useCallback(
    (key: string, width: number) => {
      setLayout({
        ...layout,
        widths: { ...(layout.widths || {}), [key]: width },
      });
    },
    [layout, setLayout]
  );

  const toggleSort = useCallback(
    (key: string) => {
      const current = layout.sort;
      let next: SortState | null;
      if (current?.key === key) {
        if (current.dir === "asc") next = { key, dir: "desc" };
        else next = null;
      } else {
        next = { key, dir: "asc" };
      }
      setLayout({ ...layout, sort: next });
    },
    [layout, setLayout]
  );

  const setFilter = useCallback(
    (key: string, value: string) => {
      setFilters((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const setFilterMode = useCallback(
    (key: string, mode: FilterMode) => {
      setFilterModes((prev) => ({ ...prev, [key]: mode }));
    },
    []
  );

  const clearFilters = useCallback(() => {
    setFilters({});
    setFilterModes({});
  }, []);

  const resetLayout = useCallback(() => {
    setLayout(defaultLayout);
    setFilters({});
    setFilterModes({});
  }, [defaultLayout, setLayout]);

  return {
    layout,
    visibleColumns,
    hiddenColumns,
    toggleColumn,
    moveColumn,
    reorderColumn,
    resetLayout,
    allColumns,
    setColumnWidth,
    toggleSort,
    sort: layout.sort || null,
    widths: layout.widths || {},
    filters,
    filterModes,
    setFilter,
    setFilterMode,
    clearFilters,
  };
}
