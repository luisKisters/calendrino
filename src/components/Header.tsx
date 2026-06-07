import { Logo } from "./riso/Logo";
import { Icon } from "./riso/Icon";

interface HeaderProps {
  onSettings?: () => void;
  showSettings?: boolean;
}

export function Header({ onSettings, showSettings = true }: HeaderProps) {
  return (
    <header
      className="flex items-center gap-2 px-4 py-3 border-b border-line"
      style={{ borderBottomWidth: "1.5px" }}
    >
      <Logo size={26} />
      <h1 className="font-display font-extrabold text-[17px] leading-none mr-auto text-ink">
        Calendrino
      </h1>
      {showSettings && onSettings && (
        <button
          onClick={onSettings}
          aria-label="Settings"
          className="flex items-center justify-center w-[26px] h-[26px] rounded-full border border-ink text-ink transition hover:bg-paper-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
          style={{ borderWidth: "1.5px", minWidth: 44, minHeight: 44 }}
        >
          <Icon name="gear" size={14} aria-hidden={true} />
        </button>
      )}
    </header>
  );
}
