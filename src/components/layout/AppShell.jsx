"use client";

import { Suspense } from "react";
import { usePathname } from "next/navigation";
import { TopNav } from "./TopNav.jsx";
import { BottomNav } from "./BottomNav.jsx";
import { QuickShopModal } from "../QuickShopModal.jsx";

// Routes that show the mobile bottom nav (mirrors the old `bottomNavByScreen`
// map). Detail / booking / confirmation / explore / plans render their own
// footer or are desktop-only, so they show no bottom nav.
const BOTTOM_NAV_ROUTES = new Set(["/", "/bookings", "/rewards", "/vouchers", "/account"]);

export function AppShell({ children }) {
  const pathname = usePathname();
  const showBottomNav = BOTTOM_NAV_ROUTES.has(pathname);

  return (
    <div className="flex h-screen flex-col bg-white font-body text-ink antialiased">
      <TopNav className="hidden lg:flex" />
      <main className="min-h-0 flex-1 overflow-hidden">{children}</main>
      {showBottomNav ? <BottomNav className="lg:hidden" /> : null}
      <Suspense fallback={null}>
        <QuickShopModal />
      </Suspense>
    </div>
  );
}
