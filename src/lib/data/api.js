// Thin data-access layer over the Supabase client: reference-catalog reads, the
// signed-in user's bookings/favourites/transactions, and the atomic RPC write
// wrappers. Every function takes the client explicitly (the AppProvider owns the
// singleton) and throws on error so callers can try/catch in one place.
import { adaptBooking, adaptPlan, adaptService, adaptShop } from "./adapters.js";
import { formatIsoLabel } from "../calendar.js";

function unwrap({ data, error }) {
  if (error) throw error;
  return data;
}

// ---- Reference catalog (public read) ---------------------------------------

export async function fetchCatalog(supabase) {
  const [shopsRes, servicesRes, plansRes] = await Promise.all([
    supabase
      .from("shops")
      .select("*, shop_services(service_id)")
      .eq("status", "approved"),
    supabase.from("services").select("*").order("price"),
    supabase.from("plans").select("*").order("price")
  ]);

  const shops = unwrap(shopsRes).map((row) =>
    adaptShop({ ...row, services: (row.shop_services ?? []).map((s) => s.service_id) })
  );
  const services = unwrap(servicesRes).map(adaptService);
  const plans = unwrap(plansRes).map(adaptPlan);
  return { shops, services, plans };
}

// ---- Per-user reads --------------------------------------------------------

export async function fetchBookings(supabase, userId) {
  const rows = unwrap(
    await supabase
      .from("bookings")
      .select("*, booking_services(service_id), shops(name)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
  );
  return rows.map((row) =>
    adaptBooking(
      {
        ...row,
        shop_name: row.shops?.name,
        services: (row.booking_services ?? []).map((s) => s.service_id)
      },
      formatIsoLabel(row.scheduled_date) || row.scheduled_date
    )
  );
}

export async function fetchFavorites(supabase, userId) {
  const rows = unwrap(
    await supabase.from("favorites").select("shop_id").eq("user_id", userId)
  );
  return rows.map((r) => r.shop_id);
}

export async function fetchTransactions(supabase, userId) {
  return unwrap(
    await supabase
      .from("wallet_transactions")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
  );
}

// ---- RPC write wrappers ----------------------------------------------------

export async function rpcTopUp(supabase, amount, note = "Wallet top-up") {
  return unwrap(await supabase.rpc("top_up", { p_amount: amount, p_note: note }));
}

export async function rpcCreateBooking(supabase, { shopId, date, slot, serviceIds, useVoucher }) {
  return unwrap(
    await supabase.rpc("create_booking", {
      p_shop_id: shopId,
      p_date: date,
      p_slot: slot,
      p_service_ids: serviceIds,
      p_use_voucher: Boolean(useVoucher)
    })
  );
}

export async function rpcUpdateBooking(supabase, { bookingId, date, slot, serviceIds }) {
  return unwrap(
    await supabase.rpc("update_booking", {
      p_booking_id: bookingId,
      p_date: date,
      p_slot: slot,
      p_service_ids: serviceIds
    })
  );
}

export async function rpcCancelBooking(supabase, bookingId) {
  return unwrap(await supabase.rpc("cancel_booking", { p_booking_id: bookingId }));
}

export async function addFavorite(supabase, userId, shopId) {
  return unwrap(
    await supabase.from("favorites").upsert(
      { user_id: userId, shop_id: shopId },
      { onConflict: "user_id,shop_id", ignoreDuplicates: true }
    )
  );
}

export async function removeFavorite(supabase, userId, shopId) {
  return unwrap(
    await supabase.from("favorites").delete().eq("user_id", userId).eq("shop_id", shopId)
  );
}
