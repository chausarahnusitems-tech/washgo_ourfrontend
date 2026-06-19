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
      .select("*, shop_services(service_id), shop_photos(url, sort_order, is_cover)")
      .eq("status", "approved")
      .eq("published", true),
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
      // Hide unpaid card-checkout holds — they only become real bookings once the
      // PayOS webhook confirms them (pending_payment -> upcoming).
      .neq("status", "pending_payment")
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

export async function rpcCreateBooking(supabase, { shopId, date, slot, serviceIds, useVoucher, couponCode }) {
  return unwrap(
    await supabase.rpc("create_booking", {
      p_shop_id: shopId,
      p_date: date,
      p_slot: slot,
      p_service_ids: serviceIds,
      p_use_voucher: Boolean(useVoucher),
      p_coupon_code: couponCode || null
    })
  );
}

// Validate a promo/referral code against the readable coupons table (RLS allows
// public select). Returns { code, percent, amountOff, description } or null when
// the code is unknown or expired.
export async function fetchCoupon(supabase, code) {
  const clean = String(code ?? "").trim().toUpperCase();
  if (!clean) return null;
  const { data, error } = await supabase
    .from("coupons")
    .select("code, description, percent, amount_off, expires_at")
    .eq("code", clean)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  if (data.expires_at && new Date(data.expires_at) < new Date(new Date().toDateString())) return null;
  return {
    code: data.code,
    percent: data.percent ?? 0,
    amountOff: data.amount_off ?? 0,
    description: data.description ?? ""
  };
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

// ---- Shop owner reads/writes ----------------------------------------------
// The owner area binds forms directly to raw DB columns (starting_price,
// wait_minutes, status, …), so these functions deliberately DON'T run rows
// through adaptShop (which formats for the customer UI and computes distance).

// Columns an owner is allowed to write (mirrors the column grants in
// 20260612000600_owners_approval.sql). owner_id/status/rating/reviews_count are
// intentionally excluded — they move via RLS defaults, set_shop_status() and
// the reviews trigger respectively.
const SHOP_WRITE_COLUMNS = [
  "name", "district", "address", "phone", "starting_price", "wait_minutes",
  "hours", "is_open", "promo", "lat", "lng", "image_url", "image_position",
  // Phase 5: structured hours + per-slot capacity (published is RPC-only).
  "open_time", "close_time", "max_cars_per_slot", "slot_minutes",
  // Promo video URL is owner-writable; video_feature_until is RPC-gated (paid).
  "promo_video_url",
  // Per-weekday opening hours (jsonb).
  "weekly_hours"
];

function pickShopColumns(payload) {
  const out = {};
  for (const key of SHOP_WRITE_COLUMNS) {
    if (key in payload && payload[key] !== undefined) out[key] = payload[key];
  }
  return out;
}

function withServiceIds(row) {
  return {
    ...row,
    serviceIds: (row.shop_services ?? []).map((s) => s.service_id),
    // Custom services count too when deciding if a shop is publishable (a claimed
    // or applied shop's services land in shop_custom_services, not the catalogue).
    customServiceCount: (row.shop_custom_services ?? []).length
  };
}

function slugify(name) {
  const base = String(name ?? "")
    // Fold Vietnamese (and other) diacritics first so "Thảo Điền" -> "thao-dien"
    // instead of dropping the accented letters and leaving fragments.
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return base || "shop";
}

// All shops owned by this user (drafts/pending/approved/suspended — RLS scopes
// the rows). `created_at` desc puts the most recent edits on top.
export async function fetchOwnerShops(supabase, ownerId) {
  const rows = unwrap(
    await supabase
      .from("shops")
      .select("*, shop_services(service_id), shop_custom_services(id)")
      .eq("owner_id", ownerId)
      .order("created_at", { ascending: false })
  );
  return rows.map(withServiceIds);
}

export async function fetchOwnerShop(supabase, shopId) {
  const row = unwrap(
    await supabase
      .from("shops")
      .select("*, shop_services(service_id), shop_custom_services(id)")
      .eq("id", shopId)
      .single()
  );
  return withServiceIds(row);
}

// Create a shop. The `id` is a text PK with no DB default, so we generate a
// slug + random suffix and retry on the rare collision. The row lands in
// status='pending' (table default; status isn't grantable to clients), so we
// immediately move it to 'draft' — a half-finished shop shouldn't sit in the
// admin approval queue until the owner explicitly submits it.
export async function createShop(supabase, ownerId, payload) {
  const base = slugify(payload.name);
  let lastError = null;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const id = `${base}-${Math.random().toString(36).slice(2, 8)}`;
    const { data, error } = await supabase
      .from("shops")
      .insert({ id, owner_id: ownerId, ...pickShopColumns(payload) })
      .select("*, shop_services(service_id), shop_custom_services(id)")
      .single();
    if (!error) {
      await supabase.rpc("set_shop_status", { p_shop_id: id, p_status: "draft" });
      return withServiceIds({ ...data, status: "draft" });
    }
    if (error.code === "23505") {
      lastError = error; // unique_violation on the generated id — try another
      continue;
    }
    throw error;
  }
  throw lastError ?? new Error("Could not generate a unique shop id");
}

