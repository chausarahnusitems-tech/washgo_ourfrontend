"use client";

import { useEffect, useState } from "react";
import { useApp } from "../../lib/AppContext.jsx";
import { BRAND_NAMES, brandFromModel, modelsForBrand } from "../../data/carBrands.js";
import { Modal } from "../ui/Modal.jsx";
import { Button } from "../ui/Button.jsx";
import { Icon } from "../ui/Icon.jsx";
import { BrandLogo } from "./BrandLogo.jsx";
import { cx } from "../../lib/cx.js";

// Pop-up editor for the user's vehicle: pick a brand (which drives the logo),
// choose/type a series, and set the plate. Writes to `state.vehicle` (and the
// profile's car_model column in backend mode) on save.
export function VehicleEditModal({ open, onClose }) {
  const { t, state, mode, setVehicle, updateProfile } = useApp();
  const [brand, setBrand] = useState("");
  const [series, setSeries] = useState("");
  const [plate, setPlate] = useState("");
  const [brandOpen, setBrandOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Seed the fields from the current vehicle each time the modal opens, deriving
  // the brand from the stored model when it wasn't saved explicitly (legacy data).
  useEffect(() => {
    if (!open) return;
    const vehicle = state.vehicle ?? {};
    const model = vehicle.model ?? "";
    const derivedBrand = vehicle.brand || brandFromModel(model);
    const derivedSeries =
      derivedBrand && model.toLowerCase().startsWith(derivedBrand.toLowerCase())
        ? model.slice(derivedBrand.length).trim()
        : model;
    setBrand(derivedBrand);
    setSeries(derivedSeries);
    setPlate(vehicle.plate ?? "");
    setBrandOpen(false);
    setSaving(false);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const models = modelsForBrand(brand);
  const composedModel = [brand, series.trim()].filter(Boolean).join(" ");

  async function save() {
    setSaving(true);
    setVehicle({ brand, model: composedModel, plate: plate.trim() });
    if (mode === "backend") {
      try {
        await updateProfile({ car_model: composedModel });
      } catch {
        /* non-fatal: vehicle state is already updated + persisted */
      }
    }
    setSaving(false);
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} labelledBy="vehicle-modal-title">
      <div className="flex items-start justify-between gap-3">
        <h2 id="vehicle-modal-title" className="font-display text-xl font-black">
          {t("editVehicle")}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label={t("close")}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-neutral-100 text-neutral-500 transition hover:text-ink"
        >
          <Icon name="X" className="h-5 w-5" />
        </button>
      </div>

      {/* Live preview */}
      <div className="mt-4 flex items-center gap-3 rounded-2xl bg-neutral-50 p-3">
        <BrandLogo brand={brand} size={56} />
        <div className="min-w-0">
          <strong className="block truncate font-display text-base font-black">
            {composedModel || t("notSet")}
          </strong>
          <span className="block truncate text-xs text-neutral-500">
            {t("licensePlateLabel")}: {plate.trim() || "—"}
          </span>
        </div>
      </div>

      {/* Brand picker */}
      <label className="mt-4 block text-sm font-semibold text-neutral-600">{t("brand")}</label>
      <div className="relative mt-1">
        <button
          type="button"
          onClick={() => setBrandOpen((openState) => !openState)}
          className="flex min-h-11 w-full items-center justify-between gap-2 rounded-2xl border border-black/10 bg-white px-3 text-left text-sm outline-none focus:border-wash-500"
        >
          <span className="flex min-w-0 items-center gap-2">
            {brand ? (
              <BrandLogo brand={brand} size={24} />
            ) : (
              <Icon name="Car" className="h-5 w-5 text-neutral-400" />
            )}
            <span className="truncate">{brand || t("selectBrand")}</span>
          </span>
          <Icon name="ChevronDown" className={cx("h-4 w-4 shrink-0 text-neutral-400 transition", brandOpen && "rotate-180")} />
        </button>
        {brandOpen ? (
          <ul className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-2xl border border-black/10 bg-white py-1 shadow-lg">
            {BRAND_NAMES.map((name) => (
              <li key={name}>
                <button
                  type="button"
                  onClick={() => {
                    setBrand(name);
                    setSeries("");
                    setBrandOpen(false);
                  }}
                  className={cx(
                    "flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-wash-50",
                    name === brand ? "bg-wash-50 font-bold text-wash-600" : ""
                  )}
                >
                  <BrandLogo brand={name} size={22} />
                  {name}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {/* Series / model */}
      <label className="mt-3 block text-sm font-semibold text-neutral-600">{t("seriesModel")}</label>
      <input
        value={series}
        onChange={(event) => setSeries(event.target.value)}
        placeholder={t("carModel")}
        className="mt-1 min-h-11 w-full rounded-2xl border border-black/10 bg-white px-3 text-sm outline-none focus:border-wash-500"
      />
      {models.length ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {models.map((model) => (
            <button
              key={model}
              type="button"
              onClick={() => setSeries(model)}
              className={cx(
                "rounded-full border px-2.5 py-1 text-xs font-semibold transition",
                series === model
                  ? "border-wash-500 bg-wash-50 text-wash-600"
                  : "border-black/10 text-neutral-600 hover:bg-neutral-50"
              )}
            >
              {model}
            </button>
          ))}
        </div>
      ) : null}

      {/* License plate */}
      <label className="mt-3 block text-sm font-semibold text-neutral-600">{t("licensePlate")}</label>
      <input
        value={plate}
        onChange={(event) => setPlate(event.target.value.toUpperCase())}
        placeholder={t("licensePlate")}
        className="mt-1 min-h-11 w-full rounded-2xl border border-black/10 bg-white px-3 text-sm outline-none focus:border-wash-500"
      />

      <div className="mt-5 flex items-center justify-end gap-2">
        <Button variant="ghost" onClick={onClose} className="min-h-10 px-4 text-sm">
          {t("cancel")}
        </Button>
        <Button onClick={save} disabled={saving} className="min-h-10 px-6 text-sm">
          {saving ? "…" : t("save")}
        </Button>
      </div>
    </Modal>
  );
}
