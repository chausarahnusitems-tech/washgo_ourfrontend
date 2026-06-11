"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { formatVnd, getVouchers } from "../lib/booking.js";
import { useApp } from "../lib/AppContext.jsx";
import { useIsDesktop } from "../lib/useIsDesktop.js";
import { TopBar } from "../components/layout/TopBar.jsx";
import { Button } from "../components/ui/Button.jsx";
import { Icon } from "../components/ui/Icon.jsx";
import { RewardsCard } from "../components/RewardsCard.jsx";
import { VoucherAccess } from "./shared/VoucherAccess.jsx";

// "Jun 2026" style join date from an ISO timestamp.
function formatJoined(iso) {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: "short",
      year: "numeric"
    });
  } catch {
    return "";
  }
}

// Avatar: real photo when available, otherwise a neutral user-icon placeholder
// (no mock face).
function Avatar({ src, alt, size }) {
  const dims = size === "lg" ? "h-24 w-24" : "h-16 w-16";
  if (src) {
    return <img src={src} alt={alt} className={`${dims} rounded-full object-cover`} />;
  }
  return (
    <div className={`${dims} grid place-items-center rounded-full bg-neutral-100 text-neutral-400`}>
      <Icon name="User" className={size === "lg" ? "h-10 w-10" : "h-7 w-7"} />
    </div>
  );
}

const fieldClass =
  "mt-1 min-h-11 w-full rounded-2xl border border-black/10 px-4 text-sm outline-none focus:border-wash-500";

// One read-only detail row.
function DetailRow({ label, value, t }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-black/5 py-2 text-sm last:border-0">
      <span className="text-neutral-500">{label}</span>
      <span className="truncate text-right font-semibold text-ink">{value || t("notSet")}</span>
    </div>
  );
}

// Settings card: a collapsible profile editor. The editor stays hidden behind
// an Edit button and collapses back to a read-only summary after saving, so the
// page keeps its original uncluttered layout.
function SettingsCard() {
  const { t, auth, updateProfile, uploadAvatar } = useApp();
  const fileRef = useRef(null);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [carModel, setCarModel] = useState("");
  const [status, setStatus] = useState(null); // null | "uploading" | "saving" | error string

  const profile = auth.profile;
  const email = auth.user?.email ?? "";
  const avatarUrl = profile?.avatar_url || null;

  // Sync fields from the loaded profile (and whenever we (re)open the editor).
  useEffect(() => {
    setName(profile?.full_name ?? "");
    setPhone(profile?.phone ?? "");
    setCarModel(profile?.car_model ?? "");
  }, [profile?.full_name, profile?.phone, profile?.car_model, editing]);

  async function onPickFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setStatus("uploading");
    const { error } = await uploadAvatar(file);
    setStatus(error || null);
    event.target.value = "";
  }

  async function onSave() {
    setStatus("saving");
    const { error } = await updateProfile({
      full_name: name.trim(),
      phone: phone.trim(),
      car_model: carModel.trim()
    });
    if (error) return setStatus(error);
    setStatus(null);
    setEditing(false);
  }

  return (
    <section className="rounded-2xl border border-black/10 bg-white p-5">
      <h2 className="font-display text-lg font-black">{t("settings")}</h2>

      {/* Profile details */}
      <div className="mt-4 flex items-center justify-between">
        <h3 className="font-display text-base font-black">{t("profileDetails")}</h3>
        {!editing && (
          <Button variant="secondary" className="min-h-9 px-4 text-sm" onClick={() => setEditing(true)}>
            {t("edit")}
          </Button>
        )}
      </div>

      {editing ? (
        <div className="mt-4">
          <div className="flex items-center gap-4">
            <Avatar src={avatarUrl} alt={name || email} size="lg" />
            <div>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPickFile} />
              <Button
                variant="secondary"
                className="min-h-9 px-4 text-sm"
                onClick={() => fileRef.current?.click()}
                disabled={status === "uploading"}
              >
                {status === "uploading" ? "…" : t("changePhoto")}
              </Button>
            </div>
          </div>

          <label className="mt-4 block text-sm text-neutral-600">{t("name")}</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("name")} className={fieldClass} />

          <label className="mt-3 block text-sm text-neutral-600">{t("phone")}</label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={t("phone")} className={fieldClass} />

          <label className="mt-3 block text-sm text-neutral-600">{t("carModel")}</label>
          <input value={carModel} onChange={(e) => setCarModel(e.target.value)} placeholder={t("carModel")} className={fieldClass} />

          <label className="mt-3 block text-sm text-neutral-600">{t("email")}</label>
          <input
            value={email}
            disabled
            className="mt-1 min-h-11 w-full rounded-2xl border border-black/10 bg-neutral-50 px-4 text-sm text-neutral-500"
          />

          <div className="mt-4 flex items-center gap-3">
            <Button onClick={onSave} disabled={status === "saving"} className="min-h-9 px-5 text-sm">
              {t("saveProfile")}
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setEditing(false);
                setStatus(null);
              }}
              className="min-h-9 px-4 text-sm"
            >
              {t("cancel")}
            </Button>
            {status && !["uploading", "saving"].includes(status) && (
              <span className="text-sm text-red-600">{status}</span>
            )}
          </div>
        </div>
      ) : (
        <div className="mt-3">
          <DetailRow label={t("name")} value={profile?.full_name} t={t} />
          <DetailRow label={t("email")} value={email} t={t} />
          <DetailRow label={t("phone")} value={profile?.phone} t={t} />
          <DetailRow label={t("carModel")} value={profile?.car_model} t={t} />
        </div>
      )}
    </section>
  );
}