export async function updateShop(supabase, shopId, patch) {
  const row = unwrap(
    await supabase
      .from("shops")
      .update(pickShopColumns(patch))
      .eq("id", shopId)
      .select("*, shop_services(service_id), shop_custom_services(id)")
      .single()
  );
  return withServiceIds(row);
}

// RLS only permits deleting non-approved shops; the UI hides delete on approved.
export async function deleteShop(supabase, shopId) {
  return unwrap(await supabase.from("shops").delete().eq("id", shopId));
}

// Owners may only pass 'draft' or 'pending'; admins set any status. The RPC
// enforces this server-side.
export async function setShopStatus(supabase, shopId, status) {
  return unwrap(
    await supabase.rpc("set_shop_status", { p_shop_id: shopId, p_status: status })
  );
}

// Reconcile the shop_services join table to exactly `serviceIds`.
export async function setShopServices(supabase, shopId, serviceIds) {
  const current = unwrap(
    await supabase.from("shop_services").select("service_id").eq("shop_id", shopId)
  ).map((r) => r.service_id);
  const next = new Set(serviceIds);
  const toAdd = serviceIds.filter((id) => !current.includes(id));
  const toRemove = current.filter((id) => !next.has(id));
  if (toAdd.length) {
    unwrap(
      await supabase
        .from("shop_services")
        .insert(toAdd.map((service_id) => ({ shop_id: shopId, service_id })))
    );
  }
  if (toRemove.length) {
    unwrap(
      await supabase
        .from("shop_services")
        .delete()
        .eq("shop_id", shopId)
        .in("service_id", toRemove)
    );
  }
  return [...serviceIds];
}

// Upload a cover photo to the public shop-photos bucket under `<shopId>/...`
// (RLS namespaces writes by shop id) and point image_url at it. Mirrors
// uploadAvatar in AppContext.
export async function uploadShopPhoto(supabase, shopId, file) {
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `${shopId}/cover.${ext}`;
  const { error: uploadError } = await supabase.storage
    .from("shop-photos")
    .upload(path, file, { upsert: true, contentType: file.type });
  if (uploadError) throw uploadError;
  const { data: pub } = supabase.storage.from("shop-photos").getPublicUrl(path);
  const url = `${pub.publicUrl}?t=${Date.now()}`;
  return updateShop(supabase, shopId, { image_url: url });
}

// ---- Shop photo gallery (multiple images per shop) -------------------------

export async function fetchShopPhotos(supabase, shopId) {
  return unwrap(
    await supabase
      .from("shop_photos")
      .select("*")
      .eq("shop_id", shopId)
      .order("is_cover", { ascending: false })
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true })
  );
}

// Upload one gallery photo (distinct path per file so it never overwrites a
// previous one) and record it in shop_photos. The first photo a shop gets is
// auto-promoted to cover (and mirrored to shops.image_url for fast card reads).
export async function addShopPhoto(supabase, shopId, file) {
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const rand = Math.random().toString(36).slice(2, 10);
  const path = `${shopId}/gallery/${Date.now()}-${rand}.${ext}`;
  const { error: upErr } = await supabase.storage
    .from("shop-photos")
    .upload(path, file, { upsert: false, contentType: file.type });
  if (upErr) throw upErr;
  const { data: pub } = supabase.storage.from("shop-photos").getPublicUrl(path);
  const url = `${pub.publicUrl}?t=${Date.now()}`;

  const existing = await fetchShopPhotos(supabase, shopId);
  const isFirst = existing.length === 0;
  const row = unwrap(
    await supabase
      .from("shop_photos")
      .insert({ shop_id: shopId, url, sort_order: existing.length, is_cover: isFirst })
      .select("*")
      .single()
  );
  if (isFirst) await supabase.from("shops").update({ image_url: url }).eq("id", shopId);
  return row;
}

