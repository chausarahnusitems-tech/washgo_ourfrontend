import { cx } from "../../lib/cx.js";
import { Icon } from "../ui/Icon.jsx";

/**
 * Temporary stand-in for the interactive map. The real map will be wired up
 * later with a proper mapping library; until then this renders a clearly
 * labelled placeholder so the layout/spacing is correct.
 */
export function MapPlaceholder({ className, label = "Map", rounded = "rounded-[18px]" }) {
  return (
    <div
      role="img"
      aria-label={`${label} placeholder`}
      className={cx(
        "relative grid place-items-center overflow-hidden border border-[#dfe9e9]",
        "bg-[linear-gradient(180deg,#f1f7f8_0%,#e4eef0_100%)]",
        rounded,
        className
      )}
    >
      {/* faint road lines so the empty box reads as a map */}
      <span className="pointer-events-none absolute left-[8%] top-[52%] h-[6px] w-[84%] -rotate-6 rounded-full bg-[#52606122]" />
      <span className="pointer-events-none absolute left-[24%] top-[26%] h-[6px] w-[60%] rotate-45 rounded-full bg-[#52606122]" />
      <span className="pointer-events-none absolute left-[14%] top-[78%] h-[6px] w-[70%] rotate-2 rounded-full bg-[#52606122]" />

      <div className="relative z-10 flex flex-col items-center gap-2 px-4 text-center">
        <span className="grid h-12 w-12 place-items-center rounded-full bg-wash-500 text-white shadow-lg">
          <Icon name="MapPin" className="h-6 w-6" />
        </span>
        <span className="text-sm font-black text-ink/70">{label}</span>
        <span className="text-[0.7rem] font-medium text-neutral-500">Map integration coming soon</span>
      </div>
    </div>
  );
}
