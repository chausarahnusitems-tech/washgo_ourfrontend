"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { TopNav } from "./TopNav.jsx";
import { BottomNav } from "./BottomNav.jsx";
import { useApp } from "../../lib/AppContext.jsx";
import { isCustomerPortalMode } from "../../lib/adminPortal.js";

// Routes that show the mobile bottom nav (mirrors the old `bottomNavByScreen`
// map). Detail / booking / confirmation / explore / plans render their own
// footer or are desktop-only, so they show no bottom nav.
const BOTTOM_NAV_ROUTES = new Set(["/", "/bookings", "/chat", "/rewards", "/vouchers", "/account"]);

// Role homes: owners/admins are auto-routed into their own section so they land
// on their dashboard/console first. Either can opt into the customer portal (see
// adminPortal.js) to browse the customer app without being bounced back.
const ROLE_HOME = { admin: "/admin", owner: "/owner" };

function isRoleExempt(pathname, home) {
  return (
    pathname.startsWith(home) ||
    // The owner area is reachable by admins who also run a shop, so don't bounce
    // them back to /admin while they're managing it.
    pathname.startsWith("/owner") ||
    pathname.startsWith("/auth") ||
    pathname === "/login"
  );
}

export function AppShell({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const { auth } = useApp();

  // Auto-route signed-in owners/admins into their own section. Runs once the
  // session has resolved; pairs with each layout's reverse guard (wrong role →
  // "/"). Customers have no home override and stay in the customer app.
  useEffect(() => {
    if (auth.loading) return;
    const role = auth.profile?.role;
    const home = ROLE_HOME[role];
    // Owners/admins can opt into the customer portal (see adminPortal.js) — don't
    // bounce them back to their section while that session preference is on.
    if (home && isCustomerPortalMode()) return;
    if (home && !isRoleExempt(pathname, home)) {
      router.replace(home);
    }
  }, [auth.loading, auth.profile?.role, pathname, router]);

  // The /owner and /admin sections bring their own chrome; render them bare so
  // the customer TopNav/BottomNav/QuickShop modal don't bleed in.
  if (pathname.startsWith("/owner") || pathname.startsWith("/admin")) {
    return children;
  }

  const showBottomNav = BOTTOM_NAV_ROUTES.has(pathname);

  return (
    <div className="flex h-screen flex-col bg-white font-body text-ink antialiased">
      <TopNav className="hidden lg:flex" />
      <main className="min-h-0 flex-1 overflow-hidden">{children}</main>
      {showBottomNav ? <BottomNav className="lg:hidden" /> : null}
    </div>
  );
}