export async function removeShopPhoto(supabase, photoId) {
  return unwrap(await supabase.from("shop_photos").delete().eq("id", photoId));
}

// Promote one photo to cover: clear the flag on the rest, set it here, and mirror
// the url onto shops.image_url (the denormalised cover the cards read).
export async function setCoverPhoto(supabase, shopId, photoId, url) {
  await supabase.from("shop_photos").update({ is_cover: false }).eq("shop_id", shopId);
  unwrap(await supabase.from("shop_photos").update({ is_cover: true }).eq("id", photoId));
  return updateShop(supabase, shopId, { image_url: url });
}

// ---- Promo video (paid feature) -------------------------------------------

// Upload a promo video to the shop-videos bucket and point promo_video_url at it.
export async function uploadShopVideo(supabase, shopId, file) {
  const ext = (file.name.split(".").pop() || "mp4").toLowerCase();
  const path = `${shopId}/promo.${ext}`;
  const { error } = await supabase.storage
    .from("shop-videos")
    .upload(path, file, { upsert: true, contentType: file.type });
  if (error) throw error;
  const { data: pub } = supabase.storage.from("shop-videos").getPublicUrl(path);
  const url = `${pub.publicUrl}?t=${Date.now()}`;
  return updateShop(supabase, shopId, { promo_video_url: url });
}

// Buy/extend the paid promo-video feature (charges the owner's wallet).
export async function rpcBuyShopVideoFeature(supabase, shopId) {
  return unwrap(await supabase.rpc("buy_shop_video_feature", { p_shop_id: shopId }));
}

// Bookings made at the owner's shops (read-only — RLS grants select, not write).
// Customer identity isn't exposed (profiles RLS scopes to self), so we surface
// only the schedule/services/status.
export async function fetchOwnerBookings(supabase, shopIds) {
  if (!shopIds?.length) return [];
  const rows = unwrap(
    await supabase
      .from("bookings")
      .select("*, booking_services(service_id), shops(name), conversations(id)")
      .in("shop_id", shopIds)
      // Owners only see confirmed bookings, not unpaid card-checkout holds.
      .neq("status", "pending_payment")
      .order("scheduled_date", { ascending: false })
  );
  return rows.map((row) => ({
    id: row.id,
    shopId: row.shop_id,
    shop: row.shops?.name ?? row.shop_id,
    date: row.scheduled_date,
    time: row.slot_time,
    services: (row.booking_services ?? []).map((s) => s.service_id),
    total: row.total ?? 0,
    status: row.status ?? "upcoming",
    // The per-booking chat. [0] is safe: conversations_booking_id_key enforces at
    // most one conversation per booking. RLS-scoped to threads the owner can see.
    conversationId: row.conversations?.[0]?.id ?? null
  }));
}

// ---- Admin moderation ------------------------------------------------------
// Admins see every shop ("Admins can view all shops" RLS) and move status via
// set_shop_status (the admin branch permits any transition). Owner identity
// comes from a separate profiles read enabled by the admin profiles policy.

// All shops, optionally filtered to one status. Each row carries serviceIds and
// the owner's contact (email/name) for the review console.
export async function fetchAdminShops(supabase, status) {
  // The admin directory shows EVERY shop on the platform — partner shops (which
  // owners run / get moderated) and the imported info-only directory listings.
  let query = supabase
    .from("shops")
    .select("*, shop_services(service_id)")
    .order("updated_at", { ascending: false });
  if (status) query = query.eq("status", status);
  const rows = unwrap(await query).map(withServiceIds);

  // Join the owners in a second read (admins can view all profiles).
  const ownerIds = [...new Set(rows.map((r) => r.owner_id).filter(Boolean))];
  let ownersById = {};
  if (ownerIds.length) {
    const owners = unwrap(
      await supabase.from("profiles").select("id, email, full_name").in("id", ownerIds)
    );
    ownersById = Object.fromEntries(owners.map((o) => [o.id, o]));
  }
  return rows.map((row) => ({ ...row, owner: ownersById[row.owner_id] ?? null }));
}

