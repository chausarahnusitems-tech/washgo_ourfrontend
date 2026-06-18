"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, Calendar, Check, MapPin, MessageCircle, Phone, Store, UserCheck, X } from "lucide-react";
import { useAdminApplications } from "../../lib/admin/useAdminApplications.js";
import { Button } from "../../components/ui/Button.jsx";
import { cx } from "../../lib/cx.js";

// Unified admin review: shop verification requests AND owner applications in one
// queue. Both require a physical visit to confirm the business before accepting.
// "Message" opens a chat with the applicant to arrange the visit; accepting a
// shop request creates/converts the (unpublished) shop + grants the owner role,
// accepting an owner application grants the owner role.
export function AdminClaimsScreen() {
  const router = useRouter();
  const { items, loading, approve, reject, message } = useAdminApplications();
  const [busyId, setBusyId] = useState(null);

  async function act(item, fn) {
    setBusyId(item.key);
    try {
      await fn();
    } catch (err) {
      console.error("[washgo] application decision failed", err);
      window.alert(err?.message || "Something went wrong. Please try again.");
    } finally {
      setBusyId(null);
    }
  }

  async function onMessage(item) {
    setBusyId(item.key);
    try {
      const convId = await message(item.userId);
      router.push(`/admin/messages?c=${convId}`);
    } catch (err) {
      console.error("[washgo] open chat failed", err);
      window.alert(err?.message || "Could not open chat.");
      setBusyId(null);
    }
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-5 py-8 lg:px-10">
      <header>
        <h1 className="font-display text-2xl font-black">Applications</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Shop verification requests and owner applications. Message the applicant to arrange a
          physical visit, confirm the business is real, then accept.
        </p>
      </header>

      {loading ? (
        <p className="mt-8 text-sm text-neutral-500">Loading…</p>
      ) : items.length === 0 ? (
        <div className="mt-8 grid place-items-center rounded-2xl border border-dashed border-black/15 bg-white px-6 py-14 text-center">
          <BadgeCheck className="h-8 w-8 text-neutral-300" aria-hidden="true" />
          <p className="mt-3 text-sm font-semibold text-ink">No pending applications</p>
        </div>
      ) : (
        <ul className="mt-6 grid gap-3">
          {items.map((item) => {
            const busy = busyId === item.key;
            const isOwner = item.type === "owner";
            const title = isOwner ? "Owner application" : item.shopName;
            const badge = isOwner ? "Owner" : item.isNewShop ? "New shop" : "Claim";
            return (
              <li key={item.key} className="rounded-2xl border border-black/10 bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="flex flex-wrap items-center gap-2 font-display text-lg font-black text-ink">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-neutral-100 text-neutral-400">
                        {isOwner ? (
                          <UserCheck className="h-4 w-4" aria-hidden="true" />
                        ) : (
                          <Store className="h-4 w-4" aria-hidden="true" />
                        )}
                      </span>
                      {title}
                      <span
                        className={cx(
                          "rounded-full px-2 py-0.5 text-[0.6rem] font-black uppercase tracking-wide",
                          isOwner
                            ? "bg-neutral-200 text-neutral-700"
                            : item.isNewShop
                              ? "bg-wash-100 text-wash-700"
                              : "bg-amber-100 text-amber-700"
                        )}
                      >
                        {badge}
                      </span>
                    </h2>
                    {item.shopAddress ? (
                      <p className="mt-1 flex items-start gap-1.5 text-xs text-neutral-500">
                        <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        {item.shopDistrict ? `${item.shopDistrict} · ` : ""}
                        {item.shopAddress}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="secondary"
                      className="min-h-9 px-3 text-sm"
                      disabled={busy}
                      onClick={() => onMessage(item)}
                    >
                      <MessageCircle className="h-4 w-4" aria-hidden="true" />
                      Message
                    </Button>
                    <Button
                      className="min-h-9 px-3 text-sm"
                      disabled={busy}
                      onClick={() => act(item, () => approve(item))}
                    >
                      <Check className="h-4 w-4" aria-hidden="true" />
                      {isOwner ? "Approve" : "Verify & accept"}
                    </Button>
                    <Button
                      variant="ghost"
                      className="min-h-9 px-3 text-sm text-red-600 hover:bg-red-50"
                      disabled={busy}
                      onClick={() => {
                        if (window.confirm("Reject this application?")) {
                          act(item, () => reject(item));
                        }
                      }}
                    >
                      <X className="h-4 w-4" aria-hidden="true" />
                      Reject
                    </Button>
                  </div>
                </div>

                <div className="mt-3 grid gap-1 border-t border-black/5 pt-3 text-sm">
                  <p className="text-xs text-neutral-500">
                    {isOwner ? "Applicant" : "Requested by"}{" "}
                    <strong className="text-ink">{item.person?.full_name || "Unnamed user"}</strong>{" "}
                    ({item.person?.email || "no email"})
                  </p>
                  {item.createdAt ? (
                    <p className="inline-flex items-center gap-1.5 text-xs text-neutral-500">
                      <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
                      Submitted{" "}
                      {new Date(item.createdAt).toLocaleDateString(undefined, {
                        year: "numeric",
                        month: "short",
                        day: "numeric"
                      })}
                    </p>
                  ) : null}
                  {item.phone ? (
                    <p className="inline-flex items-center gap-1.5 text-xs text-neutral-600">
                      <Phone className="h-3.5 w-3.5" aria-hidden="true" />
                      {item.phone}
                    </p>
                  ) : null}
                  {item.note ? (
                    <p className="mt-1 rounded-xl bg-neutral-50 px-3 py-2 text-xs text-neutral-600">
                      <span className="font-bold">Visit note:</span> {item.note}
                    </p>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
