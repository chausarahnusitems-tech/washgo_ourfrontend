"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useApp } from "../lib/AppContext.jsx";
import { ShopCard } from "./ShopCard.jsx";
import { Button } from "./ui/Button.jsx";

/**
 * Global quick-view sheet driven by the `?quick=<shopId>` query param, so it can
 * float above any route (Home, Explore, …). Replaces the modal that used to be
 * inlined in App.jsx with a `quickShop` state field.
 */
export function QuickShopModal() {
  const { t, catalog } = useApp();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const quickId = searchParams.get("quick");
  const shop = quickId ? (catalog.shops ?? []).find((item) => item.id === quickId) : null;
  if (!shop) return null;

  const close = () => {
    const params = new URLSearchParams(searchParams);
    params.delete("quick");
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  const setQuick = (id) => {
    const params = new URLSearchParams(searchParams);
    params.set("quick", id);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const select = (id) => router.push(`/explore?shop=${id}`);
  const book = (id) => router.push(`/shops/${id}/book`);

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/35 p-4 lg:items-center">
      <div className="w-full max-w-[370px] rounded-[22px] bg-white p-3 shadow-device">
        <div className="mx-auto mb-3 h-1.5 w-11 rounded-full bg-neutral-200" />
        <ShopCard shop={shop} t={t} onSelect={select} onQuickView={setQuick} />
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Button variant="secondary" onClick={close}>{t("close")}</Button>
          <Button onClick={() => book(shop.id)}>{t("bookNow")}</Button>
        </div>
      </div>
    </div>
  );
}