// Counts per status for the admin dashboard badges.
export async function fetchAdminShopCounts(supabase) {
  const rows = unwrap(
    await supabase.from("shops").select("status").eq("listing_type", "partner")
  );
  return rows.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1;
    return acc;
  }, {});
}

// ---- Owner applications (admin) -------------------------------------------

// Customers who applied to run a car wash (owner_status='pending'). Readable by
// admins via the "Admins can view all profiles" policy.
export async function fetchOwnerApplications(supabase) {
  const rows = unwrap(
    await supabase
      .from("profiles")
      .select("id, email, full_name, owner_status, created_at")
      .eq("owner_status", "pending")
      .order("created_at", { ascending: true })
  );
  // People applying through a shop application (listing claim) are reviewed in
  // the Listing claims queue — keep them out of this one to avoid a duplicate
  // approval that would grant the owner role without setting up their shop.
  const claimRows = unwrap(
    await supabase.from("listing_claims").select("user_id").eq("status", "pending")
  );
  const claimUserIds = new Set(claimRows.map((r) => r.user_id));
  return rows.filter((r) => !claimUserIds.has(r.id));
}

// Admin decision on an application; 'approved' also grants the owner role.
export async function setOwnerStatus(supabase, userId, status) {
  return unwrap(
    await supabase.rpc("set_owner_status", { p_user_id: userId, p_status: status })
  );
}

// ---- Directory listings: claim / verification onboarding -------------------
// A directory listing (imported, info-only car wash) can be claimed by its real
// owner. They submit verification details (services + pricing, working hours, a
// location photo) which sit as a PENDING claim; an admin approves, which turns
// the listing into a partner shop they own (unpublished) and applies the
// details, after which the owner can release it publicly themselves.

// Upload a claim's location photo to the user-namespaced claim-photos bucket
// (<uid>/<shopId>) and return its public URL.
export async function uploadClaimPhoto(supabase, userId, shopId, file) {
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `${userId}/${shopId}.${ext}`;
  const { error } = await supabase.storage
    .from("claim-photos")
    .upload(path, file, { upsert: true, contentType: file.type });
  if (error) throw error;
  const { data: pub } = supabase.storage.from("claim-photos").getPublicUrl(path);
  return `${pub.publicUrl}?t=${Date.now()}`;
}

// Submit (or resubmit) a verification claim for an existing directory listing.
export async function submitListingClaim(supabase, shopId, details) {
  return unwrap(
    await supabase.rpc("submit_listing_claim", {
      p_shop_id: shopId,
      p_services: details.services ?? [],
      p_open: details.openTime || null,
      p_close: details.closeTime || null,
      p_hours: details.hours || null,
      p_phone: details.phone || null,
      p_photo_url: details.photoUrl || null,
      p_note: details.note || null,
      p_closed_dates: details.closedDates ?? []
    })
  );
}

// Apply for a brand-new shop that isn't on the map yet. Also registers the
// caller as a pending owner applicant (granted on approval).
export async function submitNewListing(supabase, details) {
  return unwrap(
    await supabase.rpc("submit_new_listing", {
      p_name: details.name,
      p_address: details.address || null,
      p_district: details.district || null,
      p_lat: details.lat ?? null,
      p_lng: details.lng ?? null,
      p_services: details.services ?? [],
      p_open: details.openTime || null,
      p_close: details.closeTime || null,
      p_hours: details.hours || null,
      p_phone: details.phone || null,
      p_photo_url: details.photoUrl || null,
      p_note: details.note || null,
      p_closed_dates: details.closedDates ?? []
    })
  );
}

// The signed-in user's own claim for a shop (RLS scopes the read to self), or
// null if they haven't claimed it.
export async function fetchMyListingClaim(supabase, shopId) {
  const rows = unwrap(
    await supabase.from("listing_claims").select("*").eq("shop_id", shopId).limit(1)
  );
  return rows[0] ?? null;
}

// Pending claims for admin review, with the shop and claimant contact joined.
export async function fetchListingClaims(supabase) {
  const rows = unwrap(
    await supabase
      .from("listing_claims")
      .select("*, shops(name, district, address)")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
  );
  const userIds = [...new Set(rows.map((r) => r.user_id).filter(Boolean))];
  let byId = {};
  if (userIds.length) {
    const claimers = unwrap(
      await supabase.from("profiles").select("id, email, full_name").in("id", userIds)
    );
    byId = Object.fromEntries(claimers.map((c) => [c.id, c]));
  }
  return rows.map((r) => ({
    ...r,
    shop: r.shops ?? null,
    claimer: byId[r.user_id] ?? null
  }));
}

