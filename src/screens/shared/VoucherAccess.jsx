import { Icon } from "../../components/ui/Icon.jsx";

export function VoucherAccess({ count, t, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="grid min-h-[74px] w-full grid-cols-[44px_1fr_24px] items-center gap-3 rounded-[18px] border border-black/10 bg-white p-3 text-left"
    >
      <span className="grid h-11 w-11 place-items-center rounded-xl bg-wash-50 text-wash-500">
        <Icon name="Gift" className="h-5 w-5" />
      </span>
      <span>
        <strong className="block">{t("currentVouchers")}</strong>
        <small className="mt-1 block text-neutral-500">{count} {t("voucherCount")}</small>
      </span>
      <Icon name="ArrowLeft" className="h-5 w-5 rotate-180 text-neutral-500" />
    </button>
  );
}
