"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { icons as svgIcons } from "../../assets.js";
import { cx } from "../../lib/cx.js";
import { useApp } from "../../lib/AppContext.jsx";
import { useChatBadge } from "../../lib/useChatBadge.js";
import { Icon } from "../ui/Icon.jsx";

// Desktop top-nav highlight, keyed off the current route.
function activeKey(pathname) {
  if (pathname === "/explore" || pathname.startsWith("/shops")) return "explore";
  if (pathname === "/bookings") return "bookings";
  if (pathname === "/chat") return "chat";
  if (pathname === "/account") return "account";
  if (pathname === "/plans") return "joinUs";
  return null;
}

export function TopNav({ className }) {
  const { t, auth } = useApp();
  const pathname = usePathname();
  const active = activeKey(pathname);
  const chatUnread = useChatBadge();

  const isSignedIn = Boolean(auth?.user);
  const displayName = isSignedIn ? auth.profile?.full_name || auth.user.email : null;
  const avatarUrl = isSignedIn ? auth.profile?.avatar_url || null : null;

  const links = [
    { key: "explore", label: t("explore"), href: "/explore" },
    { key: "bookings", label: t("bookings"), href: "/bookings" },
    { key: "chat", label: t("chat"), href: "/chat" },
    { key: "joinUs", label: t("joinUs"), href: "/plans" }
  ];

  return (
    <header className={cx("sticky top-0 z-30 border-b border-black/10 bg-white/95 backdrop-blur", className)}>
      <div className="mx-auto flex h-[68px] w-full max-w-[1400px] items-center gap-6 px-6 xl:px-10">
        <Link href="/" aria-label={t("homeAria")} className="inline-flex shrink-0 items-center border-0 bg-transparent p-0">
          <img src={svgIcons.washgoLogo} alt="Washgo" className="h-8 w-auto object-contain" />
        </Link>

        <nav aria-label={t("primaryNav")} className="ml-6 flex items-center gap-7">
          {links.map((link) =>
            link.href ? (
              <Link
                key={link.key}
                href={link.href}
                aria-current={active === link.key ? "page" : undefined}
                className={cx(
                  "bg-transparent p-0 text-[0.95rem] transition hover:text-wash-500",
                  active === link.key ? "font-black text-wash-500" : "font-semibold text-ink"
                )}
              >
                <span className="inline-flex items-center gap-1.5">
                  {link.label}
                  {link.key === "chat" && chatUnread > 0 ? (
                    <span className="grid h-[18px] min-w-[18px] place-items-center rounded-full bg-wash-500 px-1 text-[0.62rem] font-black leading-none text-white">
                      {chatUnread > 9 ? "9+" : chatUnread}
                    </span>
                  ) : null}
                </span>
              </Link>
            ) : (
              <button
                key={link.key}
                type="button"
                className="bg-transparent p-0 text-[0.95rem] font-semibold text-ink transition hover:text-wash-500"
              >
                {link.label}
              </button>
            )
          )}
        </nav>

        <div className="ml-auto flex items-center gap-4">
          {isSignedIn ? (
            <Link
              href="/account"
              aria-current={active === "account" ? "page" : undefined}
              className={cx(
                "flex items-center gap-2 rounded-full border bg-white py-1 pl-1 pr-2 transition hover:bg-neutral-50",
                active === "account" ? "border-wash-300" : "border-black/10"
              )}
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="h-9 w-9 rounded-full object-cover" />
              ) : (
                <span className="grid h-9 w-9 place-items-center rounded-full bg-neutral-100 text-neutral-400">
                  <Icon name="User" className="h-5 w-5" />
                </span>
              )}
              <span className="hidden max-w-[160px] text-left leading-tight sm:block">
                <span className="block truncate text-sm font-black text-ink">{displayName}</span>
              </span>
            </Link>
          ) : (
            <Link
              href="/login"
              className="inline-flex h-9 items-center gap-1.5 rounded-full bg-wash-500 px-4 text-sm font-bold text-white shadow-cta transition hover:bg-wash-600"
            >
              <Icon name="User" className="h-4 w-4" />
              {t("signIn")}
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