// Admin decisions. Approve converts the listing into an owned partner shop and
// applies the submitted details; reject leaves the directory listing as-is.
export async function approveListingClaim(supabase, claimId) {
  return unwrap(await supabase.rpc("approve_listing_claim", { p_claim_id: claimId }));
}

export async function rejectListingClaim(supabase, claimId) {
  return unwrap(await supabase.rpc("reject_listing_claim", { p_claim_id: claimId }));
}

// ---- Shop scheduling: publish, slot overrides, custom services -------------

// Release publicly / unpublish. Gated server-side: publishing needs an approved
// shop.
export async function setShopPublished(supabase, shopId, published) {
  return unwrap(
    await supabase.rpc("set_shop_published", { p_shop_id: shopId, p_published: published })
  );
}

export async function fetchSlotOverrides(supabase, shopId) {
  return unwrap(
    await supabase
      .from("shop_slot_overrides")
      .select("*")
      .eq("shop_id", shopId)
      .order("date", { ascending: true })
  );
}

// Upsert one special-day override (closed, or a custom per-slot cap).
export async function setSlotOverride(supabase, shopId, date, { isClosed, maxCars }) {
  return unwrap(
    await supabase
      .from("shop_slot_overrides")
      .upsert(
        {
          shop_id: shopId,
          date,
          is_closed: Boolean(isClosed),
          max_cars_per_slot: maxCars ?? null
        },
        { onConflict: "shop_id,date" }
      )
  );
}

export async function deleteSlotOverride(supabase, shopId, date) {
  return unwrap(
    await supabase.from("shop_slot_overrides").delete().eq("shop_id", shopId).eq("date", date)
  );
}

export async function fetchCustomServices(supabase, shopId) {
  return unwrap(
    await supabase
      .from("shop_custom_services")
      .select("*")
      .eq("shop_id", shopId)
      .order("created_at", { ascending: true })
  );
}

export async function addCustomService(supabase, shopId, { name, price, isOffer, imageUrl }) {
  return unwrap(
    await supabase
      .from("shop_custom_services")
      .insert({
        shop_id: shopId,
        name,
        price: Math.round(price),
        is_offer: Boolean(isOffer),
        image_url: imageUrl ?? null
      })
      .select("*")
      .single()
  );
}

// Patch an existing custom service (e.g. attach/replace its image).
export async function updateCustomService(supabase, id, patch) {
  const allowed = {};
  if ("name" in patch) allowed.name = patch.name;
  if ("price" in patch) allowed.price = Math.round(patch.price);
  if ("isOffer" in patch) allowed.is_offer = Boolean(patch.isOffer);
  if ("imageUrl" in patch) allowed.image_url = patch.imageUrl ?? null;
  return unwrap(
    await supabase.from("shop_custom_services").update(allowed).eq("id", id).select("*").single()
  );
}

export async function removeCustomService(supabase, id) {
  return unwrap(await supabase.from("shop_custom_services").delete().eq("id", id));
}

// Upload a per-service image to the shop-photos bucket under
// '<shopId>/services/<serviceId>.<ext>' (covered by the bucket's owner RLS) and
// return its public URL.
export async function uploadServiceImage(supabase, shopId, serviceId, file) {
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `${shopId}/services/${serviceId}.${ext}`;
  const { error } = await supabase.storage
    .from("shop-photos")
    .upload(path, file, { upsert: true, contentType: file.type });
  if (error) throw error;
  const { data: pub } = supabase.storage.from("shop-photos").getPublicUrl(path);
  return `${pub.publicUrl}?t=${Date.now()}`;
}

// Per-slot availability for a shop+date (counts + cap + closed). RLS-safe RPC.
export async function fetchSlotAvailability(supabase, shopId, date) {
  return unwrap(
    await supabase.rpc("slot_availability", { p_shop_id: shopId, p_date: date })
  );
}

// ---- Chat (customer / owner / admin) --------------------------------------

