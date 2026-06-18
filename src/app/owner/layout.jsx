"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "../../lib/AppContext.jsx";
import { OwnerNav } from "../../components/layout/OwnerNav.jsx";

// Role gate + owner chrome. Non-owners are bounced to the customer home; owners
// get the owner nav + their page. (AppShell suppresses the customer TopNav/
// BottomNav on /owner, so this layout owns all the chrome here.)
export default function OwnerLayout({ children }) {
  const { auth, mode } = useApp();
  const router = useRouter();

  const role = auth.profile?.role;
  // In demo mode there are no roles/owners — send to the customer app. Admins are
  // allowed in too: a platform admin can also own and run a shop (e.g. the Prisma
  // hub) through the owner dashboard while keeping their moderation powers.
  const allowed = mode === "backend" && (role === "owner" || role === "admin");

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
      <OwnerNav />
      <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
