import { useState, useRef, useEffect, useMemo } from "react";
import { Input } from "@/components/ui/input";

interface FieldSuggestInputProps {
  value: string;
  onChange: (value: string) => void;
  suggestions: string[];
  placeholder?: string;
  className?: string;
  type?: string;
  dir?: "rtl" | "ltr";
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  [key: string]: any;
}

export function FieldSuggestInput({
  value,
  onChange,
  suggestions,
  placeholder,
  className,
  type = "text",
  dir,
}: FieldSuggestInputProps) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const query = (value || "").trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!query) return [];
    const unique = [...new Set(suggestions.filter(Boolean))];
    return unique
      .filter((s) => s.toLowerCase().includes(query) && s.toLowerCase() !== query)
      .slice(0, 8);
  }, [query, suggestions]);

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
      onChange(filtered[activeIndex]);
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
        dir={dir}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setShowSuggestions(true);
        }}
        onFocus={() => query && filtered.length > 0 && setShowSuggestions(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={className}
      />
      {showSuggestions && filtered.length > 0 && (
        <div ref={listRef} className="absolute z-50 top-full left-0 right-0 mt-0.5 bg-popover border border-border rounded shadow-lg max-h-32 overflow-y-auto min-w-[120px]">
          {filtered.map((s, i) => (
            <div
              key={i}
              dir={dir}
              className={`px-2 py-1 hover:bg-accent cursor-pointer text-xs border-b border-border last:border-b-0 truncate ${i === activeIndex ? "bg-accent" : ""}`}
              onClick={() => {
                onChange(s);
                setShowSuggestions(false);
              }}
            >
              {s}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
