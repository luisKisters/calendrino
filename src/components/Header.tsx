interface HeaderProps {
  onSettings?: () => void;
  showSettings?: boolean;
}

export function Header({ onSettings, showSettings = true }: HeaderProps) {
  return (
    <header className="flex items-center justify-between px-5 py-4">
      <div className="flex items-center gap-2">
        <span className="text-2xl">📅</span>
        <h1 className="text-lg font-semibold tracking-tight">Calendrino</h1>
      </div>
      {showSettings && onSettings && (
        <button
          onClick={onSettings}
          aria-label="Settings"
          className="rounded-full p-2 text-gray-400 transition hover:bg-white/10 hover:text-white"
        >
          ⚙️
        </button>
      )}
    </header>
  );
}
