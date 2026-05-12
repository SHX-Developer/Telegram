interface Props {
  message?: string;
}

export function EmptyState({ message = "Выбери чат, чтобы начать переписку." }: Props) {
  return (
    <div className="flex-1 grid place-items-center px-6 text-center">
      <div className="bg-bg-panel/70 border border-border rounded-2xl px-5 py-3 text-sm text-muted">
        {message}
      </div>
    </div>
  );
}
