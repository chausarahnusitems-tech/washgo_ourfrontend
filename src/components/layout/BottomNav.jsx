"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "../ui/Icon.jsx";
import { cx } from "../../lib/cx.js";
import { useApp } from "../../lib/AppContext.jsx";

// [key, icon, label-copy-key, href].
const navItems = [
  ["home", "Home", "home", "/"],
  ["bookings", "Calendar", "bookings", "/bookings"],
  ["chat", "MessageCircle", "chat", "/chat"],
  ["account", "User", "account", "/account"]
];

// Rewards / vouchers fall under the "account" tab highlight.
function activeKey(pathname) {
  if (pathname === "/") return "home";
  if (pathname === "/bookings") return "bookings";
  if (pathname === "/chat") return "chat";
  if (pathname === "/account" || pathname === "/rewards" || pathname === "/vouchers") return "account";
  return null;
}

export function BottomNav({ className }) {
  const { t } = useApp();
  const pathname = usePathname();
  const active = activeKey(pathname);

  return (
    <nav
      aria-label={t("primaryNav")}
      className={cx("grid h-[72px] grid-cols-4 border-t border-black/20 bg-white/95 backdrop-blur", className)}
    >
      {navItems.map(([key, icon, copyKey, href]) => {
        const classes = cx(
          "grid min-w-0 place-items-center content-center gap-1 text-[0.68rem]",
          active === key ? "font-extrabold text-wash-500" : "text-neutral-500"
        );
        const inner = (
          <>
            <Icon name={icon} className="h-[21px] w-[21px]" />
            <span>{t(copyKey)}</span>
          </>
        );
        return href ? (
          <Link key={key} href={href} className={classes}>
            {inner}
          </Link>
        ) : (
          <button key={key} type="button" className={classes}>
            {inner}
          </button>
        );
      })}
    </nav>
  );
}
