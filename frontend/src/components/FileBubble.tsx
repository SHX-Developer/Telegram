"use client";

interface Props {
  url: string;
  name: string;
  mime: string;
  size: number;
  isMine: boolean;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function isImage(mime: string): boolean {
  return mime.startsWith("image/");
}

export function FileBubble({ url, name, mime, size, isMine }: Props) {
  if (isImage(mime)) {
    return (
      <a
        href={url}
        download={name}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="block min-w-[180px] max-w-[260px] rounded-lg overflow-hidden bg-black/20"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={name} className="block w-full h-auto" />
      </a>
    );
  }
  return (
    <a
      href={url}
      download={name}
      onClick={(e) => e.stopPropagation()}
      className={`flex items-center gap-3 min-w-[220px] rounded-lg px-2 py-1.5 transition-colors ${
        isMine ? "hover:bg-white/10" : "hover:bg-white/5"
      }`}
    >
      <div
        className={`h-10 w-10 shrink-0 rounded-full grid place-items-center ${
          isMine ? "bg-white/20" : "bg-accent/20 text-accent"
        }`}
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M13 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9z" strokeLinejoin="round" />
          <path d="M13 3v6h6" strokeLinejoin="round" />
        </svg>
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{name}</div>
        <div className={`text-xs ${isMine ? "text-white/70" : "text-muted"}`}>{formatSize(size)}</div>
      </div>
    </a>
  );
}
