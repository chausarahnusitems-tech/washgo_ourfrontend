"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { TopNav } from "./TopNav.jsx";
import { BottomNav } from "./BottomNav.jsx";
import { useApp } from "../../lib/AppContext.jsx";
import { isAdminCustomerMode } from "../../lib/adminPortal.js";

// Routes that show the mobile bottom nav (mirrors the old `bottomNavByScreen`
// map). Detail / booking / confirmation / explore / plans render their own
// footer or are desktop-only, so they show no bottom nav.
const BOTTOM_NAV_ROUTES = new Set(["/", "/bookings", "/chat", "/rewards", "/vouchers", "/account"]);

// Role homes: admins are auto-routed into /admin. Owners are NOT force-routed —
// they're ordinary customers with an extra owner area they opt into from their
// profile (the "Owner mode" toggle), so they stay in the customer app by default.
const ROLE_HOME = { admin: "/admin" };

function isRoleExempt(pathname, home) {
  return (
    pathname.startsWith(home) ||
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
    // Admins can opt into the customer portal (see adminPortal.js) — don't bounce
    // them back to /admin while that session preference is on.
    if (role === "admin" && isAdminCustomerMode()) return;
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