// Find-or-create a thread (kind 'shop' needs a shopId; 'support' doesn't).
// `tags` are the predefined problem-tag slugs to stamp on a NEW support thread
// (ignored when an existing thread is found). Always sent so PostgREST resolves
// the 3-arg open_conversation.
export async function openConversation(supabase, kind, shopId = null, tags = []) {
  return unwrap(
    await supabase.rpc("open_conversation", {
      p_kind: kind,
      p_shop_id: shopId,
      p_tags: tags
    })
  );
}

// Admin: open (find-or-create) a specific user's support thread, e.g. to message
// an applicant about a verification visit.
export async function openSupportThread(supabase, userId) {
  return unwrap(await supabase.rpc("open_support_thread", { p_user_id: userId }));
}

// Conversations the signed-in user can see (RLS-scoped: their threads, or all
// for admins). `kind` optionally filters (e.g. admin support inbox). The thread
// creator's name/email is joined so the admin can see WHO each support thread is
// with (admins can read all profiles; for non-admins this resolves to self only,
// which is fine — they label support threads as "Support" anyway).
export async function fetchConversations(supabase, kind = null) {
  let query = supabase
    .from("conversations")
    // conversation_reads is RLS-scoped to the caller, so the embed resolves to
    // the caller's own read mark (0 or 1 row) per conversation. bookings() (via
    // booking_id) carries the session a per-booking thread is about.
    .select("*, shops(name), conversation_reads(last_read_at), bookings(scheduled_date, slot_time)")
    .order("created_at", { ascending: false });
  if (kind) query = query.eq("kind", kind);
  const rows = unwrap(await query);

  // Drop conversations the caller hid from their own list ("delete for me"). The
  // hidden rows are RLS-scoped to the caller, so this select returns only theirs.
  const hiddenRows = unwrap(await supabase.from("conversation_hidden").select("conversation_id"));
  const hiddenSet = new Set(hiddenRows.map((h) => h.conversation_id));
  const visible = rows.filter((r) => !hiddenSet.has(r.id));

  const creatorIds = [...new Set(visible.map((r) => r.created_by).filter(Boolean))];
  let byId = {};
  if (creatorIds.length) {
    const people = unwrap(
      await supabase.from("profiles").select("id, full_name, email, role").in("id", creatorIds)
    );
    byId = Object.fromEntries(people.map((p) => [p.id, p]));
  }

  return visible.map((r) => mapConversationRow(r, byId[r.created_by]));
}

// Shape one conversation row (+ its creator profile) into the UI object. Shared
// by the list fetch and the single-conversation fetch so they stay in sync.
// `person` is the created_by profile ({full_name,email,role}) or undefined.
function mapConversationRow(r, person) {
  // RLS scopes conversation_reads to the caller (0/1 row), but don't depend on
  // that positionally — take the latest read mark across whatever rows return.
  const lastReadAt = (r.conversation_reads ?? []).reduce(
    (acc, x) => (x?.last_read_at && (!acc || x.last_read_at > acc) ? x.last_read_at : acc),
    null
  );
  const lastMessageAt = r.last_message_at ?? null;
  // Unread = there's a message and the caller's read mark is older (or missing).
  // The caller's own sends mark the thread read, so this lights up only for new
  // messages from the other party.
  const unread = Boolean(lastMessageAt) && (!lastReadAt || new Date(lastMessageAt) > new Date(lastReadAt));
  return {
    id: r.id,
    kind: r.kind,
    shopId: r.shop_id,
    shopName: r.shops?.name ?? null,
    createdBy: r.created_by ?? null,
    creatorName: person?.full_name ?? null,
    creatorEmail: person?.email ?? null,
    // Requester role lets the support inbox label a thread "Name · Customer/Owner".
    creatorRole: person?.role ?? null,
    status: r.status ?? "open",
    closedAt: r.closed_at ?? null,
    closedBy: r.closed_by ?? null,
    archivedAt: r.archived_at ?? null,
    archived: Boolean(r.archived_at),
    problemTags: r.problem_tags ?? [],
    createdAt: r.created_at,
    lastMessageAt,
    lastMessagePreview: r.last_message_preview ?? null,
    lastReadAt,
    unread,
    // Per-booking shop threads carry the booked session (null for other threads).
    bookingId: r.booking_id ?? null,
    bookingDate: r.bookings?.scheduled_date ?? null,
    bookingSlot: r.bookings?.slot_time ?? null
  };
}

