import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Save, Download, Trash2, FileText, Eye, Filter, Pencil, ChevronDown, Maximize2, ArrowUpDown, ArrowUp, ArrowDown, Search, Edit3, Plus, X, SlidersHorizontal } from "lucide-react";
import { useChecks, type Check } from "@/hooks/useChecks";
import { useChalikah } from "@/hooks/useChalikah";
import { useAccounts } from "@/hooks/useAccounts";
import { usePayees } from "@/hooks/usePayees";
import { useSavedReports, useSaveReport, useDeleteReport, useUpdateReport, type SavedReport } from "@/hooks/useReports";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useColumnLayout, type ColumnDef, type FilterMode } from "@/hooks/useColumnLayout";
import { ColumnLayoutManager } from "@/components/ColumnLayoutManager";
import { DraggableTableHeader } from "@/components/DraggableTableHeader";
import { useAuditSource } from "@/hooks/useAuditSource";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import * as XLSX from "xlsx";

const fmt = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" });

const STATIC_REPORT_COLS: ColumnDef[] = [
  { key: "sort_order", label: "Sort" },
  { key: "record_id", label: "Record ID" },
  { key: "urgent_level", label: "Urgent" },
  { key: "is_active", label: "Active" },
  { key: "yiddish_name", label: "Yiddish Name" },
  { key: "payee_name", label: "Payee" },
  { key: "address", label: "Address" },
  { key: "memo", label: "Memo", defaultVisible: false },
];

type ChalikahMode = "all" | "last_n" | "specific";

interface DynamicReportConfig {
  dynamic: true;
  accountFilter: string;
  statusFilter: string;
  dateFrom: string;
  dateTo: string;
  chalikahMode: ChalikahMode;
  chalikahN?: number;
  chalikahIds?: string[];
}

