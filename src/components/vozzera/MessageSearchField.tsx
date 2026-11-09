import { Search, X } from "lucide-react";
import type { RefObject } from "react";

import { Input } from "@/components/ui/input";

export function MessageSearchField({
  value,
  matchCount,
  totalCount,
  inputRef,
  onChange,
  onClear,
}: Readonly<{
  value: string;
  matchCount: number;
  totalCount: number;
  inputRef: RefObject<HTMLInputElement | null>;
  onChange: (value: string) => void;
  onClear: () => void;
}>) {
  const searching = value.trim().length > 0;

  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <div className="relative flex min-w-0 items-center">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-2 h-3.5 w-3.5 text-muted-foreground"
        />
        <Input
          ref={inputRef}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Buscar nas mensagens"
          aria-label="Buscar nas mensagens desta sala"
          className="h-9 w-28 pl-7 pr-7 sm:w-52"
        />
        {searching && (
          <button
            type="button"
            onClick={onClear}
            aria-label="Limpar busca"
            className="absolute right-0 flex h-9 w-7 items-center justify-center rounded-r-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <X aria-hidden="true" className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {searching && (
        <span
          role="status"
          aria-live="polite"
          className="shrink-0 text-[11px] tabular-nums text-muted-foreground"
        >
          {matchCount} de {totalCount}
        </span>
      )}
    </div>
  );
}