export function AccountScreen() {
  const isDesktop = useIsDesktop();
  const router = useRouter();

  const { t, state, auth, signOut, setLang, resetDemo, redeemVoucher } = useApp();

  const isSignedIn = Boolean(auth?.user);
  // Real identity only — no mock profile. Signed-out shows a neutral "Guest"
  // with no avatar/member date.
  const displayName = isSignedIn
    ? auth.profile?.full_name || auth.user.email
    : t("guest");
  const avatarUrl = isSignedIn ? auth.profile?.avatar_url || null : null;
  const memberSince =
    isSignedIn && auth.profile?.created_at
      ? `${t("memberSince")} ${formatJoined(auth.profile.created_at)}`
      : null;

  const props = {
    state,
    t,
    isSignedIn,
    displayName,
    avatarUrl,
    memberSince,
    onLang: setLang,
    onHome: () => router.push("/"),
    onPlans: () => router.push("/plans"),
    onVouchers: () => router.push("/vouchers"),
    onReset: resetDemo,
    onAuth: isSignedIn ? signOut : () => router.push("/login"),
    onRewards: () => router.push("/rewards"),
    onTopUp: () => router.push("/topup"),
    // Mark the free wash to be applied, then send the user to pick a shop.
    onUseVoucher: () => {
      redeemVoucher();
      router.push("/explore");
    }
  };

  // Avoid flashing the mobile layout (full-width red membership card) for a frame
  // on desktop before the breakpoint resolves.
  if (isDesktop === null) return null;
  return isDesktop ? <AccountDesktop {...props} /> : <AccountMobile {...props} />;
}

