"use client";

import Link from "next/link";
import { Icon } from "../ui/Icon.jsx";
import { IconButton } from "../ui/Button.jsx";
import { icons } from "../../assets.js";
import { useApp } from "../../lib/AppContext.jsx";

export function TopBar({ compact = false, title, subtitle, onBack, hideLogo = false }) {
  const { t, auth, state } = useApp();
  // Only show the membership chip for an ACTUAL premium member, with their real
  // renewal date — not a hardcoded one for everyone (#9).
  const membershipUntil = auth?.profile?.membership_until ?? null;
  const isMember = state?.selectedPlan === "premium";

  return (
    <header className="mb-4 flex min-h-12 items-start justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        {onBack ? (
          <IconButton label={t("back")} onClick={onBack}>
            <Icon name="ArrowLeft" className="h-5 w-5" />
          </IconButton>
        ) : hideLogo ? null : (
          <Link
            href="/"
            aria-label={t("homeAria")}
            className="inline-flex min-h-11 shrink-0 items-center border-0 bg-transparent p-0"
          >
            <img src={icons.washgoLogo} alt="Washgo" className="h-[31px] w-[79px] object-contain" />
          </Link>
        )}

        {title ? (
          <div className="min-w-0">
            <h1 className="m-0 font-display text-[1.42rem] font-black leading-none text-ink">{title}</h1>
            {subtitle ? <p className="mt-1 truncate text-xs text-neutral-500">{subtitle}</p> : null}
          </div>
        ) : null}
      </div>

      {!compact && isMember ? (
        <div className="flex shrink-0 items-center gap-2">
          <div className="text-right text-[0.68rem] leading-tight">
            <span className="block text-neutral-500">{t("memberUntil")}</span>
            <strong className="block text-ink">{membershipUntil || t("active")}</strong>
          </div>
        </div>
      ) : null}
    </header>
  );
}
