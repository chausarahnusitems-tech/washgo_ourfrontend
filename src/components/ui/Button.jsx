import { cx } from "../../lib/cx.js";

const variants = {
  primary: "bg-wash-500 text-white shadow-cta hover:bg-wash-600",
  secondary: "border border-black/10 bg-white text-ink hover:bg-neutral-50",
  subtle: "bg-neutral-100 text-ink hover:bg-neutral-200",
  ghost: "bg-transparent text-ink hover:bg-neutral-100",
  // White pill for use on colored/gradient cards. Kept as its own variant so it
  // never inherits primary's red bg/white text (which would otherwise win on CSS
  // source order and make a className override of bg-white silently fail).
  onColor: "bg-white text-wash-700 hover:bg-white"
};

export function Button({ children, className, variant = "primary", type = "button", ...props }) {
  return (
    <button
      type={type}
      className={cx(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl px-4 font-bold transition disabled:cursor-not-allowed disabled:bg-neutral-300 disabled:text-white disabled:shadow-none",
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function IconButton({ children, className, label, variant = "subtle", ...props }) {
  return (
    <button
      type="button"
      aria-label={label}
      className={cx(
        "inline-grid h-11 w-11 shrink-0 place-items-center rounded-full transition",
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