// Placeholder shown in place of tokens/membership/rewards when signed out —
// that data only exists for a signed-in account.
function SignedOutPrompt({ t, onAuth }) {
  return (
    <section className="grid place-items-center gap-3 rounded-2xl border border-black/10 bg-mist px-6 py-10 text-center">
      <span className="grid h-12 w-12 place-items-center rounded-full bg-white text-neutral-400">
        <Icon name="User" className="h-6 w-6" />
      </span>
      <p className="max-w-xs text-sm text-neutral-600">{t("signedOutBlurb")}</p>
      <Button onClick={onAuth} className="px-6">{t("signIn")}</Button>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Mobile (original)                                                   */
/* ------------------------------------------------------------------ */

function AccountMobile({ state, t, isSignedIn, displayName, avatarUrl, memberSince, onLang, onHome, onPlans, onVouchers, onReset, onAuth, onRewards, onTopUp, onUseVoucher }) {
  return (
    <section className="grid h-full content-start gap-4 overflow-y-auto bg-white px-4 py-7">
      <TopBar compact title={t("account")} t={t} lang={state.lang} onLang={onLang} onHome={onHome} />
      <div className="flex items-center gap-3">
        <Avatar src={avatarUrl} alt={displayName} />
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-2xl font-black">{displayName}</h1>
          {memberSince ? <p className="mt-1 text-sm text-neutral-600">{memberSince}</p> : null}
        </div>
        <Button variant="secondary" onClick={onAuth} className="min-h-9 px-4 text-sm">
          {isSignedIn ? t("signOut") : t("signIn")}
        </Button>
      </div>
      {isSignedIn ? (
        <>
          <section className="rounded-[18px] bg-[radial-gradient(circle_at_88%_22%,rgba(255,255,255,0.35),transparent_22%),linear-gradient(135deg,#c40000,#ff1208_68%,#ff7568)] p-6 text-white">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-2xl font-black">{state.selectedPlan === "premium" ? t("premium") : t("basic")} {t("member")}</h2>
                <p className="mt-3 text-sm text-white/90">
                  {t("memberUntil")}
                  <br />
                  <strong>{t("dateUntil")}</strong>
                </p>
              </div>
              <Button onClick={onPlans} variant="onColor" className="min-h-9 px-4 text-sm">
                {t("upgradePlan")}
              </Button>
            </div>
          </section>
          <section className="flex min-h-[94px] items-center justify-between gap-4 rounded-xl border border-black/20 bg-white px-6 py-5">
            <div>
              <span className="flex items-center gap-1.5 text-neutral-600">
                <Icon name="Wallet" className="h-4 w-4" />
                {t("myWallet")}
              </span>
              <strong className="block text-2xl">{formatVnd(state.funds)}</strong>
            </div>
            <Button onClick={onTopUp} className="min-h-9 px-4 text-sm">
              <Icon name="Plus" className="h-4 w-4" />
              {t("topUp")}
            </Button>
          </section>
          <VoucherAccess count={getVouchers(state.voucher, t).length} t={t} onClick={onVouchers} />
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-black">{t("rewardsTitle")}</h2>
            <button type="button" onClick={onRewards} className="bg-transparent p-0 text-sm font-black text-wash-500">
              {t("viewRewards")}
            </button>
          </div>
          <RewardsCard stamps={state.stamps} voucher={state.voucher} t={t} onUse={onUseVoucher} />
          <SettingsCard />
          <Button variant="secondary" onClick={onReset}>{t("resetDemo")}</Button>
        </>
      ) : (
        <SignedOutPrompt t={t} onAuth={onAuth} />
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Desktop two-column (image 4)                                        */
/* ------------------------------------------------------------------ */
function RewardTile({ title, expires, tone, t }) {
  const toneClasses =
    tone === "green"
      ? "bg-[radial-gradient(circle_at_86%_20%,rgba(255,255,255,0.4),transparent_24%),linear-gradient(135deg,#7f9b1e,#a7c400_70%,#c9e84a)]"
      : "bg-[radial-gradient(circle_at_88%_22%,rgba(255,255,255,0.35),transparent_24%),linear-gradient(135deg,#c40000,#ff1208_68%,#ff7568)]";

  return (
    <article className={`relative flex h-40 flex-col justify-between overflow-hidden rounded-[18px] p-5 text-white ${toneClasses}`}>
      <h3 className="font-display text-2xl font-black">{title}</h3>
      <p className="text-sm text-white/90">
        {t("expires")}
        <br />
        <strong>{t("dateUntil")}</strong>
      </p>
    </article>
  );
}

function AccountDesktop({ state, t, isSignedIn, displayName, avatarUrl, memberSince, onPlans, onRewards, onReset, onAuth, onTopUp, onUseVoucher }) {
  return (
    <section className="h-full overflow-y-auto bg-mist">
      <div className="mx-auto grid w-full max-w-[1200px] grid-cols-[340px_1fr] gap-6 px-6 py-8 xl:px-10">
        {/* Left: profile */}
        <aside className="flex flex-col gap-4">
          <div className="flex flex-col items-center rounded-2xl border border-black/10 bg-white p-6 text-center">
            <Avatar src={avatarUrl} alt={displayName} size="lg" />
            <h1 className="mt-4 font-display text-xl font-black">{displayName}</h1>
            {memberSince ? <p className="mt-1 text-sm text-neutral-500">{memberSince}</p> : null}

            {isSignedIn ? (
              <div className="mt-5 flex w-full items-center justify-between gap-3 rounded-2xl bg-wash-50 p-4">
                <div className="text-left">
                  <span className="flex items-center gap-1.5 text-sm text-neutral-600">
                    <Icon name="Wallet" className="h-4 w-4" />
                    {t("myWallet")}
                  </span>
                  <strong className="block text-2xl font-black">{formatVnd(state.funds)}</strong>
                </div>
                <Button onClick={onTopUp} className="min-h-9 px-4 text-sm">
                  <Icon name="Plus" className="h-4 w-4" />
                  {t("topUp")}
                </Button>
              </div>
            ) : null}
          </div>
          <Button variant="secondary" onClick={onAuth}>
            {isSignedIn ? t("signOut") : t("signIn")}
          </Button>
          {isSignedIn ? (
            <Button variant="secondary" onClick={onReset}>{t("resetDemo")}</Button>
          ) : null}
        </aside>

        {/* Right: membership + rewards */}
        <div className="flex flex-col gap-6">
          {isSignedIn ? (
            <>
              <section className="relative min-h-[150px] overflow-hidden rounded-[20px] bg-[radial-gradient(circle_at_88%_20%,rgba(255,255,255,0.3),transparent_30%),linear-gradient(135deg,#9c0000,#c40000_60%,#ff5a4a)] p-7 text-white">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-display text-2xl font-black">{t("proMember")}</h2>
                    <p className="mt-3 text-sm text-white/90">
                      {t("renewOn")}
                      <br />
                      <strong>{t("dateUntil")}</strong>
                    </p>
                    <p className="mt-3 text-sm text-white/90">{t("unlimitedWashes")}</p>
                  </div>
                  <Button onClick={onPlans} variant="onColor" className="min-h-9 px-4 text-sm">
                    {t("upgradePlan")}
                  </Button>
                </div>
              </section>

              <RewardsCard stamps={state.stamps} voucher={state.voucher} t={t} onUse={onUseVoucher} />

              <section>
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-lg font-black">{t("rewards")}</h2>
                  <button type="button" onClick={onRewards} className="bg-transparent p-0 text-sm font-black text-wash-500">
                    {t("viewRewards")}
                  </button>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-5">
                  <RewardTile title={t("freeCharging")} tone="green" t={t} />
                  <RewardTile title={t("discountDetailing")} tone="red" t={t} />
                </div>
              </section>

              <SettingsCard />
            </>
          ) : (
            <SignedOutPrompt t={t} onAuth={onAuth} />
          )}
        </div>
      </div>
    </section>
  );
}
