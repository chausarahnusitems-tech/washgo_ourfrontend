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
  "open_time", "close_time", "max_cars_per_slot", "slot_minutes"
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

// Bookings made at the owner's shops (read-only — RLS grants select, not write).
// Customer identity isn't exposed (profiles RLS scopes to self), so we surface
// only the schedule/services/status.
export async function fetchOwnerBookings(supabase, shopIds) {
  if (!shopIds?.length) return [];
  const rows = unwrap(
    await supabase
      .from("bookings")
      .select("*, booking_services(service_id), shops(name)")
      .in("shop_id", shopIds)
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
    status: row.status ?? "upcoming"
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

export async function addCustomService(supabase, shopId, { name, price, isOffer }) {
  return unwrap(
    await supabase
      .from("shop_custom_services")
      .insert({ shop_id: shopId, name, price: Math.round(price), is_offer: Boolean(isOffer) })
      .select("*")
      .single()
  );
}

export async function removeCustomService(supabase, id) {
  return unwrap(await supabase.from("shop_custom_services").delete().eq("id", id));
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
    .select("*, shops(name)")
    .order("created_at", { ascending: false });
  if (kind) query = query.eq("kind", kind);
  const rows = unwrap(await query);

  const creatorIds = [...new Set(rows.map((r) => r.created_by).filter(Boolean))];
  let byId = {};
  if (creatorIds.length) {
    const people = unwrap(
      await supabase.from("profiles").select("id, full_name, email, role").in("id", creatorIds)
    );
    byId = Object.fromEntries(people.map((p) => [p.id, p]));
  }

  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    shopId: r.shop_id,
    shopName: r.shops?.name ?? null,
    createdBy: r.created_by ?? null,
    creatorName: byId[r.created_by]?.full_name ?? null,
    creatorEmail: byId[r.created_by]?.email ?? null,
    // Requester role lets the support inbox label a thread "Name · Customer/Owner".
    creatorRole: byId[r.created_by]?.role ?? null,
    status: r.status ?? "open",
    closedAt: r.closed_at ?? null,
    closedBy: r.closed_by ?? null,
    problemTags: r.problem_tags ?? [],
    createdAt: r.created_at
  }));
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
  return {
    url: `${pub.publicUrl}?t=${Date.now()}`,
    type: (file.type || "").startsWith("video/") ? "video" : "image"
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
