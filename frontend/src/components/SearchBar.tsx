"use client";

interface Props {
  value: string;
  onChange: (next: string) => void;
  onClear: () => void;
}

export function SearchBar({ value, onChange, onClear }: Props) {
  return (
    <div className="px-3 pb-3">
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted">
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" strokeLinecap="round" />
          </svg>
        </span>
        <input
          type="text"
          placeholder="Search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-full bg-bg-elevated border border-transparent focus:border-accent outline-none pl-9 pr-9 py-2 text-sm placeholder:text-muted"
        />
        {value && (
          <button
            onClick={onClear}
            type="button"
            aria-label="Clear search"
            className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 grid place-items-center rounded-full text-muted hover:text-white hover:bg-bg-hover"
          >
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
