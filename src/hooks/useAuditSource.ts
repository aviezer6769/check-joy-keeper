import { useEffect } from "react";
import { setAuditSource } from "@/lib/audit";

/** Sets the global audit source label while this page is mounted. */
export function useAuditSource(source: string) {
  useEffect(() => {
    setAuditSource(source);
  }, [source]);
}
