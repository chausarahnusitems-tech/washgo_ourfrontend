"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Gift, Percent, Ticket } from "lucide-react";
import { useApp } from "../lib/AppContext.jsx";
import { createClient } from "../lib/supabase/client.js";
import { formatVnd } from "../lib/booking.js";
import { useBackOr } from "../lib/useBackOr.js";
import { Button, IconButton } from "../components/ui/Button.jsx";
import { Icon } from "../components/ui/Icon.jsx";

const MEMBERSHIP_FEE = 199000;

const PERKS = [
  { icon: Percent, title: "10% off every wash", copy: "An automatic discount on all your bookings." },
  { icon: Gift, title: "Seasonal discounts", copy: "Members-only seasonal deals throughout the year." },
  { icon: Ticket, title: "Exclusive coupons", copy: "Redeemable coupons you won't find anywhere else." }
];

export function PlansScreen() {
  const router = useRouter();
  const { t, state, auth, mode, setLang: onLang } = useApp();
  const onBack = useBackOr("/account");
  const supabase = useMemo(() => createClient(), []);

  // Member if there's a renewal date (backend) or the premium tier is active
  // (demo, which has no DB membership_until).
  const memberUntil = auth.profile?.membership_until ?? null;
  const isMember = Boolean(memberUntil) || (mode === "demo" && state.selectedPlan === "premium");

  const [coupons, setCoupons] = useState([]);
  useEffect(() => {
    if (!supabase) return undefined;
    let active = true;
    supabase
      .from("coupons")
      .select("*")
      .then(({ data }) => active && setCoupons(data ?? []))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [supabase]);

  // Join routes through the placeholder payment page, which charges the wallet
  // and calls start_membership on success.
  const onJoin = () =>
    router.push(`/payment?purpose=membership&amount=${MEMBERSHIP_FEE}&next=${encodeURIComponent("/plans")}`);

  return (
    <div className="grid h-full min-h-0 grid-rows-[1fr_auto] bg-white lg:bg-mist">
      <section className="min-h-0 min-w-0 overflow-y-auto overflow-x-hidden px-4 pb-4 pt-7">
        <div className="mx-auto w-full max-w-xl">
          <div className="mb-7 grid min-w-0 grid-cols-[auto_1fr_auto] items-center gap-3">
            <IconButton label={t("back")} onClick={onBack}>
              <Icon name="ArrowLeft" className="h-5 w-5" />
            </IconButton>
            <div className="min-w-0">
              <h1 className="m-0 font-display text-[1.35rem] font-black leading-none text-ink">
                {t("membershipTitle")}
              </h1>
              <p className="mt-1 truncate text-xs text-neutral-500">{t("membershipSubtitle")}</p>
            </div>
            <div className="inline-flex h-9 shrink-0 rounded-full bg-neutral-100 p-1" role="group" aria-label={t("language")}>
              {["en", "vi"].map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => onLang(code)}
                  className={`min-w-8 rounded-full px-2 text-[0.68rem] font-black ${
                    state.lang === code ? "bg-ink text-white" : "text-neutral-500"
                  }`}
                >
                  {code.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Membership hero */}
          <section className="overflow-hidden rounded-[22px] bg-[radial-gradient(circle_at_85%_15%,rgba(255,255,255,0.3),transparent_30%),linear-gradient(135deg,#9c0000,#c40000_60%,#ff5a4a)] p-6 text-white">
            <h2 className="font-display text-2xl font-black">{t("washgoMembership")}</h2>
            {isMember ? (
              <p className="mt-2 text-sm text-white/90">
                {t("memberActiveUntil")} <strong>{memberUntil || t("active")}</strong>
              </p>
            ) : (
              <p className="mt-2 text-sm text-white/90">{t("membershipPitch")}</p>
            )}
            <p className="mt-4 font-display text-3xl font-black">
              {formatVnd(MEMBERSHIP_FEE)}
              <span className="text-base font-bold text-white/80"> / {t("month")}</span>
            </p>
          </section>

          {/* Perks */}
          <ul className="mt-5 grid gap-3">
            {PERKS.map((perk) => (
              <li key={perk.title} className="flex items-start gap-3 rounded-2xl border border-black/5 bg-white p-4">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-wash-50 text-wash-500">
                  <perk.icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <strong className="block text-sm font-black text-ink">{perk.title}</strong>
                  <span className="text-sm text-neutral-500">{perk.copy}</span>
                </div>
              </li>
            ))}
          </ul>

          {/* Coupons (members) */}
          {isMember && coupons.length > 0 && (
            <section className="mt-6">
              <h3 className="mb-2 text-sm font-black uppercase tracking-wide text-neutral-500">
                {t("yourCoupons")}
              </h3>
              <ul className="grid gap-2">
                {coupons.map((c) => (
                  <li key={c.code} className="flex items-center gap-3 rounded-2xl border border-dashed border-wash-300 bg-wash-50 p-3">
                    <Ticket className="h-5 w-5 text-wash-500" aria-hidden="true" />
                    <div className="min-w-0 flex-1">
                      <strong className="block text-sm text-ink">{c.code}</strong>
                      <span className="text-xs text-neutral-500">{c.description}</span>
                    </div>
                    <span className="text-sm font-black text-wash-600">{c.percent}%</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </section>

      <footer className="border-t border-black/20 bg-white p-4">
        <div className="mx-auto w-full max-w-xl">
          {isMember ? (
            <Button onClick={onJoin} variant="secondary" className="w-full rounded-2xl">
              <Check className="h-5 w-5" />
              {t("renewMembership")}
            </Button>
          ) : (
            <Button onClick={onJoin} className="w-full rounded-2xl" disabled={mode === "backend" && !auth.user}>
              {mode === "backend" && !auth.user ? t("signInToJoin") : t("joinMembership")}
            </Button>
          )}
        </div>
      </footer>
    </div>
  );
}
