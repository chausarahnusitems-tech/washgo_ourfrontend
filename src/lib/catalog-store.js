// Module-level catalog store so the pure helpers in booking.js (getCurrentShop,
// getShopById, getVisibleShops, getSelectedServices, getSubtotal, …) can read
// the LIVE catalog without changing their signatures or every call site.
//
// It defaults to the hardcoded catalog.js seed, so server render, the first
// client paint, and demo mode all behave exactly as before. In backend mode the
// AppProvider fetches the DB catalog and calls setCatalog(); React components
// re-render via context (which also holds the catalog), and these helpers then
// compute against the fresh data.
import {
  plans as seedPlans,
  services as seedServices,
  shops as seedShops
} from "../data/catalog.js";

let current = { shops: seedShops, services: seedServices, plans: seedPlans };

export function setCatalog(next) {
  current = {
    shops: next?.shops ?? current.shops,
    services: next?.services ?? current.services,
    plans: next?.plans ?? current.plans
  };
}

export function getCatalog() {
  return current;
}
