import { images, icons as svgIcons } from "../../assets.js";
import { cx } from "../../lib/cx.js";
import { Icon } from "../ui/Icon.jsx";

export function TopNav({ active, onScreen, t, lang, onLang, className }) {
  const links = [
    { key: "explore", label: t("explore"), screen: "explore" },
    { key: "bookings", label: t("bookings"), screen: "bookings" },
    { key: "chat", label: t("chat"), screen: null },
    { key: "joinUs", label: t("joinUs"), screen: "plans" }
  ];

  return (
    <header className={cx("sticky top-0 z-30 border-b border-black/10 bg-white/95 backdrop-blur", className)}>
      <div className="mx-auto flex h-[68px] w-full max-w-[1400px] items-center gap-6 px-6 xl:px-10">
        <button
          type="button"
          onClick={() => onScreen("home")}
          aria-label="Washgo home"
          className="inline-flex shrink-0 items-center border-0 bg-transparent p-0"
        >
          <img src={svgIcons.washgoLogo} alt="Washgo" className="h-8 w-auto object-contain" />
        </button>

        <nav aria-label="Primary navigation" className="ml-6 flex items-center gap-7">
          {links.map((link) => (
            <button
              key={link.key}
              type="button"
              onClick={() => (link.screen ? onScreen(link.screen) : undefined)}
              aria-current={active === link.key ? "page" : undefined}
              className={cx(
                "bg-transparent p-0 text-[0.95rem] transition hover:text-wash-500",
                active === link.key ? "font-black text-wash-500" : "font-semibold text-ink"
              )}
            >
              {link.label}
            </button>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-4">
          <div className="inline-flex h-9 rounded-full bg-neutral-100 p-1" role="group" aria-label="Language">
            {["en", "vi"].map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => onLang(code)}
                className={cx(
                  "min-w-8 rounded-full px-2 text-[0.68rem] font-black",
                  lang === code ? "bg-ink text-white" : "text-neutral-500"
                )}
              >
                {code.toUpperCase()}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => onScreen("account")}
            aria-current={active === "account" ? "page" : undefined}
            className={cx(
              "flex items-center gap-2 rounded-full border bg-white py-1 pl-1 pr-2 transition hover:bg-neutral-50",
              active === "account" ? "border-wash-300" : "border-black/10"
            )}
          >
            <img src={images.profile} alt="" className="h-9 w-9 rounded-full object-cover" />
            <span className="hidden text-left leading-tight sm:block">
              <span className="block text-sm font-black text-ink">{t("profileName")}</span>
              <span className="block text-xs font-semibold text-wash-500">{t("proMember")}</span>
            </span>
            <Icon name="ChevronDown" className="h-4 w-4 text-neutral-500" />
          </button>
        </div>
      </div>
    </header>
  );
}
