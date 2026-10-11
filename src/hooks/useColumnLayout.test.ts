import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useColumnLayout } from "./useColumnLayout";

const columns = [
  { key: "payee_name", label: "Payee" },
  { key: "memo", label: "Memo" },
  { key: "acc_one", label: "Account" },
  { key: "total", label: "Total" },
];

describe("report column movement", () => {
  beforeEach(() => localStorage.clear());

  it("moves an account before Memo using rendered indices despite unavailable saved columns", () => {
    const { result } = renderHook(() => useColumnLayout("reports", columns));
    act(() => result.current.applyLayout({ visibleKeys: ["payee_name", "ch_old", "memo", "acc_one", "total"] }));
    act(() => result.current.reorderColumn(2, 1));
    expect(result.current.visibleColumns.map((col) => col.key)).toEqual(["payee_name", "acc_one", "memo", "total"]);
    expect(JSON.parse(localStorage.getItem("col-layout-reports") || "{}").visibleKeys).toEqual(["payee_name", "acc_one", "memo", "total"]);
  });

  it("moves Total before Memo by key, skipping unavailable saved columns", () => {
    const { result } = renderHook(() => useColumnLayout("reports", columns));
    act(() => result.current.applyLayout({ visibleKeys: ["payee_name", "memo", "ch_old", "total"] }));
    act(() => result.current.moveColumn("total", "up"));
    expect(result.current.visibleColumns.map((col) => col.key)).toEqual(["payee_name", "total", "memo"]);
  });
});