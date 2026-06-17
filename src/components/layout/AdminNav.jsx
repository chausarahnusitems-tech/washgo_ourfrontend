"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft, BadgeCheck, ClipboardCheck, LogOut, MessageCircle, ShieldCheck, Star, Store } from "lucide-react";
import { icons as svgIcons } from "../../assets.js";
import { cx } from "../../lib/cx.js";
import { useApp } from "../../lib/AppContext.jsx";
import { enterCustomerPortal } from "../../lib/adminPortal.js";

// Admin-area navigation. Left sidebar on desktop, sticky top bar on mobile —
// same shape as OwnerNav but for the moderation console.
const NAV_ITEMS = [
  { key: "queue", label: "Approval queue", href: "/admin", icon: ClipboardCheck },
  { key: "shops", label: "All shops", href: "/admin/shops", icon: Store },
  { key: "claims", label: "Applications", href: "/admin/claims", icon: BadgeCheck },
  { key: "messages", label: "Messages", href: "/admin/messages", icon: MessageCircle },
  { key: "reviews", label: "Reviews", href: "/admin/reviews", icon: Star }
];

function isActive(pathname, href) {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminNav() {
  const { auth, signOut } = useApp();
  const pathname = usePathname();
  const router = useRouter();
  const name = auth.profile?.full_name || auth.user?.email || "Admin";

  const links = NAV_ITEMS.map(({ key, label, href, icon: LucideIcon }) => {
    const active = isActive(pathname, href);
    return (
      <Link
        key={key}
        href={href}
        aria-current={active ? "page" : undefined}
        className={cx(
          "flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-bold transition",
          active ? "bg-ink/5 text-ink" : "text-ink hover:bg-neutral-100"
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
        <Link href="/admin" className="mb-6 inline-flex items-center px-2">
          <img src={svgIcons.washgoLogo} alt="Washgo" className="h-8 w-auto object-contain" />
          <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-ink px-2 py-0.5 text-[0.6rem] font-black uppercase tracking-wide text-white">
            <ShieldCheck className="h-3 w-3" aria-hidden="true" />
            Admin
          </span>
        </Link>

        <nav aria-label="Admin navigation" className="flex flex-col gap-1">
          {links}
        </nav>

        <div className="mt-auto flex flex-col gap-1 border-t border-black/10 pt-3">
          <p className="truncate px-3 text-xs font-semibold text-neutral-500">{name}</p>
          <button
            type="button"
            onClick={() => enterCustomerPortal(router)}
            className="flex items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-sm font-semibold text-neutral-600 transition hover:bg-neutral-100"
          >
            <ArrowLeft className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
            Customer app
          </button>
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
        <Link href="/admin" className="inline-flex items-center">
          <img src={svgIcons.washgoLogo} alt="Washgo" className="h-7 w-auto object-contain" />
          <span className="ml-2 rounded-full bg-ink px-2 py-0.5 text-[0.55rem] font-black uppercase tracking-wide text-white">
            Admin
          </span>
        </Link>
        <nav aria-label="Admin navigation" className="ml-auto flex items-center gap-1">
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
                  active ? "bg-ink/5 text-ink" : "text-neutral-500 hover:bg-neutral-100"
                )}
              >
                <LucideIcon className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => enterCustomerPortal(router)}
            aria-label="Customer app"
            className="grid h-10 w-10 place-items-center rounded-full text-neutral-500 transition hover:bg-neutral-100"
          >
            <ArrowLeft className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
          </button>
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
