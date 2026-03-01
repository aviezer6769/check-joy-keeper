import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { type Payee } from "@/hooks/usePayees";

interface PayeeAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelectPayee?: (payee: Payee) => void;
  payees: Payee[];
  searchField: "payee_name" | "record_id";
  placeholder?: string;
  className?: string;
  type?: string;
}

export function PayeeAutocomplete({
  value,
  onChange,
  onSelectPayee,
  payees,
  searchField,
  placeholder,
  className = "h-7 text-xs min-w-[80px] px-1.5",
  type = "text",
}: PayeeAutocompleteProps) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const query = (value || "").trim().toLowerCase();
  const filtered = query
    ? payees
        .filter((p) => {
          if (searchField === "record_id") {
            return p.record_id?.toLowerCase().includes(query);
          }
          return (
            p.payee_name.toLowerCase().includes(query) ||
            p.first_name?.toLowerCase().includes(query) ||
            p.last_name?.toLowerCase().includes(query) ||
            p.first_name_yiddish?.toLowerCase().includes(query) ||
            p.last_name_yiddish?.toLowerCase().includes(query)
          );
        })
        .slice(0, 10)
    : [];

  useEffect(() => {
    setActiveIndex(-1);
  }, [filtered.length, value]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions || filtered.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) => (prev < filtered.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) => (prev > 0 ? prev - 1 : filtered.length - 1));
    } else if ((e.key === "Enter" || e.key === "Tab") && activeIndex >= 0) {
      e.preventDefault();
      onSelectPayee?.(filtered[activeIndex]);
      setShowSuggestions(false);
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
    }
  };

  useEffect(() => {
    if (activeIndex >= 0 && listRef.current) {
      const item = listRef.current.children[activeIndex] as HTMLElement;
      item?.scrollIntoView({ block: "nearest" });
    }
  }, [activeIndex]);

  return (
    <div className="relative" ref={containerRef}>
      <Input
        type={type}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setShowSuggestions(true);
        }}
        onFocus={() => query && setShowSuggestions(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={className}
      />
      {showSuggestions && filtered.length > 0 && (
        <div ref={listRef} className="absolute z-50 top-full left-0 right-0 mt-0.5 bg-popover border border-border rounded shadow-lg max-h-40 overflow-y-auto min-w-[180px]">
          {filtered.map((p, i) => (
            <div
              key={p.id}
              className={`px-2 py-1.5 hover:bg-accent cursor-pointer text-xs border-b border-border last:border-b-0 ${i === activeIndex ? "bg-accent" : ""}`}
              onClick={() => {
                onSelectPayee?.(p);
                setShowSuggestions(false);
              }}
            >
              <div className="flex justify-between gap-2">
                <span className="font-medium truncate">{p.payee_name}</span>
                {p.record_id && (
                  <span className="font-mono text-muted-foreground shrink-0">{p.record_id}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
