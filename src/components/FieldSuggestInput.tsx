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
  const containerRef = useRef<HTMLDivElement>(null);

  const query = (value || "").trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!query) return [];
    const unique = [...new Set(suggestions.filter(Boolean))];
    return unique
      .filter((s) => s.toLowerCase().includes(query) && s.toLowerCase() !== query)
      .slice(0, 8);
  }, [query, suggestions]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

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
        placeholder={placeholder}
        className={className}
      />
      {showSuggestions && filtered.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-0.5 bg-popover border border-border rounded shadow-lg max-h-32 overflow-y-auto min-w-[120px]">
          {filtered.map((s, i) => (
            <div
              key={i}
              dir={dir}
              className="px-2 py-1 hover:bg-accent cursor-pointer text-xs border-b border-border last:border-b-0 truncate"
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
