"use client";

import { useState } from "react";
import { useApp } from "../../lib/AppContext.jsx";
import { cx } from "../../lib/cx.js";
import { Button } from "../ui/Button.jsx";
import { PROBLEM_TAGS } from "./problemTags.js";

// Shown when a user starts a support chat: pick zero or more problem tags so the
// admin inbox can triage. Tags are optional — "Start" works with none selected.
export function SupportTagPicker({ onStart, onCancel, busy = false }) {
  const { t } = useApp();
  const [selected, setSelected] = useState([]);

  const toggle = (slug) =>
    setSelected((s) => (s.includes(slug) ? s.filter((x) => x !== slug) : [...s, slug]));

  return (
    <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
      <h3 className="font-display text-lg font-black">{t("chooseProblemTags")}</h3>
      <div className="mt-4 flex flex-wrap gap-2">
        {PROBLEM_TAGS.map((tag) => {
          const active = selected.includes(tag.slug);
          return (
            <button
              key={tag.slug}
              type="button"
              onClick={() => toggle(tag.slug)}
              aria-pressed={active}
              className={cx(
                "rounded-full px-3 py-1.5 text-sm font-semibold transition",
                active ? "bg-wash-500 text-white" : "bg-neutral-100 text-ink hover:bg-neutral-200"
              )}
            >
              {t(tag.key)}
            </button>
          );
        })}
      </div>
      <div className="mt-5 grid gap-2">
        <Button onClick={() => onStart(selected)} disabled={busy} className="w-full">
          {busy ? t("uploading") : t("startSupport")}
        </Button>
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="text-sm font-semibold text-neutral-500"
        >
          {t("discardChanges")}
        </button>
      </div>
    </div>
  );
}
