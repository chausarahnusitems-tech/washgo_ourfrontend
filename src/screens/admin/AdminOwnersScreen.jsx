"use client";

import { useState } from "react";
import { Check, UserCheck, X } from "lucide-react";
import { useAdminOwners } from "../../lib/admin/useAdminOwners.js";
import { Button } from "../../components/ui/Button.jsx";

// Admin review of customers applying to run a car wash. Approve grants the owner
// role; reject sends them back to customer.
export function AdminOwnersScreen() {
  const { applications, loading, approve, reject } = useAdminOwners();
  const [busyId, setBusyId] = useState(null);

  async function act(id, fn) {
    setBusyId(id);
    try {
      await fn();
    } catch (err) {
      console.error("[washgo] owner decision failed", err);
      window.alert(err?.message || "Something went wrong. Please try again.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-5 py-8 lg:px-10">
      <header>
        <h1 className="font-display text-2xl font-black">Owner applications</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Approve customers who want to list a car wash, or reject the request.
        </p>
      </header>

      {loading ? (
        <p className="mt-8 text-sm text-neutral-500">Loading…</p>
      ) : applications.length === 0 ? (
        <div className="mt-8 grid place-items-center rounded-2xl border border-dashed border-black/15 bg-white px-6 py-14 text-center">
          <UserCheck className="h-8 w-8 text-neutral-300" aria-hidden="true" />
          <p className="mt-3 text-sm font-semibold text-ink">No pending applications</p>
        </div>
      ) : (
        <ul className="mt-6 grid gap-3">
          {applications.map((app) => {
            const busy = busyId === app.id;
            return (
              <li
                key={app.id}
                className="flex flex-wrap items-center gap-3 rounded-2xl border border-black/5 bg-white p-4"
              >
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-neutral-100 text-neutral-400">
                  <UserCheck className="h-5 w-5" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-ink">
                    {app.full_name || "Unnamed user"}
                  </p>
                  <p className="truncate text-xs text-neutral-500">{app.email}</p>
                </div>
                <div className="flex gap-2">
                  <Button
                    className="min-h-9 px-3 text-sm"
                    disabled={busy}
                    onClick={() => act(app.id, () => approve(app.id))}
                  >
                    <Check className="h-4 w-4" aria-hidden="true" />
                    Approve
                  </Button>
                  <Button
                    variant="ghost"
                    className="min-h-9 px-3 text-sm text-red-600 hover:bg-red-50"
                    disabled={busy}
                    onClick={() => {
                      if (window.confirm("Reject this owner application?")) {
                        act(app.id, () => reject(app.id));
                      }
                    }}
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                    Reject
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
