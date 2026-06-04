import { Icon } from "../ui/Icon.jsx";
import { IconButton } from "../ui/Button.jsx";
import { icons } from "../../assets.js";

export function TopBar({ compact = false, title, subtitle, t, lang, onLang, onBack, onHome }) {
  return (
    <header className="mb-4 flex min-h-12 items-start justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        {onBack ? (
          <IconButton label="Back" onClick={onBack}>
            <Icon name="ArrowLeft" className="h-5 w-5" />
          </IconButton>
        ) : (
          <button
            type="button"
            onClick={onHome}
            aria-label="Washgo home"
            className="inline-flex min-h-11 shrink-0 items-center border-0 bg-transparent p-0"
          >
            <img src={icons.washgoLogo} alt="Washgo" className="h-[31px] w-[79px] object-contain" />
          </button>
        )}

        {title ? (
          <div className="min-w-0">
            <h1 className="m-0 font-display text-[1.42rem] font-black leading-none text-ink">{title}</h1>
            {subtitle ? <p className="mt-1 truncate text-xs text-neutral-500">{subtitle}</p> : null}
          </div>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {!compact ? (
          <div className="text-right text-[0.68rem] leading-tight">
            <span className="block text-neutral-500">{t("memberUntil")}</span>
            <strong className="block text-ink">{t("dateUntil")}</strong>
          </div>
        ) : null}
        <div className="inline-flex h-9 rounded-full bg-neutral-100 p-1" role="group" aria-label="Language">
          {["en", "vi"].map((code) => (
            <button
              key={code}
              type="button"
              data-lang={code}
              onClick={() => onLang(code)}
              className={`min-w-8 rounded-full px-2 text-[0.68rem] font-black ${
                lang === code ? "bg-ink text-white" : "text-neutral-500"
              }`}
            >
              {code.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
    </header>
  );
}
