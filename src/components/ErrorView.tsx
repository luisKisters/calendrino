interface ErrorViewProps {
  message: string;
  detail?: string;
  onRetry?: () => void;
  onSettings?: () => void;
}

export function ErrorView({ message, detail, onRetry, onSettings }: ErrorViewProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
      <span className="text-4xl">⚠️</span>
      <p className="text-lg font-medium">{message}</p>
      {detail && <p className="max-w-xs break-words text-sm text-gray-400">{detail}</p>}
      <div className="mt-2 flex flex-col gap-3">
        {onRetry && (
          <button
            onClick={onRetry}
            className="rounded-xl bg-indigo-500 px-5 py-3 font-semibold text-white hover:bg-indigo-400"
          >
            Try again
          </button>
        )}
        {onSettings && (
          <button
            onClick={onSettings}
            className="rounded-xl px-5 py-3 text-gray-400 transition hover:text-white"
          >
            Open settings
          </button>
        )}
      </div>
    </div>
  );
}
