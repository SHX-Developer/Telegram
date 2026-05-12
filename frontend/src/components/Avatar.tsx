interface Props {
  name: string;
  url?: string | null;
  size?: "sm" | "md" | "lg" | "xl";
  online?: boolean;
}

const sizeClasses = {
  sm: "h-9 w-9 text-sm",
  md: "h-11 w-11 text-base",
  lg: "h-14 w-14 text-lg",
  xl: "h-20 w-20 text-2xl",
};

const dotClasses = {
  sm: "h-2.5 w-2.5 border-[2px]",
  md: "h-3 w-3 border-[2px]",
  lg: "h-3.5 w-3.5 border-[2px]",
  xl: "h-4 w-4 border-[3px]",
};

// Стабильно выбираем цвет фона по строке-имени (детерминированно).
const palette = [
  "bg-[#3390ec]",
  "bg-[#7a55ff]",
  "bg-[#e07a5f]",
  "bg-[#2da27a]",
  "bg-[#d27d1f]",
  "bg-[#c95571]",
  "bg-[#5a8ad1]",
];

function colorFor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return palette[hash % palette.length];
}

export function Avatar({ name, url, size = "md", online }: Props) {
  const initial = (name?.trim()?.charAt(0) ?? "?").toUpperCase();
  return (
    <div className="relative shrink-0">
      <div
        className={`rounded-full grid place-items-center text-white font-semibold ${
          sizeClasses[size]
        } ${url ? "bg-bg-elevated" : colorFor(name || "?")}`}
      >
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={name} className="h-full w-full rounded-full object-cover" />
        ) : (
          <span>{initial}</span>
        )}
      </div>
      {online && (
        <span
          className={`absolute bottom-0 right-0 rounded-full bg-emerald-500 border-bg-panel ${dotClasses[size]}`}
          aria-label="online"
        />
      )}
    </div>
  );
}
