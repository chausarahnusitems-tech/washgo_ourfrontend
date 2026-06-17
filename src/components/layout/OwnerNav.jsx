"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, LayoutDashboard, LogOut, MessageCircle, Star, Store } from "lucide-react";
import { icons as svgIcons } from "../../assets.js";
import { cx } from "../../lib/cx.js";
import { useApp } from "../../lib/AppContext.jsx";

// Owner-area navigation. Renders a left sidebar on desktop and a sticky top bar
// on mobile (the owner layout arranges them via flex). Deliberately separate
// from the customer TopNav/BottomNav — the owner section is its own world.
const NAV_ITEMS = [
  { key: "dashboard", label: "Dashboard", href: "/owner", icon: LayoutDashboard },
  { key: "shops", label: "My shops", href: "/owner/shops", icon: Store },
  { key: "messages", label: "Messages", href: "/owner/messages", icon: MessageCircle },
  { key: "reviews", label: "Reviews", href: "/owner/reviews", icon: Star }
];

function isActive(pathname, href) {
  if (href === "/owner") return pathname === "/owner";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function OwnerNav() {
  const { auth, signOut } = useApp();
  const pathname = usePathname();
  const name = auth.profile?.full_name || auth.user?.email || "Owner";

  const links = NAV_ITEMS.map(({ key, label, href, icon: LucideIcon }) => {
    const active = isActive(pathname, href);
    return (
      <Link
        key={key}
        href={href}
        aria-current={active ? "page" : undefined}
        className={cx(
          "flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-bold transition",
          active ? "bg-wash-50 text-wash-600" : "text-ink hover:bg-neutral-100"
        )}
      >
        <LucideIcon className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
        <span>{label}</span>
      </Link>
    );
  });

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-black/10 bg-white p-4 lg:flex">
        <Link href="/owner" className="mb-6 inline-flex items-center px-2">
          <img src={svgIcons.washgoLogo} alt="Washgo" className="h-8 w-auto object-contain" />
          <span className="ml-2 rounded-full bg-ink px-2 py-0.5 text-[0.6rem] font-black uppercase tracking-wide text-white">
            Owner
          </span>
        </Link>

        <nav aria-label="Owner navigation" className="flex flex-col gap-1">
          {links}
        </nav>

        <div className="mt-auto flex flex-col gap-1 border-t border-black/10 pt-3">
          <p className="truncate px-3 text-xs font-semibold text-neutral-500">{name}</p>
          <Link
            href="/"
            className="flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-semibold text-neutral-600 transition hover:bg-neutral-100"
          >
            <ArrowLeft className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
            Customer app
          </Link>
          <button
            type="button"
            onClick={signOut}
            className="flex items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-sm font-semibold text-neutral-600 transition hover:bg-neutral-100"
          >
            <LogOut className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-black/10 bg-white/95 px-4 py-2.5 backdrop-blur lg:hidden">
        <Link href="/owner" className="inline-flex items-center">
          <img src={svgIcons.washgoLogo} alt="Washgo" className="h-7 w-auto object-contain" />
          <span className="ml-2 rounded-full bg-ink px-2 py-0.5 text-[0.55rem] font-black uppercase tracking-wide text-white">
            Owner
          </span>
        </Link>
        <nav aria-label="Owner navigation" className="ml-auto flex items-center gap-1">
          {NAV_ITEMS.map(({ key, label, href, icon: LucideIcon }) => {
            const active = isActive(pathname, href);
            return (
              <Link
                key={key}
                href={href}
                aria-label={label}
                aria-current={active ? "page" : undefined}
                className={cx(
                  "grid h-10 w-10 place-items-center rounded-full transition",
                  active ? "bg-wash-50 text-wash-600" : "text-neutral-500 hover:bg-neutral-100"
                )}
              >
                <LucideIcon className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
              </Link>
            );
          })}
          <button
            type="button"
            onClick={signOut}
            aria-label="Sign out"
            className="grid h-10 w-10 place-items-center rounded-full text-neutral-500 transition hover:bg-neutral-100"
          >
            <LogOut className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
          </button>
        </nav>
      </header>
    </>
  );
}