const Reports = () => {
  useAuditSource("Reports page");
  const { data: allChecks = [], isLoading: checksLoading } = useChecks(undefined, undefined);
  const { data: chalikahList = [] } = useChalikah();
  const { data: accounts = [] } = useAccounts();
  const { data: payeesList = [] } = usePayees();
  const { data: savedReports = [], isLoading: reportsLoading } = useSavedReports();
  const saveReport = useSaveReport();
  const deleteReport = useDeleteReport();
  const updateReport = useUpdateReport();

  const [accountFilter, setAccountFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("issued");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [reportName, setReportName] = useState("");
  const [viewingReport, setViewingReport] = useState<SavedReport | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedNames, setSelectedNames] = useState<Set<string>>(new Set());
  const [renameReport, setRenameReport] = useState<SavedReport | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [hasRun, setHasRun] = useState(false);
  const [fullViewReport, setFullViewReport] = useState<SavedReport | null>(null);
  const [fullViewSearch, setFullViewSearch] = useState("");
  const [fullViewSort, setFullViewSort] = useState<{ key: string; dir: "asc" | "desc" } | null>(null);
  // Editing existing report
  const [editingReportId, setEditingReportId] = useState<string | null>(null);
  const [editingReportName, setEditingReportName] = useState<string>("");
  // Custom note columns (per saved report)
  const [customColumns, setCustomColumns] = useState<Array<{ key: string; label: string }>>([]);
  const [customValues, setCustomValues] = useState<Record<string, Record<string, string>>>({});
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [newColumnName, setNewColumnName] = useState("");
  // Filter rules with AND/OR logic (across any column, incl. dynamic chalikah)
  type FilterRule = { id: string; key: string; mode: FilterMode; value: string };
  const [filterRules, setFilterRules] = useState<FilterRule[]>([]);
  const [rulesLogic, setRulesLogic] = useState<"and" | "or">("and");
  // Save-dialog dynamic options
  const [saveMode, setSaveMode] = useState<"snapshot" | "dynamic">("snapshot");
  const [chalikahMode, setChalikahMode] = useState<ChalikahMode>("last_n");
  const [chalikahN, setChalikahN] = useState<number>(2);
  const [specificChalikahIds, setSpecificChalikahIds] = useState<Set<string>>(new Set());
  // Build payee lookup by record_id and payee_name
  const payeeLookup = useMemo(() => {
    const byRecord: Record<string, { record_id: string; yiddish: string; memo: string; address: string; is_active: boolean; urgent_level: number | null; last_name_yiddish: string; first_name_yiddish: string; middle_name_yiddish: string }> = {};
    const byName: Record<string, typeof byRecord[string]> = {};
    payeesList.forEach((p) => {
      const yiddish = [p.title_1_yiddish, p.first_name_yiddish, p.middle_name_yiddish, p.last_name_yiddish, p.title_2_yiddish]
        .filter(Boolean)
        .join(" ");
      const address = [p.street_no, p.street_name, p.apt ? `#${p.apt}` : ""].filter(Boolean).join(" ");
      const entry = {
        record_id: p.record_id || "", yiddish, memo: p.memo || "", address,
        is_active: p.is_active, urgent_level: p.urgent_level,
        last_name_yiddish: p.last_name_yiddish || "",
        first_name_yiddish: p.first_name_yiddish || "",
        middle_name_yiddish: p.middle_name_yiddish || "",
      };
      if (p.record_id) byRecord[p.record_id] = entry;
      byName[p.payee_name.toLowerCase()] = entry;
    });
    return { byRecord, byName };
  }, [payeesList]);

  const getPayeeInfo = (payeeName: string, recordNumber: string | null) => {
    if (recordNumber && payeeLookup.byRecord[recordNumber]) {
      return payeeLookup.byRecord[recordNumber];
    }
    return payeeLookup.byName[payeeName.toLowerCase()] || { record_id: "", yiddish: "", memo: "", address: "", is_active: true, urgent_level: null, last_name_yiddish: "", first_name_yiddish: "", middle_name_yiddish: "" };
  };

  // Filter checks
  const filteredChecks = useMemo(() => {
    let result = allChecks;
    if (accountFilter !== "all") {
      result = result.filter((c) => c.account_id === accountFilter);
    }
    if (statusFilter === "issued") {
      result = result.filter((c) => c.status === "Given" || c.status === "Cleared");
    } else if (statusFilter === "pending") {
      result = result.filter((c) => c.status === "Open" || c.status === "Printed");
    } else if (statusFilter !== "all") {
      result = result.filter((c) => c.status === statusFilter);
    }
    if (dateFrom) {
      result = result.filter((c) => c.check_date >= dateFrom);
    }
    if (dateTo) {
      result = result.filter((c) => c.check_date <= dateTo);
    }
    return result;
  }, [allChecks, accountFilter, statusFilter, dateFrom, dateTo]);

  // Build payee × chalikah matrix
  const { matrix, payeeRows, chalikahCols, grandTotal } = useMemo(() => {
    const map: Record<string, Record<string, number>> = {};
    const payeeMap: Record<string, { key: string; name: string; record_id: string; yiddish: string; memo: string; address: string; is_active: boolean; urgent_level: number | null; last_name_yiddish: string; first_name_yiddish: string; middle_name_yiddish: string }> = {};
    const chalikahIds = new Set<string>();

    // Attribute check to given_to if different from check payee, same as payee list
    filteredChecks.forEach((c) => {
      // Use given_to_record_number first (the actual recipient), fall back to payee_record_number
      const effectiveRecordNumber = c.given_to_record_number || c.payee_record_number;
      const effectivePayee = c.given_to_payee || c.payee || "(No Payee)";
      const info = getPayeeInfo(effectivePayee, effectiveRecordNumber);
      // Deduplicate by record_id when available, otherwise by payee name
      const dedupeKey = (effectiveRecordNumber && info.record_id)
        ? `__rid__${info.record_id}`
        : effectivePayee;
      const chId = c.chalikah_id || "__none__";
      chalikahIds.add(chId);
      if (!map[dedupeKey]) {
        map[dedupeKey] = {};
        payeeMap[dedupeKey] = { key: dedupeKey, name: effectivePayee, ...info };
      }
      map[dedupeKey][chId] = (map[dedupeKey][chId] || 0) + c.amount;
    });

    const chalikahNameMap = Object.fromEntries(chalikahList.map((c) => [c.id, c.name]));
    const cols = Array.from(chalikahIds).map((id) => ({
      id,
      name: id === "__none__" ? "(No Chalikah)" : chalikahNameMap[id] || id,
    }));
    cols.sort((a, b) => a.name.localeCompare(b.name));

    const rows = Object.values(payeeMap).sort((a, b) => a.name.localeCompare(b.name));
    let gt = 0;
    filteredChecks.forEach((c) => (gt += c.amount));

    return { matrix: map, payeeRows: rows, chalikahCols: cols, grandTotal: gt };
  }, [filteredChecks, chalikahList, payeeLookup]);

  // Dynamic columns = static cols + chalikah cols + total
  const allReportColumns: ColumnDef[] = useMemo(() => [
    ...STATIC_REPORT_COLS,
    ...chalikahCols.map((col) => ({ key: `ch_${col.id}`, label: col.name })),
    { key: "total", label: "Total" },
    ...customColumns.map((c) => ({ key: c.key, label: c.label })),
  ], [chalikahCols, customColumns]);

  const colLayout = useColumnLayout("reports", allReportColumns);

  const currentFilters = { accountFilter, statusFilter, dateFrom, dateTo };

  const buildReportData = () => ({
    payeeRows,
    chalikahCols,
    matrix,
    grandTotal,
    generatedAt: new Date().toISOString(),
  });

  const handleSave = () => {
    if (!reportName.trim()) return;
    if (saveMode === "dynamic") {
      const cfg: DynamicReportConfig = {
        dynamic: true,
        accountFilter, statusFilter, dateFrom, dateTo,
        chalikahMode,
        chalikahN: chalikahMode === "last_n" ? chalikahN : undefined,
        chalikahIds: chalikahMode === "specific" ? Array.from(specificChalikahIds) : undefined,
      };
      saveReport.mutate(
        {
          name: reportName.trim(),
          report_type: "payee_chalikah_dynamic",
          filters: { ...(cfg as any), _overrides: buildOverrides() },
          report_data: {},
        },
        { onSuccess: () => { setSaveDialogOpen(false); setReportName(""); } }
      );
      return;
    }
    saveReport.mutate(
      {
        name: reportName.trim(),
        report_type: "payee_chalikah",
        filters: { ...currentFilters, _overrides: buildOverrides() },
        report_data: buildReportData(),
      },
      { onSuccess: () => { setSaveDialogOpen(false); setReportName(""); } }
    );
  };

  // ===== Edit / Update saved report =====
  const buildOverrides = () => ({
    visibleKeys: colLayout.layout.visibleKeys,
    widths: colLayout.widths,
    sort: colLayout.sort,
    filters: colLayout.filters,
    filterModes: colLayout.filterModes,
    customColumns,
    customValues,
    filterRules,
    rulesLogic,
  });

  const loadReportForEdit = (r: SavedReport) => {
    const f: any = r.filters || {};
    const isDyn = r.report_type === "payee_chalikah_dynamic";
    setEditingReportId(r.id);
    setEditingReportName(r.name);
    setSaveMode(isDyn ? "dynamic" : "snapshot");
    setAccountFilter(f.accountFilter || "all");
    setStatusFilter(f.statusFilter || "issued");
    setDateFrom(f.dateFrom || "");
    setDateTo(f.dateTo || "");
    if (isDyn) {
      setChalikahMode((f.chalikahMode as ChalikahMode) || "all");
      setChalikahN(f.chalikahN || 2);
      setSpecificChalikahIds(new Set(f.chalikahIds || []));
    }
    const ov = f._overrides || {};
    setCustomColumns(ov.customColumns || []);
    setCustomValues(ov.customValues || {});
    setFilterRules(Array.isArray(ov.filterRules) ? ov.filterRules : []);
    setRulesLogic(ov.rulesLogic === "or" ? "or" : "and");
    // Apply layout after a tick so allReportColumns recomputes with custom cols
    setTimeout(() => {
      colLayout.applyLayout({
        visibleKeys: ov.visibleKeys,
        widths: ov.widths,
        sort: ov.sort,
        filters: ov.filters || {},
        filterModes: ov.filterModes || {},
      });
    }, 0);
    setHasRun(true);
    setSelectedNames(new Set());
  };

  const cancelEdit = () => {
    setEditingReportId(null);
    setEditingReportName("");
    setCustomColumns([]);
    setCustomValues({});
  };

  const handleUpdate = () => {
    if (!editingReportId) return;
    const isDyn = saveMode === "dynamic";
    const baseFilters: any = isDyn
      ? {
          dynamic: true,
          accountFilter, statusFilter, dateFrom, dateTo,
          chalikahMode,
          chalikahN: chalikahMode === "last_n" ? chalikahN : undefined,
          chalikahIds: chalikahMode === "specific" ? Array.from(specificChalikahIds) : undefined,
        }
      : { accountFilter, statusFilter, dateFrom, dateTo };
    baseFilters._overrides = buildOverrides();
    updateReport.mutate(
      {
        id: editingReportId,
        name: editingReportName.trim() || undefined,
        report_type: isDyn ? "payee_chalikah_dynamic" : "payee_chalikah",
        filters: baseFilters,
        report_data: isDyn ? {} : buildReportData(),
      },
      { onSuccess: () => cancelEdit() }
    );
  };

  const addCustomColumn = () => {
    const label = newColumnName.trim();
    if (!label) return;
    const key = `cust_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    setCustomColumns((prev) => [...prev, { key, label }]);
    setNewColumnName("");
    // Make it visible in the layout
    setTimeout(() => {
      if (!colLayout.layout.visibleKeys.includes(key)) colLayout.toggleColumn(key);
    }, 0);
  };

  const removeCustomColumn = (key: string) => {
    setCustomColumns((prev) => prev.filter((c) => c.key !== key));
    setCustomValues((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const setCustomValue = (colKey: string, payeeKey: string, value: string) => {
    setCustomValues((prev) => ({
      ...prev,
      [colKey]: { ...(prev[colKey] || {}), [payeeKey]: value },
    }));
  };

  // Re-compute a report at view time from saved dynamic config
  const computeDynamic = (cfg: DynamicReportConfig) => {
    let result = allChecks;
    if (cfg.accountFilter && cfg.accountFilter !== "all") {
      result = result.filter((c) => c.account_id === cfg.accountFilter);
    }
    if (cfg.statusFilter === "issued") {
      result = result.filter((c) => c.status === "Given" || c.status === "Cleared");
    } else if (cfg.statusFilter === "pending") {
      result = result.filter((c) => c.status === "Open" || c.status === "Printed");
    } else if (cfg.statusFilter && cfg.statusFilter !== "all") {
      result = result.filter((c) => c.status === cfg.statusFilter);
    }
    if (cfg.dateFrom) result = result.filter((c) => c.check_date >= cfg.dateFrom);
    if (cfg.dateTo) result = result.filter((c) => c.check_date <= cfg.dateTo);

    // Resolve which chalikah columns to include
    let allowedChalikahIds: Set<string> | null = null;
    if (cfg.chalikahMode === "last_n") {
      const sorted = [...chalikahList].sort((a, b) =>
        (b.created_at || "").localeCompare(a.created_at || "")
      );
      allowedChalikahIds = new Set(sorted.slice(0, cfg.chalikahN || 2).map((c) => c.id));
    } else if (cfg.chalikahMode === "specific") {
      allowedChalikahIds = new Set(cfg.chalikahIds || []);
    }
    if (allowedChalikahIds) {
      result = result.filter((c) => allowedChalikahIds!.has(c.chalikah_id || "__none__"));
    }

    const map: Record<string, Record<string, number>> = {};
    const payeeMap: Record<string, any> = {};
    const chalikahIds = new Set<string>();
    result.forEach((c) => {
      const effectiveRecordNumber = c.given_to_record_number || c.payee_record_number;
      const effectivePayee = c.given_to_payee || c.payee || "(No Payee)";
      const info = getPayeeInfo(effectivePayee, effectiveRecordNumber);
      const dedupeKey = (effectiveRecordNumber && info.record_id)
        ? `__rid__${info.record_id}` : effectivePayee;
      const chId = c.chalikah_id || "__none__";
      chalikahIds.add(chId);
      if (!map[dedupeKey]) {
        map[dedupeKey] = {};
        payeeMap[dedupeKey] = { key: dedupeKey, name: effectivePayee, ...info };
      }
      map[dedupeKey][chId] = (map[dedupeKey][chId] || 0) + c.amount;
    });
    const chalikahNameMap = Object.fromEntries(chalikahList.map((c) => [c.id, c.name]));
    const cols = Array.from(chalikahIds).map((id) => ({
      id, name: id === "__none__" ? "(No Chalikah)" : chalikahNameMap[id] || id,
    }));
    cols.sort((a, b) => a.name.localeCompare(b.name));
    const rows = Object.values(payeeMap).sort((a: any, b: any) => a.name.localeCompare(b.name));
    let gt = 0;
    result.forEach((c) => (gt += c.amount));
    return { payeeRows: rows, chalikahCols: cols, matrix: map, grandTotal: gt };
  };

  const handleExport = (data?: any) => {
    const src = data || buildReportData();
    // Use displayedRows (sorted/filtered) for live view, or saved data's payeeRows
    const baseRows = data ? ((src.payeeRows || []) as typeof payeeRows) : displayedRows;
    // If there's a selection, export only selected; otherwise export all displayed
    const exportPayees = selectedNames.size > 0
      ? baseRows.filter((pr) => selectedNames.has(pr.key))
      : baseRows;
    // For saved data, use that data's columns; for live, use the live layout
    const exportCols: ColumnDef[] = data
      ? [
          { key: "record_id", label: "Record ID" },
          { key: "yiddish_name", label: "Yiddish Name" },
          { key: "payee_name", label: "Payee" },
          { key: "address", label: "Address" },
          { key: "memo", label: "Memo" },
          ...((src.chalikahCols || []) as Array<{id:string;name:string}>).map((c) => ({ key: `ch_${c.id}`, label: c.name })),
          { key: "total", label: "Total" },
        ]
      : colLayout.visibleColumns;
    const rows = exportPayees.map((pr) => {
      const row: Record<string, any> = {};
      exportCols.forEach((col) => {
        if (col.key === "record_id") row["Record ID"] = pr.record_id;
        else if (col.key === "urgent_level") row["Urgent"] = pr.urgent_level == null ? "?" : pr.urgent_level;
        else if (col.key === "is_active") row["Active"] = pr.is_active ? "Active" : "Inactive";
        else if (col.key === "yiddish_name") row["Yiddish Name"] = pr.yiddish;
        else if (col.key === "payee_name") row["Payee"] = pr.name;
        else if (col.key === "address") row["Address"] = pr.address || "";
        else if (col.key === "memo") row["Memo"] = pr.memo || "";
        else if (col.key === "total") row["Total"] = Object.values(src.matrix[pr.key] || {}).reduce((s: number, v: any) => s + Number(v), 0);
        else if (col.key.startsWith("ch_")) {
          const chId = col.key.slice(3);
          row[col.label] = src.matrix[pr.key]?.[chId] || 0;
        }
      });
      return row;
    });

    // Totals row
    const totalsRow: Record<string, any> = {};
    exportCols.forEach((col) => {
      if (col.key === "payee_name") totalsRow["Payee"] = "TOTAL";
      else if (col.key === "record_id") totalsRow["Record ID"] = "";
      else if (col.key === "urgent_level") totalsRow["Urgent"] = "";
      else if (col.key === "is_active") totalsRow["Active"] = "";
      else if (col.key === "yiddish_name") totalsRow["Yiddish Name"] = "";
      else if (col.key === "address") totalsRow["Address"] = "";
      else if (col.key === "total") {
        totalsRow["Total"] = exportPayees.reduce((s: number, pr: any) =>
          s + (Object.values(src.matrix[pr.key] || {}) as number[]).reduce((ss, v) => ss + Number(v), 0), 0);
      } else if (col.key.startsWith("ch_")) {
        const chId = col.key.slice(3);
        totalsRow[col.label] = exportPayees.reduce(
          (s: number, pr: any) => s + (src.matrix[pr.key]?.[chId] || 0), 0
        );
      }
    });
    rows.push(totalsRow);

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Report");
    XLSX.writeFile(wb, "report.xlsx");
  };

  // Helper to get cell text value for filtering/sorting
  const getRowTextValue = (
    pr: typeof payeeRows[number],
    colKey: string,
    matrixData: Record<string, Record<string, number>>
  ): string => {
    if (colKey.startsWith("cust_")) return customValues[colKey]?.[pr.key] || "";
    if (colKey === "sort_order") return "";
    if (colKey === "record_id") return pr.record_id || "";
    if (colKey === "urgent_level") return pr.urgent_level == null ? "?" : String(pr.urgent_level);
    if (colKey === "is_active") return pr.is_active ? "Active" : "Inactive";
    if (colKey === "yiddish_name") return pr.yiddish || "";
    if (colKey === "payee_name") return pr.name;
    if (colKey === "address") return pr.address || "";
    if (colKey === "memo") return pr.memo || "";
    if (colKey === "total") {
      return String(Object.values(matrixData[pr.key] || {}).reduce((s, v) => s + v, 0));
    }
    if (colKey.startsWith("ch_")) {
      const chId = colKey.slice(3);
      return String(matrixData[pr.key]?.[chId] || 0);
    }
    return "";
  };

  const getRowSortValue = (
    pr: typeof payeeRows[number],
    colKey: string,
    matrixData: Record<string, Record<string, number>>
  ): string | number => {
    if (colKey.startsWith("cust_")) return (customValues[colKey]?.[pr.key] || "").toLowerCase();
    if (colKey === "record_id") {
      const n = parseFloat(pr.record_id || "");
      return isNaN(n) ? (pr.record_id || "").toLowerCase() : n;
    }
    if (colKey === "urgent_level") return pr.urgent_level ?? -1;
    if (colKey === "is_active") return pr.is_active ? 1 : 0;
    if (colKey === "yiddish_name") return (pr.yiddish || "").toLowerCase();
    if (colKey === "payee_name") return pr.name.toLowerCase();
    if (colKey === "address") return (pr.address || "").toLowerCase();
    if (colKey === "memo") return (pr.memo || "").toLowerCase();
    if (colKey === "total") return Object.values(matrixData[pr.key] || {}).reduce((s, v) => s + v, 0);
    if (colKey.startsWith("ch_")) {
      const chId = colKey.slice(3);
      return matrixData[pr.key]?.[chId] || 0;
    }
    return "";
  };

  // Apply column filters + sorting to payeeRows
  const displayedRows = useMemo(() => {
    const activeFilters = Object.entries(colLayout.filters).filter(([, v]) => v.length > 0);
    let result = [...payeeRows];

    const matchRule = (pr: typeof payeeRows[number], key: string, mode: FilterMode, val: string) => {
      if (!val) return true;
      const text = getRowTextValue(pr, key, matrix);
      if (val === "__blank__") return !text || text.trim() === "" || text === "0";
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
    };

    if (activeFilters.length > 0) {
      result = result.filter((pr) =>
        activeFilters.every(([key, val]) => matchRule(pr, key, colLayout.filterModes[key] || "contains", val))
      );
    }

    const activeRules = filterRules.filter((r) => r.key && r.value.length > 0);
    if (activeRules.length > 0) {
      result = result.filter((pr) => {
        const checks = activeRules.map((r) => matchRule(pr, r.key, r.mode, r.value));
        return rulesLogic === "or" ? checks.some(Boolean) : checks.every(Boolean);
      });
    }

    if (colLayout.sort) {
      const { key, dir } = colLayout.sort;
      if (key === "sort_order") {
        // Composite sort: active first, urgent priority 1 > 2 > 3 > 0 > ?, then Hebrew name
        result.sort((a, b) => {
          const mul = dir === "asc" ? 1 : -1;
          const activeA = a.is_active ? 0 : 1;
          const activeB = b.is_active ? 0 : 1;
          if (activeA !== activeB) return (activeA - activeB) * mul;
          const getUrgencyPriority = (value: number | null | undefined) =>
            value === 1 ? 0 : value === 2 ? 1 : value === 3 ? 2 : value === 0 ? 3 : 4;
          const urgA = getUrgencyPriority(a.urgent_level);
          const urgB = getUrgencyPriority(b.urgent_level);
          if (urgA !== urgB) return (urgA - urgB) * mul;
          const lastCmp = a.last_name_yiddish.localeCompare(b.last_name_yiddish, "he");
          if (lastCmp !== 0) return lastCmp * mul;
          const firstCmp = a.first_name_yiddish.localeCompare(b.first_name_yiddish, "he");
          if (firstCmp !== 0) return firstCmp * mul;
          return a.middle_name_yiddish.localeCompare(b.middle_name_yiddish, "he") * mul;
        });
      } else {
        result.sort((a, b) => {
          const va = getRowSortValue(a, key, matrix);
          const vb = getRowSortValue(b, key, matrix);
          if (va < vb) return dir === "asc" ? -1 : 1;
          if (va > vb) return dir === "asc" ? 1 : -1;
          return 0;
        });
      }
    }

    return result;
  }, [payeeRows, matrix, colLayout.filters, colLayout.filterModes, colLayout.sort, filterRules, rulesLogic]);

  // Filter options for dropdown
  const reportFilterOptions = useMemo(() => {
    const opts: Record<string, Set<string>> = {};
    for (const col of colLayout.visibleColumns) opts[col.key] = new Set();
    for (const pr of payeeRows) {
      for (const col of colLayout.visibleColumns) {
        const val = getRowTextValue(pr, col.key, matrix);
        if (val && val !== "0") opts[col.key]?.add(val);
      }
    }
    const result: Record<string, string[]> = {};
    for (const [key, set] of Object.entries(opts)) {
      result[key] = Array.from(set).sort();
    }
    return result;
  }, [payeeRows, matrix, colLayout.visibleColumns]);

  // Compute filtered grand total
  const filteredGrandTotal = useMemo(() =>
    displayedRows.reduce((s, pr) =>
      s + Object.values(matrix[pr.key] || {}).reduce((ss, v) => ss + v, 0), 0
    ), [displayedRows, matrix]);

  const renderMatrix = (
    rows: typeof payeeRows,
    cols: typeof chalikahCols,
    matrixData: Record<string, Record<string, number>>,
    total: number,
    visibleCols?: ColumnDef[],
    isStatic?: boolean
  ) => {
    const visCols = visibleCols || colLayout.visibleColumns;

    return (
      <div className="overflow-auto border rounded-lg">
        {!isStatic && selectedNames.size > 0 && (
          <div className="px-4 py-2 bg-muted/50 border-b text-sm text-muted-foreground flex items-center gap-2">
            {selectedNames.size} selected
            <Button variant="ghost" size="sm" onClick={() => setSelectedNames(new Set())}>
              Clear
            </Button>
          </div>
        )}
        <Table>
          <TableHeader>
            {isStatic ? (
              <TableRow>
                {visCols.map((col) => (
                  <TableHead
                    key={col.key}
                    className={
                      col.key === "record_id" || col.key === "yiddish_name" || col.key === "payee_name"
                        ? "sticky left-0 bg-muted z-10 min-w-[120px]"
                        : "text-right min-w-[120px]"
                    }
                    style={col.key === "yiddish_name" ? { direction: "rtl" } : undefined}
                  >
                    {col.label}
                  </TableHead>
                ))}
              </TableRow>
            ) : (
              <DraggableTableHeader
                columns={visCols}
                widths={colLayout.widths}
                sort={colLayout.sort}
                onToggleSort={colLayout.toggleSort}
                onReorder={colLayout.reorderColumn}
                onSetWidth={colLayout.setColumnWidth}
                columnClassName={(key) =>
                  key === "record_id" || key === "yiddish_name" || key === "payee_name" || key === "memo" || key === "address"
                    ? "min-w-[120px]"
                    : "text-right min-w-[120px]"
                }
                isRtl={(key) => key === "yiddish_name"}
                showFilters={showFilters}
                filters={colLayout.filters}
                filterModes={colLayout.filterModes}
                onFilterChange={colLayout.setFilter}
                onFilterModeChange={colLayout.setFilterMode}
                filterOptions={reportFilterOptions}
                prefix={
                  <TableHead className="w-10">
                    <Checkbox
                      checked={rows.length > 0 && rows.every((pr) => selectedNames.has(pr.key))}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedNames(new Set(rows.map((pr) => pr.key)));
                        } else {
                          setSelectedNames(new Set());
                        }
                      }}
                    />
                  </TableHead>
                }
              />
            )}
          </TableHeader>
          <TableBody>
            {rows.map((pr) => {
              const rowTotal = Object.values(matrixData[pr.key] || {}).reduce((s, v) => s + v, 0);
              return (
                <TableRow key={pr.key} className={!isStatic && selectedNames.has(pr.key) ? "bg-muted/30" : undefined}>
                  {!isStatic && (
                    <TableCell className="w-10">
                      <Checkbox
                        checked={selectedNames.has(pr.key)}
                        onCheckedChange={(checked) => {
                          setSelectedNames((prev) => {
                            const next = new Set(prev);
                            if (checked) next.add(pr.key);
                            else next.delete(pr.key);
                            return next;
                          });
                        }}
                      />
                    </TableCell>
                  )}
                  {visCols.map((col) => {
                    if (col.key === "sort_order") {
                      const parts = [pr.is_active ? "✓" : "✗", pr.urgent_level === null || pr.urgent_level === undefined ? "?" : String(pr.urgent_level)].join("/");
                      return <TableCell key={col.key} className="bg-background"><span className="text-muted-foreground text-xs">{parts}</span></TableCell>;
                    }
                    if (col.key === "record_id")
                      return <TableCell key={col.key} className="sticky left-0 bg-background z-10">{pr.record_id || "—"}</TableCell>;
                    if (col.key === "urgent_level") {
                      if (pr.urgent_level == null) return <TableCell key={col.key} className="bg-background"><Badge variant="outline">?</Badge></TableCell>;
                      return <TableCell key={col.key} className="bg-background">{pr.urgent_level > 0 ? <Badge variant="destructive">{pr.urgent_level}</Badge> : <span className="text-muted-foreground">0</span>}</TableCell>;
                    }
                    if (col.key === "is_active")
                      return <TableCell key={col.key} className="bg-background">{pr.is_active ? <Badge variant="default" className="bg-success text-success-foreground">Active</Badge> : <Badge variant="secondary">Inactive</Badge>}</TableCell>;
                    if (col.key === "yiddish_name")
                      return <TableCell key={col.key} className="bg-background" dir="rtl">{pr.yiddish || "—"}</TableCell>;
                    if (col.key === "payee_name")
                      return <TableCell key={col.key} className="bg-background font-medium">{pr.name}</TableCell>;
                    if (col.key === "address")
                      return <TableCell key={col.key} className="bg-background">{pr.address || "—"}</TableCell>;
                    if (col.key === "memo")
                      return <TableCell key={col.key} className="bg-background text-sm max-w-[300px] whitespace-pre-line">{pr.memo || "—"}</TableCell>;
                    if (col.key === "total")
                      return <TableCell key={col.key} className="text-right font-bold tabular-nums">{fmt(rowTotal)}</TableCell>;
                    if (col.key.startsWith("ch_")) {
                      const chId = col.key.slice(3);
                      return (
                        <TableCell key={col.key} className="text-right tabular-nums">
                          {matrixData[pr.key]?.[chId] ? fmt(matrixData[pr.key][chId]) : "—"}
                        </TableCell>
                      );
                    }
                    if (col.key.startsWith("cust_")) {
                      const val = customValues[col.key]?.[pr.key] || "";
                      if (isStatic) {
                        return <TableCell key={col.key}>{val || "—"}</TableCell>;
                      }
                      return (
                        <TableCell key={col.key} className="bg-background p-1">
                          <Input
                            value={val}
                            onChange={(e) => setCustomValue(col.key, pr.key, e.target.value)}
                            className="h-8 text-sm"
                            placeholder="—"
                          />
                        </TableCell>
                      );
                    }
                    return <TableCell key={col.key}>—</TableCell>;
                  })}
                </TableRow>
              );
            })}
            {/* Totals row */}
            <TableRow className="bg-muted/50 font-bold">
              {!isStatic && <TableCell className="bg-muted/50" />}
              {visCols.map((col) => {
                if (col.key === "sort_order")
                  return <TableCell key={col.key} className="bg-muted/50" />;
                if (col.key === "record_id")
                  return <TableCell key={col.key} className="sticky left-0 bg-muted/50 z-10" />;
                if (col.key === "yiddish_name")
                  return <TableCell key={col.key} className="bg-muted/50" />;
                if (col.key === "payee_name")
                  return <TableCell key={col.key} className="bg-muted/50">TOTAL</TableCell>;
                if (col.key === "address" || col.key === "memo" || col.key === "is_active" || col.key === "urgent_level")
                  return <TableCell key={col.key} className="bg-muted/50" />;
                if (col.key === "total")
                  return <TableCell key={col.key} className="text-right tabular-nums">{fmt(total)}</TableCell>;
                if (col.key.startsWith("ch_")) {
                  const chId = col.key.slice(3);
                  const colTotal = rows.reduce((s, pr) => s + (matrixData[pr.key]?.[chId] || 0), 0);
                  return <TableCell key={col.key} className="text-right tabular-nums">{fmt(colTotal)}</TableCell>;
                }
                if (col.key.startsWith("cust_")) {
                  return <TableCell key={col.key} className="bg-muted/50" />;
                }
                return <TableCell key={col.key} />;
              })}
            </TableRow>
          </TableBody>
        </Table>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Reports</h1>
              <p className="text-sm text-muted-foreground mt-1">Payee totals by Chalikah</p>
            </div>
            <Link to="/">
              <Button variant="outline">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Home
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="container py-6 space-y-6">
        {editingReportId && (
          <Card className="border-primary">
            <CardContent className="pt-4 pb-4 space-y-4">
              <div className="flex items-center gap-3 flex-wrap">
                <Edit3 className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Editing report:</span>
                <Input
                  value={editingReportName}
                  onChange={(e) => setEditingReportName(e.target.value)}
                  className="w-[260px] h-8"
                  placeholder="Report name"
                />
                <div className="flex gap-2 ml-auto">
                  <Button size="sm" variant="outline" onClick={cancelEdit}>Cancel</Button>
                  <Button size="sm" onClick={handleUpdate} disabled={updateReport.isPending}>
                    <Save className="h-4 w-4 mr-2" /> Update Report
                  </Button>
                </div>
              </div>
              <div className="space-y-2 border-t pt-3">
                <Label className="text-sm font-semibold">Report Type</Label>
                <RadioGroup
                  value={saveMode}
                  onValueChange={(v) => setSaveMode(v as any)}
                  className="flex gap-4"
                >
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="snapshot" id="edit-snap" />
                    <Label htmlFor="edit-snap" className="font-normal cursor-pointer">
                      Snapshot — freeze current data
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="dynamic" id="edit-dyn" />
                    <Label htmlFor="edit-dyn" className="font-normal cursor-pointer">
                      Dynamic — re-runs on current data each time
                    </Label>
                  </div>
                </RadioGroup>
              </div>
              {saveMode === "dynamic" && (
                <div className="space-y-2 border-l-2 pl-3">
                  <Label className="text-sm font-semibold">Chalikah columns</Label>
                  <RadioGroup value={chalikahMode} onValueChange={(v) => setChalikahMode(v as ChalikahMode)}>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="all" id="edit-ch-all" />
                      <Label htmlFor="edit-ch-all" className="font-normal cursor-pointer">All chalikah</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="last_n" id="edit-ch-last" />
                      <Label htmlFor="edit-ch-last" className="font-normal cursor-pointer">Last</Label>
                      <Input
                        type="number" min={1} value={chalikahN}
                        onChange={(e) => setChalikahN(Math.max(1, Number(e.target.value) || 1))}
                        className="w-16 h-7" disabled={chalikahMode !== "last_n"}
                      />
                      <span className="text-sm text-muted-foreground">chalikah (newest)</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <RadioGroupItem value="specific" id="edit-ch-spec" className="mt-1" />
                      <div className="flex-1">
                        <Label htmlFor="edit-ch-spec" className="font-normal cursor-pointer">Specific chalikah</Label>
                        {chalikahMode === "specific" && (
                          <div className="mt-2 max-h-40 overflow-auto border rounded p-2 space-y-1">
                            {chalikahList.map((c) => (
                              <label key={c.id} className="flex items-center gap-2 text-sm cursor-pointer">
                                <Checkbox
                                  checked={specificChalikahIds.has(c.id)}
                                  onCheckedChange={(checked) => {
                                    setSpecificChalikahIds((prev) => {
                                      const next = new Set(prev);
                                      if (checked) next.add(c.id); else next.delete(c.id);
                                      return next;
                                    });
                                  }}
                                />
                                {c.name}
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </RadioGroup>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4 items-end">
              <div className="space-y-1">
                <Label>Account</Label>
                <Select value={accountFilter} onValueChange={setAccountFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Accounts</SelectItem>
                    {accounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>{a.account_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Status</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="issued">Issued (Given+Cleared)</SelectItem>
                    <SelectItem value="pending">Pending (Open+Printed)</SelectItem>
                    <SelectItem value="Void">Void</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>From</Label>
                <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-[160px]" />
              </div>
              <div className="space-y-1">
                <Label>To</Label>
                <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-[160px]" />
              </div>
              <div className="flex gap-2 ml-auto">
                <Button
                  variant={showFilters ? "default" : "outline"}
                  size="sm"
                  onClick={() => setShowFilters(!showFilters)}
                >
                  <Filter className="h-4 w-4 mr-2" />
                  Column Filters
                </Button>
                <Popover open={advancedOpen} onOpenChange={setAdvancedOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm">
                      <SlidersHorizontal className="h-4 w-4 mr-2" />
                      Advanced
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[420px] max-h-[70vh] overflow-auto" align="end">
                    <div className="space-y-4">
                      {/* Custom columns */}
                      <div className="space-y-2">
                        <Label className="text-sm font-semibold">Custom Note Columns</Label>
                        <div className="flex gap-2">
                          <Input
                            value={newColumnName}
                            onChange={(e) => setNewColumnName(e.target.value)}
                            placeholder="New column name"
                            className="h-8"
                            onKeyDown={(e) => { if (e.key === "Enter") addCustomColumn(); }}
                          />
                          <Button size="sm" onClick={addCustomColumn} disabled={!newColumnName.trim()}>
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                        {customColumns.length > 0 && (
                          <div className="space-y-1">
                            {customColumns.map((c) => (
                              <div key={c.key} className="flex items-center gap-2 text-sm">
                                <span className="flex-1 truncate">{c.label}</span>
                                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => removeCustomColumn(c.key)}>
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Sort by any column */}
                      <div className="space-y-2 border-t pt-3">
                        <Label className="text-sm font-semibold">Sort (any column)</Label>
                        <div className="flex gap-2">
                          <Select
                            value={colLayout.sort?.key || "__none__"}
                            onValueChange={(v) => {
                              if (v === "__none__") colLayout.applyLayout({ sort: null });
                              else colLayout.applyLayout({ sort: { key: v, dir: colLayout.sort?.dir || "asc" } });
                            }}
                          >
                            <SelectTrigger className="h-8 flex-1"><SelectValue placeholder="No sort" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">No sort</SelectItem>
                              {allReportColumns.map((c) => (
                                <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Select
                            value={colLayout.sort?.dir || "asc"}
                            onValueChange={(v) => {
                              if (colLayout.sort) colLayout.applyLayout({ sort: { key: colLayout.sort.key, dir: v as any } });
                            }}
                            disabled={!colLayout.sort}
                          >
                            <SelectTrigger className="h-8 w-[110px]"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="asc">Asc</SelectItem>
                              <SelectItem value="desc">Desc</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {/* Filter by hidden / any columns */}
                      <div className="space-y-2 border-t pt-3">
                        <Label className="text-sm font-semibold">Filters (incl. hidden columns)</Label>
                        <div className="space-y-2 max-h-[260px] overflow-auto">
                          {allReportColumns
                            .filter((c) => c.key !== "sort_order")
                            .map((c) => {
                              const val = colLayout.filters[c.key] || "";
                              const mode = colLayout.filterModes[c.key] || "contains";
                              const visible = colLayout.visibleColumns.some((v) => v.key === c.key);
                              return (
                                <div key={c.key} className="flex items-center gap-1">
                                  <span className="text-xs w-32 truncate" title={c.label}>
                                    {c.label}{!visible && <span className="text-muted-foreground"> (hidden)</span>}
                                  </span>
                                  <Select
                                    value={mode}
                                    onValueChange={(v) => colLayout.setFilterMode(c.key, v as FilterMode)}
                                  >
                                    <SelectTrigger className="h-7 w-[88px] text-xs"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="contains">contains</SelectItem>
                                      <SelectItem value="equals">equals</SelectItem>
                                      <SelectItem value="not">not</SelectItem>
                                      <SelectItem value="gt">&gt;</SelectItem>
                                      <SelectItem value="lt">&lt;</SelectItem>
                                      <SelectItem value="gte">≥</SelectItem>
                                      <SelectItem value="lte">≤</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <Input
                                    value={val}
                                    onChange={(e) => colLayout.setFilter(c.key, e.target.value)}
                                    placeholder="value"
                                    className="h-7 text-xs flex-1"
                                  />
                                  {val && (
                                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => colLayout.setFilter(c.key, "")}>
                                      <X className="h-3 w-3" />
                                    </Button>
                                  )}
                                </div>
                              );
                            })}
                        </div>
                        <Button size="sm" variant="outline" className="w-full" onClick={colLayout.clearFilters}>
                          Clear all filters
                        </Button>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
                <Button onClick={() => setHasRun(true)}>
                  Run Report
                </Button>
                <ColumnLayoutManager
                  visibleColumns={colLayout.visibleColumns}
                  hiddenColumns={colLayout.hiddenColumns}
                  allColumns={allReportColumns}
                  widths={colLayout.widths}
                  onToggle={colLayout.toggleColumn}
                  onReorder={colLayout.reorderColumn}
                  onReset={colLayout.resetLayout}
                  onSetWidth={colLayout.setColumnWidth}
                />
                <Button variant="outline" onClick={() => handleExport()}>
                  <Download className="h-4 w-4 mr-2" />
                  {selectedNames.size > 0 ? `Export ${selectedNames.size} Selected` : "Export"}
                </Button>
                {editingReportId ? (
                  <Button onClick={handleUpdate} disabled={updateReport.isPending}>
                    <Save className="h-4 w-4 mr-2" /> Update Report
                  </Button>
                ) : (
                  <Button onClick={() => setSaveDialogOpen(true)}>
                    <Save className="h-4 w-4 mr-2" />
                    Save Report
                  </Button>
                )}
                {savedReports.length > 0 && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline">
                        <FileText className="h-4 w-4 mr-2" />
                        Saved Reports
                        <ChevronDown className="h-4 w-4 ml-1" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-[280px]">
                      {savedReports.map((r) => (
                        <DropdownMenuItem key={r.id} className="flex items-center justify-between gap-2 p-2" onSelect={(e) => e.preventDefault()}>
                          <button
                            className="flex-1 text-left truncate text-sm"
                            onClick={() => setViewingReport(r)}
                          >
                            <span className="font-medium">{r.name}</span>
                            <span className="text-xs text-muted-foreground ml-2">{new Date(r.created_at).toLocaleDateString()}</span>
                          </button>
                          <div className="flex gap-0.5 shrink-0">
                            <Button size="icon" variant="ghost" className="h-7 w-7" title="Edit in main view" onClick={() => loadReportForEdit(r)}>
                              <Edit3 className="h-3 w-3" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setRenameReport(r); setRenameValue(r.name); }}>
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7" title="Open full view" onClick={() => { setFullViewReport(r); setFullViewSearch(""); setFullViewSort(null); }}>
                              <Maximize2 className="h-3 w-3" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7" title="Download" onClick={() => {
                              const data = r.report_type === "payee_chalikah_dynamic"
                                ? computeDynamic(r.filters as any)
                                : r.report_data;
                              handleExport(data as any);
                            }}>
                              <Download className="h-3 w-3" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => deleteReport.mutate(r.id)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </div>
          </CardContent>
        </Card>


        {/* Live matrix */}
        {!hasRun ? (
          <div className="text-center py-16 text-muted-foreground">
            Set your filters and click <span className="font-medium text-foreground">Run Report</span> to generate the report, or open a saved report.
          </div>
        ) : checksLoading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">Loading...</div>
        ) : payeeRows.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">No checks match the current filters.</div>
        ) : (
          renderMatrix(displayedRows, chalikahCols, matrix, filteredGrandTotal)
        )}

      </main>

      {/* Save dialog */}
      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Report</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Label>Report Name</Label>
            <Input
              value={reportName}
              onChange={(e) => setReportName(e.target.value)}
              placeholder="e.g. Q1 2026 Summary"
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
            />
            <div className="space-y-2">
              <Label>Type</Label>
              <RadioGroup value={saveMode} onValueChange={(v) => setSaveMode(v as any)}>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="snapshot" id="snap" />
                  <Label htmlFor="snap" className="font-normal cursor-pointer">
                    Snapshot — freeze current data
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="dynamic" id="dyn" />
                  <Label htmlFor="dyn" className="font-normal cursor-pointer">
                    Dynamic — re-runs on current data each time
                  </Label>
                </div>
              </RadioGroup>
            </div>
            {saveMode === "dynamic" && (
              <div className="space-y-2 border-l-2 pl-3">
                <Label>Chalikah columns</Label>
                <RadioGroup value={chalikahMode} onValueChange={(v) => setChalikahMode(v as ChalikahMode)}>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="all" id="ch-all" />
                    <Label htmlFor="ch-all" className="font-normal cursor-pointer">All chalikah</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="last_n" id="ch-last" />
                    <Label htmlFor="ch-last" className="font-normal cursor-pointer">Last</Label>
                    <Input
                      type="number" min={1} value={chalikahN}
                      onChange={(e) => setChalikahN(Math.max(1, Number(e.target.value) || 1))}
                      className="w-16 h-7" disabled={chalikahMode !== "last_n"}
                    />
                    <span className="text-sm text-muted-foreground">chalikah (newest)</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <RadioGroupItem value="specific" id="ch-spec" className="mt-1" />
                    <div className="flex-1">
                      <Label htmlFor="ch-spec" className="font-normal cursor-pointer">Specific chalikah</Label>
                      {chalikahMode === "specific" && (
                        <div className="mt-2 max-h-40 overflow-auto border rounded p-2 space-y-1">
                          {chalikahList.map((c) => (
                            <label key={c.id} className="flex items-center gap-2 text-sm cursor-pointer">
                              <Checkbox
                                checked={specificChalikahIds.has(c.id)}
                                onCheckedChange={(checked) => {
                                  setSpecificChalikahIds((prev) => {
                                    const next = new Set(prev);
                                    if (checked) next.add(c.id); else next.delete(c.id);
                                    return next;
                                  });
                                }}
                              />
                              {c.name}
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </RadioGroup>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={!reportName.trim() || saveReport.isPending}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View saved report dialog */}
      <Dialog open={!!viewingReport} onOpenChange={() => setViewingReport(null)}>
        <DialogContent className="max-w-[90vw] max-h-[85vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>
              {viewingReport?.name}
              {viewingReport?.report_type === "payee_chalikah_dynamic" && (
                <Badge variant="outline" className="ml-2">Dynamic</Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          {viewingReport && (() => {
            const isDynamic = viewingReport.report_type === "payee_chalikah_dynamic";
            const rd: any = isDynamic
              ? computeDynamic(viewingReport.filters as any)
              : viewingReport.report_data;
            // Saved reports show all columns from stored data
            const savedCols: ColumnDef[] = [
              { key: "sort_order", label: "Sort" },
              { key: "record_id", label: "Record ID" },
              { key: "yiddish_name", label: "Yiddish Name" },
              { key: "payee_name", label: "Payee" },
              { key: "memo", label: "Memo" },
              ...(rd.chalikahCols || []).map((c: any) => ({ key: `ch_${c.id}`, label: c.name })),
              { key: "total", label: "Total" },
            ];
            return renderMatrix(
              rd.payeeRows || [],
              rd.chalikahCols || [],
              rd.matrix || {},
              rd.grandTotal || 0,
              savedCols,
              true
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Full-view dialog with search + sort */}
      <Dialog open={!!fullViewReport} onOpenChange={(open) => { if (!open) setFullViewReport(null); }}>
        <DialogContent className="max-w-[98vw] w-[98vw] h-[95vh] flex flex-col p-4">
          <DialogHeader>
            <DialogTitle>
              {fullViewReport?.name}
              {fullViewReport?.report_type === "payee_chalikah_dynamic" && (
                <Badge variant="outline" className="ml-2">Dynamic</Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          {fullViewReport && (() => {
            const isDyn = fullViewReport.report_type === "payee_chalikah_dynamic";
            const rd: any = isDyn
              ? computeDynamic(fullViewReport.filters as any)
              : fullViewReport.report_data;
            const cols: Array<{ id: string; name: string }> = rd.chalikahCols || [];
            const matrixData: Record<string, Record<string, number>> = rd.matrix || {};
            const allRows: any[] = rd.payeeRows || [];
            // Search
            const q = fullViewSearch.trim().toLowerCase();
            let rows = q
              ? allRows.filter((pr) =>
                  (pr.name || "").toLowerCase().includes(q) ||
                  (pr.yiddish || "").toLowerCase().includes(q) ||
                  (pr.record_id || "").toLowerCase().includes(q) ||
                  (pr.address || "").toLowerCase().includes(q) ||
                  (pr.memo || "").toLowerCase().includes(q)
                )
              : [...allRows];
            // Sort
            if (fullViewSort) {
              const { key, dir } = fullViewSort;
              const mul = dir === "asc" ? 1 : -1;
              rows.sort((a, b) => {
                let va: any, vb: any;
                if (key === "record_id") { va = a.record_id || ""; vb = b.record_id || ""; }
                else if (key === "yiddish_name") { va = a.yiddish || ""; vb = b.yiddish || ""; }
                else if (key === "payee_name") { va = a.name || ""; vb = b.name || ""; }
                else if (key === "address") { va = a.address || ""; vb = b.address || ""; }
                else if (key === "memo") { va = a.memo || ""; vb = b.memo || ""; }
                else if (key === "total") {
                  va = Object.values(matrixData[a.key] || {}).reduce((s: number, v: any) => s + v, 0);
                  vb = Object.values(matrixData[b.key] || {}).reduce((s: number, v: any) => s + v, 0);
                } else if (key.startsWith("ch_")) {
                  const id = key.slice(3);
                  va = matrixData[a.key]?.[id] || 0;
                  vb = matrixData[b.key]?.[id] || 0;
                } else { va = 0; vb = 0; }
                if (typeof va === "string") return va.localeCompare(vb) * mul;
                return (va - vb) * mul;
              });
            }
            const total = rows.reduce((s, pr) =>
              s + Object.values(matrixData[pr.key] || {}).reduce((ss: number, v: any) => ss + v, 0), 0);
            const toggleSort = (key: string) => {
              setFullViewSort((cur) => {
                if (!cur || cur.key !== key) return { key, dir: "asc" };
                if (cur.dir === "asc") return { key, dir: "desc" };
                return null;
              });
            };
            const SortIcon = ({ k }: { k: string }) => {
              if (fullViewSort?.key !== k) return <ArrowUpDown className="h-3 w-3 inline ml-1 opacity-40" />;
              return fullViewSort.dir === "asc"
                ? <ArrowUp className="h-3 w-3 inline ml-1" />
                : <ArrowDown className="h-3 w-3 inline ml-1" />;
            };
            const baseCols = [
              { key: "record_id", label: "Record ID" },
              { key: "yiddish_name", label: "Yiddish Name", rtl: true },
              { key: "payee_name", label: "Payee" },
              { key: "address", label: "Address" },
              { key: "memo", label: "Memo" },
            ];
            return (
              <>
                <div className="flex items-center gap-2 pb-2">
                  <div className="relative flex-1 max-w-md">
                    <Search className="h-4 w-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={fullViewSearch}
                      onChange={(e) => setFullViewSearch(e.target.value)}
                      placeholder="Search payee, yiddish, record id, address, memo..."
                      className="pl-8"
                    />
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {rows.length} of {allRows.length} payees
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setFullViewSort(null)} disabled={!fullViewSort}>
                    Clear sort
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleExport(rd)}>
                    <Download className="h-4 w-4 mr-2" /> Download
                  </Button>
                </div>
                <div className="flex-1 overflow-auto border rounded-lg">
                  <Table>
                    <TableHeader className="sticky top-0 bg-muted z-10">
                      <TableRow>
                        {baseCols.map((c) => (
                          <TableHead
                            key={c.key}
                            onClick={() => toggleSort(c.key)}
                            className="cursor-pointer select-none min-w-[120px]"
                            style={c.rtl ? { direction: "rtl" } : undefined}
                          >
                            {c.label}<SortIcon k={c.key} />
                          </TableHead>
                        ))}
                        {cols.map((ch) => (
                          <TableHead
                            key={ch.id}
                            onClick={() => toggleSort(`ch_${ch.id}`)}
                            className="cursor-pointer select-none text-right min-w-[120px]"
                          >
                            {ch.name}<SortIcon k={`ch_${ch.id}`} />
                          </TableHead>
                        ))}
                        <TableHead
                          onClick={() => toggleSort("total")}
                          className="cursor-pointer select-none text-right min-w-[120px]"
                        >
                          Total<SortIcon k="total" />
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((pr) => {
                        const rowTotal = Object.values(matrixData[pr.key] || {}).reduce((s: number, v: any) => s + v, 0);
                        return (
                          <TableRow key={pr.key}>
                            <TableCell>{pr.record_id || "—"}</TableCell>
                            <TableCell dir="rtl">{pr.yiddish || "—"}</TableCell>
                            <TableCell className="font-medium">{pr.name}</TableCell>
                            <TableCell>{pr.address || "—"}</TableCell>
                            <TableCell className="text-sm max-w-[300px] whitespace-pre-line">{pr.memo || "—"}</TableCell>
                            {cols.map((ch) => (
                              <TableCell key={ch.id} className="text-right tabular-nums">
                                {matrixData[pr.key]?.[ch.id] ? fmt(matrixData[pr.key][ch.id]) : "—"}
                              </TableCell>
                            ))}
                            <TableCell className="text-right font-bold tabular-nums">{fmt(rowTotal)}</TableCell>
                          </TableRow>
                        );
                      })}
                      <TableRow className="bg-muted/50 font-bold sticky bottom-0">
                        <TableCell />
                        <TableCell />
                        <TableCell>TOTAL</TableCell>
                        <TableCell />
                        <TableCell />
                        {cols.map((ch) => {
                          const colTotal = rows.reduce((s, pr) => s + (matrixData[pr.key]?.[ch.id] || 0), 0);
                          return <TableCell key={ch.id} className="text-right tabular-nums">{fmt(colTotal)}</TableCell>;
                        })}
                        <TableCell className="text-right tabular-nums">{fmt(total)}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Rename dialog */}
      <Dialog open={!!renameReport} onOpenChange={() => setRenameReport(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Report</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Label>Report Name</Label>
            <Input
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && renameReport && renameValue.trim()) {
                  updateReport.mutate({ id: renameReport.id, name: renameValue.trim() }, { onSuccess: () => setRenameReport(null) });
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameReport(null)}>Cancel</Button>
            <Button
              onClick={() => {
                if (renameReport && renameValue.trim()) {
                  updateReport.mutate({ id: renameReport.id, name: renameValue.trim() }, { onSuccess: () => setRenameReport(null) });
                }
              }}
              disabled={!renameValue.trim() || updateReport.isPending}
            >
              Rename
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Reports;
