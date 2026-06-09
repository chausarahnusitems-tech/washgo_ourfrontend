import { Icon } from "../ui/Icon.jsx";
import { cx } from "../../lib/cx.js";

const navItems = [
  ["home", "Home", "home"],
  ["bookings", "Calendar", "bookings"],
  ["chat", "MessageCircle", "chat"],
  ["account", "User", "account"]
];

export function BottomNav({ active, onScreen, t, className }) {
  return (
    <nav aria-label="Primary navigation" className={cx("grid h-[72px] grid-cols-4 border-t border-black/20 bg-white/95 backdrop-blur", className)}>
      {navItems.map(([screen, icon, key]) => (
        <button
          key={screen}
          type="button"
          onClick={() => (screen === "chat" ? undefined : onScreen(screen))}
          className={`grid min-w-0 place-items-center content-center gap-1 text-[0.68rem] ${
            active === screen ? "font-extrabold text-wash-500" : "text-neutral-500"
          }`}
        >
          <Icon name={icon} className="h-[21px] w-[21px]" />
          <span>{t(key)}</span>
        </button>
      ))}
    </nav>
  );
}
