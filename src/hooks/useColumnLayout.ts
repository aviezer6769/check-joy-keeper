import { useState, useCallback, useMemo } from "react";

export interface ColumnDef {
  key: string;
  label: string;
  defaultVisible?: boolean; // defaults to true
}

export interface ColumnLayout {
  /** ordered list of visible column keys */
  visibleKeys: string[];
}

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
    };
  }, [allColumns]);

  const [layout, setLayoutState] = useState<ColumnLayout>(() => {
    const saved = loadLayout(storageKey);
    if (saved) {
      // filter out keys that no longer exist, keep order
      const validKeys = new Set(allColumns.map((c) => c.key));
      const filtered = saved.visibleKeys.filter((k) => validKeys.has(k));
      return { visibleKeys: filtered.length > 0 ? filtered : defaultLayout.visibleKeys };
    }
    return defaultLayout;
  });

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

  const toggleColumn = useCallback(
    (key: string) => {
      setLayout({
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
      setLayout({ visibleKeys: next });
    },
    [layout, setLayout]
  );

  const resetLayout = useCallback(() => {
    setLayout(defaultLayout);
  }, [defaultLayout, setLayout]);

  return {
    layout,
    visibleColumns,
    hiddenColumns,
    toggleColumn,
    moveColumn,
    resetLayout,
    allColumns,
  };
}
