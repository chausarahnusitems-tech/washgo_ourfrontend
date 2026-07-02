"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { formatVnd, getVouchers } from "../lib/booking.js";
import { useApp } from "../lib/AppContext.jsx";
import { exitCustomerPortal } from "../lib/adminPortal.js";
import { useIsDesktop } from "../lib/useIsDesktop.js";
import { TopBar } from "../components/layout/TopBar.jsx";
import { Button } from "../components/ui/Button.jsx";
import { Icon } from "../components/ui/Icon.jsx";
import { RewardsCard } from "../components/RewardsCard.jsx";
import { VoucherAccess } from "./shared/VoucherAccess.jsx";
import { BrandLogo } from "../components/vehicle/BrandLogo.jsx";
import { VehicleEditModal } from "../components/vehicle/VehicleEditModal.jsx";
import { brandFromModel } from "../data/carBrands.js";

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
  const {
    t,
    auth,
    state,
    lang,
    setLang,
    setVehicle,
    updateProfile,
    uploadAvatar,
    profileComplete,
    profileRewardClaimed,
    claimProfileReward
  } = useApp();
  const fileRef = useRef(null);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [carModel, setCarModel] = useState("");
  const [status, setStatus] = useState(null); // null | "uploading" | "saving" | error string
  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState(null);
  const [justClaimed, setJustClaimed] = useState(false);

  const profile = auth.profile;
  const email = auth.user?.email ?? "";
  const avatarUrl = profile?.avatar_url || null;
  const plate = state.vehicle?.plate ?? "";

  // Sync fields from the loaded profile (and whenever we (re)open the editor).
  useEffect(() => {
    setName(profile?.full_name ?? "");
    setPhone(profile?.phone ?? "");
    setCarModel(profile?.car_model ?? "");
  }, [profile?.full_name, profile?.phone, profile?.car_model, editing]);

  async function onClaimReward() {
    setClaiming(true);
    setClaimError(null);
    try {
      const granted = await claimProfileReward();
      if (granted) setJustClaimed(true);
      else setClaimError(t("profileRewardDone"));
    } catch {
      setClaimError(t("profileRewardDone"));
    }
    setClaiming(false);
  }

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

          <label className="mt-3 block text-sm text-neutral-600">{t("vehicleModel")}</label>
          <input value={carModel} onChange={(e) => setCarModel(e.target.value)} placeholder={t("carModel")} className={fieldClass} />

          <label className="mt-3 block text-sm text-neutral-600">{t("licensePlate")}</label>
          <input
            value={plate}
            onChange={(e) => setVehicle({ plate: e.target.value })}
            placeholder={t("licensePlate")}
            className={fieldClass}
          />

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
          <DetailRow label={t("vehicleModel")} value={profile?.car_model} t={t} />
          <DetailRow label={t("licensePlate")} value={plate} t={t} />
        </div>
      )}

      {/* Profile-completion incentive: claim a one-time free wash once the
          profile (name + phone + car model + plate) is filled in. */}
      {profileRewardClaimed || justClaimed ? (
        <div className="mt-4 flex items-center gap-2 rounded-2xl bg-wash-50 px-4 py-3 text-sm text-wash-600">
          <Icon name="Check" className="h-4 w-4 shrink-0" />
          <span>{t("profileRewardDone")}</span>
        </div>
      ) : (
        <div className="mt-4 rounded-2xl border border-wash-300 bg-wash-50 p-4">
          <div className="flex items-center gap-2">
            <Icon name="Sparkles" className="h-5 w-5 text-wash-500" />
            <h3 className="font-display text-base font-black text-ink">{t("completeProfile")}</h3>
          </div>
          <p className="mt-2 text-sm text-neutral-600">{t("completeProfilePitch")}</p>
          {profileComplete ? (
            <p className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-wash-600">
              <Icon name="Check" className="h-4 w-4" />
              {t("detailsComplete")}
            </p>
          ) : null}
          <Button
            className="mt-3"
            onClick={profileComplete ? onClaimReward : () => setEditing(true)}
            disabled={claiming}
          >
            <Icon name="Sparkles" className="h-4 w-4" />
            {claiming ? "…" : t("claimFreeWash")}
          </Button>
          {!profileComplete ? (
            <p className="mt-2 text-xs text-neutral-500">{t("completeDetailsToClaim")}</p>
          ) : null}
          {claimError ? <p className="mt-2 text-sm text-neutral-500">{claimError}</p> : null}
        </div>
      )}

      {/* Language preference (moved here from the nav). */}
      <div className="mt-4 flex items-center justify-between gap-4">
        <span className="flex items-center gap-2 text-sm font-semibold text-neutral-600">
          <Icon name="Languages" className="h-4 w-4" />
          {t("language")}
        </span>
        <div className="inline-flex h-9 rounded-full bg-neutral-100 p-1" role="group" aria-label={t("language")}>
          {["en", "vi"].map((code) => (
            <button
              key={code}
              type="button"
              onClick={() => setLang(code)}
              className={`min-w-8 rounded-full px-2 text-[0.68rem] font-black ${
                lang === code ? "bg-ink text-white" : "text-neutral-500"
              }`}
            >
              {code.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

// "My Vehicle" card with the brand logo, model and plate, plus an Edit button
// that opens the pop-up vehicle editor. The brand is derived from the stored
// model when it wasn't saved explicitly (legacy data).
function VehicleCard() {
  const { t, state } = useApp();
  const [open, setOpen] = useState(false);
  const vehicle = state.vehicle ?? {};
  const brand = vehicle.brand || brandFromModel(vehicle.model);

  return (
    <section className="rounded-2xl border border-black/10 bg-white p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-black">{t("myVehicle")}</h2>
        <Button variant="secondary" className="min-h-9 px-4 text-sm" onClick={() => setOpen(true)}>
          {t("edit")}
        </Button>
      </div>
      <div className="mt-4 flex items-center gap-4">
        {vehicle.photoUrl ? (
          <img
            src={vehicle.photoUrl}
            alt={vehicle.model || t("myVehicle")}
            className="h-[72px] w-[72px] shrink-0 rounded-2xl object-cover ring-1 ring-black/10"
          />
        ) : (
          <BrandLogo brand={brand} size={72} />
        )}
        <div className="min-w-0">
          <strong className="block truncate font-display text-lg font-black">
            {vehicle.model || t("notSet")}
          </strong>
          <span className="block truncate text-sm text-neutral-500">
            {t("licensePlateLabel")}: {vehicle.plate || t("notSet")}
          </span>
        </div>
      </div>
      <VehicleEditModal open={open} onClose={() => setOpen(false)} />
    </section>
  );
}

// Owner tools: lets a customer apply to run a car wash, shows their application
// status, and — once approved — links into the owner-only dashboard (the
// "owner mode" the user opts into; they're otherwise a normal customer).
function OwnerToolsCard() {
  const { t, auth, mode, applyForOwner } = useApp();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  // Owner concepts only exist in backend mode for a signed-in user.
  if (mode !== "backend" || !auth.user) return null;

  const role = auth.profile?.role;
  const ownerStatus = auth.profile?.owner_status ?? "none";
  const isOwner = role === "owner";

  // Admins don't apply to be owners — they get the admin-console card instead.
  if (role === "admin") return null;

  async function apply() {
    setBusy(true);
    const { error } = await applyForOwner();
    setBusy(false);
    if (error) window.alert(error);
  }

  return (
    <section className="rounded-2xl border border-black/10 bg-white p-5">
      <div className="flex items-center gap-2">
        <Icon name="Sparkles" className="h-5 w-5 text-wash-500" />
        <h2 className="font-display text-lg font-black">{t("ownerTools")}</h2>
      </div>

      {isOwner ? (
        <div className="mt-3">
          <p className="text-sm text-neutral-600">{t("ownerApproved")}</p>
          <Button className="mt-3" onClick={() => exitCustomerPortal(router, "/owner")}>
            <Icon name="Sparkles" className="h-4 w-4" />
            {t("openOwnerDashboard")}
          </Button>
        </div>
      ) : ownerStatus === "pending" ? (
        <div className="mt-3 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {t("ownerPending")}
        </div>
      ) : (
        <div className="mt-3">
          <p className="text-sm text-neutral-600">
            {ownerStatus === "rejected" ? t("ownerRejected") : t("ownerPitch")}
          </p>
          <Button variant="secondary" className="mt-3" onClick={apply} disabled={busy}>
            {busy ? "…" : ownerStatus === "rejected" ? t("ownerApplyAgain") : t("ownerApply")}
          </Button>
        </div>
      )}
    </section>
  );
}

// Admin console entry point shown on an admin's customer-portal account page, so
// they can hop back to /admin (the customer portal is opt-in for admins).
function AdminToolsCard() {
  const { auth, mode } = useApp();
  const router = useRouter();
  if (mode !== "backend" || auth.profile?.role !== "admin") return null;
  return (
    <section className="rounded-2xl border border-black/10 bg-white p-5">
      <div className="flex items-center gap-2">
        <Icon name="ShieldCheck" className="h-5 w-5 text-wash-500" />
        <h2 className="font-display text-lg font-black">Admin</h2>
      </div>
      <p className="mt-3 text-sm text-neutral-600">You’re in the customer portal.</p>
      <Button className="mt-3" onClick={() => exitCustomerPortal(router)}>
        <Icon name="ShieldCheck" className="h-4 w-4" />
        Back to admin console
      </Button>
    </section>
  );
}

export function AccountScreen() {
  const isDesktop = useIsDesktop();
  const router = useRouter();

  const { t, state, auth, mode, requireAuth, signOut, setLang, redeemVoucher } = useApp();

  const isSignedIn = Boolean(auth?.user);
  // The wallet ledger only exists for a signed-in backend account, so the
  // "View transactions" link is hidden in demo mode (and while signed out).
  const showTransactions = !requireAuth && mode === "backend";
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

  // Real membership state (#9) — premium tier only counts while membership_until
  // hasn't lapsed (AppContext already gates selectedPlan on that for backend).
  const isMember = state.selectedPlan === "premium";
  const membershipUntil = auth?.profile?.membership_until ?? null;

  const props = {
    state,
    t,
    isSignedIn,
    isMember,
    membershipUntil,
    showTransactions,
    displayName,
    avatarUrl,
    memberSince,
    onLang: setLang,
    onHome: () => router.push("/"),
    onPlans: () => router.push("/plans"),
    onVouchers: () => router.push("/vouchers"),
    onAuth: isSignedIn ? signOut : () => router.push("/login"),
    onRewards: () => router.push("/rewards"),
    onTopUp: () => router.push("/topup"),
    onTransactions: () => router.push("/transactions"),
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

function AccountMobile({ state, t, isSignedIn, isMember, membershipUntil, showTransactions, displayName, avatarUrl, memberSince, onLang, onHome, onPlans, onVouchers, onAuth, onRewards, onTopUp, onTransactions, onUseVoucher }) {
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
                {isMember ? (
                  <>
                    <h2 className="font-display text-2xl font-black">{t("premium")} {t("member")}</h2>
                    <p className="mt-3 text-sm text-white/90">
                      {t("memberUntil")}
                      <br />
                      <strong>{membershipUntil || t("active")}</strong>
                    </p>
                  </>
                ) : (
                  <>
                    <h2 className="font-display text-2xl font-black">{t("washgoMembership")}</h2>
                    <p className="mt-3 text-sm text-white/90">{t("membershipPitch")}</p>
                  </>
                )}
              </div>
              <Button onClick={onPlans} variant="onColor" className="min-h-9 px-4 text-sm">
                {isMember ? t("renewMembership") : t("joinMembership")}
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
            <Button onClick={onTopUp} className="min-h-9 shrink-0 whitespace-nowrap px-4 text-sm">
              <Icon name="Plus" className="h-4 w-4" />
              {t("topUp")}
            </Button>
          </section>
          {showTransactions ? (
            <button
              type="button"
              onClick={onTransactions}
              className="flex items-center justify-between gap-3 rounded-xl border border-black/20 bg-white px-6 py-4 text-left"
            >
              <span className="flex items-center gap-1.5 font-semibold text-neutral-600">
                <Icon name="WalletCards" className="h-4 w-4" />
                {t("viewTransactions")}
              </span>
              <Icon name="ChevronRight" className="h-5 w-5 text-neutral-400" />
            </button>
          ) : null}
          <VoucherAccess count={getVouchers(state.voucher, t).length} t={t} onClick={onVouchers} />
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-black">{t("rewardsTitle")}</h2>
            <button type="button" onClick={onRewards} className="bg-transparent p-0 text-sm font-black text-wash-500">
              {t("viewRewards")}
            </button>
          </div>
          <RewardsCard stamps={state.stamps} voucher={state.voucher} t={t} onUse={onUseVoucher} />
          <VehicleCard />
          <SettingsCard />
          <OwnerToolsCard />
          <AdminToolsCard />
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

function AccountDesktop({ state, t, isSignedIn, isMember, membershipUntil, showTransactions, displayName, avatarUrl, memberSince, onPlans, onRewards, onVouchers, onAuth, onTopUp, onTransactions, onUseVoucher }) {
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
                <Button onClick={onTopUp} className="min-h-9 shrink-0 whitespace-nowrap px-4 text-sm">
                  <Icon name="Plus" className="h-4 w-4" />
                  {t("topUp")}
                </Button>
              </div>
            ) : null}

            {isSignedIn && showTransactions ? (
              <button
                type="button"
                onClick={onTransactions}
                className="mt-3 flex w-full items-center justify-between gap-3 rounded-2xl border border-black/10 px-4 py-3 text-left"
              >
                <span className="flex items-center gap-1.5 text-sm font-semibold text-neutral-600">
                  <Icon name="WalletCards" className="h-4 w-4" />
                  {t("viewTransactions")}
                </span>
                <Icon name="ChevronRight" className="h-5 w-5 text-neutral-400" />
              </button>
            ) : null}
          </div>
          <Button variant="secondary" onClick={onAuth}>
            {isSignedIn ? t("signOut") : t("signIn")}
          </Button>
        </aside>

        {/* Right: membership + rewards */}
        <div className="flex flex-col gap-6">
          {isSignedIn ? (
            <>
              <section className="relative min-h-[150px] overflow-hidden rounded-[20px] bg-[radial-gradient(circle_at_88%_20%,rgba(255,255,255,0.3),transparent_30%),linear-gradient(135deg,#9c0000,#c40000_60%,#ff5a4a)] p-7 text-white">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    {isMember ? (
                      <>
                        <h2 className="font-display text-2xl font-black">{t("proMember")}</h2>
                        <p className="mt-3 text-sm text-white/90">
                          {t("memberActiveUntil")}
                          <br />
                          <strong>{membershipUntil || t("active")}</strong>
                        </p>
                        <p className="mt-3 text-sm text-white/90">{t("unlimitedWashes")}</p>
                      </>
                    ) : (
                      <>
                        <h2 className="font-display text-2xl font-black">{t("washgoMembership")}</h2>
                        <p className="mt-3 text-sm text-white/90">{t("membershipPitch")}</p>
                      </>
                    )}
                  </div>
                  <Button onClick={onPlans} variant="onColor" className="min-h-9 px-4 text-sm">
                    {isMember ? t("renewMembership") : t("joinMembership")}
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
                <VoucherAccess count={getVouchers(state.voucher, t).length} t={t} onClick={onVouchers} />
              </section>

              <VehicleCard />
              <SettingsCard />
              <OwnerToolsCard />
              <AdminToolsCard />
            </>
          ) : (
            <SignedOutPrompt t={t} onAuth={onAuth} />
          )}
        </div>
      </div>
    </section>
  );
}
