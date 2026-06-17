"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "../../lib/AppContext.jsx";
import { AdminNav } from "../../components/layout/AdminNav.jsx";

// Role gate + admin chrome. Non-admins are bounced to the customer home; admins
// get the admin nav + their page. AppShell suppresses the customer TopNav/
// BottomNav on /admin, so this layout owns all the chrome here.
export default function AdminLayout({ children }) {
  const { auth, mode } = useApp();
  const router = useRouter();

  const allowed = mode === "backend" && auth.profile?.role === "admin";

  useEffect(() => {
    if (auth.loading) return;
    if (!allowed) router.replace("/");
  }, [auth.loading, allowed, router]);

  if (auth.loading || !allowed) {
    return (
      <div className="grid h-screen place-items-center bg-white text-sm text-neutral-500">
        Loading…
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-mist font-body text-ink antialiased lg:flex-row">
      <AdminNav />
      <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