// Fetch one conversation by id (RLS-scoped). Used to open a thread via a deep
// link (e.g. from the reviews page) even when it isn't in the current filtered
// list — admins can thus open a shop chat from a review. Returns null if the
// caller can't see it.
export async function fetchConversation(supabase, conversationId) {
  const { data, error } = await supabase
    .from("conversations")
    .select("*, shops(name), conversation_reads(last_read_at), bookings(scheduled_date, slot_time)")
    .eq("id", conversationId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  let person = null;
  if (data.created_by) {
    const { data: p } = await supabase
      .from("profiles")
      .select("id, full_name, email, role")
      .eq("id", data.created_by)
      .maybeSingle();
    person = p ?? null;
  }
  return mapConversationRow(data, person);
}

// For a shop owner messaging a customer: resolve the customer's name/phone for a
// booking thread they own the shop of (profiles RLS is self-only, so this goes
// through a SECURITY DEFINER RPC). Returns { full_name, phone } | null.
export async function fetchConversationCustomer(supabase, conversationId) {
  return unwrap(
    await supabase.rpc("get_conversation_customer", { p_conv: conversationId })
  );
}

export async function fetchMessages(supabase, conversationId) {
  return unwrap(
    await supabase
      .from("messages")
      .select("id, sender_id, body, attachment_url, attachment_type, created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
  );
}

// Mark the caller's read position in a thread to now() (clears its unread flag).
// Called when a thread is opened/viewed and after the caller sends.
export async function markConversationRead(supabase, conversationId) {
  return unwrap(await supabase.rpc("mark_conversation_read", { p_conv: conversationId }));
}

// Send a text and/or attachment message. `attachment` is { url, type } | null;
// body coalesces to '' so an attachment-only message still satisfies the
// NOT NULL body column.
export async function sendMessage(supabase, conversationId, senderId, body, attachment = null) {
  return unwrap(
    await supabase
      .from("messages")
      .insert({
        conversation_id: conversationId,
        sender_id: senderId,
        body: body ?? "",
        attachment_url: attachment?.url ?? null,
        attachment_type: attachment?.type ?? null
      })
      .select("id, sender_id, body, attachment_url, attachment_type, created_at")
      .single()
  );
}

// Upload a chat attachment to the public 'chat-attachments' bucket under
// <conversationId>/<uid>/<file> (the storage RLS keys off those path segments).
// Returns { url, type } ready to pass to sendMessage. A timestamped filename
// keeps each upload distinct (no upsert overwrite).
export async function uploadChatAttachment(supabase, conversationId, uid, file) {
  const safeName = (file.name || "file").replace(/[^\w.\-]/g, "_");
  const path = `${conversationId}/${uid}/${Date.now()}-${safeName}`;
  const { error } = await supabase.storage
    .from("chat-attachments")
    .upload(path, file, { upsert: false, contentType: file.type });
  if (error) throw error;
  const { data: pub } = supabase.storage.from("chat-attachments").getPublicUrl(path);
  const mime = file.type || "";
  return {
    url: `${pub.publicUrl}?t=${Date.now()}`,
    type: mime.startsWith("audio/") ? "audio" : mime.startsWith("video/") ? "video" : "image"
  };
}

// Close a thread (requester, shop owner participant, or admin). Idempotent.
export async function closeConversation(supabase, conversationId) {
  return unwrap(
    await supabase.rpc("close_conversation", { p_conv: conversationId })
  );
}

// Upsert the caller's review of a (closed) conversation. RLS enforces non-admin
// participant + closed thread + self.
export async function submitConversationReview(supabase, conversationId, userId, rating, comment) {
  return unwrap(
    await supabase
      .from("conversation_reviews")
      .upsert(
        { conversation_id: conversationId, user_id: userId, rating, comment: comment || null },
        { onConflict: "conversation_id,user_id" }
      )
      .select("id, rating, comment, created_at")
      .single()
  );
}

// The caller's existing review for a thread (to prefill / avoid re-prompting),
// or null if they haven't reviewed yet.
export async function fetchConversationReview(supabase, conversationId, userId) {
  const { data, error } = await supabase
    .from("conversation_reviews")
    .select("id, rating, comment, created_at")
    .eq("conversation_id", conversationId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

// Archive / unarchive a thread (reversible). RLS-RPC: admin or creator only.
export async function setConversationArchived(supabase, conversationId, archived) {
  return unwrap(
    await supabase.rpc("set_conversation_archived", { p_conv: conversationId, p_archived: archived })
  );
}

// Hide a thread from the caller's own list ("delete for me"). Non-destructive —
// the thread, messages and review stay for the other party and for records.
export async function hideConversation(supabase, conversationId) {
  return unwrap(await supabase.rpc("hide_conversation", { p_conv: conversationId }));
}

// Hard purge ("delete for everyone"): admin-only, and the RPC refuses when a
// review exists. Cascades messages/participants when allowed.
export async function deleteConversation(supabase, conversationId) {
  return unwrap(await supabase.rpc("delete_conversation", { p_conv: conversationId }));
}

// All conversation reviews the caller may read (RLS-scoped): admins see every
// review; owners see reviews on the shop chats they participate in. Joins the
// conversation (kind/shop/tags) and resolves reviewer identity via a second
// profiles read (no direct FK to profiles, same pattern as fetchConversations).
export async function fetchConversationReviews(supabase) {
  const rows = unwrap(
    await supabase
      .from("conversation_reviews")
      .select(
        "id, rating, comment, created_at, user_id, " +
          "conversations(id, kind, shop_id, problem_tags, created_at, closed_at, shops(name))"
      )
      .order("created_at", { ascending: false })
  );

  const reviewerIds = [...new Set(rows.map((r) => r.user_id).filter(Boolean))];
  let byId = {};
  if (reviewerIds.length) {
    const people = unwrap(
      await supabase.from("profiles").select("id, full_name, email, role").in("id", reviewerIds)
    );
    byId = Object.fromEntries(people.map((p) => [p.id, p]));
  }

  return rows.map((r) => ({
    id: r.id,
    rating: r.rating,
    comment: r.comment ?? null,
    createdAt: r.created_at,
    reviewerId: r.user_id,
    reviewerName: byId[r.user_id]?.full_name ?? null,
    reviewerEmail: byId[r.user_id]?.email ?? null,
    reviewerRole: byId[r.user_id]?.role ?? null,
    conversationId: r.conversations?.id ?? null,
    kind: r.conversations?.kind ?? null,
    shopId: r.conversations?.shop_id ?? null,
    shopName: r.conversations?.shops?.name ?? null,
    problemTags: r.conversations?.problem_tags ?? []
  }));
}

// Report a shop chat to the admins. Either participant (customer or owner) may
// file; the RPC re-checks kind ('shop') + participation and collapses repeat
// reports into the caller's existing open one. `reason` is optional free text.
export async function reportConversation(supabase, conversationId, reason = "") {
  return unwrap(
    await supabase.rpc("report_conversation", { p_conv: conversationId, p_reason: reason || null })
  );
}

// All conversation reports the caller may read (RLS-scoped: admins see every
// report). Joins the reported shop chat and resolves the reporter's identity via
// a second profiles read (same pattern as fetchConversationReviews).
export async function fetchConversationReports(supabase) {
  const rows = unwrap(
    await supabase
      .from("conversation_reports")
      .select(
        "id, reason, status, created_at, reported_by, " +
          "conversations(id, kind, shop_id, created_at, shops(name))"
      )
      .order("created_at", { ascending: false })
  );

  const reporterIds = [...new Set(rows.map((r) => r.reported_by).filter(Boolean))];
  let byId = {};
  if (reporterIds.length) {
    const people = unwrap(
      await supabase.from("profiles").select("id, full_name, email, role").in("id", reporterIds)
    );
    byId = Object.fromEntries(people.map((p) => [p.id, p]));
  }

  return rows.map((r) => ({
    id: r.id,
    reason: r.reason ?? null,
    status: r.status ?? "open",
    createdAt: r.created_at,
    reporterId: r.reported_by,
    reporterName: byId[r.reported_by]?.full_name ?? null,
    reporterEmail: byId[r.reported_by]?.email ?? null,
    reporterRole: byId[r.reported_by]?.role ?? null,
    conversationId: r.conversations?.id ?? null,
    shopName: r.conversations?.shops?.name ?? null
  }));
}

// Admin: flip a report between 'open' and 'resolved'. RLS-RPC is admin-only.
export async function setReportStatus(supabase, reportId, status) {
  return unwrap(
    await supabase.rpc("set_report_status", { p_report: reportId, p_status: status })
  );
}
